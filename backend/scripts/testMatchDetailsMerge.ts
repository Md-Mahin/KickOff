import assert from "node:assert/strict";
import {
  isMatchDetailSnapshotFresh, isVerifiedFixtureMapping, matchDetailSnapshotTtl,
  mergeMatchDetails, mergeVerifiedProviderFallback, selectVerifiedProviderFixture, unresolvedDetailCategories,
} from "../src/services/matchDetailsMerge";

const primary = {
  _apiFixtureId: 7000000575353,
  fixture: { date: "2023-02-11T12:30:00Z", status: { short: "FT" }, venue: null, referees: [] },
  teams: { home: { id: 65, name: "Manchester City FC" }, away: { id: 524, name: "Paris Saint-Germain FC" } },
  goals: { home: 2, away: 1 }, lineups: [
    { team: { id: 65, name: "Manchester City FC" }, formation: null, coach: null, starters: [{ id: 11, name: "Player One", number: 9, rating: 7.2 }], substitutes: [], unavailable: [] },
    { team: { id: 524, name: "Paris Saint-Germain FC" }, formation: null, coach: null, starters: [], substitutes: [], unavailable: [] },
  ],
  events: [], playerStatistics: [], teamStatistics: { home: { Possession: 55 }, away: null }, headToHead: [], standings: [],
};
const fallback = {
  _providerFixture: { id: 9876, date: "2023-02-11T12:30:00Z" },
  fixture: { date: "2023-02-11T12:30:00Z", venue: { name: "Stadium" }, referees: ["Referee"] },
  teams: { home: { id: 65, name: "Manchester City" }, away: { id: 524, name: "Paris Saint Germain" } },
  goals: { home: 9, away: 9 }, lineups: [
    { team: { name: "Manchester City" }, formation: "4-3-3", coach: { name: "Coach A" }, starters: [{ id: 999, name: "Player One", number: 9, minutes: 90 }, { id: 12, name: "Player Two", number: 10 }], substitutes: [{ id: 13, name: "Sub One" }], unavailable: [] },
    { team: { name: "Paris Saint Germain" }, formation: "4-4-2", coach: { name: "Coach B" }, starters: [{ id: 14, name: "Player Three" }], substitutes: [{ id: 15, name: "Sub Two" }], unavailable: [] },
  ],
  events: [{ id: 99, eventtime: 22, eventtype: "Goal", playername: "Player One" }],
  playerStatistics: [{ id: 11, minutes: 90, rating: 7.2 }],
  teamStatistics: { home: { Shots: 5 }, away: { Possession: 45 } },
  headToHead: [{ id: 31, date: "2022-01-01", homeTeam: "A", awayTeam: "B" }],
  standings: [{ teamId: 65, teamName: "Manchester City", points: 65 }],
};

assert.equal(selectVerifiedProviderFixture([
  { id: 1, date: "2023-02-11", home_team: "Manchester City", away_team: "Paris Saint-Germain" },
], "Manchester City FC", "Paris Saint-Germain FC", primary.fixture.date)?.id, 1);
assert.equal(selectVerifiedProviderFixture([
  { id: 1, date: "2023-02-11", home_team: "Manchester City", away_team: "Paris Saint-Germain" },
  { id: 2, date: "2023-02-11", home_team: "Manchester City", away_team: "Paris Saint-Germain" },
], "Manchester City", "Paris Saint-Germain", primary.fixture.date), null, "ambiguous fixture mapping must fail closed");
assert.equal(isVerifiedFixtureMapping(primary, fallback), true);
assert.equal(isVerifiedFixtureMapping(primary, { ...fallback, teams: { home: fallback.teams.away, away: fallback.teams.home } }), false);
assert.equal(isVerifiedFixtureMapping(primary, { ...fallback, _providerFixture: { id: 9876, date: "2024-02-11" } }), false);

const merged = mergeMatchDetails(primary, fallback);
assert.equal(mergeVerifiedProviderFallback(primary, fallback).fixture.venue.name, "Stadium",
  "the shared provider fallback path should accept only verified mappings");
assert.equal(mergeVerifiedProviderFallback(primary, { ...fallback, teams: { home: fallback.teams.away, away: fallback.teams.home } }), primary,
  "the shared provider fallback path must reject guessed or reversed mappings");
assert.equal(merged._apiFixtureId, primary._apiFixtureId, "alternate IDs must not replace the main fixture ID");
assert.equal(merged.fixture.venue.name, "Stadium");
assert.equal(merged.goals.home, 2, "stored valid values have priority");
assert.equal(merged.lineups[0].formation, "4-3-3");
assert.equal(merged.lineups[0].coach.name, "Coach A");
assert.equal(merged.lineups[0].starters.length, 2, "same named players merge without provider-ID duplication");
assert.equal(merged.lineups[0].starters[0].rating, 7.2, "provider rating is preserved");
assert.equal(merged.events.length, 1);
assert.deepEqual(merged.teamStatistics, { home: { Possession: 55, Shots: 5 }, away: { Possession: 45 } });
assert.equal(merged.headToHead.length, 1);
assert.equal(merged.standings[0].points, 65);
assert.ok(unresolvedDetailCategories(merged).includes("playerStats") === false);

const now = Date.now();
const freshUnavailable = { ttlMs: matchDetailSnapshotTtl(primary, false) };
assert.equal(isMatchDetailSnapshotFresh(freshUnavailable, new Date(now - 30_000).toISOString(), now), true,
  "unavailable responses use a reusable short negative cache");
assert.equal(isMatchDetailSnapshotFresh(freshUnavailable, new Date(now - 3_700_000).toISOString(), now), false);
console.log("Match detail merge tests passed: verified fallback mapping, field-level preservation, and cached unavailable results.");
