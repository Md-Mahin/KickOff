import { pool } from "../db";

const API_BASE = "https://v3.football.api-sports.io";
const DAILY_LIMIT = 95; // Keep five calls in reserve for manual/operational use.
const inFlight = new Map<string, Promise<any[]>>();
const responseCache = new Map<string, { value: any[]; expiresAt: number }>();
let circuitOpenUntil = 0;
let accountSuspended = false;
let providerStateCheckedAt = 0;
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
  `)).then(() => undefined).catch((error) => { setup = null; throw error; });
  await setup;
}

async function refreshProviderState() {
  if (Date.now() - providerStateCheckedAt < 10_000) return;
  await ensureUsageTable();
  const result = await pool.query(
    `SELECT Payload FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = 'api-football-state'`
  );
  const state = result.rows[0]?.payload ?? {};
  accountSuspended ||= state.suspended === true;
  if (state.retryAt) circuitOpenUntil = Math.max(circuitOpenUntil, new Date(state.retryAt).getTime());
  providerStateCheckedAt = Date.now();
}

async function persistProviderState(state: { suspended?: boolean; retryAt?: number }) {
  const payload = {
    suspended: state.suspended ?? accountSuspended,
    retryAt: state.retryAt ? new Date(state.retryAt).toISOString() : null,
  };
  await pool.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
    VALUES (0, 'api-football-state', $1::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
    [JSON.stringify(payload)]);
}

function retryAfterMs(response: Response, fallbackMs: number) {
  const value = response.headers.get("retry-after");
  if (!value) return fallbackMs;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : fallbackMs;
}

async function openCircuitFor(durationMs: number, suspended = false) {
  accountSuspended ||= suspended;
  circuitOpenUntil = accountSuspended ? Number.POSITIVE_INFINITY : Date.now() + durationMs;
  try {
    await persistProviderState({ suspended: accountSuspended, retryAt: accountSuspended ? undefined : circuitOpenUntil });
  } catch (error) {
    console.warn(`[API] Could not persist provider cooldown: ${(error as Error).message}`);
  }
}

async function reserveRequest(): Promise<boolean> {
  await ensureUsageTable();
  const usageDate = new Date().toISOString().slice(0, 10);
  const result = await pool.query(`
    INSERT INTO ApiFootballDailyUsage (UsageDate, RequestCount)
    VALUES ($2::date, 1)
    ON CONFLICT (UsageDate) DO UPDATE
      SET RequestCount = ApiFootballDailyUsage.RequestCount + 1,
          UpdatedAt = CURRENT_TIMESTAMP
      WHERE ApiFootballDailyUsage.RequestCount < $1
    RETURNING RequestCount
  `, [DAILY_LIMIT, usageDate]);
  if (result.rowCount) {
    const count = Number(result.rows[0].requestcount);
    console.info(`[API] Daily usage ${count}/${DAILY_LIMIT}`);
    return true;
  }
  console.warn("[API] Request skipped - daily quota protection");
  return false;
}

export async function callApiFootball(path: string): Promise<any[]> {
  const url = `${API_BASE}${path}`;
  const ttl = path.startsWith("/fixtures?from=") ? 20 * 60_000
    : path.startsWith("/fixtures?date=") ? 3 * 60 * 60_000 : 0;
  const cached = ttl ? responseCache.get(url) : undefined;
  if (cached && cached.expiresAt > Date.now()) {
    console.log("[CACHE] Reusing recent fixture list");
    return cached.value;
  }
  const existing = inFlight.get(url);
  if (existing) {
    console.log("[CACHE] Reusing in-flight API request");
    return existing;
  }
  const request = (async () => {
    await refreshProviderState();
    if (accountSuspended) throw new Error("API-Football account is suspended; provider access requires account reinstatement");
    if (Date.now() < circuitOpenUntil) throw new Error("API-Football cooldown is active");
    const key = process.env.API_FOOTBALL_KEY;
    if (!key || key === "your-api-football-key") throw new Error("API key not configured");
    if (!(await reserveRequest())) throw new Error("API-Football daily request budget exhausted");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      console.log(`[API] Fetching ${path}`);
      const response = await fetch(url, { headers: { "x-apisports-key": key }, signal: controller.signal });
      if (!response.ok) {
        const detail = await response.text();
        if (detail.toLowerCase().includes("suspended")) {
          await openCircuitFor(0, true);
          throw new Error("API-Football account is suspended; provider access requires account reinstatement");
        }
        if (response.status === 429) await openCircuitFor(retryAfterMs(response, 60 * 60_000));
        else if (response.status >= 500) await openCircuitFor(60_000);
        throw new Error(`API-Football returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
      }
      const body = await response.json() as { response?: any[]; errors?: Record<string, unknown> | unknown[] };
      const errors = body.errors;
      if (errors && (Array.isArray(errors) ? errors.length > 0 : Object.keys(errors).length > 0)) {
        const isSuspended = JSON.stringify(errors).toLowerCase().includes("suspended");
        if (isSuspended) await openCircuitFor(0, true);
        throw new Error(`API-Football rejected the request: ${JSON.stringify(errors)}`);
      }
      circuitOpenUntil = 0;
      const result = Array.isArray(body.response) ? body.response : [];
      if (ttl) responseCache.set(url, { value: result, expiresAt: Date.now() + ttl });
      return result;
    } catch (error) {
      if (!circuitOpenUntil && !accountSuspended) await openCircuitFor(60_000);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  })();
  inFlight.set(url, request);
  try { return await request; } finally { inFlight.delete(url); }
}
