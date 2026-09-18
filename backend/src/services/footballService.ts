
import { pool } from "../db";

function mapMatch(row: any) {
  let status = "UPCOMING";
  let elapsed: number | null = null;

  const date = new Date(row.matchdate);
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);

  if (mins >= 0 && mins < 120) {
    status = "LIVE";
    elapsed = mins > 45 ? 45 : mins;
  } else if (mins >= 120) {
    status = "FT";
    elapsed = 90;
  }

  return {
    fixture: {
      id: row.matchid,
      status: {
        short: status,
        elapsed,
      },
    },
    league: {
      id: row.tournamentid,
      name: row.tournamentname,
      country: "International",
    },
    teams: {
      home: {
        id: row.hometeamid,
        name: row.hometeamname,
        logo: row.hometeamlogo
      },
      away: {
        id: row.awayteamid,
        name: row.awayteamname,
        logo: row.awayteamlogo,
      },
    },
    goals: {
      home: row.homegoals,
      away: row.awaygoals,
    },
  };
}

const baseQuery = `
  SELECT
    m.MatchID,
    m.HomeGoals,
    m.AwayGoals,
    m.MatchDate,
    t.TournamentID,
    t.Name AS TournamentName,
    home.TeamID AS HomeTeamID,
    home.Name AS HomeTeamName,
    away.TeamID AS AwayTeamID,
    away.Name AS AwayTeamName,
    home.Logo AS HomeTeamLogo,
    away.Logo AS AwayTeamLogo
  FROM Match m
  JOIN Tournament t ON m.TournamentID = t.TournamentID
  JOIN Team home ON m.HomeTeamID = home.TeamID
  JOIN Team away ON m.AwayTeamID = away.TeamID
`;

export async function getFixtures() {
  const query = `
    ${baseQuery}
    ORDER BY m.MatchDate DESC
  `;

  const result = await pool.query(query);

  return {
    response: result.rows.map(mapMatch),
  };
}

export async function getMatchById(id: number) {
  const query = `
    ${baseQuery}
    WHERE m.MatchID = $1
  `;

  const result = await pool.query(query, [id]);

  if (result.rows.length === 0) {
    return null;
  }

  return mapMatch(result.rows[0]);
}

