import { Router } from "express";

import { pool } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.get("/teams/catalog", requireAuth, async (_req, res) => {
  const result = await pool.query(`SELECT TeamID AS "teamId", Name AS "teamName" FROM Team ORDER BY Name`);
  return res.json({ teams: result.rows });
});

router.get("/teams", requireAuth, requireRole("fan"), async (req, res) => {
  const result = await pool.query(
    `SELECT t.TeamID AS "teamId", t.Name AS "teamName"
     FROM UserFollowsTeam f JOIN Team t ON t.TeamID = f.TeamID
     WHERE f.UserID = $1 ORDER BY t.Name`,
    [req.auth!.userId]
  );
  return res.json({ teams: result.rows });
});

router.post("/teams/:teamId", requireAuth, requireRole("fan"), async (req, res) => {
  const teamId = Number(req.params.teamId);
  if (!Number.isInteger(teamId) || teamId < 1) return res.status(400).json({ message: "Team ID must be a positive integer." });
  const team = await pool.query("SELECT TeamID AS \"teamId\", Name AS \"teamName\" FROM Team WHERE TeamID = $1", [teamId]);
  if (!team.rowCount) return res.status(404).json({ message: "Team not found." });
  try {
    await pool.query("INSERT INTO UserFollowsTeam (UserID, TeamID) VALUES ($1, $2)", [req.auth!.userId, teamId]);
    return res.status(201).json({ team: team.rows[0] });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return res.status(409).json({ message: "You already follow this team." });
    throw error;
  }
});

router.delete("/teams/:teamId", requireAuth, requireRole("fan"), async (req, res) => {
  const teamId = Number(req.params.teamId);
  if (!Number.isInteger(teamId) || teamId < 1) return res.status(400).json({ message: "Team ID must be a positive integer." });
  const result = await pool.query("DELETE FROM UserFollowsTeam WHERE UserID = $1 AND TeamID = $2", [req.auth!.userId, teamId]);
  if (!result.rowCount) return res.status(404).json({ message: "That team is not in your followed list." });
  return res.status(204).send();
});

router.get("/admin/users", requireAuth, requireRole("admin"), async (_req, res) => {
  const result = await pool.query(`SELECT UserID AS "id", Username AS "name", Email AS "email", Role AS "role", CreatedAt AS "createdAt" FROM Users ORDER BY CreatedAt DESC`);
  return res.json({ users: result.rows });
});

export default router;