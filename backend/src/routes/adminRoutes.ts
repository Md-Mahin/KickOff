import { Router, Request, Response } from "express";
import { pool } from "../db";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// ============================================================================
// 1. GET /api/admin/player-rankings
// Retrieves paginated & filtered player rankings based on performance ratings
// ============================================================================
router.get("/player-rankings", optionalAuth, async (req: Request, res: Response) => {
  try {
    const position = req.query.position ? String(req.query.position).toUpperCase() : "ALL";
    const search = req.query.search ? String(req.query.search).trim() : "";
    const sortBy = req.query.sortBy ? String(req.query.sortBy) : "rating";
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || 25), 10)));
    const offset = Math.max(0, parseInt(String(req.query.offset || 0), 10));

    let whereClauses: string[] = ["p.OverallRating IS NOT NULL", "pss.MatchesPlayed > 0"];
    const params: any[] = [];

    if (position !== "ALL") {
      params.push(position);
      whereClauses.push(`p.Position = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      whereClauses.push(`(p.Name ILIKE $${params.length} OR pss.TeamName ILIKE $${params.length})`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // Sort column mapping
    let orderSql = "p.OverallRating DESC NULLS LAST, pss.TotalGoals DESC, p.PlayerID ASC";
    if (sortBy === "goals") {
      orderSql = "pss.TotalGoals DESC NULLS LAST, p.OverallRating DESC";
    } else if (sortBy === "assists") {
      orderSql = "pss.TotalAssists DESC NULLS LAST, p.OverallRating DESC";
    } else if (sortBy === "tackles") {
      orderSql = "pss.TotalTackles DESC NULLS LAST, p.OverallRating DESC";
    } else if (sortBy === "saves") {
      orderSql = "pss.TotalSaves DESC NULLS LAST, p.OverallRating DESC";
    } else if (sortBy === "minutes") {
      orderSql = "pss.TotalMinutes DESC NULLS LAST, p.OverallRating DESC";
    }

    // Count query
    const countRes = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM Player p
      JOIN PlayerSeasonStatsView pss ON p.PlayerID = pss.PlayerID
      ${whereSql}
      `,
      params
    );
    const total = countRes.rows[0]?.total ?? 0;

    // Data query with row_number() over overall rating to get true rank
    const queryParams = [...params, limit, offset];
    const dataRes = await pool.query(
      `
      WITH RankedPlayers AS (
        SELECT
          p.PlayerID,
          p.Name,
          p.Position,
          p.Photo,
          p.OverallRating,
          pss.TeamID,
          pss.TeamName,
          pss.MatchesPlayed,
          pss.TotalMinutes,
          pss.TotalGoals,
          pss.TotalAssists,
          pss.TotalShots,
          pss.TotalShotsOnTarget,
          pss.TotalPasses,
          pss.TotalKeyPasses,
          pss.TotalTackles,
          pss.TotalInterceptions,
          pss.TotalClearances,
          pss.TotalSaves,
          pss.TotalCleanSheets,
          pss.TotalYellowCards,
          pss.TotalRedCards,
          pss.TotalGoalsConceded,
          pss.GoalsPer90,
          pss.AssistsPer90,
          DENSE_RANK() OVER (ORDER BY p.OverallRating DESC NULLS LAST) AS GlobalRank
        FROM Player p
        JOIN PlayerSeasonStatsView pss ON p.PlayerID = pss.PlayerID
        WHERE p.OverallRating IS NOT NULL AND pss.MatchesPlayed > 0
      )
      SELECT *
      FROM RankedPlayers pss
      ${whereSql}
      ORDER BY ${orderSql}
      LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}
      `,
      queryParams
    );

    const rankings = dataRes.rows.map((row: any) => ({
      rank: Number(row.globalrank),
      playerId: Number(row.playerid),
      name: row.name,
      position: row.position,
      photo: row.photo,
      team: row.teamname ?? "Free Agent",
      teamId: row.teamid ? Number(row.teamid) : null,
      rating: Number(row.overallrating),
      matchesPlayed: Number(row.matchesplayed),
      totalMinutes: Number(row.totalminutes),
      goals: Number(row.totalgoals),
      assists: Number(row.totalassists),
      shots: Number(row.totalshots),
      shotsOnTarget: Number(row.totalshotsontarget),
      passes: Number(row.totalpasses),
      keyPasses: Number(row.totalkeypasses),
      tackles: Number(row.totaltackles),
      interceptions: Number(row.totalinterceptions),
      clearances: Number(row.totalclearances),
      saves: Number(row.totalsaves),
      cleanSheets: Number(row.totalcleansheets),
      yellowCards: Number(row.totalyellowcards),
      redCards: Number(row.totalredcards),
      goalsConceded: Number(row.totalgoalsconceded),
      goalsPer90: row.goalsper90 ? Number(row.goalsper90) : 0,
      assistsPer90: row.assistsper90 ? Number(row.assistsper90) : 0,
    }));

    return res.json({
      rankings,
      total,
      limit,
      offset,
      hasMore: offset + rankings.length < total,
    });
  } catch (err) {
    console.error("GET /api/admin/player-rankings error:", err);
    return res.status(500).json({ message: "Failed to fetch player rankings" });
  }
});

