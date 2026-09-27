import { Router } from "express";
import { pool } from "../db";
import { requireAuth, requireRole } from "../middleware/auth";
import { getTeamsCatalog, getPlayersCatalog } from "../services/footballService";

const router = Router();

// ── Public catalogs (used on signup page before user exists) ──────────────────

router.get("/teams/catalog", async (_req, res) => {
  try {
    const catalog = await getTeamsCatalog();
    return res.json(catalog);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch team catalog" });
  }
});

router.get("/players/catalog", async (_req, res) => {
  try {
    const catalog = await getPlayersCatalog();
    return res.json(catalog);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch player catalog" });
  }
});

// ── Follow status checks ──────────────────────────────────────────────────────

router.get("/follows", requireAuth, async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const [teamsRes, playersRes, tournamentsRes] = await Promise.all([
      pool.query(`SELECT TeamID AS id FROM UserFollowsTeam WHERE UserID = $1`, [userId]),
      pool.query(`SELECT PlayerID AS id FROM UserFollowsPlayer WHERE UserID = $1`, [userId]),
      pool.query(`SELECT TournamentID AS id FROM UserFollowsTournament WHERE UserID = $1`, [userId]),
    ]);

    return res.json({
      teams: teamsRes.rows.map(r => r.id),
      players: playersRes.rows.map(r => r.id),
      tournaments: tournamentsRes.rows.map(r => r.id),
    });
  } catch (error) {
    console.error("Error fetching user follows:", error);
    return res.status(500).json({ message: "Failed to fetch follows" });
  }
});

router.get("/follows/check", requireAuth, async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const type = String(req.query.type || "").toLowerCase();
    const id = Number(req.query.id);

    if (!id || !Number.isInteger(id)) {
      return res.status(400).json({ message: "Invalid ID parameter." });
    }

    let isFollowing = false;
    if (type === "team") {
      const r = await pool.query(`SELECT 1 FROM UserFollowsTeam WHERE UserID = $1 AND TeamID = $2`, [userId, id]);
      isFollowing = (r.rowCount ?? 0) > 0;
    } else if (type === "player") {
      const r = await pool.query(`SELECT 1 FROM UserFollowsPlayer WHERE UserID = $1 AND PlayerID = $2`, [userId, id]);
      isFollowing = (r.rowCount ?? 0) > 0;
    } else if (type === "tournament") {
      const r = await pool.query(`SELECT 1 FROM UserFollowsTournament WHERE UserID = $1 AND TournamentID = $2`, [userId, id]);
      isFollowing = (r.rowCount ?? 0) > 0;
    } else {
      return res.status(400).json({ message: "Invalid type. Must be team, player, or tournament." });
    }

    return res.json({ following: isFollowing });
  } catch (error) {
    console.error("Error checking follow status:", error);
    return res.status(500).json({ message: "Failed to check follow status" });
  }
});

// ── Team follows ──────────────────────────────────────────────────────────────

router.get("/teams", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.TeamID AS "teamId", t.Name AS "teamName", t.Logo AS "teamLogo"
       FROM UserFollowsTeam f JOIN Team t ON t.TeamID = f.TeamID
       WHERE f.UserID = $1 ORDER BY t.Name`,
      [req.auth!.userId]
    );
    return res.json({ teams: result.rows });
  } catch (error) {
    console.error("Error fetching user followed teams:", error);
    return res.status(500).json({ message: "Failed to fetch followed teams" });
  }
});

router.post("/teams/:teamId", requireAuth, async (req, res) => {
  const teamId = Number(req.params.teamId);
  if (!Number.isInteger(teamId) || teamId < 1) return res.status(400).json({ message: "Team ID must be a positive integer." });
  const team = await pool.query(`SELECT TeamID AS "teamId", Name AS "teamName" FROM Team WHERE TeamID = $1`, [teamId]);
  if (!team.rowCount) return res.status(404).json({ message: "Team not found." });

  try {
    await pool.query(
      `INSERT INTO UserFollowsTeam (UserID, TeamID) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.auth!.userId, teamId]
    );
    const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM UserFollowsTeam WHERE TeamID = $1`, [teamId]);
    const followersCount = countRes.rows[0]?.count ?? 0;
    return res.status(200).json({ team: team.rows[0], following: true, followersCount });
  } catch (error) {
    console.error("Error following team:", error);
    return res.status(500).json({ message: "Failed to follow team." });
  }
});

router.delete("/teams/:teamId", requireAuth, async (req, res) => {
  const teamId = Number(req.params.teamId);
  if (!Number.isInteger(teamId) || teamId < 1) return res.status(400).json({ message: "Team ID must be a positive integer." });

  try {
    await pool.query(
      `DELETE FROM UserFollowsTeam WHERE UserID = $1 AND TeamID = $2`,
      [req.auth!.userId, teamId]
    );
    const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM UserFollowsTeam WHERE TeamID = $1`, [teamId]);
    const followersCount = countRes.rows[0]?.count ?? 0;
    return res.status(200).json({ following: false, followersCount });
  } catch (error) {
    console.error("Error unfollowing team:", error);
    return res.status(500).json({ message: "Failed to unfollow team." });
  }
});

// ── Player follows ────────────────────────────────────────────────────────────

