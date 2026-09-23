import { Router } from "express";
import { pool } from "../db";

const router = Router();

// GET /api/players/:id
router.get("/:id", async (req, res) => {
  try {
    const playerId = Number(req.params.id);

    if (Number.isNaN(playerId)) {
      return res.status(400).json({ message: "Invalid player ID" });
    }

    // 1. Player info
    const playerResult = await pool.query(
      `SELECT p.PlayerID, p.Name, p.DateOfBirth, c.Name AS Nationality
       FROM Player p
       LEFT JOIN Country c ON p.NationalityCountryID = c.CountryID
       WHERE p.PlayerID = $1`,
      [playerId]
    );

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ message: "Player not found" });
    }

    const playerRow = playerResult.rows[0];
    const player = {
      id: playerRow.playerid,
      name: playerRow.name,
      dateOfBirth: playerRow.dateofbirth,
      nationality: playerRow.nationality,
    };

    // 2. Followers
    const followersResult = await pool.query(
      `SELECT COUNT(*) FROM UserFollowsPlayer WHERE PlayerID = $1`,
      [playerId]
    );
    const followers = Number(followersResult.rows[0].count);

    // 3. Current Club
    const clubResult = await pool.query(
      `SELECT t.TeamID as id, t.Name, t.Logo, tph.Type as position, tph.BeginDate as joinDate
       FROM TeamPlayerHistory tph
       JOIN Team t ON tph.TeamID = t.TeamID
       WHERE tph.PlayerID = $1 AND tph.EndDate IS NULL
       LIMIT 1`,
      [playerId]
    );

    let club = null;
    if (clubResult.rows.length > 0) {
      const clubRow = clubResult.rows[0];
      club = {
        id: clubRow.id,
        name: clubRow.name,
        logo: clubRow.logo,
        position: clubRow.position,
        joinDate: clubRow.joindate,
      };
    }

    // 4. Stats
    const goalsResult = await pool.query(
      `SELECT COUNT(*) FROM Event WHERE PlayerID = $1 AND EventType = 'Goal'`,
      [playerId]
    );
    const totalGoals = Number(goalsResult.rows[0].count);

    const assistsResult = await pool.query(
      `SELECT COUNT(*) FROM Goal WHERE AssistPlayerID = $1`,
      [playerId]
    );
    const totalAssists = Number(assistsResult.rows[0].count);

    const stats = {
      totalGoals,
      totalAssists,
    };

    // 5. Matches (Prev & Next)
    let finalMatches: any[] = [];
    
    if (club && club.id) {
      const teamId = club.id;
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

      const ftMatches = matches.filter((m: any) => m.status === "FT");
      const prevMatch = ftMatches.length > 0 ? ftMatches[0] : null;

      const futureMatches = matches.filter((m: any) => m.status !== "FT");
      const nextMatch = futureMatches.length > 0 ? futureMatches[futureMatches.length - 1] : null;

      if (prevMatch) finalMatches.push(prevMatch);
      if (nextMatch) finalMatches.push(nextMatch);
      
      // Sort the final matches array by date
      finalMatches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    res.json({
      player,
      followers,
      club,
      matches: finalMatches,
      stats,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch player data" });
  }
});

export default router;
