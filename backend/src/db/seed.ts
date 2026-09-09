import fs from "fs";
import path from "path";
import { pool } from "./index";

async function seed() {
  try {
    console.log("Reading seed.sql...");
    const seedSqlPath = path.resolve(__dirname, "../../database/seed.sql");
    const seedSql = fs.readFileSync(seedSqlPath, "utf-8");

    console.log("Executing seed.sql...");
    await pool.query(seedSql);

    console.log("Successfully seeded the database!");
  } catch (error) {
    console.error("Error seeding the database:", error);
  } finally {
    await pool.end();
  }
}

seed();

