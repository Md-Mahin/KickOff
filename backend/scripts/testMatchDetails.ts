import assert from "node:assert/strict";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { initializeDatabase, pool } from "../src/db";
import { normalizeFootballDataFixture, normalizeFootballDataMatch } from "../src/services/footballDataClient";
import { normalizeSportsDbEvent } from "../src/services/sportsDbClient";
import { persistMatchDetailsToDatabase, pullMatchDetailsFromDatabase, executeMatchDetailPipeline } from "../src/services/matchPipelineService";

async function main() {
  const footballDataFixture = normalizeFootballDataFixture({
    id: 555038,
    utcDate: "2026-10-11T00:00:00Z",
    status: "FINISHED",
    matchday: 12,
    stage: "REGULAR_SEASON",
    competition: { id: 17, name: "Test League", area: { name: "Brazil" }, season: { startDate: "2026-01-01" } },
    homeTeam: { id: 1, name: "Home FC" },
    awayTeam: { id: 2, name: "Away FC" },
    score: { fullTime: { home: 2, away: 1 }, halfTime: { home: 1, away: 0 } },
  });
  assert.equal(footballDataFixture.fixture.id, 7_000_000_555_038);
  assert.deepEqual(footballDataFixture.goals.halftime, { home: 1, away: 0 });
  assert.deepEqual(footballDataFixture.fixture.round, { matchday: 12, stage: "REGULAR_SEASON" });

  const footballDataDetails = normalizeFootballDataMatch({
    id: 555038,
    utcDate: "2026-10-11T00:00:00Z",
    status: "FINISHED",
    competition: { id: 17, name: "Test League", season: { startDate: "2026-01-01" } },
    homeTeam: {
      id: 1, name: "Home FC", coach: { name: "Coach Home" }, formation: "4-3-3",
      lineup: [{ id: 10, name: "Keeper", position: "Goalkeeper", shirtNumber: 1 }],
      bench: [{ id: 11, name: "Sub", position: "Forward", shirtNumber: 12 }],
    },
    awayTeam: { id: 2, name: "Away FC", lineup: [], bench: [] },
    score: { fullTime: { home: 1, away: 0 }, halfTime: { home: 0, away: 0 } },
    goals: [{ minute: 45, injuryTime: 2, scorer: { id: 10, name: "Keeper" }, type: "PENALTY" }],
  });
  assert.equal(footballDataDetails.lineups[0].coach?.name, "Coach Home");
  assert.equal(footballDataDetails.lineups[0].startXI[0].player.pos, "Goalkeeper");
  assert.equal(footballDataDetails.lineups[0].substitutes[0].player.name, "Sub");
  assert.deepEqual(footballDataDetails.events[0].time, { elapsed: 45, injuryTime: 2 });
  assert.equal(footballDataDetails.events[0].detail, "PENALTY");

  const sportsDbFixture = normalizeSportsDbEvent({
    idEvent: "2397396", idLeague: "4328", strLeague: "USL Championship", strCountry: "USA",
    dateEvent: "2026-10-24", idHomeTeam: "133602", strHomeTeam: "Hartford Athletic",
    idAwayTeam: "141234", strAwayTeam: "Rhode Island FC", strVenue: "Trinity Health Stadium",
  });
  assert.equal(sportsDbFixture?.fixture.id, 8_000_002_397_396);
  assert.equal(sportsDbFixture?.fixture.venue?.name, "Trinity Health Stadium");

  await initializeDatabase();
  const response = await executeMatchDetailPipeline(4);
  assert.equal(response.teams.home.name, "Manchester City");
  assert.equal(response.teams.away.name, "Liverpool");
  assert.equal(response.events.length, 6);
  assert.equal(response.lineups.reduce((count: number, team: any) => count + team.starters.length, 0), 22);
  assert.equal(response.lineups.reduce((count: number, team: any) => count + team.substitutes.length, 0), 8);

  const before = await pullMatchDetailsFromDatabase(199);
  assert.ok(before, "the existing Spain–Croatia fixture is present");
  const countsBefore = await detailCounts(199);
  assert.ok(Number(countsBefore.events) > 0 && Number(countsBefore.starters) > 0);
  await persistMatchDetailsToDatabase(199, {
    fixture: { ...before.fixture, referee: null },
    league: {
      id: before.league.id,
      name: before.league.name,
      country: before.league.country,
      edition: before.league.edition,
      season: Number(before.league.edition) || new Date(before.fixture.date).getUTCFullYear(),
    },
    teams: before.teams,
    goals: before.goals,
    lineups: [],
    events: [],
  } as any);
  const countsAfter = await detailCounts(199);
  assert.deepEqual(countsAfter, countsBefore, "empty provider data preserves existing event, lineup, coach and official rows");

  console.log("Match detail tests passed: provider mapping, normalization, backend response, and additive persistence.");
}

async function detailCounts(matchId: number) {
  const result = await pool.query(`SELECT
    (SELECT COUNT(*)::int FROM Event WHERE MatchID = $1) AS events,
    (SELECT COUNT(*)::int FROM Lineup WHERE MatchID = $1 AND Status = 'Starter') AS starters,
    (SELECT COUNT(*)::int FROM Lineup WHERE MatchID = $1 AND Status = 'Sub') AS substitutes,
    (SELECT COUNT(*)::int FROM TeamMatchCoach WHERE MatchID = $1) AS coaches,
    (SELECT COUNT(*)::int FROM MatchOfficiating WHERE MatchID = $1) AS officials`, [matchId]);
  return result.rows[0];
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => pool.end());