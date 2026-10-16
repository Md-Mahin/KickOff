
import express from "express";
import { pool } from "../db";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const filter = typeof req.query.type === "string" ? req.query.type : "All";

    if (!query) {
      return res.json([]);
    }

    // Treat search text literally. Unescaped '%' and '_' otherwise turn a
    // name search into an unexpectedly broad database scan.
    const escapedQuery = query.replace(/[\\%_]/g, "\\$&");
    const searchParam = `%${escapedQuery}%`;
    let results: any[] = [];

    // Search Teams
    if (filter === "All" || filter === "Team") {
      const teamRes = await pool.query(`
        SELECT t.TeamID as id, t.Name as name, t.Logo as logo, c.Name as country,
          (SELECT COUNT(*)::int FROM UserFollowsTeam f WHERE f.TeamID = t.TeamID) AS followers
        FROM Team t
        LEFT JOIN Country c ON t.CountryID = c.CountryID
        WHERE t.Name ILIKE $1
        LIMIT 5
      `, [searchParam]);
      
      results = [...results, ...teamRes.rows.map(r => ({
        id: `team-${r.id}`,
        realId: r.id,
        name: r.name,
        followers: r.followers,
        country: r.country || "Unknown",
        flag: "🌍",
        sport: "Football",
        avatar: r.logo ?? null,
        type: "Team"
      }))];
    }

    // Search Players
    if (filter === "All" || filter === "Player") {
      const playerRes = await pool.query(`
        SELECT p.PlayerID as id, p.Name as name, c.Name as country, p.Photo as photo,
          (SELECT COUNT(*)::int FROM UserFollowsPlayer f WHERE f.PlayerID = p.PlayerID) AS followers
        FROM Player p
        LEFT JOIN Country c ON p.NationalityCountryID = c.CountryID
        WHERE p.Name ILIKE $1 ESCAPE E'\\\\'
        ORDER BY
          CASE WHEN LOWER(p.Name) = LOWER($2) THEN 0
               WHEN LOWER(p.Name) LIKE LOWER($3) ESCAPE E'\\\\' THEN 1
               ELSE 2 END,
          followers DESC, p.Name ASC
        LIMIT $4
      `, [searchParam, escapedQuery, `${escapedQuery}%`, filter === "Player" ? 25 : 8]);
      
      results = [...results, ...playerRes.rows.map(r => ({
        id: `player-${r.id}`,
        realId: r.id,
        name: r.name,
        followers: r.followers,
        country: r.country || "Unknown",
        flag: "🌍",
        sport: "Football",
        avatar: r.photo ?? null,
        type: "Player"
      }))];
    }

    // Search Tournaments
    if (filter === "All" || filter === "Competition") {
      const compRes = await pool.query(`
        SELECT t.TournamentID as id, t.Name as name,
          (SELECT COUNT(*)::int FROM UserFollowsTournament f WHERE f.TournamentID = t.TournamentID) AS followers
        FROM Tournament t
        WHERE t.Name ILIKE $1
        LIMIT 5
      `, [searchParam]);
      
      results = [...results, ...compRes.rows.map(r => ({
        id: `comp-${r.id}`,
        realId: r.id,
        name: r.name,
        followers: r.followers,
        country: "International",
        flag: "🏆",
        sport: "Football",
        avatar: null,
        type: "Competition"
      }))];
    }

    // Search Referees
    if (filter === "All" || filter === "Referee") {
      const refRes = await pool.query(`
        SELECT r.RefereeID as id, r.Name as name, c.Name as country
        FROM Referee r
        LEFT JOIN Country c ON r.NationalityCountryID = c.CountryID
        WHERE r.Name ILIKE $1
        LIMIT 5
      `, [searchParam]);
      
      results = [...results, ...refRes.rows.map(r => ({
        id: `ref-${r.id}`,
        realId: r.id,
        name: r.name,
        followers: "—",
        country: r.country || "Unknown",
        flag: "🌍",
        sport: "Football",
        avatar: null,
        type: "Referee"
      }))];
    }

    // Search Venues
    if (filter === "All" || filter === "Venue") {
      const venueRes = await pool.query(`
        SELECT v.VenueID as id, v.Name as name, c.Name as country
        FROM Venue v
        LEFT JOIN Country c ON v.CountryID = c.CountryID
        WHERE v.Name ILIKE $1
        LIMIT 5
      `, [searchParam]);
      
      results = [...results, ...venueRes.rows.map(r => ({
        id: `venue-${r.id}`,
        realId: r.id,
        name: r.name,
        followers: "—",
        country: r.country || "Unknown",
        flag: "🏟️",
        sport: "Football",
        avatar: null,
        type: "Venue"
      }))];
    }

    res.json(results);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;


