import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { pool } from "../src/db";
import { syncSportsDbRange } from "../src/services/sportsDbClient";

async function main() {
  const originalFetch = globalThis.fetch;
  const originalState = await pool.query(
    "SELECT Payload, FetchedAt FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = 'tds-rate-limit'",
  );
  const originalKey = process.env.SPORTSDB_API_KEY;
  assert.ok(originalKey, "SPORTSDB_API_KEY must be configured for this database test");
  const keyFingerprint = createHash("sha256").update(originalKey).digest("hex").slice(0, 16);
  let mockedCalls = 0;
  globalThis.fetch = (async () => {
    mockedCalls++;
    const lock = await pool.query(`SELECT COUNT(*)::int AS count FROM pg_locks
      WHERE locktype = 'advisory' AND classid = 0 AND objid = $1::oid`, [7_004_211]);
    assert.equal(Number(lock.rows[0]?.count ?? 0), 0,
      "TheSportsDB network I/O must not hold its PostgreSQL advisory lock");
    return new Response("Forbidden", { status: 403 });
  }) as typeof fetch;

  try {
    await pool.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
      VALUES (0, 'tds-rate-limit', $1::jsonb, CURRENT_TIMESTAMP)
      ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
      [JSON.stringify({ keyFingerprint, nextAllowedAt: new Date(Date.now() - 5_000).toISOString() })]);

    const date = new Date().toISOString().slice(0, 10);
    await assert.rejects(syncSportsDbRange(date, date), /paused after HTTP 403/);
    assert.equal(mockedCalls, 1, "the access-denied response should be requested once");

    await assert.rejects(syncSportsDbRange(date, date), /TheSportsDB is paused/);
    assert.equal(mockedCalls, 1, "a persisted 403 pause must prevent another provider request");

    const state = await pool.query("SELECT Payload FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = 'tds-rate-limit'");
    assert.equal(state.rows[0]?.payload?.paused, true);
    assert.equal(state.rows[0]?.payload?.lastStatus, 403);
    console.log("TheSportsDB access guard passed: HTTP 403 is recorded and subsequent lookups make no provider request.");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalState.rows.length) {
      await pool.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
        VALUES (0, 'tds-rate-limit', $1::jsonb, $2)
        ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
        [JSON.stringify(originalState.rows[0].payload), originalState.rows[0].fetchedat]);
    } else {
      await pool.query("DELETE FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = 'tds-rate-limit'");
    }
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
