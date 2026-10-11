import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const requestedId = Number(process.argv[2]);
  if (!Number.isSafeInteger(requestedId) || requestedId <= 0) {
    throw new Error("Usage: npm run sync:match-details -- <KickOff MatchID or ApiFixtureID>");
  }

  const { pool, initializeDatabase } = require("../src/db") as typeof import("../src/db");
  try {
    await initializeDatabase();
    const result = await pool.query(`SELECT MatchID, ApiFixtureID, ApiStatus
      FROM Match WHERE MatchID = $1::bigint OR ApiFixtureID = $1::bigint
      ORDER BY CASE WHEN ApiFixtureID = $1::bigint THEN 0 ELSE 1 END LIMIT 1`, [requestedId]);
    const row = result.rows[0];
    if (!row?.apifixtureid) throw new Error(`Match ${requestedId} has no verified provider mapping.`);
    const fixtureId = Number(row.apifixtureid);
    let updated = false;
    let provider = "";
    let providerFixtureId = fixtureId;
    if (fixtureId >= 7_000_000_000_000 && fixtureId < 8_000_000_000_000) {
      const { syncFootballDataMatchDetails } = require("../src/services/footballDataClient") as typeof import("../src/services/footballDataClient");
      provider = "football-data.org";
      providerFixtureId = fixtureId - 7_000_000_000_000;
      updated = await syncFootballDataMatchDetails(fixtureId, true);
    } else if (fixtureId >= 8_000_000_000_000 && fixtureId < 9_000_000_000_000) {
      const { syncSportsDbMatchDetails } = require("../src/services/sportsDbClient") as typeof import("../src/services/sportsDbClient");
      provider = "TheSportsDB";
      providerFixtureId = fixtureId - 8_000_000_000_000;
      updated = await syncSportsDbMatchDetails(fixtureId, row.apistatus ?? "UPCOMING", true);
    } else {
      throw new Error("Forced refresh is supported for mapped football-data.org and TheSportsDB matches only.");
    }

    const { pullMatchDetailsFromDatabase } = require("../src/services/matchPipelineService") as typeof import("../src/services/matchPipelineService");
    const match = await pullMatchDetailsFromDatabase(requestedId);
    console.log(JSON.stringify({
      requestedId,
      databaseMatchId: Number(row.matchid),
      provider,
      providerFixtureId,
      updated,
      venue: match?.fixture.venue?.name ?? null,
      referees: match?.fixture.referees ?? [],
      eventCount: match?.events.length ?? 0,
      lineupPlayers: match?.lineups.reduce((count: number, team: any) => count + team.starters.length + team.substitutes.length, 0) ?? 0,
      coaches: match?.lineups.filter((team: any) => team.coach?.name).length ?? 0,
    }));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
