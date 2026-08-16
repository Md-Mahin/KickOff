import { Router } from "express";
import {
  getFixtures,
  getMatchById,
} from "../services/footballService";

const router = Router();

// GET /api/matches
router.get("/", async (_req, res) => {
  try {
    const data = await getFixtures();

    res.json(data);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch football matches",
    });
  }
});

// GET /api/matches/:id
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (Number.isNaN(id)) {
      return res.status(400).json({
        message: "Invalid match ID",
      });
    }

    const match = await getMatchById(id);

    if (!match) {
      return res.status(404).json({
        message: "Match not found",
      });
    }

    res.json(match);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch match",
    });
  }
});

export default router;