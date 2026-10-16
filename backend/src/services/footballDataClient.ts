import { pool } from "../db";
import { syncFixtureToDb } from "./footballService";

const API_BASE = "https://api.football-data.org/v4";
// Keep this provider's IDs in their own numeric namespace in the existing BIGINT column.
const ID_OFFSET = 7_000_000_000_000;
const REQUEST_INTERVAL_MS = 6_100;
const RANGE_CACHE_TTL_MS = 15 * 60_000;
const RATE_LIMIT_ENDPOINT = "fd-rate-limit";
const RATE_LIMIT_LOCK_ID = 7_004_210;
const requestInFlight = new Map<string, Promise<Response>>();
let requestQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

type FootballDataTeam = {
  id: number;
  name: string;
  crest?: string | null;
  coach?: { id?: number; name?: string } | null;
  formation?: string | null;
  lineup?: Array<{ id?: number; name?: string; position?: string | null; shirtNumber?: number | null }>;
  bench?: Array<{ id?: number; name?: string; position?: string | null; shirtNumber?: number | null }>;
};

type FootballDataMatch = {
  id: number;
  utcDate: string;
  status: string;
  matchday?: number | null;
  minute?: number | null;
  stage?: string | null;
  competition?: { id: number; name: string; area?: { name?: string }; season?: { startDate?: string } };
  homeTeam: FootballDataTeam;
  awayTeam: FootballDataTeam;
  score?: {
    fullTime?: { home?: number | null; away?: number | null };
    halfTime?: { home?: number | null; away?: number | null };
  };
  venue?: string | null;
  referees?: Array<{ name?: string; type?: string }>;
  goals?: Array<{ minute?: number; injuryTime?: number | null; team?: { id?: number; name?: string }; scorer?: { id?: number; name?: string }; assist?: { id?: number; name?: string } | null; type?: string }>;
  bookings?: Array<{ minute?: number; injuryTime?: number | null; team?: { id?: number; name?: string }; player?: { id?: number; name?: string }; card?: string }>;
  substitutions?: Array<{ minute?: number; injuryTime?: number | null; team?: { id?: number; name?: string }; playerOut?: { id?: number; name?: string }; playerIn?: { id?: number; name?: string } }>;
};

async function requestFootballData(url: string, token: string): Promise<Response> {
  const existing = requestInFlight.get(url);
  if (existing) return existing;
  const request = requestQueue.then(async () => {
    const client = await pool.connect();
    let locked = false;
    let state: Record<string, any> = {};
    let slotAt = Date.now();
    let nextAllowedAt = 0;
    try {
      await client.query("SELECT pg_advisory_lock($1)", [RATE_LIMIT_LOCK_ID]);
      locked = true;
      const stateResult = await client.query("SELECT Payload FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = $1", [RATE_LIMIT_ENDPOINT]);
      state = stateResult.rows[0]?.payload ?? {};
      const cooldownUntil = state.cooldownUntil ? new Date(state.cooldownUntil).getTime() : 0;
      if (cooldownUntil > Date.now()) {
        throw new Error(`football-data.org cooldown active until ${new Date(cooldownUntil).toISOString()}`);
      }
      const persistedNext = state.nextAllowedAt ? new Date(state.nextAllowedAt).getTime() : 0;
      slotAt = Math.max(Date.now(), lastRequestAt + REQUEST_INTERVAL_MS, persistedNext);
      nextAllowedAt = slotAt + REQUEST_INTERVAL_MS;
      await persistFootballDataState({ ...state, nextAllowedAt: new Date(nextAllowedAt).toISOString() }, client);
    } finally {
      if (locked) await client.query("SELECT pg_advisory_unlock($1)", [RATE_LIMIT_LOCK_ID]);
      client.release();
    }

    const delay = Math.max(0, slotAt - Date.now());
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "X-Auth-Token": token },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
    } finally {
      lastRequestAt = Date.now();
    }

    if (response.status === 429 || response.status >= 500) {
      const completionClient = await pool.connect();
      let completionLocked = false;
      try {
        await completionClient.query("SELECT pg_advisory_lock($1)", [RATE_LIMIT_LOCK_ID]);
        completionLocked = true;
        const latestResult = await completionClient.query("SELECT Payload FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = $1", [RATE_LIMIT_ENDPOINT]);
        const latest = latestResult.rows[0]?.payload ?? state;
        const failures = Math.min(Number(latest.failures ?? 0) + 1, 6);
        const fallbackMs = Math.min(60_000 * 2 ** (failures - 1), 30 * 60_000);
        const retry = response.headers.get("retry-after");
        const retrySeconds = Number(retry);
        const retryDate = retry && !Number.isFinite(retrySeconds) ? Date.parse(retry) : NaN;
        const cooldownMs = Math.max(60_000, Number.isFinite(retrySeconds) ? retrySeconds * 1000
          : Number.isFinite(retryDate) ? retryDate - Date.now() : fallbackMs);
        await persistFootballDataState({ ...latest,
          cooldownUntil: new Date(Date.now() + cooldownMs).toISOString(), failures,
          lastStatus: response.status, lastStatusAt: new Date().toISOString() }, completionClient);
      } finally {
        if (completionLocked) await completionClient.query("SELECT pg_advisory_unlock($1)", [RATE_LIMIT_LOCK_ID]);
        completionClient.release();
      }
    }
    return response;
  });
  requestQueue = request.then(() => undefined, () => undefined);
  requestInFlight.set(url, request);
  try {
    return await request;
  } finally {
    requestInFlight.delete(url);
  }
}

