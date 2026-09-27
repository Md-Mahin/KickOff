import { Router, Request, Response } from "express";
import {
  getFixtures,
  getMatchById,
  getPopularFixtures,
  getFavouriteFixtures,
  getMatchEvents,
  getMatchLineups,
} from "../services/footballService";
import {
  getBasicMatchList,
  executeMatchDetailPipeline,
  pullMatchDetailsFromDatabase,
} from "../services/matchPipelineService";
import { optionalAuth, requireAuth } from "../middleware/auth";

const router = Router();

// ============================================================================
// 1. Initial Page Load: Basic Match List
// Fetches only teams and match status (LIVE, FT, UPCOMING)
// Fallback: Uses backup mock data ONLY if API-Football call fails
// ============================================================================
router.get("/basic", async (_req: Request, res: Response) => {
  try {
    const data = await getBasicMatchList();
    return res.json(data);
  } catch (error) {
    console.error("GET /api/matches/basic error:", error);
    return res.status(500).json({ message: "Failed to fetch basic matches" });
  }
});

// GET /api/matches/popular — biggest leagues first
router.get("/popular", async (_req: Request, res: Response) => {
  try {
    const data = await getPopularFixtures();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(502).json({ message: "Failed to fetch popular matches" });
  }
});

// GET /api/matches/favourites — matches for followed teams
router.get("/favourites", requireAuth, async (req: Request, res: Response) => {
  try {
    const data = await getFavouriteFixtures(req.auth!.userId);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(502).json({ message: "Failed to fetch favourite matches" });
  }
});

// GET /api/matches
router.get("/", optionalAuth, async (req: Request, res: Response) => {
  try {
    if (req.query.basic === "true") {
      const basicData = await getBasicMatchList();
      return res.json(basicData);
    }

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

// ============================================================================
// 2. User Interaction: Click on Match -> Trigger Detailed Data Fetch
// Database Caching Strategy (Strict Pipeline):
//   1. Call API-Football for detailed data (Fallback to mock data on failure)
//   2. Put and fill up the database with this data
//   3. Pull and show the data to the user DIRECTLY from the database
// ============================================================================
router.get("/:id/details", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid match ID" });
    }

    // Execute the strict 3-step pipeline
    const matchDetails = await executeMatchDetailPipeline(id);
    return res.json(matchDetails);
  } catch (error) {
    console.error(`GET /api/matches/${req.params.id}/details pipeline error:`, error);
    return res.status(500).json({
      message: "Failed to execute match details pipeline",
      error: (error as Error).message,
    });
  }
});

// GET /api/matches/:id/events
router.get("/:id/events", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid match ID" });
    }

    // Step 1: Check if match details and events already exist directly in DB
    const existingDb = await pullMatchDetailsFromDatabase(id);
    if (existingDb) {
      if (existingDb.fixture.status.short === "UPCOMING") {
        return res.json({ events: [] });
      }
      if (Array.isArray(existingDb.events) && existingDb.events.length > 0) {
        return res.json({ events: existingDb.events });
      }
    }

    // Step 2: Strict Pipeline (API / Mock -> Store in DB -> Pull from DB)
    const pipelineData = await executeMatchDetailPipeline(id);
    if (pipelineData) {
      if (pipelineData.fixture?.status?.short === "UPCOMING") {
        return res.json({ events: [] });
      }
      if (Array.isArray(pipelineData.events)) {
        return res.json({ events: pipelineData.events });
      }
    }

    // Fallback to legacy
    const events = await getMatchEvents(id);
    res.json({ events: events ?? [] });
  } catch (error) {
    console.error(`GET /api/matches/${req.params.id}/events error:`, error);
    try {
      const fallbackEvents = await getMatchEvents(Number(req.params.id));
      res.json({ events: fallbackEvents ?? [] });
    } catch {
      res.status(500).json({ message: "Failed to fetch match events" });
    }
  }
});

// GET /api/matches/:id/lineups
router.get("/:id/lineups", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid match ID" });
    }

    // Step 1: Check if match lineups already exist directly in DB
    const existingDb = await pullMatchDetailsFromDatabase(id);
    if (existingDb && Array.isArray(existingDb.lineups) && existingDb.lineups.length > 0) {
      return res.json({ lineups: existingDb.lineups });
    }

    // Step 2: Strict Pipeline
    const pipelineData = await executeMatchDetailPipeline(id);
    if (pipelineData && Array.isArray(pipelineData.lineups)) {
      return res.json({ lineups: pipelineData.lineups });
    }

    // Fallback to legacy
    const lineups = await getMatchLineups(id);
    res.json({ lineups: lineups ?? [] });
  } catch (error) {
    console.error(`GET /api/matches/${req.params.id}/lineups error:`, error);
    try {
      const fallbackLineups = await getMatchLineups(Number(req.params.id));
      res.json({ lineups: fallbackLineups ?? [] });
    } catch {
      res.status(500).json({ message: "Failed to fetch match lineups" });
    }
  }
});

// GET /api/matches/:id — Uses the strict pipeline to populate DB and read directly from DB
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid match ID" });

    // Use pipeline: 1. API/Mock -> 2. Store to DB -> 3. Return from DB
    const match = await executeMatchDetailPipeline(id);
    if (!match) return res.status(404).json({ message: "Match not found" });

    res.json(match);
  } catch (error) {
    console.error("GET /api/matches/:id error:", error);
    // Fallback to legacy getMatchById if pipeline threw unexpected error
    const match = await getMatchById(Number(req.params.id));
    if (!match) return res.status(404).json({ message: "Match not found" });
    res.json(match);
  }
});

export default router;
