import { pool } from "../src/db";

async function run() {
  const m = await pool.query(`
    SELECT m.MatchID, m.round_status, m.round_position, m.MatchDate,
           ht.Name as HomeTeam, at.Name as AwayTeam, m.HomeGoals, m.AwayGoals
    FROM Match m
    JOIN Team ht ON m.HomeTeamID = ht.TeamID
    JOIN Team at ON m.AwayTeamID = at.TeamID
    WHERE m.TournamentID = 4
    ORDER BY m.MatchDate DESC
  `);
  console.log(`Tournament 4 match count: ${m.rows.length}`);
  console.table(m.rows.slice(0, 15));
  await pool.end();
}

run().catch(console.error);

