import { pool } from "../src/db";

async function runTests() {
  console.log("=================================================");
  console.log("RUNNING PLAYER PERFORMANCE RATING ALGORITHM TESTS");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (detail) console.error(`   Detail: ${detail}`);
      failed++;
    }
  }

  try {
    // 1. Test PlayerMatchStat table exists and has rows
    const pmsCountRes = await pool.query("SELECT COUNT(*) AS count FROM PlayerMatchStat");
    const pmsCount = parseInt(pmsCountRes.rows[0].count, 10);
    assert(pmsCount > 0, "PlayerMatchStat table has seeded data", `Found ${pmsCount} match stat records`);

    // 2. Test UNIQUE constraint on (PlayerID, MatchID)
    const constraintRes = await pool.query(`
      SELECT conname FROM pg_constraint 
      WHERE conrelid = 'PlayerMatchStat'::regclass AND contype = 'u'
    `);
    const hasUniqueConstraint = constraintRes.rows.some(r => r.conname.toLowerCase().includes('match'));
    assert(hasUniqueConstraint, "PlayerMatchStat enforces UNIQUE(PlayerID, MatchID) constraint");

    // 3. Test PlayerSeasonStatsView aggregates match stats
    const viewRes = await pool.query("SELECT * FROM PlayerSeasonStatsView LIMIT 5");
    assert(viewRes.rows.length > 0, "PlayerSeasonStatsView returns aggregated season statistics");
    const sampleViewRow = viewRes.rows[0];
    assert(
      sampleViewRow.matchesplayed !== undefined && sampleViewRow.totalminutes !== undefined && sampleViewRow.totalgoals !== undefined,
      "PlayerSeasonStatsView includes expected fields (matchesplayed, totalminutes, totalgoals, etc.)"
    );

    // 4. Test PL/SQL procedure execution
    console.log("\nExecuting stored procedure CALL update_all_player_ratings('2025/2026')...");
    const procStart = Date.now();
    await pool.query("CALL update_all_player_ratings('2025/2026')");
    const procDuration = Date.now() - procStart;
    assert(procDuration < 1000, `update_all_player_ratings executed successfully in ${procDuration}ms`);

    // 5. Test 0–10 scale constraint on Player.OverallRating
    const boundsRes = await pool.query(`
      SELECT 
        MIN(OverallRating) AS min_rating, 
        MAX(OverallRating) AS max_rating,
        COUNT(CASE WHEN OverallRating < 0.0 OR OverallRating > 10.0 THEN 1 END) AS out_of_bounds,
        COUNT(CASE WHEN OverallRating IS NOT NULL THEN 1 END) AS rated_count
      FROM Player
    `);
    const bounds = boundsRes.rows[0];
    const minRating = parseFloat(bounds.min_rating);
    const maxRating = parseFloat(bounds.max_rating);
    const outOfBounds = parseInt(bounds.out_of_bounds, 10);
    const ratedCount = parseInt(bounds.rated_count, 10);

    assert(outOfBounds === 0, "All calculated ratings satisfy 0 <= OverallRating <= 10", `Out of bounds count: ${outOfBounds}`);
    assert(minRating >= 1.0 && maxRating <= 10.0, "Ratings span realistic calibrated range", `Min: ${minRating}, Max: ${maxRating}`);
    assert(ratedCount > 0, "Active players received calculated ratings", `Rated players: ${ratedCount}`);

    // 6. Test PlayerRatingHistory snapshots
    const historyRes = await pool.query("SELECT COUNT(*) AS count FROM PlayerRatingHistory WHERE Season = '2025/2026'");
    const historyCount = parseInt(historyRes.rows[0].count, 10);
    assert(historyCount > 0, "PlayerRatingHistory table stores rating calculation snapshots", `Found ${historyCount} history records`);

    // 7. Test Top Players per Position (Admin queries)
    console.log("\nTesting Admin Position Leaderboard Queries:");
    const positions = [
      { key: "F", name: "Forwards" },
      { key: "M", name: "Midfielders" },
      { key: "D", name: "Defenders" },
      { key: "G", name: "Goalkeepers" },
    ];

    for (const pos of positions) {
      const posRes = await pool.query(`
        SELECT pss.PlayerID, pss.PlayerName AS Name, pss.Position, pss.TeamName, pss.OverallRating,
               pss.TotalGoals, pss.TotalAssists, pss.TotalTackles, pss.TotalSaves
        FROM PlayerSeasonStatsView pss
        WHERE UPPER(pss.Position) LIKE $1 AND pss.OverallRating IS NOT NULL
        ORDER BY pss.OverallRating DESC
        LIMIT 3
      `, [`${pos.key}%`]);

      assert(posRes.rows.length > 0, `Top ${pos.name} query returns data`, `Found ${posRes.rows.length} players`);
      if (posRes.rows.length > 0) {
        console.log(`   Top ${pos.key}: ${posRes.rows[0].name} (${posRes.rows[0].teamname}) - Rating: ${posRes.rows[0].overallrating}`);
      }
    }

    // 8. Test Rating Distribution and Percentages
    console.log("\nTesting Rating Distribution Tiers:");
    const distRes = await pool.query(`
      SELECT 
        COUNT(CASE WHEN OverallRating >= 8.50 THEN 1 END) AS elite_count,
        COUNT(CASE WHEN OverallRating >= 7.50 AND OverallRating < 8.50 THEN 1 END) AS outstanding_count,
        COUNT(CASE WHEN OverallRating >= 6.50 AND OverallRating < 7.50 THEN 1 END) AS good_count,
        COUNT(CASE WHEN OverallRating >= 5.50 AND OverallRating < 6.50 THEN 1 END) AS average_count,
        COUNT(CASE WHEN OverallRating < 5.50 THEN 1 END) AS developing_count,
        COUNT(OverallRating) AS total_rated,
        ROUND(AVG(OverallRating), 2) AS avg_rating
      FROM Player
      WHERE OverallRating IS NOT NULL
    `);
    const dist = distRes.rows[0];
    const totalRated = parseInt(dist.total_rated, 10);
    const sumTiers = parseInt(dist.elite_count, 10) + parseInt(dist.outstanding_count, 10) +
                     parseInt(dist.good_count, 10) + parseInt(dist.average_count, 10) +
                     parseInt(dist.developing_count, 10);

    assert(totalRated === sumTiers, "All rated players map cleanly to tiers without gaps or overlaps", `Total: ${totalRated}, Tiers sum: ${sumTiers}`);
    console.log(`   Elite (8.50+): ${dist.elite_count} (${((parseInt(dist.elite_count, 10) / totalRated) * 100).toFixed(1)}%)`);
    console.log(`   Outstanding (7.50-8.49): ${dist.outstanding_count} (${((parseInt(dist.outstanding_count, 10) / totalRated) * 100).toFixed(1)}%)`);
    console.log(`   Good (6.50-7.49): ${dist.good_count} (${((parseInt(dist.good_count, 10) / totalRated) * 100).toFixed(1)}%)`);
    console.log(`   Average (5.50-6.49): ${dist.average_count} (${((parseInt(dist.average_count, 10) / totalRated) * 100).toFixed(1)}%)`);
    console.log(`   Developing (<5.50): ${dist.developing_count} (${((parseInt(dist.developing_count, 10) / totalRated) * 100).toFixed(1)}%)`);
    console.log(`   Cohort Average Rating: ${dist.avg_rating}`);

    // 9. Verify zero-minute players have OverallRating IS NULL
    const zeroMinRes = await pool.query(`
      SELECT COUNT(*) AS count FROM Player p
      WHERE NOT EXISTS (SELECT 1 FROM PlayerMatchStat pms WHERE pms.PlayerID = p.PlayerID)
        AND p.OverallRating IS NOT NULL
    `);
    const unratedWithRating = parseInt(zeroMinRes.rows[0].count, 10);
    assert(unratedWithRating === 0, "Players with zero match minutes are unrated (OverallRating IS NULL)", `Found: ${unratedWithRating}`);

    console.log("\n=================================================");
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("=================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Test execution threw error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
