import { pool } from "../src/db";

async function run() {
  const t = await pool.query("SELECT TournamentID, Name, Type, Edition FROM Tournament ORDER BY TournamentID");
  console.log("=== Tournaments ===");
  console.table(t.rows);

  const m = await pool.query("SELECT round_status, round_position, COUNT(*) FROM Match GROUP BY round_status, round_position");
  console.log("=== Match Round Distribution ===");
  console.table(m.rows);

  const tm = await pool.query(`
    SELECT t.TournamentID, t.Name, m.round_status, m.round_position, COUNT(*) 
    FROM Match m 
    JOIN Tournament t ON m.TournamentID = t.TournamentID 
    GROUP BY t.TournamentID, t.Name, m.round_status, m.round_position
    ORDER BY t.TournamentID, m.round_status, m.round_position
  `);
  console.log("=== Matches by Tournament and Round ===");
  console.table(tm.rows);

  await pool.end();
}

run().catch(console.error);