router.get("/players", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.PlayerID AS "playerId", p.Name AS "playerName", p.Photo AS "photo"
       FROM UserFollowsPlayer f JOIN Player p ON p.PlayerID = f.PlayerID
       WHERE f.UserID = $1 ORDER BY p.Name`,
      [req.auth!.userId]
    );
    return res.json({ players: result.rows });
  } catch (error) {
    console.error("Error fetching user followed players:", error);
    return res.status(500).json({ message: "Failed to fetch followed players" });
  }
});

router.post("/players/:playerId", requireAuth, async (req, res) => {
  const playerId = Number(req.params.playerId);
  if (!Number.isInteger(playerId) || playerId < 1) return res.status(400).json({ message: "Player ID must be a positive integer." });
  const player = await pool.query(`SELECT PlayerID AS "playerId", Name AS "playerName" FROM Player WHERE PlayerID = $1`, [playerId]);
  if (!player.rowCount) return res.status(404).json({ message: "Player not found." });

  try {
    await pool.query(
      `INSERT INTO UserFollowsPlayer (UserID, PlayerID) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.auth!.userId, playerId]
    );
    const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM UserFollowsPlayer WHERE PlayerID = $1`, [playerId]);
    const followersCount = countRes.rows[0]?.count ?? 0;
    return res.status(200).json({ player: player.rows[0], following: true, followersCount });
  } catch (error) {
    console.error("Error following player:", error);
    return res.status(500).json({ message: "Failed to follow player." });
  }
});

router.delete("/players/:playerId", requireAuth, async (req, res) => {
  const playerId = Number(req.params.playerId);
  if (!Number.isInteger(playerId) || playerId < 1) return res.status(400).json({ message: "Player ID must be a positive integer." });

  try {
    await pool.query(
      `DELETE FROM UserFollowsPlayer WHERE UserID = $1 AND PlayerID = $2`,
      [req.auth!.userId, playerId]
    );
    const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM UserFollowsPlayer WHERE PlayerID = $1`, [playerId]);
    const followersCount = countRes.rows[0]?.count ?? 0;
    return res.status(200).json({ following: false, followersCount });
  } catch (error) {
    console.error("Error unfollowing player:", error);
    return res.status(500).json({ message: "Failed to unfollow player." });
  }
});

// ── Tournament follows ────────────────────────────────────────────────────────

router.get("/tournaments", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.TournamentID AS "tournamentId", t.Name AS "tournamentName", t.Edition AS "edition"
       FROM UserFollowsTournament f JOIN Tournament t ON t.TournamentID = f.TournamentID
       WHERE f.UserID = $1 ORDER BY t.Name`,
      [req.auth!.userId]
    );
    return res.json({ tournaments: result.rows });
  } catch (error) {
    console.error("Error fetching user followed tournaments:", error);
    return res.status(500).json({ message: "Failed to fetch followed tournaments" });
  }
});

router.post("/tournaments/:tournamentId", requireAuth, async (req, res) => {
  const tournamentId = Number(req.params.tournamentId);
  if (!Number.isInteger(tournamentId) || tournamentId < 1) return res.status(400).json({ message: "Tournament ID must be a positive integer." });
  const tournament = await pool.query(`SELECT TournamentID AS "tournamentId", Name AS "tournamentName" FROM Tournament WHERE TournamentID = $1`, [tournamentId]);
  if (!tournament.rowCount) return res.status(404).json({ message: "Tournament not found." });

  try {
    await pool.query(
      `INSERT INTO UserFollowsTournament (UserID, TournamentID) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.auth!.userId, tournamentId]
    );
    const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM UserFollowsTournament WHERE TournamentID = $1`, [tournamentId]);
    const followersCount = countRes.rows[0]?.count ?? 0;
    return res.status(200).json({ tournament: tournament.rows[0], following: true, followersCount });
  } catch (error) {
    console.error("Error following tournament:", error);
    return res.status(500).json({ message: "Failed to follow tournament." });
  }
});

router.delete("/tournaments/:tournamentId", requireAuth, async (req, res) => {
  const tournamentId = Number(req.params.tournamentId);
  if (!Number.isInteger(tournamentId) || tournamentId < 1) return res.status(400).json({ message: "Tournament ID must be a positive integer." });

  try {
    await pool.query(
      `DELETE FROM UserFollowsTournament WHERE UserID = $1 AND TournamentID = $2`,
      [req.auth!.userId, tournamentId]
    );
    const countRes = await pool.query(`SELECT COUNT(*)::int AS count FROM UserFollowsTournament WHERE TournamentID = $1`, [tournamentId]);
    const followersCount = countRes.rows[0]?.count ?? 0;
    return res.status(200).json({ following: false, followersCount });
  } catch (error) {
    console.error("Error unfollowing tournament:", error);
    return res.status(500).json({ message: "Failed to unfollow tournament." });
  }
});

// ── Admin ─────────────────────────────────────────────────────────────────────

router.get("/admin/users", requireAuth, requireRole("admin"), async (_req, res) => {
  const result = await pool.query(`SELECT UserID AS "id", Username AS "name", Email AS "email", Role AS "role", CreatedAt AS "createdAt" FROM Users ORDER BY CreatedAt DESC`);
  return res.json({ users: result.rows });
});

export default router;