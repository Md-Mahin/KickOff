import { pool } from "../db";

const API_BASE = "https://v3.football.api-sports.io";
const DAILY_LIMIT = 95; // Keep five calls in reserve for manual/operational use.
const inFlight = new Map<string, Promise<any[]>>();
const responseCache = new Map<string, { value: any[]; expiresAt: number }>();
let circuitOpenUntil = 0;
let setup: Promise<void> | null = null;

async function ensureUsageTable() {
  setup ??= pool.query(`
    CREATE TABLE IF NOT EXISTS ApiFootballDailyUsage (
      UsageDate DATE PRIMARY KEY DEFAULT CURRENT_DATE,
      RequestCount INTEGER NOT NULL DEFAULT 0,
      UpdatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).then(() => undefined).catch((error) => { setup = null; throw error; });
  await setup;
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
  const ttl = path.startsWith("/fixtures?date=") ? 3 * 60 * 60_000 : 0;
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
        if (response.status === 429 || response.status >= 500) circuitOpenUntil = Date.now() + (response.status === 429 ? 60 * 60_000 : 60_000);
        throw new Error(`API-Football returned ${response.status}`);
      }
      circuitOpenUntil = 0;
      const body = await response.json() as { response?: any[] };
      const result = Array.isArray(body.response) ? body.response : [];
      if (ttl) responseCache.set(url, { value: result, expiresAt: Date.now() + ttl });
      return result;
    } catch (error) {
      if (!circuitOpenUntil) circuitOpenUntil = Date.now() + 60_000;
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  })();
  inFlight.set(url, request);
  try { return await request; } finally { inFlight.delete(url); }
}
