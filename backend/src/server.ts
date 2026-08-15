import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import matchRoutes from "./routes/matchRoutes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "KickOff backend is running!",
  });
});

app.use("/api/matches", matchRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`KickOff backend running on http://localhost:${PORT}`);
});