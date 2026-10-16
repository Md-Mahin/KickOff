import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { initializeDatabase, pool } from "../src/db";
import { syncFootballDataRange } from "../src/services/footballDataClient";

async function restoreCacheRow(endpoint: string, row: any) {
  if (!row) {
    await pool.query("DELETE FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = $1", [endpoint]);
    return;
  }
  await pool.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
    VALUES (0, $1, $2::jsonb, $3)
    ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
  [endpoint, JSON.stringify(row.payload), row.fetchedat]);
}

async function main() {
  await initializeDatabase();
  const oldToken = process.env.FOOTBALL_DATA_TOKEN;
  const oldFetch = globalThis.fetch;
  const previousState = await pool.query("SELECT Payload, FetchedAt FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = 'fd-rate-limit'");
  const previousFixtures = await pool.query("SELECT Payload, FetchedAt FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = 'fd-fixtures'");
  let calls = 0;
  process.env.FOOTBALL_DATA_TOKEN = "mock-football-data-token";
  globalThis.fetch = async () => {
    calls++;
    const lock = await pool.query(`SELECT COUNT(*)::int AS count FROM pg_locks
      WHERE locktype = 'advisory' AND classid = 0 AND objid = $1::oid`, [7_004_210]);
    assert.equal(Number(lock.rows[0]?.count ?? 0), 0,
      "football-data network I/O must not hold its PostgreSQL advisory lock");
    return new Response(JSON.stringify({ matches: [] }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    await pool.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
      VALUES (0, 'fd-rate-limit', '{}'::jsonb, CURRENT_TIMESTAMP)
      ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`);
    const start = new Date(Date.now() + randomInt(2_000_000) * 86_400_000).toISOString().slice(0, 10);
    const end = new Date(Date.parse(`${start}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    assert.equal(await syncFootballDataRange(start, end), 0);
    assert.equal(await syncFootballDataRange(start, end), 0);
    assert.equal(calls, 1, "a stored range response is reused without a second provider request");
    console.log("football-data.org tests passed: lock released during fetch, cache persisted and reused.");
  } finally {
    globalThis.fetch = oldFetch;
    if (oldToken == null) delete process.env.FOOTBALL_DATA_TOKEN;
    else process.env.FOOTBALL_DATA_TOKEN = oldToken;
    await restoreCacheRow("fd-rate-limit", previousState.rows[0]);
    await restoreCacheRow("fd-fixtures", previousFixtures.rows[0]);
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
