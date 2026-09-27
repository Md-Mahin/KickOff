import { pool } from "../src/db";
import {
  getBasicMatchList,
  executeMatchDetailPipeline,
} from "../src/services/matchPipelineService";

async function runPipelineTests() {
  console.log("=================================================================");
  console.log("TESTING DATA FETCHING, DATABASE CACHING & FALLBACK ARCHITECTURE");
  console.log("=================================================================\n");

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
    // -------------------------------------------------------------------------
    // TEST 1: Initial Page Load (Basic Match List)
    // -------------------------------------------------------------------------
    console.log("--- 1. Testing Initial Page Load: Basic Match List ---");
    const t0 = Date.now();
    const basicRes = await getBasicMatchList();
    const duration1 = Date.now() - t0;

    assert(
      basicRes && Array.isArray(basicRes.matches) && basicRes.matches.length > 0,
      "Initial load returns basic matches",
      `Count: ${basicRes.matches.length}, Source: ${basicRes.source}, Duration: ${duration1}ms`
    );

    const firstMatch = basicRes.matches[0];
    const hasBasicFieldsOnly =
      firstMatch.homeTeam !== undefined &&
      firstMatch.awayTeam !== undefined &&
      firstMatch.status !== undefined &&
      ["LIVE", "FT", "UPCOMING"].includes(firstMatch.status);

    assert(
      hasBasicFieldsOnly,
      "Basic match list contains teams and match status (LIVE, FT, UPCOMING)",
      `Sample: ${firstMatch.homeTeam} vs ${firstMatch.awayTeam} [${firstMatch.status}]`
    );

    assert(
      basicRes.source === "API-Football" || basicRes.source === "Mock Fallback",
      "Gracefully handles API call or engages mock fallback on error",
      `Resolved source: ${basicRes.source}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Strict Pipeline for User Interaction (Click on Specific Match)
    // Sequence: 1. Fetch API/Mock -> 2. Store to DB -> 3. Pull directly from DB
    // -------------------------------------------------------------------------
    console.log("\n--- 2. Testing Strict Database Caching Pipeline on Match Click ---");
    const testMatchId = 991; // Arsenal vs Real Madrid fixture

    const t1 = Date.now();
    const detailedRes = await executeMatchDetailPipeline(testMatchId);
    const duration2 = Date.now() - t1;

    assert(
      detailedRes !== null && detailedRes.fixture?.id === testMatchId,
      "Match detail pipeline successfully returns match",
      `MatchID: ${detailedRes.fixture?.id}, Duration: ${duration2}ms`
    );

    assert(
      detailedRes._pipelineMetadata?.retrievedDirectlyFromDatabase === true,
      "Strict Pipeline Verified: Data returned is pulled directly from database",
      `Sequence: ${detailedRes._pipelineMetadata?.sequence}`
    );

    // Verify DB records actually exist in PostgreSQL
    const dbMatchCheck = await pool.query("SELECT * FROM Match WHERE MatchID = $1", [testMatchId]);
    assert(
      dbMatchCheck.rows.length > 0,
      "Step 2 Verified: Match header and score stored in database table Match",
      `HomeGoals: ${dbMatchCheck.rows[0].homegoals}, AwayGoals: ${dbMatchCheck.rows[0].awaygoals}`
    );

    const dbLineupCheck = await pool.query("SELECT COUNT(*) AS count FROM Lineup WHERE MatchID = $1", [testMatchId]);
    const lineupCount = parseInt(dbLineupCheck.rows[0].count, 10);
    assert(
      lineupCount > 0,
      "Step 2 Verified: Squad lineups stored in database table Lineup",
      `Stored lineup players: ${lineupCount}`
    );

    const dbEventsCheck = await pool.query("SELECT COUNT(*) AS count FROM Event WHERE MatchID = $1", [testMatchId]);
    const eventCount = parseInt(dbEventsCheck.rows[0].count, 10);
    assert(
      eventCount > 0,
      "Step 2 Verified: Timeline events stored in database table Event",
      `Stored events: ${eventCount}`
    );

    // Step 3 Verified: Data structure returned to user matches database content
    assert(
      detailedRes.lineups.length > 0 && detailedRes.events.length > 0,
      "Step 3 Verified: User receives complete detailed database records (lineups, events, coaches)",
      `Lineups: ${detailedRes.lineups.length}, Events: ${detailedRes.events.length}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Dynamic ID Fallback Mock Verification
    // -------------------------------------------------------------------------
    console.log("\n--- 3. Testing Dynamic Fallback Mock Data Generation ---");
    const arbitraryMatchId = 8842;
    const dynamicRes = await executeMatchDetailPipeline(arbitraryMatchId);

    assert(
      dynamicRes !== null && dynamicRes.fixture?.id === arbitraryMatchId,
      "Arbitrary non-existent match ID uses fallback mock data and persists to DB",
      `Generated & cached match #${arbitraryMatchId} (${dynamicRes.teams.home.name} vs ${dynamicRes.teams.away.name})`
    );

    const dynamicDbCheck = await pool.query("SELECT 1 FROM Match WHERE MatchID = $1", [arbitraryMatchId]);
    assert(
      dynamicDbCheck.rows.length > 0,
      "Fallback mock data was stored in database before being served to user"
    );

    // -------------------------------------------------------------------------
    // TEST 4: Events Retrieval & Guarantee For Matches with Goals/Scores
    // -------------------------------------------------------------------------
    console.log("\n--- 4. Testing Events Retrieval for Database & Mock Matches ---");
    for (const testId of [1, 991, 993, 994]) {
      const matchPipelineData = await executeMatchDetailPipeline(testId);
      const goalsSum = (matchPipelineData.goals.home ?? 0) + (matchPipelineData.goals.away ?? 0);
      assert(
        matchPipelineData.events !== undefined && Array.isArray(matchPipelineData.events),
        `Match #${testId} returns array of events`,
        `Events count: ${matchPipelineData.events.length}`
      );

      if (goalsSum > 0) {
        const goalEvents = matchPipelineData.events.filter((e: any) => e.eventtype === "Goal");
        assert(
          goalEvents.length > 0,
          `Match #${testId} with score ${matchPipelineData.goals.home}-${matchPipelineData.goals.away} has goal events`,
          `Goal events count: ${goalEvents.length}`
        );
      }
    }

    console.log("\n=================================================================");
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("=================================================================");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("Test execution threw error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runPipelineTests();
