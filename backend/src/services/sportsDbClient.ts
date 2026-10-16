import { syncFixtureToDb } from "./footballService";
import { pool } from "../db";
import { createHash } from "crypto";

const ID_OFFSET = 8_000_000_000_000;
const REQUEST_INTERVAL_MS = 2_100;
const EMPTY_RESPONSE_TTL_MS = 60 * 60_000;
const DATA_RESPONSE_TTL_MS = 12 * 60 * 60_000;
const MAX_BACKOFF_MS = 12 * 60 * 60_000;
const RATE_LIMIT_ENDPOINT = "tds-rate-limit";
const RATE_LIMIT_LOCK_ID = 7_004_211;
const DETAIL_RETRY_BASE_MS = 15 * 60_000;
const DETAIL_RETRY_MAX_MS = 6 * 60 * 60_000;
const requestInFlight = new Map<string, Promise<unknown>>();
let requestQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;
let requestCacheReady: Promise<void> | null = null;

type SportsDbEvent = {
  idEvent?: string;
  idLeague?: string;
  strLeague?: string;
  strCountry?: string;
  dateEvent?: string;
  strTime?: string;
  strTimestamp?: string;
  idHomeTeam?: string;
  strHomeTeam?: string;
  strHomeTeamBadge?: string | null;
  idAwayTeam?: string;
  strAwayTeam?: string;
  strAwayTeamBadge?: string | null;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  strVenue?: string | null;
  strOfficial?: string | null;
  strHomeFormation?: string | null;
  strAwayFormation?: string | null;
  strHomeCoach?: string | null;
  strAwayCoach?: string | null;
};

type SportsDbTimeline = {
  strTimeline?: string | null;
  strTimelineDetail?: string | null;
  intTime?: string | null;
  idTeam?: string | null;
  strTeam?: string | null;
  idPlayer?: string | null;
  strPlayer?: string | null;
  idAssist?: string | null;
  strAssist?: string | null;
};

type SportsDbLineup = {
  strPosition?: string | null;
  strHome?: string | null;
  strSubstitute?: string | null;
  intSquadNumber?: string | null;
  idPlayer?: string | null;
  strPlayer?: string | null;
  strCutout?: string | null;
  strThumb?: string | null;
};

