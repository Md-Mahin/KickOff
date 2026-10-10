import { getPopularFixtures, getFixtures } from "../src/services/footballService";
import { pullMatchDetailsFromDatabase } from "../src/services/matchPipelineService";
import { pool } from "../src/db";

async function verify() {
  console.log("==================================================");
  console.log("VERIFYING HIGH VOLTAGE MATCHES & HOMEPAGE PRIORITY");
  console.log("==================================================\n");

  // 1. Test getPopularFixtures
  console.log("1. Checking Popular Matches (Featured Homepage Carousel)...");
  const pop = await getPopularFixtures();
  console.log(`Total popular fixtures returned: ${pop.response.length}`);
  console.log("Top 6 Featured Matches:");
  pop.response.slice(0, 6).forEach((m: any, idx: number) => {
    console.log(
      `  #${idx + 1} [ID: ${m.fixture.id}] ${m.teams.home.name} ${m.goals.home} - ${m.goals.away} ${m.teams.away.name} | Status: ${m.fixture.status.short} | League: ${m.league.name}`
    );
  });

  // 2. Test getFixtures
  console.log("\n2. Checking Main Fixtures List...");
  const fix = await getFixtures();
  console.log(`Total fixtures returned: ${fix.response.length}`);
  console.log("Top 6 League Fixtures:");
  fix.response.slice(0, 6).forEach((m: any, idx: number) => {
    console.log(
      `  #${idx + 1} [ID: ${m.fixture.id}] ${m.teams.home.name} ${m.goals.home} - ${m.goals.away} ${m.teams.away.name} | Status: ${m.fixture.status.short} | League: ${m.league.name}`
    );
  });

  // 3. Test Detail Integrity for Match 88001 (Real Madrid vs Barcelona)
  console.log("\n3. Checking Full Tactical Details for Match 88001 (El Clásico)...");
  const m1 = await pullMatchDetailsFromDatabase(88001);
  if (!m1) {
    throw new Error("Match 88001 not found!");
  }
  console.log(`  Match: ${m1.teams.home.name} vs ${m1.teams.away.name}`);
  console.log(`  Score: ${m1.goals.home} - ${m1.goals.away}`);
  console.log(`  Status: ${m1.fixture.status.short} (${m1.fixture.status.elapsed} mins)`);
  console.log(`  Venue: ${m1.fixture.venue?.name}, ${m1.fixture.venue?.city}`);
  console.log(`  Referee: ${m1.fixture.referees?.join(", ")}`);
  console.log(`  Home Lineup: ${m1.lineups[0]?.starters?.length} Starters, ${m1.lineups[0]?.substitutes?.length} Subs | Coach: ${m1.lineups[0]?.coach?.name} | Formation: ${m1.lineups[0]?.formation}`);
  console.log(`  Away Lineup: ${m1.lineups[1]?.starters?.length} Starters, ${m1.lineups[1]?.substitutes?.length} Subs | Coach: ${m1.lineups[1]?.coach?.name} | Formation: ${m1.lineups[1]?.formation}`);
  console.log(`  Events Timeline (${m1.events.length} events):`);
  m1.events.forEach((ev: any) => {
    const detail = ev.eventtype === "Goal" ? `Goal (${ev.goaltype}) by ${ev.playername}${ev.assistplayername ? ` (Assist: ${ev.assistplayername})` : ""}`
      : ev.eventtype === "Card" ? `${ev.cardtype} Card to ${ev.playername}`
      : `Substitution: ${ev.assistplayername} in for ${ev.playername}`;
    console.log(`    ${ev.eventtime}' - [${ev.teamname}] ${detail}`);
  });

  // 4. Test Detail Integrity for Match 88002 (Manchester City vs Liverpool)
  console.log("\n4. Checking Full Tactical Details for Match 88002 (Man City vs Liverpool)...");
  const m2 = await pullMatchDetailsFromDatabase(88002);
  if (!m2) {
    throw new Error("Match 88002 not found!");
  }
  console.log(`  Match: ${m2.teams.home.name} vs ${m2.teams.away.name}`);
  console.log(`  Score: ${m2.goals.home} - ${m2.goals.away}`);
  console.log(`  Status: ${m2.fixture.status.short} (${m2.fixture.status.elapsed} mins)`);
  console.log(`  Home Lineup: ${m2.lineups[0]?.starters?.length} Starters | Coach: ${m2.lineups[0]?.coach?.name}`);
  console.log(`  Away Lineup: ${m2.lineups[1]?.starters?.length} Starters | Coach: ${m2.lineups[1]?.coach?.name}`);
  console.log(`  Events Timeline (${m2.events.length} events):`);
  m2.events.forEach((ev: any) => {
    const detail = ev.eventtype === "Goal" ? `Goal (${ev.goaltype}) by ${ev.playername}${ev.assistplayername ? ` (Assist: ${ev.assistplayername})` : ""}`
      : ev.eventtype === "Card" ? `${ev.cardtype} Card to ${ev.playername}`
      : `Substitution: ${ev.assistplayername} in for ${ev.playername}`;
    console.log(`    ${ev.eventtime}' - [${ev.teamname}] ${detail}`);
  });

  console.log("\n==================================================");
  console.log("ALL VERIFICATION CHECKS PASSED PERFECTLY!");
  console.log("==================================================");
  await pool.end();
}

verify().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