async function persistFootballDataState(state: Record<string, unknown>, client: import("pg").PoolClient | typeof pool = pool) {
  await client.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
    VALUES (0, $1, $2::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
    [RATE_LIMIT_ENDPOINT, JSON.stringify(state)]);
}

export function normalizeFootballDataFixture(match: FootballDataMatch) {
  const id = ID_OFFSET + Number(match.id);
  if (!Number.isSafeInteger(id)) throw new Error("football-data.org returned an invalid match ID");
  return {
    fixture: {
      id, date: match.utcDate,
      venue: match.venue ? { name: match.venue } : null,
      referee: match.referees?.find((ref) => ref.type === "REFEREE")?.name ?? null,
      round: { matchday: match.matchday ?? null, stage: match.stage ?? null },
      status: { short: match.status, elapsed: match.minute ?? null },
    },
    league: {
      id: match.competition?.id,
      name: match.competition?.name ?? "Football",
      country: match.competition?.area?.name ?? "International",
      season: Number(match.competition?.season?.startDate?.slice(0, 4)) || new Date(match.utcDate).getUTCFullYear(),
    },
    teams: {
      home: { id: match.homeTeam.id, name: match.homeTeam.name, logo: match.homeTeam.crest ?? null },
      away: { id: match.awayTeam.id, name: match.awayTeam.name, logo: match.awayTeam.crest ?? null },
    },
    goals: {
      home: match.score?.fullTime?.home ?? null,
      away: match.score?.fullTime?.away ?? null,
      halftime: { home: match.score?.halfTime?.home ?? null, away: match.score?.halfTime?.away ?? null },
    },
  };
}

export async function syncFootballDataRange(dateFrom: string, dateTo: string): Promise<number> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error("FOOTBALL_DATA_TOKEN is not configured");
  const cache = await pool.query(
    "SELECT Payload, FetchedAt FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = 'fd-fixtures'",
  );
  const cached = cache.rows[0]?.payload;
  const cacheAge = cache.rows[0] ? Date.now() - new Date(cache.rows[0].fetchedat).getTime() : Infinity;
  if (cached?.dateFrom === dateFrom && cached?.dateTo === dateTo && cacheAge < RANGE_CACHE_TTL_MS) {
    return Number(cached.count ?? 0);
  }
  const params = new URLSearchParams({ dateFrom, dateTo });
  const response = await requestFootballData(`${API_BASE}/matches?${params}`, token);
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`football-data.org returned ${response.status}: ${detail}`);
  }
  const body = await response.json() as { matches?: FootballDataMatch[] };
  const matches = Array.isArray(body.matches) ? body.matches : [];
  for (const match of matches) await syncFixtureToDb(normalizeFootballDataFixture(match));
  await pool.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
    VALUES (0, 'fd-fixtures', $1::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
    [JSON.stringify({ count: matches.length, dateFrom, dateTo })]);
  return matches.length;
}

