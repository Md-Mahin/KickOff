import { Router } from "express";
import { pool } from "../db";

const router = Router();

// GET /api/teams/:id
router.get("/:id", async (req, res) => {
  try {
    const teamId = Number(req.params.id);

    if (Number.isNaN(teamId)) {
      return res.status(400).json({ message: "Invalid team ID" });
    }

    // 1. Team info
    const teamResult = await pool.query(
      `SELECT t.TeamID, t.Name, t.Logo,
              c.Name AS CountryName,
              cl.Name AS ClubName,
              f.Name AS FederationName
       FROM Team t
       LEFT JOIN Country c ON t.CountryID = c.CountryID
       LEFT JOIN Club cl ON t.ClubID = cl.ClubID
       LEFT JOIN Federation f ON t.FederationID = f.FederationID
       WHERE t.TeamID = $1`,
      [teamId]
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({ message: "Team not found" });
    }

    const teamRow = teamResult.rows[0];
    const team = {
      id: teamRow.teamid,
      name: teamRow.name,
      logo: teamRow.logo,
      country: teamRow.countryname,
      club: teamRow.clubname,
      federation: teamRow.federationname,
    };

    // 2. Home venue (most common venue where team plays as home)
    const venueResult = await pool.query(
      `SELECT v.Name, v.City
       FROM (
         SELECT VenueID, COUNT(*) AS cnt
         FROM Match
         WHERE HomeTeamID = $1 AND VenueID IS NOT NULL
         GROUP BY VenueID
         ORDER BY cnt DESC
         LIMIT 1
       ) mv
       JOIN Venue v ON v.VenueID = mv.VenueID`,
      [teamId]
    );

    const homeVenue =
      venueResult.rows.length > 0
        ? { name: venueResult.rows[0].name, city: venueResult.rows[0].city }
        : null;

    // 3. Tournament participations
    const tournamentsResult = await pool.query(
      `SELECT t.TournamentID, t.Name, t.Type, t.Edition
       FROM TournamentParticipation tp
       JOIN Tournament t ON tp.TournamentID = t.TournamentID
       WHERE tp.TeamID = $1`,
      [teamId]
    );

    const tournaments = tournamentsResult.rows.map((row: any) => ({
      id: row.tournamentid,
      name: row.name,
      type: row.type,
      edition: row.edition,
    }));

    // 4. Matches
    const matchesResult = await pool.query(
      `SELECT m.MatchID, m.MatchDate,
              m.HomeGoals, m.AwayGoals,
              m.HomeTeamID, m.AwayTeamID,
              ht.Name AS HomeTeamName, ht.Logo AS HomeTeamLogo,
              at.Name AS AwayTeamName, at.Logo AS AwayTeamLogo,
              t.Name AS TournamentName,
              v.Name AS VenueName
       FROM Match m
       JOIN Team ht ON m.HomeTeamID = ht.TeamID
       JOIN Team at ON m.AwayTeamID = at.TeamID
       JOIN Tournament t ON m.TournamentID = t.TournamentID
       LEFT JOIN Venue v ON m.VenueID = v.VenueID
       WHERE m.HomeTeamID = $1 OR m.AwayTeamID = $1
       ORDER BY m.MatchDate DESC`,
      [teamId]
    );

    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const matches = matchesResult.rows.map((row: any) => {
      const matchDate = new Date(row.matchdate);
      let status: string;
      if (matchDate > now) {
        status = "UPCOMING";
      } else if (matchDate > twoHoursAgo) {
        status = "LIVE";
      } else {
        status = "FT";
      }

      const isHome = row.hometeamid === teamId;
      const teamGoals = isHome ? row.homegoals : row.awaygoals;
      const opponentGoals = isHome ? row.awaygoals : row.homegoals;
      let result: string;
      if (teamGoals > opponentGoals) {
        result = "W";
      } else if (teamGoals < opponentGoals) {
        result = "L";
      } else {
        result = "D";
      }

      return {
        id: row.matchid,
        date: row.matchdate,
        status,
        homeTeam: {
          id: row.hometeamid,
          name: row.hometeamname,
          logo: row.hometeamlogo,
        },
        awayTeam: {
          id: row.awayteamid,
          name: row.awayteamname,
          logo: row.awayteamlogo,
        },
        homeGoals: row.homegoals,
        awayGoals: row.awaygoals,
        result,
        tournament: row.tournamentname,
        venue: row.venuename,
      };
    });

    // 5. Standings — for each tournament this team participates in, get ALL rows
    const standingsResult = await pool.query(
      `SELECT s.TournamentID,
              t.Name AS TournamentName,
              s.Ranking, s.TeamID,
              tm.Name AS TeamName,
              c.Name AS CountryName,
              s.Wins, s.Draws, s.Losses,
              s.GoalsFor, s.GoalsAgainst, s.Points
       FROM Standing s
       JOIN Tournament t ON s.TournamentID = t.TournamentID
       JOIN Team tm ON s.TeamID = tm.TeamID
       LEFT JOIN Country c ON tm.CountryID = c.CountryID
       WHERE s.TournamentID IN (
         SELECT TournamentID FROM TournamentParticipation WHERE TeamID = $1
       )
       ORDER BY s.TournamentID, s.Ranking ASC`,
      [teamId]
    );

    const standingsMap = new Map<number, any>();
    for (const row of standingsResult.rows) {
      const tid = row.tournamentid;
      if (!standingsMap.has(tid)) {
        standingsMap.set(tid, {
          tournamentId: tid,
          tournamentName: row.tournamentname,
          rows: [],
        });
      }
      const played = (row.wins ?? 0) + (row.draws ?? 0) + (row.losses ?? 0);
      standingsMap.get(tid).rows.push({
        rank: row.ranking,
        teamId: row.teamid,
        teamName: row.teamname,
        country: row.countryname,
        played,
        wins: row.wins ?? 0,
        draws: row.draws ?? 0,
        losses: row.losses ?? 0,
        goalsFor: row.goalsfor ?? 0,
        goalsAgainst: row.goalsagainst ?? 0,
        goalDifference: (row.goalsfor ?? 0) - (row.goalsagainst ?? 0),
        points: row.points ?? 0,
      });
    }
    const standings = Array.from(standingsMap.values());

    // 6. Current squad
    const squadResult = await pool.query(
      `SELECT p.PlayerID, p.Name, p.DateOfBirth,
              c.Name AS Nationality,
              tph.Type AS Position
       FROM TeamPlayerHistory tph
       JOIN Player p ON tph.PlayerID = p.PlayerID
       LEFT JOIN Country c ON p.NationalityCountryID = c.CountryID
       WHERE tph.TeamID = $1 AND tph.EndDate IS NULL`,
      [teamId]
    );

    const squad = squadResult.rows.map((row: any) => ({
      id: row.playerid,
      name: row.name,
      dateOfBirth: row.dateofbirth,
      nationality: row.nationality,
      position: row.position,
    }));

    res.json({ team, homeVenue, tournaments, matches, standings, squad });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch team data" });
  }
});

export default router;
