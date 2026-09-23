import express from "express";
import { pool } from "../db";

const router = express.Router();

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid tournament ID" });
    }

    // 1. Fetch Tournament Info
    const infoRes = await pool.query(
      `SELECT TournamentID as id, Name as name, Type as type, Edition as edition
       FROM Tournament WHERE TournamentID = $1`,
      [id]
    );

    if (infoRes.rows.length === 0) {
      return res.status(404).json({ message: "Tournament not found" });
    }

    const tRow = infoRes.rows[0];

    const tournamentInfo = {
      id: tRow.id,
      name: tRow.name,
      type: tRow.type,
      edition: tRow.edition,
      logo: `https://ui-avatars.com/api/?name=${encodeURIComponent(tRow.name)}&background=random&color=fff&size=128`, // Mock logo
      country: "Europe", // Mock region/country
    };

    // 2. Followers (mocking deterministic based on ID)
    const followers = 100000 + (id * 50000);

    // 3. Matches
    // Fetch some matches for this tournament
    const matchRes = await pool.query(
      `SELECT 
        m.MatchID as id, 
        m.MatchDate as date, 
        home.TeamID as hometeamid, home.Name as hometeamname, home.Logo as hometeamlogo,
        away.TeamID as awayteamid, away.Name as awayteamname, away.Logo as awayteamlogo,
        m.HomeGoals, m.AwayGoals,
        t.Name as tournament
       FROM Match m
       JOIN Team home ON m.HomeTeamID = home.TeamID
       JOIN Team away ON m.AwayTeamID = away.TeamID
       JOIN Tournament t ON m.TournamentID = t.TournamentID
       WHERE m.TournamentID = $1
       ORDER BY m.MatchDate DESC
       LIMIT 20`,
      [id]
    );

    const matches = matchRes.rows.map(row => {
      const d = new Date(row.date);
      const mins = Math.floor((Date.now() - d.getTime()) / 60000);
      let status = "UPCOMING";
      if (mins >= 0 && mins < 120) status = "LIVE";
      else if (mins >= 120) status = "FT";

      let result = null;
      if (status === "FT") {
        if (row.homegoals > row.awaygoals) result = "W";
        else if (row.homegoals < row.awaygoals) result = "L";
        else result = "D";
      }

      return {
        id: row.id,
        date: row.date,
        status,
        homeTeam: { id: row.hometeamid, name: row.hometeamname, logo: row.hometeamlogo },
        awayTeam: { id: row.awayteamid, name: row.awayteamname, logo: row.awayteamlogo },
        homeGoals: row.homegoals ?? 0,
        awayGoals: row.awaygoals ?? 0,
        result,
        tournament: row.tournament,
        venue: null,
      };
    });

    // 4. Standings
    const stdRes = await pool.query(
      `SELECT 
        s.Ranking, s.Wins, s.Losses, s.Draws, s.Points, s.GoalsFor, s.GoalsAgainst,
        t.TeamID, t.Name as TeamName, t.Logo as TeamLogo
       FROM Standing s
       JOIN Team t ON s.TeamID = t.TeamID
       WHERE s.TournamentID = $1
       ORDER BY s.Ranking ASC, s.Points DESC`,
      [id]
    );

    const standings = stdRes.rows.map(row => ({
      rank: row.ranking,
      teamId: row.teamid,
      teamName: row.teamname,
      teamLogo: row.teamlogo,
      played: (row.wins || 0) + (row.draws || 0) + (row.losses || 0),
      wins: row.wins || 0,
      draws: row.draws || 0,
      losses: row.losses || 0,
      goalsFor: row.goalsfor || 0,
      goalsAgainst: row.goalsagainst || 0,
      goalDifference: (row.goalsfor || 0) - (row.goalsagainst || 0),
      points: row.points || 0,
      last5: ["W", "D", "W", "L", "W"] // Mock since we don't have historical match sequence per team easily
    }));

    res.json({
      tournament: tournamentInfo,
      followers,
      matches,
      standings
    });
  } catch (error) {
    console.error("Tournament API Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;