export function normalizeFootballDataMatch(match: FootballDataMatch) {
  const base = normalizeFootballDataFixture(match);
  const teamDetails = (team: FootballDataTeam) => ({
    team: { id: team.id, name: team.name, logo: team.crest ?? null },
    coach: team.coach ? { id: null, name: team.coach.name ?? null, photo: null } : null,
    formation: team.formation ?? null,
    startXI: (team.lineup ?? []).map((player) => ({ player: {
      id: player.id, name: player.name, number: player.shirtNumber ?? null,
      pos: player.position ?? null, photo: null, source: "football-data",
    } })),
    substitutes: (team.bench ?? []).map((player) => ({ player: {
      id: player.id, name: player.name, number: player.shirtNumber ?? null,
      pos: player.position ?? null, photo: null, source: "football-data",
    } })),
  });
  const events: any[] = [
    ...(match.goals ?? []).map((goal) => ({
      time: { elapsed: goal.minute ?? 0, injuryTime: goal.injuryTime ?? null }, team: goal.team,
      player: goal.scorer ? { ...goal.scorer, source: "football-data" } : null,
      assist: goal.assist ? { ...goal.assist, source: "football-data" } : null,
      type: "Goal", detail: goal.type ?? "Normal Goal",
    })),
    ...(match.bookings ?? []).map((booking) => ({
      time: { elapsed: booking.minute ?? 0, injuryTime: booking.injuryTime ?? null }, team: booking.team,
      player: booking.player ? { ...booking.player, source: "football-data" } : null,
      type: "Card", detail: booking.card ?? "Yellow Card",
    })),
    ...(match.substitutions ?? []).map((sub) => ({
      time: { elapsed: sub.minute ?? 0, injuryTime: sub.injuryTime ?? null }, team: sub.team,
      player: sub.playerOut ? { ...sub.playerOut, source: "football-data" } : null,
      assist: sub.playerIn ? { ...sub.playerIn, source: "football-data" } : null,
      type: "Substitution", detail: "Substitution",
    })),
  ];
  return {
    ...base,
    fixture: { ...base.fixture, referee: match.referees?.find((ref) => ref.type === "REFEREE")?.name ?? null },
    lineups: [teamDetails(match.homeTeam), teamDetails(match.awayTeam)],
    events,
  };
}

/** Fetch the documented single-match resource and persist the fields this account
 * is entitled to receive. */
export async function syncFootballDataMatchDetails(fixtureId: number, force = false): Promise<boolean> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token || fixtureId < ID_OFFSET || fixtureId >= ID_OFFSET + 1_000_000_000) return false;
  const sourceId = fixtureId - ID_OFFSET;
  const cache = await pool.query(
    "SELECT Payload, FetchedAt FROM MatchApiCache WHERE MatchID = $1 AND Endpoint = 'fd-detail'",
    [fixtureId],
  );
  if (cache.rows[0] && !force) {
    const prior = cache.rows[0].payload ?? {};
    const age = Date.now() - new Date(cache.rows[0].fetchedat).getTime();
    const hasDetails = Boolean(prior.hasLineups || prior.eventCount > 0);
    // Refresh empty provider responses often; coverage can appear after a match
    // finishes or the provider can recover from a temporary gap.
    const ttl = hasDetails ? 7 * 24 * 60 * 60_000 : 5 * 60_000;
    if (age < ttl) return false;
  }
  const response = await requestFootballData(`${API_BASE}/matches/${sourceId}`, token);
  if (!response.ok) throw new Error(`football-data.org match detail returned ${response.status}`);
  const match = await response.json() as FootballDataMatch;
  if (Number(match?.id) !== sourceId) throw new Error(`football-data.org returned no match for provider ID ${sourceId}`);
  const details = normalizeFootballDataMatch(match);
  const { persistMatchDetailsToDatabase } = require("./matchPipelineService") as typeof import("./matchPipelineService");
  await persistMatchDetailsToDatabase(fixtureId, details as any);
  await pool.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
    VALUES ($1, 'fd-detail', $2::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
    [fixtureId, JSON.stringify({
      hasLineups: details.lineups.some((team: any) => team.startXI.length > 0),
      eventCount: details.events.length,
      status: match.status,
      permission: null,
      hasVenue: Boolean(match.venue),
      hasReferee: Boolean(match.referees?.some((referee) => referee.type === "REFEREE")),
      hasCoaches: Boolean(match.homeTeam.coach?.name && match.awayTeam.coach?.name),
    })]);
  return true;
}

export async function syncFootballDataToday(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(`${today}T00:00:00.000Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return syncFootballDataRange(today, tomorrow.toISOString().slice(0, 10));
}
