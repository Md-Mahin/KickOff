import express from "express";
import { pool } from "../db";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const query = req.query.q as string;
    const filter = req.query.type as string || "All";

    if (!query) {
      return res.json([]);
    }

    const searchParam = `%${query}%`;
    let results: any[] = [];

    // Search Teams
    if (filter === "All" || filter === "Team") {
      const teamRes = await pool.query(`
        SELECT t.TeamID as id, t.Name as name, c.Name as country
        FROM Team t
        LEFT JOIN Country c ON t.CountryID = c.CountryID
        WHERE t.Name ILIKE $1
        LIMIT 5
      `, [searchParam]);
      
      results = [...results, ...teamRes.rows.map(r => ({
        id: `team-${r.id}`,
        realId: r.id,
        name: r.name,
        followers: "1.2M", // Mocked
        country: r.country || "Unknown",
        flag: "🌍",
        sport: "Football",
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(r.name)}&background=random`,
        type: "Team"
      }))];
    }

    // Search Players
    if (filter === "All" || filter === "Player") {
      const playerRes = await pool.query(`
        SELECT p.PlayerID as id, p.Name as name, c.Name as country
        FROM Player p
        LEFT JOIN Country c ON p.NationalityCountryID = c.CountryID
        WHERE p.Name ILIKE $1
        LIMIT 5
      `, [searchParam]);
      
      results = [...results, ...playerRes.rows.map(r => ({
        id: `player-${r.id}`,
        realId: r.id,
        name: r.name,
        followers: "800K", // Mocked
        country: r.country || "Unknown",
        flag: "🌍",
        sport: "Football",
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(r.name)}&background=random`,
        type: "Player"
      }))];
    }

    // Search Tournaments
    if (filter === "All" || filter === "Competition") {
      const compRes = await pool.query(`
        SELECT TournamentID as id, Name as name
        FROM Tournament
        WHERE Name ILIKE $1
        LIMIT 5
      `, [searchParam]);
      
      results = [...results, ...compRes.rows.map(r => ({
        id: `comp-${r.id}`,
        realId: r.id,
        name: r.name,
        followers: "500K",
        country: "International",
        flag: "🏆",
        sport: "Football",
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(r.name)}&background=random`,
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
        followers: "10K",
        country: r.country || "Unknown",
        flag: "🌍",
        sport: "Football",
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(r.name)}&background=random`,
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
        followers: "50K",
        country: r.country || "Unknown",
        flag: "🏟️",
        sport: "Football",
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(r.name)}&background=random`,
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

