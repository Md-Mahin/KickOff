import { pool, withTransaction, initializeDatabase } from "../src/db";

async function runTests() {
  console.log("=================================================================");
  console.log("TESTING DATABASE FEATURES: TRANSACTIONS, TRIGGERS, FUNCTIONS, PROCEDURES & QUERIES");
  console.log("=================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 0. Ensure schema, triggers, functions, and procedures are initialized
    await initializeDatabase();

    // ── 1. Explicit Transaction Control (COMMIT & ROLLBACK) ───────────────────
    console.log("--- 1. Testing Explicit Transaction Control (COMMIT & ROLLBACK) ---");
    
    // Test A: Successful Transaction (COMMIT)
    let committedUserEmail = `tx_test_${Date.now()}@kickoff.com`;
    let insertedUserId: number | null = null;
    await withTransaction(async (client) => {
      const res = await client.query(
        `INSERT INTO Users (Username, Email, PasswordHash, Role)
         VALUES ($1, $2, 'dummyhash', 'fan')
         RETURNING UserID`,
        [`User_${Date.now()}`, committedUserEmail]
      );
      insertedUserId = res.rows[0].userid;
    });

    const checkCommit = await pool.query(
      `SELECT 1 FROM Users WHERE UserID = $1`,
      [insertedUserId]
    );
    assert(checkCommit.rows.length === 1, "Transaction successfully COMMITTED changes to database");

    // Test B: Failed Transaction (ROLLBACK)
    let rolledBackEmail = `tx_rollback_${Date.now()}@kickoff.com`;
    let rollbackThrew = false;
    try {
      await withTransaction(async (client) => {
        // Step 1: Insert user
        await client.query(
          `INSERT INTO Users (Username, Email, PasswordHash, Role)
           VALUES ($1, $2, 'dummyhash', 'fan')`,
          [`RollbackUser_${Date.now()}`, rolledBackEmail]
        );
        // Step 2: Deliberate error to trigger ROLLBACK
        throw new Error("Intentional failure to test ROLLBACK behavior");
      });
    } catch {
      rollbackThrew = true;
    }

    const checkRollback = await pool.query(
      `SELECT 1 FROM Users WHERE Email = $1`,
      [rolledBackEmail]
    );
    assert(rollbackThrew, "Error inside transaction callback was caught");
    assert(checkRollback.rows.length === 0, "Explicit ROLLBACK prevented partial write to database");

    // ── 2. Use of Triggers (Validation & Shadow Tables) ────────────────────────
    console.log("\n--- 2. Testing Triggers (Data Validation & Shadow Table Auditing) ---");

    // Test A: Validation Trigger before DML (check_lineup_team_in_match)
    let invalidLineupBlocked = false;
    try {
      // Pick a match
      const mRes = await pool.query(`SELECT MatchID, HomeTeamID, AwayTeamID FROM Match LIMIT 1`);
      if (mRes.rows.length > 0) {
        const m = mRes.rows[0];
        // Pick a team that is NOT participating in this match
        const otherTeamRes = await pool.query(
          `SELECT TeamID FROM Team WHERE TeamID <> $1 AND TeamID <> $2 LIMIT 1`,
          [m.hometeamid, m.awayteamid]
        );
        const pRes = await pool.query(`SELECT PlayerID FROM Player LIMIT 1`);
        if (otherTeamRes.rows.length > 0 && pRes.rows.length > 0) {
          await pool.query(
            `INSERT INTO Lineup (MatchID, TeamID, PlayerID, Status)
             VALUES ($1, $2, $3, 'Starter')`,
            [m.matchid, otherTeamRes.rows[0].teamid, pRes.rows[0].playerid]
          );
        }
      }
    } catch (trgErr) {
      if ((trgErr as Error).message.includes("is not a participant in MatchID")) {
        invalidLineupBlocked = true;
      }
    }
    assert(invalidLineupBlocked, "Validation Trigger (trg_lineup_team_check) rejected invalid team assignment before DML");

    // Test B: Shadow Table Trigger for Player Transfer (trg_player_transfer_sync)
    const pSample = await pool.query(`SELECT PlayerID FROM Player LIMIT 1`);
    const tSample = await pool.query(`SELECT TeamID FROM Team LIMIT 2`);
    let transferAudited = false;
    if (pSample.rows.length > 0 && tSample.rows.length >= 2) {
      const pid = pSample.rows[0].playerid;
      const t1 = tSample.rows[0].teamid;
      const t2 = tSample.rows[1].teamid;

      // Call procedure sp_process_player_transfer
      await withTransaction(async (client) => {
        await client.query(
          `CALL sp_process_player_transfer($1, $2, CURRENT_DATE, 'Permanent Transfer')`,
          [pid, t2]
        );
      });

      // Check shadow table PlayerTransferAudit
      const auditCheck = await pool.query(
        `SELECT * FROM PlayerTransferAudit WHERE PlayerID = $1 ORDER BY AuditID DESC LIMIT 1`,
        [pid]
      );
      if (auditCheck.rows.length > 0 && auditCheck.rows[0].action === 'INSERT') {
        transferAudited = true;
      }
    }
    assert(transferAudited, "Shadow Table Trigger (trg_player_transfer_sync) logged transfer to PlayerTransferAudit");

    // Test C: Security Audit Shadow Table Trigger (trg_user_security_audit)
    if (insertedUserId) {
      await withTransaction(async (client) => {
        await client.query(`UPDATE Users SET Role = 'admin' WHERE UserID = $1`, [insertedUserId]);
      });
      const secAudit = await pool.query(
        `SELECT * FROM SecurityAuditLog WHERE UserID = $1 ORDER BY AuditID DESC LIMIT 1`,
        [insertedUserId]
      );
      assert(
        secAudit.rows.length > 0 && secAudit.rows[0].action === 'ROLE_CHANGE',
        "Security Trigger (trg_user_security_audit) logged role modification to SecurityAuditLog"
      );
    }

    // Test D: Integrity Trigger: Forbid Club vs National Matchup (trg_match_club_country_check)
    let clubVsNatBlocked = false;
    try {
      const natTeamRes = await pool.query(`SELECT TeamID, Name FROM Team WHERE Type = 'national' LIMIT 1`);
      if (natTeamRes.rows.length > 0) {
        const natId = natTeamRes.rows[0].teamid;
        // Team 1 is Arsenal (club). Attempt to pair club with national team:
        await pool.query(
          `INSERT INTO Match (MatchID, TournamentID, HomeTeamID, AwayTeamID, MatchDate)
           VALUES (88888, 1, 1, $1, NOW())`,
          [natId]
        );
      }
    } catch (trgErr) {
      if ((trgErr as Error).message.includes("Forbidden: Club teams cannot play national teams")) {
        clubVsNatBlocked = true;
      }
    }
    assert(clubVsNatBlocked, "Integrity Trigger (trg_match_club_country_check) rejected forbidden match between club and national team");


    // ── 3. Use of Functions (Computed & Statistical Values) ───────────────────
    console.log("\n--- 3. Testing Database Functions (Computed & Statistical Values) ---");

    // Test A: fn_calculate_player_rating
    const pForRating = await pool.query(
      `SELECT PlayerID FROM PlayerMatchStat WHERE MinutesPlayed > 0 LIMIT 1`
    );
    if (pForRating.rows.length > 0) {
      const pid = pForRating.rows[0].playerid;
      const fnRes = await pool.query(
        `SELECT fn_calculate_player_rating($1) AS rating`,
        [pid]
      );
      const rating = Number(fnRes.rows[0]?.rating);
      assert(
        rating >= 1.0 && rating <= 10.0,
        `Function fn_calculate_player_rating computed rating on 0-10 scale (Score: ${rating})`
      );
    } else {
      console.log("ℹ️ Skipping player rating function check (no player match stats found)");
    }

    // Test B: fn_get_team_win_ratio
    const tForRatio = await pool.query(`SELECT TeamID FROM Team LIMIT 1`);
    if (tForRatio.rows.length > 0) {
      const tid = tForRatio.rows[0].teamid;
      const ratioRes = await pool.query(
        `SELECT fn_get_team_win_ratio($1) AS win_ratio`,
        [tid]
      );
      const ratio = Number(ratioRes.rows[0]?.win_ratio);
      assert(
        ratio >= 0.0 && ratio <= 100.0,
        `Function fn_get_team_win_ratio returned computed statistical win percentage (${ratio}%)`
      );
    }

    // Test C: fn_get_player_form
    if (pForRating.rows.length > 0) {
      const pid = pForRating.rows[0].playerid;
      const formRes = await pool.query(
        `SELECT fn_get_player_form($1, 5) AS recent_form`,
        [pid]
      );
      const form = Number(formRes.rows[0]?.recent_form);
      assert(
        form >= 0.0 && form <= 10.0,
        `Function fn_get_player_form computed average form over last 5 matches (${form})`
      );
    }

    // ── 4. Use of Procedures (Multi-Step Workflows) ───────────────────────────
    console.log("\n--- 4. Testing Stored Procedures (Multi-Step Table Modifying Workflows) ---");

    // Test A: update_all_player_ratings
    await withTransaction(async (client) => {
      await client.query(`CALL update_all_player_ratings('2025/2026')`);
    });

    const ratedPlayersRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM Player WHERE OverallRating IS NOT NULL`
    );
    const historyRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM PlayerRatingHistory WHERE Season = '2025/2026'`
    );
    assert(
      (ratedPlayersRes.rows[0]?.count ?? 0) > 0,
      `Procedure update_all_player_ratings updated Player.OverallRating (${ratedPlayersRes.rows[0]?.count} players)`
    );
    assert(
      (historyRes.rows[0]?.count ?? 0) > 0,
      `Procedure update_all_player_ratings populated PlayerRatingHistory (${historyRes.rows[0]?.count} records)`
    );

    // Test B: sp_process_player_transfer
    if (pSample.rows.length > 0 && tSample.rows.length >= 2) {
      const pid = pSample.rows[0].playerid;
      const t1 = tSample.rows[0].teamid;
      await withTransaction(async (client) => {
        await client.query(`CALL sp_process_player_transfer($1, $2, CURRENT_DATE, 'Loan')`, [pid, t1]);
      });
      const tphCheck = await pool.query(
        `SELECT * FROM TeamPlayerHistory WHERE PlayerID = $1 AND EndDate IS NULL ORDER BY HistoryID DESC LIMIT 1`,
        [pid]
      );
      assert(
        tphCheck.rows.length > 0 && tphCheck.rows[0].teamid === t1,
        "Procedure sp_process_player_transfer atomically transferred player to new squad roster"
      );
    }

    // ── 5. Use of Complex Queries ─────────────────────────────────────────────
    console.log("\n--- 5. Testing Complex Queries (Multi-Table Joins & Aggregations) ---");

    // Complex Query 1: Admin Player Rankings with Window Function & LATERAL Join
    const q1Res = await pool.query(`
      WITH RankedPlayers AS (
        SELECT
          p.PlayerID,
          p.Name,
          p.Position,
          p.OverallRating,
          tm.TeamName,
          COUNT(pms.MatchID)::int AS MatchesPlayed,
          COALESCE(SUM(pms.Goals), 0)::int AS TotalGoals,
          COALESCE(SUM(pms.Assists), 0)::int AS TotalAssists,
          DENSE_RANK() OVER (ORDER BY p.OverallRating DESC NULLS LAST, p.PlayerID ASC) AS Rank
        FROM Player p
        LEFT JOIN PlayerMatchStat pms ON p.PlayerID = pms.PlayerID
        LEFT JOIN LATERAL (
          SELECT t.Name AS TeamName
          FROM Lineup l
          JOIN Team t ON l.TeamID = t.TeamID
          WHERE l.PlayerID = p.PlayerID
          ORDER BY l.MatchID DESC
          LIMIT 1
        ) tm ON true
        GROUP BY p.PlayerID, p.Name, p.Position, p.OverallRating, tm.TeamName
      )
      SELECT * FROM RankedPlayers LIMIT 5
    `);
    assert(q1Res.rows.length > 0, `Complex Query 1 (Admin Rankings with DENSE_RANK() & LATERAL Join) executed successfully (${q1Res.rows.length} rows)`);

    // Complex Query 2: Position Breakdown & Rating Aggregation
    const q2Res = await pool.query(`
      SELECT
        Position,
        COUNT(*)::int AS PlayerCount,
        ROUND(AVG(OverallRating), 2) AS AvgRating,
        MAX(OverallRating) AS MaxRating,
        MIN(OverallRating) AS MinRating,
        SUM(CASE WHEN OverallRating >= 8.0 THEN 1 ELSE 0 END)::int AS EliteCount
      FROM Player
      WHERE OverallRating IS NOT NULL
      GROUP BY Position
      ORDER BY AvgRating DESC NULLS LAST
    `);
    assert(q2Res.rows.length > 0, `Complex Query 2 (Position Breakdown with AVG, MIN, MAX, SUM CASE) executed successfully (${q2Res.rows.length} positions)`);

    // Complex Query 3: Match Details with 12 Tables Joined
    const q3Res = await pool.query(`
      SELECT
        m.MatchID,
        m.MatchDate,
        t.Name AS TournamentName,
        home.Name AS HomeTeam,
        away.Name AS AwayTeam,
        v.Name AS VenueName,
        c.Name AS VenueCountry,
        r.Name AS RefereeName,
        tmc.CoachName AS HomeCoach,
        COUNT(DISTINCT l.PlayerID)::int AS TotalPlayersInLineup,
        COUNT(DISTINCT e.EventID)::int AS TotalEvents
      FROM Match m
      JOIN Tournament t ON m.TournamentID = t.TournamentID
      JOIN Team home ON m.HomeTeamID = home.TeamID
      JOIN Team away ON m.AwayTeamID = away.TeamID
      LEFT JOIN Venue v ON m.VenueID = v.VenueID
      LEFT JOIN Country c ON v.CountryID = c.CountryID
      LEFT JOIN MatchOfficiating mo ON m.MatchID = mo.MatchID
      LEFT JOIN Referee r ON mo.RefereeID = r.RefereeID
      LEFT JOIN TeamMatchCoach tmc ON m.MatchID = tmc.MatchID AND m.HomeTeamID = tmc.TeamID
      LEFT JOIN Lineup l ON m.MatchID = l.MatchID
      LEFT JOIN Event e ON m.MatchID = e.MatchID
      GROUP BY m.MatchID, m.MatchDate, t.Name, home.Name, away.Name, v.Name, c.Name, r.Name, tmc.CoachName
      LIMIT 1
    `);
    assert(q3Res.rows.length > 0, `Complex Query 3 (Multi-Table Relational Match Sheet with 10+ Joins) executed successfully`);

    // Complex Query 4: PlayerSeasonStatsView Aggregation with Safe Division
    const q4Res = await pool.query(`
      SELECT PlayerName, Position, TotalMinutes, GoalsPer90, AssistsPer90, KeyPassesPer90
      FROM PlayerSeasonStatsView
      WHERE MatchesPlayed > 0
      ORDER BY TotalMinutes DESC
      LIMIT 5
    `);
    assert(q4Res.rows.length > 0, `Complex Query 4 (PlayerSeasonStatsView with Safe Per-90 Normalization) executed successfully (${q4Res.rows.length} rows)`);

    // Complex Query 5: Tournament Standings with Goal Difference & Win Percentage
    const q5Res = await pool.query(`
      SELECT
        s.TournamentID,
        tr.Name AS TournamentName,
        t.Name AS TeamName,
        s.Wins,
        s.Draws,
        s.Losses,
        s.Points,
        (s.GoalsFor - s.GoalsAgainst) AS GoalDifference,
        ROUND((s.Wins::numeric / NULLIF(s.Wins + s.Draws + s.Losses, 0)) * 100.0, 2) AS WinPercentage
      FROM Standing s
      JOIN Tournament tr ON s.TournamentID = tr.TournamentID
      JOIN Team t ON s.TeamID = t.TeamID
      ORDER BY s.TournamentID, s.Points DESC, GoalDifference DESC
      LIMIT 5
    `);
    assert(q5Res.rows.length > 0, `Complex Query 5 (Tournament Standings with Goal Difference & Percentage Aggregation) executed successfully`);

    // Clean up temporary user
    if (insertedUserId) {
      await withTransaction(async (client) => {
        await client.query(`DELETE FROM Users WHERE UserID = $1`, [insertedUserId]);
      });
    }

  } catch (error) {
    console.error("Test execution error:", error);
    failed++;
  } finally {
    await pool.end();
  }

  console.log("\n=================================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
