import dotenv from "dotenv";
import path from "path";
import { pool } from "../src/db";
import { syncSecondaryFootballProvidersToday } from "../src/services/secondaryFootballProviders";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

syncSecondaryFootballProvidersToday()
  .then(() => console.log("Synchronized configured secondary providers into PostgreSQL."))
  .catch((error) => {
    console.error("Secondary provider sync failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
