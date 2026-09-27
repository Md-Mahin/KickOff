import { pool, initializeDatabase } from "../src/db";

async function main() {
  console.log("=== Initializing Player Match Stats & Rating Schema ===");
  try {
    await initializeDatabase();
    console.log("✓ Database initialized successfully!");

    // Verify PlayerMatchStat table exists
    const tCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('playermatchstat', 'playerratinghistory')
    `);
    console.log("Found tables:", tCheck.rows.map(r => r.table_name));

    // Verify view exists
    const vCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_name = 'playerseasonstatsview'
    `);
    console.log("Found views:", vCheck.rows.map(r => r.table_name));

    // Verify stored procedure exists
    const pCheck = await pool.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_name = 'update_all_player_ratings'
    `);
    console.log("Found routine:", pCheck.rows.map(r => r.routine_name));

    console.log("Schema migration verification complete!");
  } catch (err) {
    console.error("Initialization error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
