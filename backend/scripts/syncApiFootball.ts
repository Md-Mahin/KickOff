import dotenv from "dotenv";
import path from "path";
import { initializeDatabase, pool } from "../src/db";
import { callApiFootball } from "../src/services/apiFootballClient";
import { syncFixtureToDb } from "../src/services/footballService";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function sync() {
  const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  try {
    await initializeDatabase();
    const fixtures = await callApiFootball(`/fixtures?date=${date}`);
    for (const fixture of fixtures) await syncFixtureToDb(fixture);
    console.log(`[DB] Synchronized ${fixtures.length} fixtures for ${date}`);
  } catch (error) {
    console.error("API-Football sync failed:", (error as Error).message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void sync();