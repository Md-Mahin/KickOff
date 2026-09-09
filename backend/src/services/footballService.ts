import { pool } from "../db";

function mapDbRowToApiFixture(row: any) {
  // Determine status based on MatchDate
  // For mock purposes, if date is in the past, it's FT.
  let statusShort = "UPCOMING";
  let elapsed: number | null = null;
  const matchDate = new Date(row.matchdate);
  const now = new Date();
  
  const diffMs = now.getTime() - matchDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins >= 0 && diffMins < 120) {
    statusShort = "LIVE";
    elapsed = diffMins > 45 ? (diffMins > 60 ? diffMins - 15 : 45) : diffMins; // Rough estimate of minute
  } else if (diffMins >= 120) {
    statusShort = "FT";
    elapsed = 90;
  }

  return {
    fixture: {
      id: row.matchid,
      status: {
        short: statusShort,
        elapsed: elapsed,
      },
    },
    league: {
      id: row.tournamentid,
      name: row.tournamentname,
      country: "International", // Assuming International since no country in DB schema for Tournament
    },
    teams: {
      home: {
        id: row.hometeamid,
        name: row.hometeamname,
        logo: null,
      },
      away: {
        id: row.awayteamid,
        name: row.awayteamname,
        logo: null,
      },
    },
    goals: {
      home: row.homegoals,
      away: row.awaygoals,
    },
  };
}

export async function getFixtures() {
  try {
    const query = `
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
        away.Name AS AwayTeamName
      FROM Match m
      JOIN Tournament t ON m.TournamentID = t.TournamentID
      JOIN Team home ON m.HomeTeamID = home.TeamID
      JOIN Team away ON m.AwayTeamID = away.TeamID
      ORDER BY m.MatchDate DESC
    `;

    const result = await pool.query(query);
    
    // If DB is up but completely empty, also use fallback data for demonstration
    if (result.rows.length === 0) {
      throw new Error("No matches found in DB, using fallback data");
    }

    return {
      response: result.rows.map(mapDbRowToApiFixture),
    };
  } catch (error) {
    console.warn("Using fallback matches. Database query failed:", (error as Error).message);
    
    // Fallback data if database is not running or empty
    return {
      response: [
        {
          fixture: { id: 991, status: { short: "LIVE", elapsed: 45 } },
          league: { id: 1, name: "Champions League", country: "International" },
          teams: {
            home: { id: 1, name: "Arsenal", logo: null },
            away: { id: 2, name: "Real Madrid", logo: null }
          },
          goals: { home: 1, away: 0 }
        },
        {
          fixture: { id: 992, status: { short: "UPCOMING", elapsed: null } },
          league: { id: 1, name: "Champions League", country: "International" },
          teams: {
            home: { id: 3, name: "Bayern Munich", logo: null },
            away: { id: 4, name: "PSG", logo: null }
          },
          goals: { home: 0, away: 0 }
        }
      ]
    };
  }
}

export async function getMatchById(id: number) {
  try {
    const query = `
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
        away.Name AS AwayTeamName
      FROM Match m
      JOIN Tournament t ON m.TournamentID = t.TournamentID
      JOIN Team home ON m.HomeTeamID = home.TeamID
      JOIN Team away ON m.AwayTeamID = away.TeamID
      WHERE m.MatchID = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      throw new Error("Match not found in DB");
    }

    return mapDbRowToApiFixture(result.rows[0]);
  } catch (error) {
    console.warn("Using fallback match data for getMatchById. Database query failed:", (error as Error).message);
    
    // Return a mock match based on ID
    return {
      fixture: { id: id, status: { short: id === 991 ? "LIVE" : "FT", elapsed: id === 991 ? 45 : 90 } },
      league: { id: 1, name: "Champions League", country: "International" },
      teams: {
        home: { id: 1, name: "Arsenal", logo: null },
        away: { id: 2, name: "Real Madrid", logo: null }
      },
      goals: { home: 1, away: 0 }
    };
  }
}
