import dotenv from "dotenv";
import path from "path";
import { initializeDatabase, pool } from "../src/db";
import { getApiFootballBudgetReport, reconcileApiFootballQuota } from "../src/services/apiFootballClient";
import { getMissingDetailCategories } from "../src/services/providerCapabilities";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const detailEndpoints = ["events", "lineups", "players", "statistics"] as const;
const UPCOMING_STATUSES = new Set(["NS", "TIMED", "TBD", "SCHEDULED", "UPCOMING"]);
type PlannedRequest = {
  endpoint: typeof detailEndpoints[number];
  category: string;
  cacheStatus: "missing" | "stale";
  cacheAgeMs: number | null;
};
type PlannedMatch = {
  matchId: number;
  fixtureId: number;
  teams: string;
  status: string | null;
  missingFields: string[];
  requests: PlannedRequest[];
};

async function getDryRunReport() {
  const budget = await getApiFootballBudgetReport();
  const result = await pool.query(`
    SELECT m.MatchID, m.ApiFixtureID, m.ApiStatus, m.MatchDate,
      m.VenueID, m.HomeGoals, m.AwayGoals,
      home.Name AS HomeTeam, away.Name AS AwayTeam,
      (SELECT COUNT(*)::int FROM Event e WHERE e.MatchID = m.MatchID) AS EventCount,
      (SELECT COUNT(*)::int FROM Lineup l WHERE l.MatchID = m.MatchID AND l.Status = 'Starter') AS StarterCount,
      (SELECT COUNT(*)::int FROM Lineup l WHERE l.MatchID = m.MatchID AND l.Status = 'Sub') AS SubstituteCount,
      (SELECT COUNT(*)::int FROM PlayerMatchStat s WHERE s.MatchID = m.MatchID) AS PlayerStatCount,
      (SELECT COUNT(*)::int FROM MatchOfficiating mo WHERE mo.MatchID = m.MatchID) AS RefereeCount
    FROM Match m
    JOIN Team home ON home.TeamID = m.HomeTeamID
    JOIN Team away ON away.TeamID = m.AwayTeamID
    WHERE m.ApiFixtureID > 0 AND m.ApiFixtureID < 7000000000000
    ORDER BY m.MatchDate DESC
    LIMIT 100
  `);
  const planned: PlannedMatch[] = [];
  const total = new Set<string>();
  for (const row of result.rows) {
    const fixtureId = Number(row.apifixtureid);
    const cached = await pool.query(`SELECT Endpoint, Payload, FetchedAt FROM MatchApiCache
      WHERE MatchID = $1 AND Endpoint = ANY($2::varchar[])`, [fixtureId, detailEndpoints]);
    const cache = new Map(cached.rows.map((entry) => [entry.endpoint, entry]));
    const matchLike = {
      fixture: { venue: row.venueid ? { name: "present" } : null, referees: row.refereecount ? ["present"] : [],
        status: { short: UPCOMING_STATUSES.has(String(row.apistatus).toUpperCase()) ? "UPCOMING" : row.apistatus } },
      events: Number(row.eventcount) ? [{}] : [],
      lineups: [{ starters: Array(Number(row.startercount)), substitutes: Array(Number(row.substitutecount)), coach: { name: null } }],
      playerStatistics: Array(Number(row.playerstatcount)),
      teamStatistics: null,
      headToHead: [],
    };
    const missing = getMissingDetailCategories(matchLike);
    const endpoints: PlannedRequest[] = [];
    const addEndpoint = (endpoint: typeof detailEndpoints[number], category: string) => {
      const entry = cache.get(endpoint);
      const ageMs = entry ? Date.now() - new Date(entry.fetchedat).getTime() : null;
      const hasData = Array.isArray(entry?.payload) && entry.payload.length > 0;
      const live = row.apistatus === "LIVE";
      const ttlMs = endpoint === "events" ? (live ? 2 : hasData ? 30 * 24 : 6) * 60 * 60_000
        : endpoint === "lineups" ? (hasData ? 30 : 12) * 24 * 60 * 60_000
          : endpoint === "players" || endpoint === "statistics" ? (live ? (hasData ? 5 : 2) * 60_000 : (hasData ? 30 : 12) * 24 * 60 * 60_000)
            : 0;
      const status = !entry ? "missing" : ageMs != null && ageMs < ttlMs ? (hasData ? "cached" : "negative-cache") : "stale";
      if (status === "missing" || status === "stale") {
        endpoints.push({ endpoint, category, cacheStatus: status, cacheAgeMs: ageMs });
        total.add(`${fixtureId}:${endpoint}`);
      }
    };

    if (missing.includes("events") && !UPCOMING_STATUSES.has(String(row.apistatus).toUpperCase())) addEndpoint("events", "events");
    if (missing.some((item) => ["lineups", "coaches", "substitutes"].includes(item))) addEndpoint("lineups", "lineups/coaches/substitutes");
    if (!UPCOMING_STATUSES.has(String(row.apistatus).toUpperCase())) {
      if (!Number(row.playerstatcount)) addEndpoint("players", "player statistics and ratings");
      addEndpoint("statistics", "team statistics");
    }
    if (endpoints.length) planned.push({
      matchId: Number(row.matchid), fixtureId, teams: `${row.hometeam} vs ${row.awayteam}`,
      status: row.apistatus, missingFields: missing, requests: endpoints,
    });
  }
  return {
    mode: "dry-run",
    providerCallsMade: 0,
    verifiedApiFootballFixtureIds: result.rows.map((row) => Number(row.apifixtureid)),
    matchesNeedingRefresh: planned,
    estimatedRequestsIfAllPlannedRun: total.size,
    budget,
  };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  await initializeDatabase();
  if (command === "report" && args.includes("--dry-run")) {
    const report = await getDryRunReport();
    const output = args.includes("--summary") ? {
      mode: report.mode,
      providerCallsMade: report.providerCallsMade,
      verifiedFixtureCount: report.verifiedApiFootballFixtureIds.length,
      matchesNeedingRefresh: report.matchesNeedingRefresh.length,
      estimatedRequestsIfAllPlannedRun: report.estimatedRequestsIfAllPlannedRun,
      budget: report.budget,
    } : report;
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  if (command === "reconcile") {
    const remainingText = args[0];
    const limitText = args[1];
    if (!args.includes("--account-active") || !args.includes("--dashboard-verified")) {
      throw new Error("Confirm the account is active and reconcile quota against the official dashboard, then include --account-active --dashboard-verified");
    }
    const verificationIndex = args.indexOf("--verified-at");
    const verifiedAt = verificationIndex >= 0 ? args[verificationIndex + 1] : undefined;
    const remaining = Number(remainingText);
    const limit = Number(limitText);
    await reconcileApiFootballQuota({ remaining, limit, accountVerified: true, accountActive: true, dashboardVerified: true, verifiedAt });
    console.log("API-Football quota snapshot recorded; the rolling application budget remains capped at 80 requests per 24 hours.");
    return;
  }
  if (command === "report") {
    console.log(JSON.stringify(await getApiFootballBudgetReport(), null, 2));
    return;
  }
  throw new Error("Usage: npm run api-football:admin -- report [--dry-run] | reconcile <remaining> <limit> --account-active --dashboard-verified --verified-at <ISO timestamp>");
}

main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
}).finally(() => pool.end());