// ============================================================================
// 2. GET /api/admin/position-breakdown
// Returns top 5 performers for Forwards, Midfielders, Defenders, and Goalkeepers
// ============================================================================
router.get("/position-breakdown", optionalAuth, async (_req: Request, res: Response) => {
  try {
    const fetchTopByPosition = async (pos: string) => {
      const result = await pool.query(
        `
        SELECT
          p.PlayerID,
          p.Name,
          p.Position,
          p.Photo,
          p.OverallRating,
          pss.TeamName,
          pss.MatchesPlayed,
          pss.TotalMinutes,
          pss.TotalGoals,
          pss.TotalAssists,
          pss.TotalTackles,
          pss.TotalSaves,
          pss.TotalCleanSheets,
          DENSE_RANK() OVER (ORDER BY p.OverallRating DESC) AS PosRank
        FROM Player p
        JOIN PlayerSeasonStatsView pss ON p.PlayerID = pss.PlayerID
        WHERE p.Position = $1 AND p.OverallRating IS NOT NULL AND pss.MatchesPlayed > 0
        ORDER BY p.OverallRating DESC, pss.TotalGoals DESC, p.PlayerID ASC
        LIMIT 5
        `,
        [pos]
      );

      return result.rows.map((row: any) => ({
        playerId: Number(row.playerid),
        name: row.name,
        position: row.position,
        photo: row.photo,
        team: row.teamname ?? "Free Agent",
        rating: Number(row.overallrating),
        matchesPlayed: Number(row.matchesplayed),
        totalMinutes: Number(row.totalminutes),
        goals: Number(row.totalgoals),
        assists: Number(row.totalassists),
        tackles: Number(row.totaltackles),
        saves: Number(row.totalsaves),
        cleanSheets: Number(row.totalcleansheets),
        posRank: Number(row.posrank),
      }));
    };

    const [forwards, midfielders, defenders, goalkeepers] = await Promise.all([
      fetchTopByPosition("F"),
      fetchTopByPosition("M"),
      fetchTopByPosition("D"),
      fetchTopByPosition("G"),
    ]);

    // Position aggregate metrics
    const statsRes = await pool.query(`
      SELECT
        p.Position,
        COUNT(*)::int AS count,
        ROUND(AVG(p.OverallRating), 2) AS avgRating,
        MAX(p.OverallRating) AS maxRating,
        MIN(p.OverallRating) AS minRating
      FROM Player p
      JOIN PlayerSeasonStatsView pss ON p.PlayerID = pss.PlayerID
      WHERE p.OverallRating IS NOT NULL AND pss.MatchesPlayed > 0
      GROUP BY p.Position
    `);

    return res.json({
      forwards,
      midfielders,
      defenders,
      goalkeepers,
      positionAverages: statsRes.rows,
    });
  } catch (err) {
    console.error("GET /api/admin/position-breakdown error:", err);
    return res.status(500).json({ message: "Failed to fetch position breakdown" });
  }
});

