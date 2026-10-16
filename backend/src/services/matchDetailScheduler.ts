import { pool } from "../db";
import { syncFootballDataMatchDetails } from "./footballDataClient";
import { syncSportsDbMatchDetails } from "./sportsDbClient";

const SCHEDULER_LOCK_ID = 7_004_218;
const DEFAULT_BATCH_SIZE = 3;
const RUN_INTERVAL_MS = 60_000;
let timer: NodeJS.Timeout | null = null;
let activeRun: Promise<number> | null = null;

export async function syncMappedMatchDetailsBatch(batchSize = DEFAULT_BATCH_SIZE): Promise<number> {
  if (activeRun) return activeRun;
  activeRun = runBatch(batchSize).finally(() => { activeRun = null; });
  return activeRun;
}

async function runBatch(batchSize: number): Promise<number> {
  const client = await pool.connect();
  let locked = false;
  try {
    const lock = await client.query("SELECT pg_try_advisory_lock($1) AS locked", [SCHEDULER_LOCK_ID]);
    locked = lock.rows[0]?.locked === true;
    if (!locked) return 0;

    const candidates = await client.query(`
      SELECT m.ApiFixtureID, m.ApiStatus,
        cache.FetchedAt,
        COALESCE((cache.Payload->>'hasLineups')::boolean, false) AS has_lineups,
        COALESCE((cache.Payload->>'eventCount')::int, 0) AS event_count,
        COALESCE((cache.Payload->>'hasVenue')::boolean, false) AS has_venue,
        COALESCE((cache.Payload->>'hasReferee')::boolean, false) AS has_referee,
        COALESCE((cache.Payload->>'hasCoaches')::boolean, false) AS has_coaches,
        cache.Payload->>'permission' AS permission,
        cache.Payload->>'retryAt' AS retry_at
      FROM Match m
      LEFT JOIN MatchApiCache cache
        ON cache.MatchID = m.ApiFixtureID
       AND cache.Endpoint = CASE
         WHEN m.ApiFixtureID >= 8000000000000 THEN 'tds-detail'
         ELSE 'fd-detail'
       END
      WHERE m.ApiFixtureID >= 7000000000000
        AND m.ApiFixtureID < 9000000000000
        AND (cache.FetchedAt IS NULL OR cache.FetchedAt < CURRENT_TIMESTAMP - INTERVAL '10 minutes')
        AND (cache.Payload->>'retryAt' IS NULL OR (cache.Payload->>'retryAt')::timestamptz <= CURRENT_TIMESTAMP)
      ORDER BY
        (cache.FetchedAt IS NULL) DESC,
        (NOT COALESCE((cache.Payload->>'hasLineups')::boolean, false)) DESC,
        (COALESCE((cache.Payload->>'eventCount')::int, 0) = 0) DESC,
        cache.FetchedAt ASC NULLS FIRST,
        m.MatchDate DESC
      LIMIT $1
    `, [Math.max(1, Math.min(10, Math.floor(batchSize)))]);

    let synced = 0;
    for (const row of candidates.rows) {
      const fixtureId = Number(row.apifixtureid);
      try {
        const updated = fixtureId >= 8_000_000_000_000
          ? await syncSportsDbMatchDetails(fixtureId, row.apistatus ?? "UPCOMING")
          : await syncFootballDataMatchDetails(fixtureId);
        if (updated) synced++;
      } catch (error) {
        const message = (error as Error).message ?? "provider error";
        if (!/timeout|abort/i.test(message)) console.warn(`[match-sync] Fixture ${fixtureId} skipped: ${message}`);
      }
    }
    return synced;
  } finally {
    if (locked) await client.query("SELECT pg_advisory_unlock($1)", [SCHEDULER_LOCK_ID]);
    client.release();
  }
}

export function startMatchDetailScheduler() {
  if (timer) return;
  const run = () => {
    void syncMappedMatchDetailsBatch().then((count) => {
      if (count > 0) console.info(`[match-sync] Persisted details for ${count} mapped fixtures`);
    }).catch((error) => console.warn(`[match-sync] Background batch failed: ${(error as Error).message}`));
  };
  run();
  timer = setInterval(run, RUN_INTERVAL_MS);
  timer.unref();
}