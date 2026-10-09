import { pool } from "../src/db";

async function testApi() {
  const matchRes = await pool.query(
    `SELECT 
      m.MatchID as id, 
      m.MatchDate as date, 
      home.TeamID as hometeamid, home.Name as hometeamname, home.Logo as hometeamlogo,
      away.TeamID as awayteamid, away.Name as awayteamname, away.Logo as awayteamlogo,
      m.HomeGoals, m.AwayGoals,
      m.round_status, m.round_position,
      t.Name as tournament
     FROM Match m
     JOIN Team home ON m.HomeTeamID = home.TeamID
     JOIN Team away ON m.AwayTeamID = away.TeamID
     JOIN Tournament t ON m.TournamentID = t.TournamentID
     WHERE m.TournamentID = 4
     ORDER BY m.MatchDate DESC
     LIMIT 100`
  );

  console.log(`Fetched ${matchRes.rows.length} matches for tournament 4.`);
  console.log("Sample rows with round attributes:");
  console.table(
    matchRes.rows.slice(0, 5).map((r) => ({
      id: r.id,
      fixture: `${r.hometeamname} vs ${r.awayteamname}`,
      score: `${r.homegoals}-${r.awaygoals}`,
      round_status: r.round_status,
      round_position: r.round_position,
    }))
  );

  await pool.end();
}

testApi().catch(console.error);

