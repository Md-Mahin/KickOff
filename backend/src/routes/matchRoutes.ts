import { Router } from "express";
import { getFixtures } from "../services/footballService";

const router = Router();

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

export default router;