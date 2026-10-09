import { pool } from "../src/db";

async function run() {
  const t = await pool.query(`
    SELECT TournamentID, Name, Type, Edition 
    FROM Tournament 
    WHERE Name ILIKE '%Champions League%' 
       OR Name ILIKE '%World Cup%' 
       OR Name ILIKE '%Euro%' 
       OR Name ILIKE '%Cup%'
       OR Name ILIKE '%Premier%'
    LIMIT 20
  `);
  console.table(t.rows);
  await pool.end();
}

run().catch(console.error);