async function requestSportsDb<T>(path: string, force = false): Promise<T> {
  const key = process.env.SPORTSDB_API_KEY;
  if (!key) throw new Error("SPORTSDB_API_KEY is not configured");
  const existing = requestInFlight.get(path);
  if (existing) return existing as Promise<T>;
  const request = requestQueue.then(async () => {
    await ensureRequestCache();
    const endpoint = `tds-${createHash("sha1").update(path).digest("hex").slice(0, 12)}`;
    const client = await pool.connect();
    let locked = false;
    try {
      await client.query("SELECT pg_advisory_lock($1)", [RATE_LIMIT_LOCK_ID]);
      locked = true;
      const cached = await client.query(
        "SELECT Payload, FetchedAt FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = $1",
        [endpoint]
      );
      if (!force && cached.rows[0]) {
        const age = Date.now() - new Date(cached.rows[0].fetchedat).getTime();
        const ttl = hasProviderData(cached.rows[0].payload) ? DATA_RESPONSE_TTL_MS : EMPTY_RESPONSE_TTL_MS;
        if (age < ttl) return cached.rows[0].payload as T;
      }

      const stateResult = await client.query(
        "SELECT Payload FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = $1",
        [RATE_LIMIT_ENDPOINT]
      );
      const state = stateResult.rows[0]?.payload ?? {};
      const retryAt = state.retryAt ? new Date(state.retryAt).getTime() : 0;
      if (retryAt > Date.now()) {
        throw new Error(`TheSportsDB cooldown active until ${new Date(retryAt).toISOString()}`);
      }

      const persistedNext = state.nextAllowedAt ? new Date(state.nextAllowedAt).getTime() : 0;
      const delay = Math.max(0, lastRequestAt + REQUEST_INTERVAL_MS - Date.now(), persistedNext - Date.now());
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      const nextAllowedAt = Date.now() + REQUEST_INTERVAL_MS;
      await persistRateLimitState(client, { ...state, nextAllowedAt: new Date(nextAllowedAt).toISOString() });
      const response = await fetch(`https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(key)}/${path}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      lastRequestAt = Date.now();
      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          const failures = Math.min(Number(state.failures ?? 0) + 1, 6);
          const fallback = response.status === 429
            ? Math.min(15 * 60_000 * 2 ** (failures - 1), MAX_BACKOFF_MS)
            : Math.min(60_000 * 2 ** (failures - 1), 30 * 60_000);
          const header = response.headers.get("retry-after");
          const retryAfter = header == null ? NaN : Number(header);
          const retryDate = header && !Number.isFinite(retryAfter) ? Date.parse(header) : NaN;
          const serverDelay = Number.isFinite(retryAfter) ? retryAfter * 1000
            : Number.isFinite(retryDate) ? retryDate - Date.now() : fallback;
          const cooldownMs = Math.max(60_000, serverDelay);
          await persistRateLimitState(client, {
            nextAllowedAt: new Date(nextAllowedAt).toISOString(),
            retryAt: new Date(Date.now() + cooldownMs).toISOString(),
            failures,
          });
        }
        throw new Error(`TheSportsDB returned ${response.status}`);
      }
      const body = await response.json() as T;
      await client.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
        VALUES (0, $1, $2::jsonb, CURRENT_TIMESTAMP)
        ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
        [endpoint, JSON.stringify(body)]);
      await persistRateLimitState(client, { nextAllowedAt: new Date(nextAllowedAt).toISOString(), failures: 0, retryAt: null });
      return body;
    } finally {
      if (locked) await client.query("SELECT pg_advisory_unlock($1)", [RATE_LIMIT_LOCK_ID]);
      client.release();
    }
  });
  requestQueue = request.then(() => undefined, () => undefined);
  requestInFlight.set(path, request);
  try {
    return await request as T;
  } finally {
    requestInFlight.delete(path);
  }
}

async function persistRateLimitState(client: import("pg").PoolClient, state: Record<string, unknown>) {
  await client.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
    VALUES (0, $1, $2::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
    [RATE_LIMIT_ENDPOINT, JSON.stringify(state)]);
}

function ensureRequestCache() {
  requestCacheReady ??= pool.query(`CREATE TABLE IF NOT EXISTS MatchApiCache (
    MatchID BIGINT NOT NULL,
    Endpoint VARCHAR(20) NOT NULL,
    Payload JSONB NOT NULL DEFAULT '[]'::jsonb,
    FetchedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (MatchID, Endpoint)
  )`).then(() => undefined).catch((error) => { requestCacheReady = null; throw error; });
  return requestCacheReady;
}

function hasProviderData(body: unknown) {
  if (!body || typeof body !== "object") return false;
  return Object.values(body).some((value) => Array.isArray(value) && value.length > 0);
}

function asNumber(value?: string | null): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeSportsDbEvent(event: SportsDbEvent) {
  const eventId = asNumber(event.idEvent);
  const homeId = asNumber(event.idHomeTeam);
  const awayId = asNumber(event.idAwayTeam);
  if (!eventId || !homeId || !awayId || !event.strHomeTeam || !event.strAwayTeam) return null;
  const date = event.strTimestamp ?? `${event.dateEvent ?? new Date().toISOString().slice(0, 10)}T${event.strTime || "00:00:00"}Z`;
  return {
    fixture: {
      id: ID_OFFSET + eventId,
      date,
      venue: event.strVenue ? { name: event.strVenue } : null,
      referee: null,
      status: { short: "NS" },
    },
    league: {
      id: asNumber(event.idLeague),
      name: event.strLeague ?? "Football",
      country: event.strCountry ?? "International",
      season: Number(event.dateEvent?.slice(0, 4)) || new Date().getUTCFullYear(),
    },
    teams: {
      home: { id: homeId, name: event.strHomeTeam, logo: event.strHomeTeamBadge ?? null },
      away: { id: awayId, name: event.strAwayTeam, logo: event.strAwayTeamBadge ?? null },
    },
    goals: { home: asNumber(event.intHomeScore), away: asNumber(event.intAwayScore) },
  };
}

export async function syncSportsDbToday(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const body = await requestSportsDb<{ events?: SportsDbEvent[] | null }>(`eventsday.php?d=${today}&s=Soccer`);
  const events = Array.isArray(body.events) ? body.events : [];
  let count = 0;
  for (const event of events) {
    const fixture = normalizeSportsDbEvent(event);
    if (fixture) {
      await syncFixtureToDb(fixture);
      count++;
    }
  }
  return count;
}

export async function syncSportsDbRange(dateFrom: string, dateTo: string): Promise<number> {
  const key = process.env.SPORTSDB_API_KEY;
  if (!key) throw new Error("SPORTSDB_API_KEY is not configured");
  let count = 0;
  const cursor = new Date(`${dateFrom}T00:00:00.000Z`);
  const end = new Date(`${dateTo}T00:00:00.000Z`);
  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    const body = await requestSportsDb<{ events?: SportsDbEvent[] | null }>(`eventsday.php?d=${date}&s=Soccer`);
    for (const event of body.events ?? []) {
      const fixture = normalizeSportsDbEvent(event);
      if (fixture) {
        await syncFixtureToDb(fixture);
        count++;
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

/** Enrich only matches already mapped to a TheSportsDB event ID in our namespaced
 * ApiFixtureID. Three cached provider lookups supply event, lineups, and timeline. */
export async function syncSportsDbMatchDetails(fixtureId: number, currentStatus: string, force = false): Promise<boolean> {
  const key = process.env.SPORTSDB_API_KEY;
  if (!key || fixtureId < ID_OFFSET || fixtureId >= ID_OFFSET + 1_000_000_000) return false;
  const eventId = fixtureId - ID_OFFSET;
  const cache = await pool.query(
    "SELECT Payload, FetchedAt FROM MatchApiCache WHERE MatchID = $1 AND Endpoint = 'tds-detail'",
    [fixtureId],
  );
  if (cache.rows[0] && !force) {
    const prior = cache.rows[0].payload ?? {};
    const age = Date.now() - new Date(cache.rows[0].fetchedat).getTime();
    const retryAt = prior.retryAt ? Date.parse(prior.retryAt) : 0;
    if (retryAt > Date.now()) return false;
    // Venue and referee metadata do not mean the event timeline or lineup has
    // arrived; keep retrying those missing details instead of treating the
    // fixture as fully enriched for a week.
    const hasDetails = Boolean(prior.hasLineups || prior.eventCount > 0);
    // Retry provider gaps frequently even after full time; timeline and lineup
    // coverage may be published later than the fixture itself.
    const ttl = hasDetails ? 7 * 24 * 60 * 60_000 : EMPTY_RESPONSE_TTL_MS;
    if (age < ttl) return false;
  }

  // TheSportsDB event IDs are used only when the DB row is already in its 8T namespace.
  const [eventResult, lineupResult, timelineResult] = await Promise.allSettled([
    requestSportsDb<{ events?: SportsDbEvent[] | null }>(`lookupevent.php?id=${eventId}`, force),
    requestSportsDb<{ lineup?: SportsDbLineup[] | null }>(`lookuplineup.php?id=${eventId}`, force),
    requestSportsDb<{ timeline?: SportsDbTimeline[] | null }>(`lookuptimeline.php?id=${eventId}`, force),
  ]);
  if ([eventResult, lineupResult, timelineResult].every((result) => result.status === "rejected")) {
    const failures = Math.min(Number(cache.rows[0]?.payload?.failures ?? 0) + 1, 8);
    const retryAt = new Date(Date.now() + Math.min(DETAIL_RETRY_BASE_MS * 2 ** (failures - 1), DETAIL_RETRY_MAX_MS)).toISOString();
    const failure = (eventResult as PromiseRejectedResult).reason;
    await pool.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
      VALUES ($1, 'tds-detail', $2::jsonb, CURRENT_TIMESTAMP)
      ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
      [fixtureId, JSON.stringify({ ...(cache.rows[0]?.payload ?? {}), failures, retryAt,
        lastError: failure instanceof Error && /timeout|abort/i.test(failure.message) ? "timeout" : "provider-request-failed" })]);
    throw failure;
  }
  const eventBody = eventResult.status === "fulfilled" ? eventResult.value : {};
  const lineupBody = lineupResult.status === "fulfilled" ? lineupResult.value : {};
  const timelineBody = timelineResult.status === "fulfilled" ? timelineResult.value : {};
  const event = eventBody.events?.[0];
  if (!event) {
    await pool.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
      VALUES ($1, 'tds-detail', $2::jsonb, CURRENT_TIMESTAMP)
      ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
      [fixtureId, JSON.stringify({ failures: 0, retryAt: null, hasLineups: false, eventCount: 0 })]);
    return false;
  }
  const homeId = asNumber(event.idHomeTeam);
  const awayId = asNumber(event.idAwayTeam);
  if (!homeId || !awayId || !event.strHomeTeam || !event.strAwayTeam) return false;
  const lineupRows = lineupBody.lineup ?? [];
  const buildLineup = (isHome: boolean) => {
    const relevant = lineupRows.filter((player) => (player.strHome === "Yes") === isHome);
    const team = isHome
      ? { id: homeId, name: event.strHomeTeam!, logo: (event as any).strHomeTeamBadge ?? null }
      : { id: awayId, name: event.strAwayTeam!, logo: (event as any).strAwayTeamBadge ?? null };
    const toPlayer = (player: SportsDbLineup) => ({ player: {
      id: asNumber(player.idPlayer), name: player.strPlayer,
      number: asNumber(player.intSquadNumber), pos: player.strPosition ?? null,
      photo: player.strCutout ?? player.strThumb ?? null, source: "sportsdb",
    } });
    const coachName = isHome ? event.strHomeCoach : event.strAwayCoach;
    return {
      team,
      coach: coachName ? { id: null, name: coachName, photo: null } : null,
      formation: isHome ? event.strHomeFormation ?? null : event.strAwayFormation ?? null,
      startXI: relevant.filter((player) => player.strSubstitute !== "Yes").map(toPlayer),
      substitutes: relevant.filter((player) => player.strSubstitute === "Yes").map(toPlayer),
    };
  };
  const events = (timelineBody.timeline ?? []).map((item) => {
    const type = String(item.strTimeline ?? "").toLowerCase();
    const eventType = type.includes("goal") ? "Goal" : type.includes("card") ? "Card" : type.includes("subst") ? "Substitution" : type.includes("foul") ? "Foul" : null;
    if (!eventType) return null;
    const teamIsHome = item.strTeam?.toLowerCase() === event.strHomeTeam?.toLowerCase();
    const team = { id: teamIsHome ? homeId : awayId, name: item.strTeam ?? (teamIsHome ? event.strHomeTeam! : event.strAwayTeam!) };
    return {
      time: { elapsed: asNumber(item.intTime) ?? 0 }, team,
      player: item.idPlayer && item.strPlayer ? { id: asNumber(item.idPlayer), name: item.strPlayer, source: "sportsdb" } : null,
      assist: item.idAssist && item.strAssist ? { id: asNumber(item.idAssist), name: item.strAssist, source: "sportsdb" } : null,
      type: eventType, detail: item.strTimelineDetail ?? eventType,
    };
  }).filter(Boolean);
  const date = event.strTimestamp ?? `${event.dateEvent ?? new Date().toISOString().slice(0, 10)}T${event.strTime || "00:00:00"}Z`;
  const details = {
    fixture: { id: fixtureId, date, venue: event.strVenue ? { name: event.strVenue, city: "", country: event.strCountry ?? "" } : null, referee: event.strOfficial || null, status: { short: currentStatus, elapsed: null } },
    league: { id: asNumber(event.idLeague) ?? 0, name: event.strLeague ?? "Football", country: event.strCountry ?? "International", season: Number(event.dateEvent?.slice(0, 4)) || new Date(date).getUTCFullYear() },
    teams: {
      home: { id: homeId, name: event.strHomeTeam, logo: (event as any).strHomeTeamBadge ?? null },
      away: { id: awayId, name: event.strAwayTeam, logo: (event as any).strAwayTeamBadge ?? null },
    },
    goals: { home: asNumber(event.intHomeScore), away: asNumber(event.intAwayScore) },
    lineups: [buildLineup(true), buildLineup(false)],
    events,
  };
  const { persistMatchDetailsToDatabase } = require("./matchPipelineService") as typeof import("./matchPipelineService");
  await persistMatchDetailsToDatabase(fixtureId, details as any);
  await pool.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
    VALUES ($1, 'tds-detail', $2::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
    [fixtureId, JSON.stringify({
      failures: 0,
      retryAt: null,
      hasLineups: lineupRows.some((player) => player.strSubstitute !== "Yes"),
      hasSubstitutes: lineupRows.some((player) => player.strSubstitute === "Yes"),
      hasCoaches: Boolean(event.strHomeCoach || event.strAwayCoach),
      eventCount: events.length,
      hasVenue: Boolean(event.strVenue),
      hasReferee: Boolean(event.strOfficial),
    })]);
  return true;
}
