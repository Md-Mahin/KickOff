import { pool } from "../src/db";
import { getMatchLineups } from "../src/services/footballService";

async function runTests() {
  console.log("=== Testing Match & Team Coach Names Feature ===");

  try {
    // Test 1: Check match lineups for known matches
    const testMatchIds = [1, 2, 6, 8, 10, 11, 1638366];
    console.log("\n--- Test 1: Verifying Match Lineup Coaches ---");

    for (const matchId of testMatchIds) {
      const matchExists = await pool.query(`SELECT 1 FROM Match WHERE MatchID = $1`, [matchId]);
      if (matchExists.rows.length === 0) continue;

      const lineups = await getMatchLineups(matchId);
      console.log(`\nMatch ${matchId} has ${lineups.length} lineups:`);

      for (const l of lineups) {
        console.log(`  Team: ${l.team.name}`);
        console.log(`    Coach Name: "${l.coach?.name ?? 'NULL'}"`);
        console.log(`    Coach Photo: "${l.coach?.photo ?? 'NULL'}"`);

        if (!l.coach?.name) {
          throw new Error(`FAIL: Match ${matchId} team ${l.team.name} has null coach name!`);
        }
      }
    }
    console.log("✓ Test 1 Passed: All checked matches returned authentic coach names!");

    // Test 2: Check Team table coach columns for teams
    console.log("\n--- Test 2: Verifying Team Profile Coaches in Database ---");
    const testTeamIds = [1, 2, 3, 6, 7, 8, 9, 10];
    const teamRes = await pool.query(
      `SELECT TeamID, Name, CoachName, CoachPhoto FROM Team WHERE TeamID = ANY($1::int[]) ORDER BY TeamID`,
      [testTeamIds]
    );

    for (const t of teamRes.rows) {
      console.log(`  Team ${t.teamid} (${t.name}): Mgr: "${t.coachname}" | Photo: ${t.coachphoto}`);
      if (!t.coachname) {
        throw new Error(`FAIL: Team ${t.name} has null CoachName!`);
      }
    }
    console.log("✓ Test 2 Passed: All checked teams have authentic managers in Team table!");

    // Test 3: Test fallback & auto-caching behavior
    console.log("\n--- Test 3: Dynamic fallback and caching test ---");
    // Temporarily delete coach row for Match 1, Team 1 from TeamMatchCoach
    await pool.query(`DELETE FROM TeamMatchCoach WHERE MatchID = 1 AND TeamID = 1`);
    console.log("Deleted Coach row for Match 1, Team 1 from TeamMatchCoach.");

    // Fetch lineups again - should fall back to Team table, resolve Mikel Arteta, and re-cache
    const lineupsAfterDelete = await getMatchLineups(1);
    const arsenalLineup = lineupsAfterDelete.find(l => l.team.id === 1);
    console.log(`  Resolved coach after cache deletion: "${arsenalLineup?.coach?.name}"`);

    if (arsenalLineup?.coach?.name !== "Mikel Arteta") {
      throw new Error(`FAIL: Expected Mikel Arteta, got ${arsenalLineup?.coach?.name}`);
    }

    // Give asynchronous caching query a moment to finish
    await new Promise(r => setTimeout(r, 200));

    const checkCache = await pool.query(`SELECT CoachName FROM TeamMatchCoach WHERE MatchID = 1 AND TeamID = 1`);
    console.log(`  Cached back to TeamMatchCoach: "${checkCache.rows[0]?.coachname}"`);
    if (checkCache.rows[0]?.coachname !== "Mikel Arteta") {
      throw new Error(`FAIL: Coach was not re-cached in TeamMatchCoach!`);
    }
    console.log("✓ Test 3 Passed: Dynamic resolution and auto-caching verified successfully!");

    console.log("\n==============================================");
    console.log("ALL TESTS PASSED! Coach names are fully fixed.");
    console.log("==============================================");
  } catch (err) {
    console.error("Test failed with error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
