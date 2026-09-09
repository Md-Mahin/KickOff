import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import matchRoutes from "./routes/matchRoutes";
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import { initializeDatabase, pool } from "./db";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:3000", credentials: true }));
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
app.use("/api/users", userRoutes);

const PORT = process.env.PORT || 5000;

initializeDatabase()
  .then(() => {
    console.log("Database initialized successfully.");
  })
  .catch((error) => {
    console.warn("Unable to initialize the database schema (server will still start):", error.message);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`KickOff backend running on http://localhost:${PORT}`);
    });
  });
