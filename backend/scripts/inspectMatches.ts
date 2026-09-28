import { pool } from "../src/db";

async function inspect() {
  const teams = await pool.query(`
    SELECT t.TeamID, t.Name, t.Type, t.ClubID, t.CountryID
    FROM Team t
    ORDER BY t.TeamID
  `);
  console.log("=== TEAMS ===");
  console.table(teams.rows);

  const matches = await pool.query(`
    SELECT 
      m.MatchID,
      m.TournamentID,
      tr.Name AS TournamentName,
      tr.Type AS TournamentType,
      m.HomeTeamID,
      ht.Name AS HomeTeam,
      ht.ClubID AS HomeClubID,
      ht.CountryID AS HomeCountryID,
      m.AwayTeamID,
      at.Name AS AwayTeam,
      at.ClubID AS AwayClubID,
      at.CountryID AS AwayCountryID
    FROM Match m
    JOIN Team ht ON m.HomeTeamID = ht.TeamID
    JOIN Team at ON m.AwayTeamID = at.TeamID
    LEFT JOIN Tournament tr ON m.TournamentID = tr.TournamentID
    ORDER BY m.MatchID
  `);
  console.log("=== MATCHES ===");
  console.table(matches.rows);

  await pool.end();
}

inspect().catch(console.error);
