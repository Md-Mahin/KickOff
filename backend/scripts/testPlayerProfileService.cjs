const assert = require("node:assert/strict");
const {
  createPlayerProfileProviderCache,
  loadVerifiedProfileFields,
  mergeMissingProfileFields,
  normalizeStoredPlayerStats,
  isVerifiedApiFootballPlayer,
} = require("../dist/services/playerProfileService.js");

const identity = { playerId: 154, teamId: 9568, leagueId: 253 };
const providerRecord = {
  player: {
    id: 154,
    name: "A different display name does not establish identity",
    birth: { date: "1987-06-24" },
    nationality: "Argentina",
    photo: "https://provider.example/player-154.png",
    height: "170 cm",
  },
  statistics: [{ team: { id: 9568 }, league: { id: 253 }, games: { position: "Attacker" } }],
};

assert.equal(isVerifiedApiFootballPlayer(identity, providerRecord), true,
  "an exact stable ID plus matching team and competition context verifies identity");
assert.equal(isVerifiedApiFootballPlayer(identity, { ...providerRecord, player: { ...providerRecord.player, id: 155 } }), false,
  "a matching name cannot override a different provider ID");
assert.equal(isVerifiedApiFootballPlayer(identity, { ...providerRecord, statistics: [{ team: { id: 1 }, league: { id: 2 } }] }), false,
  "a stable ID without the stored team/competition context is rejected");
assert.equal(isVerifiedApiFootballPlayer({ playerId: 154, teamId: null, leagueId: null }, providerRecord), false,
  "an ID without context is insufficient for profile fallback");

const stored = {
  dateOfBirth: null,
  nationality: "Stored nationality",
  position: null,
  photo: "https://stored.example/better-photo.png",
  heightCm: null,
};
const provider = {
  dateOfBirth: "1987-06-24",
  nationality: "Provider nationality",
  position: "Attacker",
  photo: "https://provider.example/player-154.png",
  heightCm: 170,
};
const merge = mergeMissingProfileFields(stored, provider);
assert.deepEqual(merge.filled, ["dateOfBirth", "position", "heightCm"]);
assert.equal(merge.fields.nationality, "Stored nationality", "existing non-empty values stay authoritative");
assert.equal(merge.fields.photo, stored.photo, "a better stored photo is never overwritten");

