import assert from "node:assert/strict";
import { createHash, randomUUID } from "crypto";
import dotenv from "dotenv";
import path from "path";
import { initializeDatabase, pool } from "../src/db";
import {
  callApiFootball,
  getApiFootballBudgetReport,
  readQuotaHeaders,
  reconcileApiFootballQuota,
} from "../src/services/apiFootballClient";
import { getMissingDetailCategories } from "../src/services/providerCapabilities";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex").slice(0, 16);
const cacheEndpoint = (path: string) => `af-${createHash("sha1").update(path).digest("hex").slice(0, 12)}`;
const testFixtureBase = Date.now() * 1000;

async function main() {
  await initializeDatabase();
  const originalKey = process.env.API_FOOTBALL_KEY;
  const originalFetch = globalThis.fetch;
  const originalState = await pool.query("SELECT Payload FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = 'api-football-state'");
  const legacyUsage = await pool.query(`SELECT COALESCE(SUM(RequestCount), 0)::int AS count
    FROM ApiFootballDailyUsage WHERE UpdatedAt >= CURRENT_TIMESTAMP - INTERVAL '24 hours'`);
  const legacyCount = Number(legacyUsage.rows[0]?.count ?? 0);
  assert.ok(legacyCount < 60, "existing usage must leave room to exercise the bulk ceiling");
  const testKeys: string[] = [];
  const testPaths: string[] = [];
  let mockCalls = 0;
  let nextResponse: { status: number; headers?: Record<string, string>; body?: unknown } | null = null;
  const mockedFetch: typeof fetch = async () => {
    mockCalls++;
    const configured = nextResponse;
    nextResponse = null;
    const status = configured?.status ?? 200;
    const headers = configured?.headers ?? {
      "x-ratelimit-requests-remaining": String(Math.max(0, 200 - mockCalls)),
      "x-ratelimit-requests-limit": "200",
      "x-ratelimit-remaining": "9",
      "x-ratelimit-limit": "10",
    };
    const body = configured?.body ?? { response: [], errors: [] };
    return new Response(JSON.stringify(body), { status, headers });
  };
  globalThis.fetch = mockedFetch;

  async function setTestQuota() {
    const key = `api-football-test-${randomUUID()}`;
    testKeys.push(hashKey(key));
    process.env.API_FOOTBALL_KEY = key;
    await reconcileApiFootballQuota({ remaining: 200, limit: 200, accountVerified: true, accountActive: true, dashboardVerified: true, verifiedAt: new Date().toISOString() });
  }

  function track(path: string) {
    testPaths.push(path);
    return path;
  }

  try {
    const configuredKey = process.env.API_FOOTBALL_KEY;
    delete process.env.API_FOOTBALL_KEY;
    const callsBeforeInvalidKey = mockCalls;
    await assert.rejects(callApiFootball(track(`/fixtures/events?fixture=${testFixtureBase - 1}`)), /API key not configured/);
    assert.equal(mockCalls, callsBeforeInvalidKey, "an invalid or missing key must never reach fetch");
    if (configuredKey == null) delete process.env.API_FOOTBALL_KEY;
    else process.env.API_FOOTBALL_KEY = configuredKey;
    const headers = readQuotaHeaders(new Headers({
      "x-ratelimit-requests-remaining": "77",
      "x-ratelimit-requests-limit": "100",
      "x-ratelimit-remaining": "4",
      "x-ratelimit-limit": "10",
    }));
    assert.deepEqual(headers, { remaining: 77, limit: 100, rateLimitRemaining: 4, rateLimitLimit: 10 });
    assert.equal(readQuotaHeaders(new Headers({ "x-ratelimit-remaining": "4" })).remaining, null,
      "per-minute headers must not be mistaken for daily quota");
    assert.deepEqual(getMissingDetailCategories({
      fixture: { venue: null, referees: [] }, events: [], lineups: [], teamStatistics: null, headToHead: [],
    }), ["venue", "referee", "events", "lineups", "coaches", "substitutes", "playerStats", "statistics", "headToHead", "standings"]);

    await setTestQuota();
    const coalescedPath = track(`/fixtures/events?fixture=${testFixtureBase}`);
    const beforeSingleFlight = mockCalls;
    await Promise.all(Array.from({ length: 12 }, () => callApiFootball(coalescedPath, { purpose: "user-detail" })));
    assert.equal(mockCalls - beforeSingleFlight, 1, "concurrent identical requests must share one provider call");
    const ledger = await pool.query(`SELECT FixtureID, RemainingQuota, RequestQuotaLimit, RateLimitRemaining, RateLimitLimit
      FROM ApiFootballRequestLedger WHERE KeyFingerprint = $1 AND Endpoint = $2 AND IsProviderRequest = TRUE
      ORDER BY RequestID DESC LIMIT 1`, [testKeys[0], coalescedPath]);
    assert.equal(Number(ledger.rows[0]?.fixtureid), testFixtureBase, "ledger should extract the verified provider fixture ID");
    assert.equal(Number(ledger.rows[0]?.requestquotalimit), 200);
    assert.equal(Number(ledger.rows[0]?.ratelimitremaining), 9);
    assert.equal(Number(ledger.rows[0]?.ratelimitlimit), 10);
    await callApiFootball(coalescedPath, { purpose: "user-detail" });
    assert.equal(mockCalls - beforeSingleFlight, 1, "cached negative responses must avoid another provider call");
    const cacheHits = await pool.query(`SELECT COUNT(*)::int AS count FROM ApiFootballRequestLedger
      WHERE KeyFingerprint = $1 AND Endpoint = $2 AND IsProviderRequest = FALSE AND CacheStatus = 'hit'`,
      [testKeys[0], coalescedPath]);
    assert.ok(Number(cacheHits.rows[0]?.count) >= 1, "cache hits should be ledgered without consuming provider budget");

    await pool.query(`UPDATE ApiFootballRequestLedger SET RequestedAt = CURRENT_TIMESTAMP - INTERVAL '61 seconds'
      WHERE KeyFingerprint = $1 AND IsProviderRequest = TRUE`, [testKeys[0]]);
    const minuteBefore = mockCalls;
    const minuteResults = await Promise.allSettled(Array.from({ length: 11 }, (_, index) =>
      callApiFootball(track(`/fixtures/events?fixture=${testFixtureBase + 500 + index}`), { purpose: "user-detail" })));
    assert.equal(minuteResults.filter((item) => item.status === "fulfilled").length, 10,
      "the shared provider must enforce the 10-request-per-minute limit");
    assert.equal(mockCalls - minuteBefore, 10, "the eleventh request in a minute must not reach fetch");

    await pool.query(`UPDATE ApiFootballRequestLedger SET RequestedAt = CURRENT_TIMESTAMP - INTERVAL '61 seconds'
      WHERE KeyFingerprint = $1 AND IsProviderRequest = TRUE`, [testKeys[0]]);

    await setTestQuota();
    async function seedDailyUsage(target: number) {
      const rowCount = Math.max(0, target - legacyCount);
      await pool.query(`INSERT INTO ApiFootballRequestLedger
        (Endpoint, Purpose, CacheStatus, IsProviderRequest, KeyFingerprint, RequestedAt)
        SELECT 'test-seed-' || n::text, 'bulk-backfill', 'miss', TRUE, $1,
          CURRENT_TIMESTAMP - INTERVAL '61 seconds'
        FROM generate_series(1, $2::int) AS n`, [testKeys.at(-1), rowCount]);
    }
    await seedDailyUsage(59);
    const bulkBefore = mockCalls;
    const bulkResults = await Promise.allSettled([
      callApiFootball(track(`/fixtures/events?fixture=${testFixtureBase + 1001}`), { purpose: "bulk-backfill" }),
      callApiFootball(track(`/fixtures/events?fixture=${testFixtureBase + 1002}`), { purpose: "bulk-backfill" }),
    ]);
    assert.equal(bulkResults.filter((item) => item.status === "fulfilled").length, 1,
      "the 60-request noninteractive daily ceiling allows exactly one request at 59 daily requests");
    assert.equal(mockCalls - bulkBefore, 1, "the daily budget must block the second provider call");

    await setTestQuota();
    await seedDailyUsage(79);
    const userBefore = mockCalls;
    const userCalls = await Promise.allSettled([
      callApiFootball(track(`/fixtures/lineups?fixture=${testFixtureBase + 2001}`), { purpose: "user-detail" }),
      callApiFootball(track(`/fixtures/lineups?fixture=${testFixtureBase + 2002}`), { purpose: "user-detail" }),
    ]);
    assert.equal(userCalls.filter((item) => item.status === "fulfilled").length, 1,
      "user details can consume the protected reserve only up to the 80-request application ceiling");
    assert.equal(mockCalls - userBefore, 1);
    const budget = await getApiFootballBudgetReport();
    assert.equal(budget.rolling24HourRequests, 80);
    assert.equal(budget.applicationCeiling, 80);

    await setTestQuota();
    const retryPath = track(`/fixtures/events?fixture=${testFixtureBase + 3001}`);
    nextResponse = { status: 429, headers: { "retry-after": "30", "x-ratelimit-requests-remaining": "50" }, body: { errors: { requests: "Too many" } } };
    await assert.rejects(callApiFootball(retryPath), /API-Football 429/);
    const after429 = mockCalls;
    await assert.rejects(callApiFootball(track(`/fixtures/events?fixture=${testFixtureBase + 3002}`)), /cooldown active/);
    assert.equal(mockCalls, after429, "429 cooldown must pause subsequent requests");

    await setTestQuota();
    const forbiddenPath = track(`/fixtures/events?fixture=${testFixtureBase + 4001}`);
    nextResponse = { status: 403, body: { errors: { message: "Account suspended" } } };
    await assert.rejects(callApiFootball(forbiddenPath), /API-Football 403/);
    const after403 = mockCalls;
    await assert.rejects(callApiFootball(track(`/fixtures/events?fixture=${testFixtureBase + 4002}`)), /paused/);
    assert.equal(mockCalls, after403, "403 must pause the provider until explicit verification");
    const pausedReport = await getApiFootballBudgetReport();
    assert.match(String(pausedReport.pauseReason), /403/);
    assert.match(String(pausedReport.pauseReason), /Account suspended/);
    await assert.rejects(reconcileApiFootballQuota({ remaining: 40, limit: 100, accountVerified: true,
      accountActive: false, dashboardVerified: true, verifiedAt: new Date().toISOString() }), /official dashboard/);
    await reconcileApiFootballQuota({ remaining: 40, limit: 100, accountVerified: true, accountActive: true,
      dashboardVerified: true, verifiedAt: new Date().toISOString() });
    assert.equal((await getApiFootballBudgetReport()).suspended, false, "manual reconciliation may clear the pause");

    console.log("API-Football client tests passed: invalid key, daily/minute quota parsing, single-flight, negative cache, atomic 60/80 caps, 429 cooldown, 403 pause reason, and dashboard-guarded reconciliation.");
  } finally {
    globalThis.fetch = originalFetch;
    await pool.query("DELETE FROM ApiFootballRequestLedger WHERE KeyFingerprint = ANY($1::varchar[])", [testKeys]);
    const cacheKeys = testPaths.map(cacheEndpoint);
    if (cacheKeys.length) await pool.query("DELETE FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = ANY($1::varchar[])", [cacheKeys]);
    if (originalState.rows.length) {
      await pool.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
        VALUES (0, 'api-football-state', $1::jsonb, CURRENT_TIMESTAMP)
        ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
        [JSON.stringify(originalState.rows[0].payload)]);
    } else {
      await pool.query("DELETE FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = 'api-football-state'");
    }
    if (originalKey == null) delete process.env.API_FOOTBALL_KEY;
    else process.env.API_FOOTBALL_KEY = originalKey;
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
