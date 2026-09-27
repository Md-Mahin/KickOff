import { Router } from "express";
import {
  getFixtures,
  getMatchById,
  getPopularFixtures,
  getFavouriteFixtures,
  getMatchEvents,
  getMatchLineups,
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
    if (req.auth?.role === "fan") {
      const data = await getFavouriteFixtures(req.auth.userId);
      return res.json(data);
    }

    const data = await getFixtures();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(502).json({ message: "Failed to fetch football matches" });
  }
});


router.get("/:id/events", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid match ID" });
    }

    const events = await getMatchEvents(id);
    res.json({ events });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch match events" });
  }
});

router.get("/:id/lineups", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "Invalid match ID" });
    }

    const lineups = await getMatchLineups(id);
    res.json({ lineups });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch match lineups" });
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
