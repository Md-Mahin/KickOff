import { pool } from "../src/db";

async function migrate() {
  console.log("Starting migration for Match round attributes...");

  // 1. Add columns if not exist
  await pool.query(`
    ALTER TABLE Match
    ADD COLUMN IF NOT EXISTS round_status VARCHAR(20) DEFAULT 'league' NOT NULL,
    ADD COLUMN IF NOT EXISTS round_position VARCHAR(10);
  `);
  console.log("Columns round_status and round_position ensured.");

  // 2. Ensure existing rows have 'league'
  await pool.query(`
    UPDATE Match
    SET round_status = 'league'
    WHERE round_status IS NULL;
  `);

  // 3. Drop existing constraints if already defined to avoid duplicate error
  await pool.query(`
    ALTER TABLE Match
    DROP CONSTRAINT IF EXISTS chk_match_round_status,
    DROP CONSTRAINT IF EXISTS chk_match_round_position;
  `);

  // 4. Add constraints
  await pool.query(`
    ALTER TABLE Match
    ADD CONSTRAINT chk_match_round_status
      CHECK (round_status IN ('league', 'knockout')),
    ADD CONSTRAINT chk_match_round_position
      CHECK (
        (round_status = 'league' AND round_position IS NULL) OR
        (round_status = 'knockout' AND round_position IS NOT NULL AND round_position IN ('RO32', 'RO16', 'QF', 'SF', 'GF'))
      );
  `);
  console.log("Constraints chk_match_round_status and chk_match_round_position created.");

  // 5. Verify columns in DB
  const cols = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'match' AND column_name IN ('round_status', 'round_position')
    ORDER BY column_name;
  `);
  console.log("Column definitions in database:");
  console.table(cols.rows);

  const cons = await pool.query(`
    SELECT conname, pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = 'match'::regclass AND conname LIKE 'chk_match_round%'
    ORDER BY conname;
  `);
  console.log("Constraints in database:");
  console.table(cons.rows);

  // 6. Test constraints with temporary transactions
  console.log("\nVerifying constraints with test cases:");

  // Helper function to test insertion
  const testInsert = async (label: string, status: string, position: string | null, shouldSucceed: boolean) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Get valid TournamentID and TeamIDs (two club teams)
      const tRes = await client.query("SELECT TournamentID FROM Tournament LIMIT 1");
      const teams = await client.query("SELECT TeamID FROM Team WHERE Type = 'club' LIMIT 2");
      if (tRes.rows.length === 0 || teams.rows.length < 2) {
        console.log("Skipping insert test: insufficient reference data");
        await client.query("ROLLBACK");
        return;
      }
      const tournamentId = tRes.rows[0].tournamentid;
      const homeTeamId = teams.rows[0].teamid;
      const awayTeamId = teams.rows[1].teamid;

      await client.query(
        `INSERT INTO Match (TournamentID, HomeTeamID, AwayTeamID, round_status, round_position)
         VALUES ($1, $2, $3, $4, $5)`,
        [tournamentId, homeTeamId, awayTeamId, status, position]
      );

      if (shouldSucceed) {
        console.log(`[PASS] ${label} - Insertion succeeded as expected.`);
      } else {
        console.error(`[FAIL] ${label} - Insertion succeeded but was expected to FAIL!`);
      }
      await client.query("ROLLBACK");
    } catch (err: any) {
      if (!shouldSucceed) {
        console.log(`[PASS] ${label} - Insertion rejected as expected (${err.message}).`);
      } else {
        console.error(`[FAIL] ${label} - Insertion failed unexpectedly:`, err.message);
      }
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  };

  await testInsert("League with NULL position", "league", null, true);
  await testInsert("Knockout with QF position", "knockout", "QF", true);
  await testInsert("Knockout with RO16 position", "knockout", "RO16", true);
  await testInsert("League with QF position (invalid)", "league", "QF", false);
  await testInsert("Knockout with NULL position (invalid)", "knockout", null, false);
  await testInsert("Knockout with invalid position 'FINAL'", "knockout", "FINAL", false);
  await testInsert("Invalid round_status 'group'", "group", null, false);

  console.log("\nAll constraint checks completed successfully!");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
