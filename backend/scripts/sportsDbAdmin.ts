import { createHash } from "node:crypto";
import dotenv from "dotenv";
import path from "node:path";
import { pool } from "../src/db";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

function keyFingerprint(key: string) {
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command !== "report" && command !== "reconcile") {
    throw new Error("Usage: npm run sportsdb:admin -- report | reconcile --account-active --endpoint-verified --verified-at <ISO timestamp>");
  }

  const configuredKey = process.env.SPORTSDB_API_KEY?.trim();
  if (!configuredKey) throw new Error("SPORTSDB_API_KEY is not configured");
  const stateResult = await pool.query("SELECT Payload FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = 'tds-rate-limit'");
  const state = stateResult.rows[0]?.payload ?? {};

  if (command === "report") {
    console.log(JSON.stringify({ configured: true, paused: Boolean(state.paused), pauseReason: state.pauseReason ?? null,
      lastStatus: state.lastStatus ?? null, lastStatusAt: state.lastStatusAt ?? null,
      keyMatchesConfigured: !state.keyFingerprint || state.keyFingerprint === keyFingerprint(configuredKey),
      nextAllowedAt: state.nextAllowedAt ?? null, retryAt: state.retryAt ?? null,
      documentedFreeTierLimit: "30 requests per minute" }, null, 2));
    return;
  }

  if (!args.includes("--account-active") || !args.includes("--endpoint-verified")) {
    throw new Error("Verify the account and documented endpoint first, then include --account-active --endpoint-verified");
  }
  const verifiedIndex = args.indexOf("--verified-at");
  const verifiedAt = verifiedIndex >= 0 ? Date.parse(args[verifiedIndex + 1] ?? "") : NaN;
  if (!Number.isFinite(verifiedAt) || Date.now() - verifiedAt > 5 * 60_000 || verifiedAt > Date.now() + 30_000) {
    throw new Error("A recent verification timestamp (within five minutes) is required");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
      VALUES (0, 'tds-rate-limit', $1::jsonb, CURRENT_TIMESTAMP)
      ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
      [JSON.stringify({ ...state, paused: false, pauseReason: null, retryAt: null, failures: 0,
        keyFingerprint: keyFingerprint(configuredKey), verifiedAt: new Date(verifiedAt).toISOString() })]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  console.log("TheSportsDB pause cleared after verification; documented request pacing remains enabled.");
}

main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
}).finally(() => pool.end());