// ============================================================================
// 3. GET /api/admin/rating-distribution
// Computes tiered player counts and percentages for Donut / Pie Chart display
// ============================================================================
router.get("/rating-distribution", optionalAuth, async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE p.OverallRating >= 8.50)::int AS elite,
        COUNT(*) FILTER (WHERE p.OverallRating >= 7.50 AND p.OverallRating < 8.50)::int AS outstanding,
        COUNT(*) FILTER (WHERE p.OverallRating >= 6.50 AND p.OverallRating < 7.50)::int AS good,
        COUNT(*) FILTER (WHERE p.OverallRating >= 5.50 AND p.OverallRating < 6.50)::int AS average,
        COUNT(*) FILTER (WHERE p.OverallRating < 5.50)::int AS developing,
        COUNT(*)::int AS total,
        ROUND(AVG(p.OverallRating), 2) AS avgRating,
        MAX(p.OverallRating) AS maxRating,
        MIN(p.OverallRating) AS minRating
      FROM Player p
      JOIN PlayerSeasonStatsView pss ON p.PlayerID = pss.PlayerID
      WHERE p.OverallRating IS NOT NULL AND pss.MatchesPlayed > 0
    `);

    const row = result.rows[0] ?? {
      elite: 0,
      outstanding: 0,
      good: 0,
      average: 0,
      developing: 0,
      total: 0,
      avgrating: 0,
      maxrating: 0,
      minrating: 0,
    };

    const total = Number(row.total) || 1;

    const tiers = [
      {
        id: "elite",
        name: "Elite (8.5 - 10.0)",
        description: "World-class match winners and decisive performers",
        count: Number(row.elite),
        percentage: Number(((Number(row.elite) / total) * 100).toFixed(1)),
        color: "#10B981", // Emerald 500
      },
      {
        id: "outstanding",
        name: "Outstanding (7.5 - 8.49)",
        description: "High impact starters consistently exceeding expectations",
        count: Number(row.outstanding),
        percentage: Number(((Number(row.outstanding) / total) * 100).toFixed(1)),
        color: "#3B82F6", // Blue 500
      },
      {
        id: "good",
        name: "Good (6.5 - 7.49)",
        description: "Solid, reliable team contributors with net-positive match impact",
        count: Number(row.good),
        percentage: Number(((Number(row.good) / total) * 100).toFixed(1)),
        color: "#8B5CF6", // Violet 500
      },
      {
        id: "average",
        name: "Average (5.5 - 6.49)",
        description: "Standard baseline performances or limited minutes",
        count: Number(row.average),
        percentage: Number(((Number(row.average) / total) * 100).toFixed(1)),
        color: "#F59E0B", // Amber 500
      },
      {
        id: "developing",
        name: "Developing (< 5.5)",
        description: "Players with disciplinary deductions or low game participation",
        count: Number(row.developing),
        percentage: Number(((Number(row.developing) / total) * 100).toFixed(1)),
        color: "#EF4444", // Red 500
      },
    ];

    // Get top rated player overall
    const topPlayerRes = await pool.query(`
      SELECT p.PlayerID, p.Name, p.Position, p.OverallRating, pss.TeamName
      FROM Player p
      JOIN PlayerSeasonStatsView pss ON p.PlayerID = pss.PlayerID
      WHERE p.OverallRating IS NOT NULL AND pss.MatchesPlayed > 0
      ORDER BY p.OverallRating DESC
      LIMIT 1
    `);

    const topPlayer = topPlayerRes.rows[0]
      ? {
          id: Number(topPlayerRes.rows[0].playerid),
          name: topPlayerRes.rows[0].name,
          position: topPlayerRes.rows[0].position,
          rating: Number(topPlayerRes.rows[0].overallrating),
          team: topPlayerRes.rows[0].teamname ?? "Free Agent",
        }
      : null;

    return res.json({
      tiers,
      totalPlayers: Number(row.total),
      averageRating: Number(row.avgrating) || 0,
      highestRating: Number(row.maxrating) || 0,
      lowestRating: Number(row.minrating) || 0,
      topPlayer,
    });
  } catch (err) {
    console.error("GET /api/admin/rating-distribution error:", err);
    return res.status(500).json({ message: "Failed to fetch rating distribution" });
  }
});

// ============================================================================
// 4. POST /api/admin/recalculate-ratings
// Executes the PL/SQL Stored Procedure to recalculate all player ratings
// ============================================================================
router.post("/recalculate-ratings", optionalAuth, async (_req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    await pool.query(`CALL update_all_player_ratings('2025/2026')`);
    const durationMs = Date.now() - startTime;

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM Player WHERE OverallRating IS NOT NULL`
    );
    const updatedCount = countRes.rows[0]?.count ?? 0;

    return res.json({
      success: true,
      message: "Player ratings recalculated successfully via PL/SQL procedure",
      updatedCount,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("POST /api/admin/recalculate-ratings error:", err);
    return res.status(500).json({ message: "Failed to recalculate player ratings" });
  }
});

export default router;
