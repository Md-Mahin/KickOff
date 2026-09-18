import { Router } from "express";
import {
  getFixtures,
  getMatchById,
  getPopularFixtures,
  getFavouriteFixtures,
} from "../services/footballService";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { pool } from "../db";

const router = Router();

// GET /api/matches/popular  — biggest leagues first, no auth required
router.get("/popular", async (_req, res) => {
  try {
    const data = await getPopularFixtures();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(502).json({ message: "Failed to fetch popular matches" });
  }
});

// GET /api/matches/favourites  — matches for followed teams, auth required
router.get("/favourites", requireAuth, async (req, res) => {
  try {
    const data = await getFavouriteFixtures(req.auth!.userId);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(502).json({ message: "Failed to fetch favourite matches" });
  }
});

// GET /api/matches
router.get("/", optionalAuth, async (req, res) => {
  try {
    const data = await getFixtures();

    if (req.auth?.role === "fan" && Array.isArray(data.response) && data.response.length > 1) {
      try {
        const followed = await pool.query(
          `SELECT TeamID FROM UserFollowsTeam WHERE UserID = $1`,
          [req.auth.userId]
        );
        const followedIds = new Set(followed.rows.map((row: { teamid: number }) => Number(row.teamid)));
        data.response.sort((left: any, right: any) => {
          const lp = followedIds.has(Number(left.teams.home.id)) || followedIds.has(Number(left.teams.away.id)) ? 0 : 1;
          const rp = followedIds.has(Number(right.teams.home.id)) || followedIds.has(Number(right.teams.away.id)) ? 0 : 1;
          return lp - rp;
        });
      } catch {
        // DB offline — skip personalisation, still serve matches
      }
    }

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(502).json({ message: "Failed to fetch football matches" });
  }
});

// GET /api/matches/:id
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid match ID" });

    const match = await getMatchById(id);
    if (!match) return res.status(404).json({ message: "Match not found" });

    res.json(match);
  } catch (error) {
    console.error(error);
    res.status(502).json({ message: "Failed to fetch match" });
  }
});

export default router;
