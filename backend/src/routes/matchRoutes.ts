import { Router, Request, Response } from "express";
import {
  getFixtures,
  getPopularFixtures,
  getFavouriteFixtures,
} from "../services/footballService";
import {
  getBasicMatchList,
  executeMatchDetailPipeline,
  pullMatchDetailsFromDatabase,
  getCachedMatchEndpoint,
} from "../services/matchPipelineService";
import { requireAuth } from "../middleware/auth";

const router = Router();

// ============================================================================
// 1. Initial Page Load: Basic Match List
// Fetches only teams and match status (LIVE, FT, UPCOMING)
// Provider responses are persisted before the database-backed result is returned.
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
router.get("/", async (req: Request, res: Response) => {
  try {
    if (req.query.basic === "true") {
      const basicData = await getBasicMatchList();
      return res.json(basicData);
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
//   1. Call configured provider for detailed data
//   2. Put and fill up the database with this data
//   3. Pull and show the data to the user DIRECTLY from the database
// ============================================================================
router.get("/:id/details", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid match ID" });
    }

    const requestPurpose = [req.headers.purpose, req.headers["sec-purpose"]]
      .flatMap((value) => Array.isArray(value) ? value : value ? [value] : []).join(" ").toLowerCase();
    if (req.headers["next-router-prefetch"] || requestPurpose.includes("prefetch")) {
      const cachedDetails = await pullMatchDetailsFromDatabase(id);
      return cachedDetails ? res.json(cachedDetails) : res.status(404).json({ message: "Match not found" });
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
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid match ID" });
  try {
    const result = await getCachedMatchEndpoint(id, "events");
    if (!result) return res.status(404).json({ message: "Match not found" });
    return res.json({ events: result.match?.events ?? [] });
  } catch (error) {
    console.error(`GET /api/matches/${id}/events error:`, error);
    return res.status(500).json({ message: "Failed to fetch match events" });
  }
});
// GET /api/matches/:id/lineups
router.get("/:id/lineups", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid match ID" });
  try {
    const result = await getCachedMatchEndpoint(id, "lineups");
    if (!result) return res.status(404).json({ message: "Match not found" });
    return res.json({ lineups: result.match?.lineups ?? [] });
  } catch (error) {
    console.error(`GET /api/matches/${id}/lineups error:`, error);
    return res.status(500).json({ message: "Failed to fetch match lineups" });
  }
});
// GET /api/matches/:id — database-backed match header; details use lazy endpoints.
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "Invalid match ID" });

    // Use pipeline: 1. API -> 2. Store to DB -> 3. Return from DB
    const match = await pullMatchDetailsFromDatabase(id);
    if (!match) return res.status(404).json({ message: "Match not found" });

    res.json(match);
  } catch (error) {
    console.error("GET /api/matches/:id error:", error);
    res.status(500).json({ message: "Failed to fetch match" });
  }
});

export default router;
