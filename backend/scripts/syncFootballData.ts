import dotenv from "dotenv";
import path from "path";
import { pool } from "../src/db";
import { syncFootballDataToday } from "../src/services/footballDataClient";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

syncFootballDataToday()
  .then((count) => console.log(`Synchronized ${count} football-data.org matches into PostgreSQL.`))
  .catch((error) => {
    console.error("football-data.org sync failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
