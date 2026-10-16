import { pool } from "../db";
import { createHash } from "crypto";

const API_BASE = "https://v3.football.api-sports.io";
const APPLICATION_LIMIT = 80;
const NONINTERACTIVE_LIMIT = 60;
const BUDGET_WINDOW_MS = 24 * 60 * 60_000;
const QUOTA_SNAPSHOT_TTL_MS = 24 * 60 * 60_000;
const REQUEST_LOCK_ID = 7_004_229;
type ApiFootballObject = Record<string, unknown>;
const inFlight = new Map<string, Promise<any[]>>();
let setup: Promise<void> | null = null;

async function ensureUsageTable() {
  setup ??= pool.query(`
    CREATE TABLE IF NOT EXISTS ApiFootballDailyUsage (
      UsageDate DATE PRIMARY KEY DEFAULT CURRENT_DATE,
      RequestCount INTEGER NOT NULL DEFAULT 0,
      UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).then(() => pool.query(`
    CREATE TABLE IF NOT EXISTS MatchApiCache (
      MatchID BIGINT NOT NULL,
      Endpoint VARCHAR(20) NOT NULL,
      Payload JSONB NOT NULL DEFAULT '[]'::jsonb,
      FetchedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (MatchID, Endpoint)
    )
  `)).then(() => pool.query(`
    CREATE TABLE IF NOT EXISTS ApiFootballRequestLedger (
      RequestID BIGSERIAL PRIMARY KEY,
      RequestedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CompletedAt TIMESTAMPTZ,
      Endpoint VARCHAR(200) NOT NULL,
      FixtureID BIGINT,
      Purpose VARCHAR(32) NOT NULL,
      CacheStatus VARCHAR(20) NOT NULL,
      IsProviderRequest BOOLEAN NOT NULL DEFAULT TRUE,
      HttpStatus INTEGER,
      RemainingQuota INTEGER,
      RequestQuotaLimit INTEGER,
      RateLimitRemaining INTEGER,
      RateLimitLimit INTEGER,
      ErrorSummary VARCHAR(300),
      KeyFingerprint VARCHAR(16) NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_api_football_ledger_window
      ON ApiFootballRequestLedger (KeyFingerprint, RequestedAt DESC)
      WHERE IsProviderRequest = TRUE;
    ALTER TABLE ApiFootballRequestLedger ADD COLUMN IF NOT EXISTS RequestQuotaLimit INTEGER;
    ALTER TABLE ApiFootballRequestLedger ADD COLUMN IF NOT EXISTS RateLimitRemaining INTEGER;
    ALTER TABLE ApiFootballRequestLedger ADD COLUMN IF NOT EXISTS RateLimitLimit INTEGER;
  `)).then(() => undefined).catch((error) => { setup = null; throw error; });
  await setup;
}

type ApiFootballPurpose = "match-list" | "user-detail" | "bulk-backfill" | "development" | "quota-status";
type ApiFootballOptions = { purpose?: ApiFootballPurpose };
type ProviderState = {
  suspended?: boolean;
  paused?: boolean;
  pauseReason?: string | null;
  suspendedAt?: string | null;
  retryAt?: string | null;
  failures?: number;
  requestsRemaining?: number | null;
  requestsLimit?: number | null;
  rateLimitRemaining?: number | null;
  rateLimitLimit?: number | null;
  quotaObservedAt?: string | null;
  quotaVerifiedAt?: string | null;
  quotaSource?: "provider-headers" | "dashboard-verification" | "local-request-reservations";
  lastSuccessfulResponseAt?: string | null;
  lastResponseStatus?: number | null;
  lastResponseError?: string | null;
  keyFingerprint?: string | null;
};

function getKeyFingerprint(key = process.env.API_FOOTBALL_KEY ?? "") {
  return key ? createHash("sha256").update(key).digest("hex").slice(0, 16) : null;
}

function endpointCacheKey(path: string) {
  return `af-${createHash("sha1").update(path).digest("hex").slice(0, 12)}`;
}

function fixtureIdFromPath(path: string) {
  const match = path.match(/(?:fixture=|\/fixtures\/|(?:\?|&)id=)(\d+)/);
  return match ? Number(match[1]) : null;
}

function isApiFootballObject(value: unknown): value is ApiFootballObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isUsefulResponse(path: string, result: unknown) {
  if (Array.isArray(result) && result.length === 0) return false;
  if (Array.isArray(result)) {
    const teams = result.filter(isApiFootballObject);
    if (path.includes("/fixtures/players")) return teams.some((team) => Array.isArray(team.players) && team.players.length > 0);
    if (path.includes("/fixtures/lineups")) return teams.some((team) =>
      (Array.isArray(team.startXI) && team.startXI.length > 0) || (Array.isArray(team.substitutes) && team.substitutes.length > 0));
    if (path.includes("/fixtures/statistics")) return teams.some((team) => Array.isArray(team.statistics) && team.statistics.length > 0);
    return teams.length > 0;
  }
  return isApiFootballObject(result) && Object.keys(result).length > 0;
}

function isLiveStatus(status: string | null) {
  return Boolean(status && ["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "IN_PLAY", "PAUSED"].includes(status.toUpperCase()));
}

function responseTtl(path: string, useful: boolean, status: string | null) {
  const live = isLiveStatus(status);
  if (path === "/status") return 60 * 60_000;
  if (path.startsWith("/fixtures?date=") || path.startsWith("/fixtures?from=")) return useful ? 60 * 60_000 : 15 * 60_000;
  if (path.includes("/fixtures/events")) return live ? (useful ? 2 * 60_000 : 60_000) : useful ? 30 * 24 * 60 * 60_000 : 6 * 60 * 60_000;
  if (path.includes("/fixtures/lineups")) return useful ? 30 * 24 * 60 * 60_000 : 12 * 60 * 60_000;
  if (path.includes("/fixtures/players")) return live ? (useful ? 5 * 60_000 : 2 * 60_000) : useful ? 30 * 24 * 60 * 60_000 : 12 * 60 * 60_000;
  if (path.includes("/fixtures/statistics")) return live ? (useful ? 5 * 60_000 : 2 * 60_000) : useful ? 30 * 24 * 60 * 60_000 : 12 * 60 * 60_000;
  if (/\/fixtures\?id=/.test(path)) return useful ? 24 * 60 * 60_000 : 6 * 60 * 60_000;
  return useful ? 24 * 60 * 60_000 : 6 * 60 * 60_000;
}

function quotaHeader(headers: Headers, names: string[]) {
  for (const name of names) {
    const value = headers.get(name);
    if (value != null && /^\d+$/.test(value.trim())) return Number(value);
  }
  return null;
}

export function readQuotaHeaders(headers: Headers) {
  const dailyRemaining = quotaHeader(headers, ["x-ratelimit-requests-remaining"]);
  const standardRemaining = quotaHeader(headers, ["x-ratelimit-remaining"]);
  const dailyLimit = quotaHeader(headers, ["x-ratelimit-requests-limit"]);
  const standardLimit = quotaHeader(headers, ["x-ratelimit-limit"]);
  return {
    remaining: dailyRemaining,
    limit: dailyLimit,
    rateLimitRemaining: standardRemaining,
    rateLimitLimit: standardLimit,
  };
}

function jitteredBackoff(failures: number) {
  const cap = Math.min(60 * 60_000, 30_000 * 2 ** Math.min(failures, 7));
  return Math.round(cap * (0.75 + Math.random() * 0.5));
}

function retryAfterMs(response: Response, fallbackMs: number) {
  const value = response.headers.get("retry-after");
  if (!value) return fallbackMs;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : fallbackMs;
}

async function readProviderState(client: import("pg").PoolClient | typeof pool = pool): Promise<ProviderState> {
  const result = await client.query("SELECT Payload FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = 'api-football-state'");
  return result.rows[0]?.payload ?? {};
}

async function persistProviderState(state: ProviderState, client: import("pg").PoolClient | typeof pool = pool) {
  await client.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
    VALUES (0, 'api-football-state', $1::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
    [JSON.stringify(state)]);
}

function providerErrorSummary(value: unknown) {
  let summary = String(value ?? "Unknown provider error").replace(/\s+/g, " ");
  const key = process.env.API_FOOTBALL_KEY;
  if (key) summary = summary.replaceAll(key, "[REDACTED]");
  return summary.replace(/(x-apisports-key\s*[:=]\s*)[^\s,;]+/ig, "$1[REDACTED]").slice(0, 280);
}

async function recordLedgerResult(client: import("pg").PoolClient | typeof pool, requestId: string | number, updates: {
  completed?: boolean; cacheStatus?: string; httpStatus?: number | null; remaining?: number | null;
  dailyLimit?: number | null; rateLimitRemaining?: number | null; rateLimitLimit?: number | null; error?: string | null;
}) {
  await client.query(`UPDATE ApiFootballRequestLedger SET
      CompletedAt = CASE WHEN $2 THEN CURRENT_TIMESTAMP ELSE CompletedAt END,
      CacheStatus = COALESCE($3, CacheStatus), HttpStatus = COALESCE($4, HttpStatus),
      RemainingQuota = $5, RequestQuotaLimit = $6, RateLimitRemaining = $7, RateLimitLimit = $8, ErrorSummary = $9
    WHERE RequestID = $1`, [requestId, updates.completed ?? false, updates.cacheStatus ?? null,
    updates.httpStatus ?? null, updates.remaining ?? null, updates.dailyLimit ?? null,
    updates.rateLimitRemaining ?? null, updates.rateLimitLimit ?? null, updates.error ?? null]);
}

async function recordCacheHit(path: string, purpose: ApiFootballPurpose, remaining: number | null,
  client: import("pg").PoolClient | typeof pool = pool) {
  const keyFingerprint = getKeyFingerprint();
  if (!keyFingerprint) return;
  await client.query(`INSERT INTO ApiFootballRequestLedger
    (Endpoint, FixtureID, Purpose, CacheStatus, IsProviderRequest, RemainingQuota, KeyFingerprint)
    VALUES ($1, $2, $3, 'hit', FALSE, $4, $5)`,
    [path, fixtureIdFromPath(path), purpose, remaining, keyFingerprint]);
}

async function statusForFixture(path: string, client: import("pg").PoolClient | typeof pool = pool) {
  const fixtureId = fixtureIdFromPath(path);
  if (!fixtureId) return null;
  const result = await client.query("SELECT ApiStatus FROM Match WHERE ApiFixtureID = $1::bigint LIMIT 1", [fixtureId]);
  return result.rows[0]?.apistatus ?? null;
}

async function getCachedResponse(path: string, client: import("pg").PoolClient | typeof pool = pool) {
  const result = await client.query("SELECT Payload, FetchedAt FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = $1", [endpointCacheKey(path)]);
  const row = result.rows[0];
  if (!row) return null;
  const payload = row.payload;
  const status = await statusForFixture(path, client);
  const useful = Boolean(payload.useful);
  const ttl = responseTtl(path, useful, status);
  const age = Date.now() - new Date(row.fetchedat).getTime();
  return age < ttl ? payload : null;
}

async function reserveProviderRequest(client: import("pg").PoolClient, path: string, purpose: ApiFootballPurpose) {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key || key === "your-api-football-key") throw new Error("API key not configured");
  const fingerprint = getKeyFingerprint(key)!;
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock($1)", [REQUEST_LOCK_ID]);
    const state = await readProviderState(client);
    if (state.suspended || state.paused) throw new Error(`API-Football is paused: ${state.pauseReason ?? "verify the account and reconcile quota manually"}`);
    if (state.keyFingerprint && state.keyFingerprint !== fingerprint) throw new Error("API-Football key changed; manual account and quota verification is required");
    if (state.retryAt && new Date(state.retryAt).getTime() > Date.now()) throw new Error(`API-Football cooldown active until ${state.retryAt}`);
    const remaining = Number(state.requestsRemaining);
    const observedAt = Date.parse(state.quotaObservedAt ?? state.quotaVerifiedAt ?? "");
    if (!Number.isFinite(remaining) || !Number.isFinite(observedAt)) throw new Error("API-Football quota is unknown; use the dashboard to verify and reconcile remaining requests before enabling calls");
    if (Date.now() - observedAt > QUOTA_SNAPSHOT_TTL_MS) throw new Error("API-Football quota snapshot is stale; reconcile through the dashboard before another request");
    if (remaining <= 0) throw new Error("API-Football reports no requests remaining");

    const minuteResult = await client.query(`SELECT COUNT(*)::int AS request_count
      FROM ApiFootballRequestLedger
      WHERE KeyFingerprint = $1 AND IsProviderRequest = TRUE
        AND RequestedAt >= CURRENT_TIMESTAMP - INTERVAL '1 minute'`, [fingerprint]);
    const observedMinuteLimit = Number(state.rateLimitLimit);
    const minuteLimit = Number.isFinite(observedMinuteLimit) && observedMinuteLimit > 0
      ? Math.min(10, observedMinuteLimit) : 10;
    const minuteCount = Number(minuteResult.rows[0]?.request_count ?? 0);
    if (minuteCount >= minuteLimit) throw new Error(`API-Football per-minute budget exhausted (${minuteCount}/${minuteLimit} requests)`);

    const countResult = await client.query(`SELECT COUNT(*)::int AS request_count
      FROM ApiFootballRequestLedger
      WHERE KeyFingerprint = $1 AND IsProviderRequest = TRUE
        AND RequestedAt >= CURRENT_TIMESTAMP - ($2 * INTERVAL '1 millisecond')`, [fingerprint, BUDGET_WINDOW_MS]);
    const legacyResult = await client.query(`SELECT COALESCE(SUM(RequestCount), 0)::int AS request_count
      FROM ApiFootballDailyUsage WHERE UpdatedAt >= CURRENT_TIMESTAMP - ($1 * INTERVAL '1 millisecond')`, [BUDGET_WINDOW_MS]);
    const requestCount = Number(countResult.rows[0]?.request_count ?? 0) + Number(legacyResult.rows[0]?.request_count ?? 0);
    const limit = purpose === "user-detail" ? APPLICATION_LIMIT : NONINTERACTIVE_LIMIT;
    if (requestCount >= limit) throw new Error(`API-Football ${purpose} budget exhausted (${requestCount}/${limit} requests in the rolling 24-hour window)`);

    const reservation = await client.query(`INSERT INTO ApiFootballRequestLedger
      (Endpoint, FixtureID, Purpose, CacheStatus, IsProviderRequest, RemainingQuota, KeyFingerprint)
      VALUES ($1, $2, $3, 'reserved', TRUE, $4, $5) RETURNING RequestID`,
      [path, fixtureIdFromPath(path), purpose, remaining - 1, fingerprint]);
    await persistProviderState({ ...state, requestsRemaining: remaining - 1, keyFingerprint: fingerprint }, client);
    await client.query("COMMIT");
    return { requestId: Number(reservation.rows[0].requestid), remainingBefore: remaining, fingerprint };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function cacheResponse(path: string, result: unknown, remaining: number | null, limit: number | null, status: string | null,
  client: import("pg").PoolClient | typeof pool = pool) {
  const useful = isUsefulResponse(path, result);
  const ttlMs = responseTtl(path, useful, status);
  await client.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
    VALUES (0, $1, $2::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
    [endpointCacheKey(path), JSON.stringify({ result, useful, ttlMs, remaining, limit })]);
}

async function completeProviderRequest(client: import("pg").PoolClient, requestId: number, path: string, response: Response | null, result: unknown,
  reservation: { remainingBefore: number; fingerprint: string }, error?: unknown) {
  const headers = response ? readQuotaHeaders(response.headers)
    : { remaining: null, limit: null, rateLimitRemaining: null, rateLimitLimit: null };
  const state = await readProviderState(client);
  const statusText = `${String(error ?? "")} ${JSON.stringify(error ?? "")}`.toLowerCase();
  const remaining = headers.remaining ?? Math.max(0, reservation.remainingBefore - 1);
  const authenticationFailure = response?.status === 401 || response?.status === 403;
  const suspensionFailure = statusText.includes("suspend");
  const nonRetryableClientFailure = Boolean(response && response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429);
  const observedAt = headers.remaining == null ? state.quotaObservedAt : new Date().toISOString();
  if (authenticationFailure || suspensionFailure) {
    await persistProviderState({ ...state, suspended: true, paused: true,
      pauseReason: `HTTP ${response?.status ?? "unknown"}: ${providerErrorSummary(error)}; manual account verification required`,
      suspendedAt: new Date().toISOString(), retryAt: null,
      requestsRemaining: Number.isFinite(Number(state.requestsRemaining))
        ? Math.min(Number(state.requestsRemaining), remaining) : remaining,
      requestsLimit: headers.limit ?? state.requestsLimit,
      rateLimitRemaining: headers.rateLimitRemaining ?? state.rateLimitRemaining,
      rateLimitLimit: headers.rateLimitLimit ?? state.rateLimitLimit,
      quotaObservedAt: observedAt,
      quotaSource: headers.remaining == null ? (state.quotaSource ?? "local-request-reservations") : "provider-headers",
      keyFingerprint: reservation.fingerprint, lastResponseStatus: response?.status ?? null,
      lastResponseError: providerErrorSummary(error) }, client);
  } else if (nonRetryableClientFailure) {
    await persistProviderState({ ...state, paused: true,
      pauseReason: `Non-retryable HTTP ${response?.status}; ${providerErrorSummary(error)}; manual provider verification required`, retryAt: null,
      requestsRemaining: remaining, requestsLimit: headers.limit ?? state.requestsLimit,
      rateLimitRemaining: headers.rateLimitRemaining ?? state.rateLimitRemaining,
      rateLimitLimit: headers.rateLimitLimit ?? state.rateLimitLimit,
      quotaObservedAt: observedAt, keyFingerprint: reservation.fingerprint,
      quotaSource: headers.remaining == null ? (state.quotaSource ?? "local-request-reservations") : "provider-headers",
      lastResponseStatus: response?.status ?? null, lastResponseError: providerErrorSummary(error) }, client);
  } else if (response?.status === 429 || (response && response.status >= 500) || error) {
    const failures = Number(state.failures ?? 0) + 1;
    const delay = response?.status === 429 ? retryAfterMs(response, jitteredBackoff(failures)) : jitteredBackoff(failures);
    await persistProviderState({ ...state, failures, paused: false, retryAt: new Date(Date.now() + delay).toISOString(),
      requestsRemaining: remaining,
      requestsLimit: headers.limit ?? state.requestsLimit,
      rateLimitRemaining: headers.rateLimitRemaining ?? state.rateLimitRemaining,
      rateLimitLimit: headers.rateLimitLimit ?? state.rateLimitLimit,
      quotaObservedAt: observedAt,
      quotaSource: headers.remaining == null ? (state.quotaSource ?? "local-request-reservations") : "provider-headers",
      keyFingerprint: reservation.fingerprint }, client);
  } else {
    await persistProviderState({ ...state, failures: 0, paused: false, pauseReason: null, retryAt: null, requestsRemaining: remaining,
      requestsLimit: headers.limit ?? state.requestsLimit,
      rateLimitRemaining: headers.rateLimitRemaining ?? state.rateLimitRemaining,
      rateLimitLimit: headers.rateLimitLimit ?? state.rateLimitLimit,
      quotaObservedAt: observedAt,
      quotaSource: headers.remaining == null ? (state.quotaSource ?? "local-request-reservations") : "provider-headers",
        keyFingerprint: reservation.fingerprint, lastSuccessfulResponseAt: new Date().toISOString(),
        lastResponseStatus: response?.status ?? null, lastResponseError: null }, client);
  }
      await recordLedgerResult(client, requestId, {
    completed: true,
    httpStatus: response?.status ?? null,
    remaining,
        dailyLimit: headers.limit,
        rateLimitRemaining: headers.rateLimitRemaining,
        rateLimitLimit: headers.rateLimitLimit,
    cacheStatus: error ? "error" : "miss",
    error: error ? providerErrorSummary(error) : null,
  });
  if (!error && response?.ok) await cacheResponse(path, result, remaining, headers.limit, await statusForFixture(path, client), client);
  return remaining;
}

export async function callApiFootball(path: string, options: ApiFootballOptions = {}): Promise<any[]> {
  await ensureUsageTable();
  const purpose = options.purpose ?? (path.startsWith("/fixtures?") ? "match-list" : "user-detail");
  const cached = await getCachedResponse(path);
  if (cached) {
    const state = await readProviderState();
    await recordCacheHit(path, purpose, Number.isFinite(Number(state.requestsRemaining)) ? Number(state.requestsRemaining) : null);
    return cached.result;
  }
  const existing = inFlight.get(path);
  if (existing) return existing;

  const request = (async () => {
    const key = process.env.API_FOOTBALL_KEY;
    if (!key || key === "your-api-football-key") throw new Error("API key not configured");
    const client = await pool.connect();
    let locked = false;
    let reservation: Awaited<ReturnType<typeof reserveProviderRequest>> | null = null;
    let response: Response | null = null;
    try {
      await client.query("SELECT pg_advisory_lock($1)", [REQUEST_LOCK_ID]);
      locked = true;
      const secondCacheCheck = await getCachedResponse(path, client);
      if (secondCacheCheck) {
        const state = await readProviderState(client);
        await recordCacheHit(path, purpose, state.requestsRemaining == null ? null : Number(state.requestsRemaining), client);
        return secondCacheCheck.result;
      }
      reservation = await reserveProviderRequest(client, path, purpose);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        response = await fetch(`${API_BASE}${path}`, {
          headers: { "x-apisports-key": key }, signal: controller.signal, cache: "no-store",
        });
        const rawBody = await response.text();
        let body: ApiFootballObject | null;
        try {
          const parsed: unknown = JSON.parse(rawBody);
          body = isApiFootballObject(parsed) ? parsed : null;
        } catch { body = null; }
        const errors = body?.errors;
        const hasErrors = Array.isArray(errors) ? errors.length > 0
          : isApiFootballObject(errors) && Object.keys(errors).length > 0;
        if (!response.ok || hasErrors) {
          const summary = providerErrorSummary(JSON.stringify(errors ?? rawBody));
          const providerError = new Error(`API-Football ${response.status}: ${summary}`);
          await completeProviderRequest(client, reservation.requestId, path, response, null, reservation, providerError);
          throw providerError;
        }
        if (!body || !Array.isArray(body.response)) throw new Error("API-Football returned a malformed response envelope");
        const result = body.response.filter(isApiFootballObject) as any[];
        await completeProviderRequest(client, reservation.requestId, path, response, result, reservation);
        return result;
      } catch (error) {
        if (reservation) {
          const statusIsRecorded = response && !response.ok;
          if (!statusIsRecorded) await completeProviderRequest(client, reservation.requestId, path, response, null, reservation, error);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    } finally {
      if (locked) await client.query("SELECT pg_advisory_unlock($1)", [REQUEST_LOCK_ID]);
      client.release();
    }
  })();
  inFlight.set(path, request);
  try { return await request; } finally { inFlight.delete(path); }
}

export async function reconcileApiFootballQuota(input: { remaining: number; limit: number; accountVerified: boolean;
  accountActive?: boolean; dashboardVerified?: boolean; verifiedAt?: string }) {
  if (!input.accountVerified || input.accountActive !== true || input.dashboardVerified !== true) {
    throw new Error("Verify the account is active and reconcile quota against the official dashboard before resuming API-Football");
  }
  if (!Number.isInteger(input.remaining) || input.remaining < 0 || !Number.isInteger(input.limit) || input.limit <= 0 || input.remaining > input.limit) {
    throw new Error("Provider remaining and limit must be valid non-negative integers");
  }
  const verificationTime = Date.parse(input.verifiedAt ?? "");
  if (!Number.isFinite(verificationTime) || verificationTime > Date.now() + 30_000 || Date.now() - verificationTime > 5 * 60_000) {
    throw new Error("A dashboard verification timestamp from the last five minutes is required");
  }
  const fingerprint = getKeyFingerprint();
  if (!fingerprint) throw new Error("API_FOOTBALL_KEY is not configured");
  const client = await pool.connect();
  let locked = false;
  try {
    await client.query("SELECT pg_advisory_lock($1)", [REQUEST_LOCK_ID]);
    locked = true;
    await client.query("BEGIN");
    const state = await readProviderState(client);
    await persistProviderState({ ...state, suspended: false, paused: false, pauseReason: null, retryAt: null, failures: 0,
      requestsRemaining: input.remaining, requestsLimit: input.limit,
      quotaVerifiedAt: new Date(verificationTime).toISOString(), quotaObservedAt: new Date(verificationTime).toISOString(),
      quotaSource: "dashboard-verification", keyFingerprint: fingerprint }, client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    if (locked) await client.query("SELECT pg_advisory_unlock($1)", [REQUEST_LOCK_ID]);
    client.release();
  }
}

export async function getApiFootballBudgetReport() {
  await ensureUsageTable();
  const fingerprint = getKeyFingerprint();
  if (!fingerprint) return { configured: false, reason: "API_FOOTBALL_KEY is not configured" };
  const [state, count, legacy, rows, lastResponse, lastSuccess] = await Promise.all([
    readProviderState(),
    pool.query(`SELECT COUNT(*)::int AS request_count FROM ApiFootballRequestLedger
      WHERE KeyFingerprint = $1 AND IsProviderRequest = TRUE
        AND RequestedAt >= CURRENT_TIMESTAMP - ($2 * INTERVAL '1 millisecond')`, [fingerprint, BUDGET_WINDOW_MS]),
    pool.query(`SELECT COALESCE(SUM(RequestCount), 0)::int AS request_count FROM ApiFootballDailyUsage
      WHERE UpdatedAt >= CURRENT_TIMESTAMP - ($1 * INTERVAL '1 millisecond')`, [BUDGET_WINDOW_MS]),
    pool.query(`SELECT RequestedAt, Endpoint, FixtureID, Purpose, CacheStatus, HttpStatus,
      RemainingQuota, RequestQuotaLimit, RateLimitRemaining, RateLimitLimit, ErrorSummary
      FROM ApiFootballRequestLedger WHERE KeyFingerprint = $1 ORDER BY RequestID DESC LIMIT 50`, [fingerprint]),
    pool.query(`SELECT RequestedAt, CompletedAt, Endpoint, HttpStatus, RemainingQuota, RequestQuotaLimit,
      RateLimitRemaining, RateLimitLimit, ErrorSummary, CacheStatus
      FROM ApiFootballRequestLedger WHERE KeyFingerprint = $1 AND IsProviderRequest = TRUE ORDER BY RequestID DESC LIMIT 1`, [fingerprint]),
    pool.query(`SELECT CompletedAt FROM ApiFootballRequestLedger WHERE KeyFingerprint = $1 AND IsProviderRequest = TRUE
      AND HttpStatus >= 200 AND HttpStatus < 300 AND ErrorSummary IS NULL ORDER BY RequestID DESC LIMIT 1`, [fingerprint]),
  ]);
  const remaining = state.requestsRemaining == null || !Number.isFinite(Number(state.requestsRemaining)) ? null : Number(state.requestsRemaining);
  const observedAt = Date.parse(state.quotaObservedAt ?? state.quotaVerifiedAt ?? "");
  const quotaStale = remaining == null || !Number.isFinite(observedAt) || Date.now() - observedAt > QUOTA_SNAPSHOT_TTL_MS;
  const keyMismatch = Boolean(state.keyFingerprint && state.keyFingerprint !== fingerprint);
  return {
    configured: true,
    paused: Boolean(state.suspended || state.paused || keyMismatch || quotaStale || (state.retryAt && new Date(state.retryAt).getTime() > Date.now())),
    suspended: Boolean(state.suspended),
    suspendedAt: state.suspendedAt ?? null,
    pauseReason: state.pauseReason ?? (state.suspended ? "Suspended flag is set, but the triggering response and reason were not persisted"
      : keyMismatch ? "Quota snapshot belongs to a different API key; manual reconciliation is required"
        : quotaStale ? "Quota snapshot is unknown or stale; manual reconciliation is required" : null),
    retryAt: state.retryAt ?? null,
    remaining,
    limit: state.requestsLimit == null || !Number.isFinite(Number(state.requestsLimit)) ? null : Number(state.requestsLimit),
    perMinuteRemaining: state.rateLimitRemaining == null || !Number.isFinite(Number(state.rateLimitRemaining)) ? null : Number(state.rateLimitRemaining),
    perMinuteLimit: state.rateLimitLimit == null || !Number.isFinite(Number(state.rateLimitLimit)) ? null : Number(state.rateLimitLimit),
    observedAt: state.quotaObservedAt ?? state.quotaVerifiedAt ?? null,
    quotaSource: state.quotaSource ?? (state.quotaVerifiedAt ? "dashboard-verification" : null),
    lastResponseStatus: state.lastResponseStatus ?? lastResponse.rows[0]?.httpstatus ?? null,
    lastResponseError: state.lastResponseError ?? null,
    verificationSteps: [
      "Check the official API-Sports dashboard to confirm the subscription and API key are active.",
      "Reconcile the dashboard's current daily remaining quota and daily limit; do not infer a reset from elapsed time or missing headers.",
      "Only then use the guarded admin recovery command with --account-active --dashboard-verified and a recent --verified-at timestamp.",
    ],
    lastSuccessfulResponseAt: state.lastSuccessfulResponseAt ?? lastSuccess.rows[0]?.completedat ?? null,
    lastRecordedProviderResponse: lastResponse.rows[0] ?? null,
    rolling24HourRequests: Number(count.rows[0]?.request_count ?? 0) + Number(legacy.rows[0]?.request_count ?? 0),
    legacyRolling24HourRequests: Number(legacy.rows[0]?.request_count ?? 0),
    applicationCeiling: APPLICATION_LIMIT,
    noninteractiveCeiling: NONINTERACTIVE_LIMIT,
    recentRequests: rows.rows,
  };
}