(async () => {
  let providerCalls = 0;
  const hydrated = await loadVerifiedProfileFields(
    { ...stored, nationality: null, photo: null },
    identity,
    async (providerPlayerId) => {
      providerCalls++;
      assert.equal(providerPlayerId, 154);
      return providerRecord;
    },
  );
  assert.equal(hydrated.verified, true);
  assert.equal(hydrated.fields.position, "Attacker");
  assert.ok(hydrated.filled.includes("photo"));
  assert.equal(providerCalls, 1, "a verified missing-field fallback invokes the injected provider once");

  let rejectedLookupCalls = 0;
  const rejected = await loadVerifiedProfileFields(stored, identity, async () => {
    rejectedLookupCalls++;
    return { ...providerRecord, player: { ...providerRecord.player, id: 155 } };
  });
  assert.equal(rejected.verified, false);
  assert.equal(rejectedLookupCalls, 1);
  assert.deepEqual(rejected.fields, stored, "unverified provider data is discarded");

  let noIdentityCalls = 0;
  const noIdentity = await loadVerifiedProfileFields(
    { dateOfBirth: null, nationality: null, position: null, photo: null, heightCm: null },
    { playerId: null, teamId: null, leagueId: null },
    async () => { noIdentityCalls++; return providerRecord; },
  );
  assert.equal(noIdentityCalls, 0, "missing identity mapping never searches a provider by player name");
  assert.equal(noIdentity.verified, false);

  let now = 1_000;
  let cacheCalls = 0;
  const cachedLookup = createPlayerProfileProviderCache(async () => {
    cacheCalls++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return providerRecord;
  }, { ttlMs: 100, now: () => now });
  const concurrent = await Promise.all([cachedLookup(154), cachedLookup(154), cachedLookup(154)]);
  assert.equal(cacheCalls, 1, "concurrent duplicate profile loads share one cached lookup");
  assert.equal(concurrent[0], providerRecord);
  await cachedLookup(154);
  assert.equal(cacheCalls, 1, "a warm profile cache avoids another provider lookup");
  now += 101;
  await cachedLookup(154);
  assert.equal(cacheCalls, 2, "expired profile cache entries are refreshed");

  // Messi's actual row has no provider mapping, no performance records, and one
  // real follow. This mocked profile-path check must never call a provider and
  // must preserve unavailable stats rather than manufacturing zeroes.
  const { pool } = require("../dist/db/index.js");
  const router = require("../dist/routes/playerRoutes.js").default;
  const originalQuery = pool.query;
  const originalFetch = global.fetch;
  let externalCalls = 0;
  global.fetch = async () => { externalCalls++; throw new Error("live provider call prohibited in this test"); };
  pool.query = async (sql) => {
    if (String(sql).includes("FROM Player p LEFT JOIN Country")) return { rows: [{
      playerid: 276, name: "Lionel Messi", dateofbirth: null, nationalitycountryid: null,
      nationality: null, position: null, photo: null, heightcm: null, preferredfoot: null,
      apiplayerid: null, apiplayerteamid: null, apiplayerleagueid: null,
    }] };
    if (String(sql).includes("FROM UserFollowsPlayer")) return { rows: [{ count: 1 }], rowCount: 1 };
    if (String(sql).includes("FROM TeamPlayerHistory")) return { rows: [], rowCount: 0 };
    if (String(sql).includes("FROM Lineup l JOIN Match")) return { rows: [], rowCount: 0 };
    if (String(sql).includes("WITH relevant_matches")) return { rows: [{ tracked_matches: 0, total_goals: null, total_assists: null, source: null }] };
    if (String(sql).includes("FROM PlayerMatchStat pms") && String(sql).includes("JOIN Tournament t")) return { rows: [] };
    if (String(sql).includes("FROM PlayerRatingHistory")) return { rows: [] };
    if (String(sql).includes("FROM PlayerFieldProvenance")) return { rows: [] };
    throw new Error(`Unexpected mocked profile query: ${String(sql).slice(0, 80)}`);
  };

  try {
    const route = router.stack.find((layer) => layer.route)?.route;
    const handler = route.stack[route.stack.length - 1].handle;
    let status = 200;
    let body;
    const response = {
      status(code) { status = code; return this; },
      json(value) { body = value; return this; },
    };
    await handler({ params: { id: "276" }, auth: undefined }, response);
    assert.equal(status, 200);
    assert.equal(body.player.photo, null);
    assert.equal(body.club, null, "an absent current-club record is not reported as free agency");
    assert.equal(body.followers, 1, "fan count comes from UserFollowsPlayer");
    assert.equal(body.stats.totalGoals, null);
    assert.equal(body.stats.totalAssists, null);
    assert.equal(body.stats.trackedMatches, 0);
    assert.deepEqual(body.seasonStats, []);
    assert.deepEqual(body.ratingHistory, []);
    assert.equal(body.provenance.photo.source, "unavailable");
    assert.equal(body.provenance.totalGoals.source, "unavailable");
    assert.equal(externalCalls, 0, "the Messi profile path makes no live provider calls without verified IDs/context");
  } finally {
    pool.query = originalQuery;
    global.fetch = originalFetch;
  }

  assert.deepEqual(normalizeStoredPlayerStats({ tracked_matches: 0, total_goals: null, total_assists: null }),
    { totalGoals: null, totalAssists: null, trackedMatches: 0 });
  console.log("Player profile tests passed: stable identity, context rejection, field preservation, fallback, caching, and Messi's unavailable-data path.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
