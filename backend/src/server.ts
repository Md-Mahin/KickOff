import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import matchRoutes from "./routes/matchRoutes";
import authRoutes from "./routes/authRoutes";
import { pool } from "./db";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "KickOff backend is running!",
  });
});

app.get("/api/test-db", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      message: "PostgreSQL connection successful",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "PostgreSQL connection failed",
    });
  }
});

app.use("/api/matches", matchRoutes);
app.use("/api/auth", authRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`KickOff backend running on http://localhost:${PORT}`);
});
