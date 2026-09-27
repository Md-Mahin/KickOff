import { parseFormationLines, layoutFormation } from "../src/components/matches/match-lineups";
import type { MatchLineupPlayer } from "../src/lib/matches";

console.log("=================================================");
console.log("TESTING FORMATION LAYOUT ENGINE");
console.log("=================================================\n");

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    console.log(`✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${name}`);
    if (detail) console.error(`   Detail: ${detail}`);
    failed++;
  }
}

// 1. Test parseFormationLines
const formationsToTest: Record<string, number[]> = {
  "4-3-3": [4, 3, 3],
  "4-2-3-1": [4, 2, 3, 1],
  "4-4-2": [4, 4, 2],
  "3-5-2": [3, 5, 2],
  "5-3-2": [5, 3, 2],
  "3-4-3": [3, 4, 3],
  "4-1-4-1": [4, 1, 4, 1],
  "5-4-1": [5, 4, 1],
  "3-4-2-1": [3, 4, 2, 1],
  "4-1-2-1-2": [4, 1, 2, 1, 2],
};

console.log("--- 1. Testing Formation String Parser ---");
for (const [fmt, expected] of Object.entries(formationsToTest)) {
  const result = parseFormationLines(fmt);
  assert(
    JSON.stringify(result) === JSON.stringify(expected),
    `Parsed formation "${fmt}" matches ${JSON.stringify(expected)}`,
    `Got: ${JSON.stringify(result)}`
  );
}

// Fallback test
assert(
  JSON.stringify(parseFormationLines(null)) === JSON.stringify([4, 3, 3]),
  `Null formation falls back to [4, 3, 3]`
);
assert(
  JSON.stringify(parseFormationLines("invalid")) === JSON.stringify([4, 3, 3]),
  `Invalid formation falls back to [4, 3, 3]`
);

// 2. Test layoutFormation with 4-2-3-1 (Bayern Munich mock data scenario)
console.log("\n--- 2. Testing 4-2-3-1 Layout (Bayern Munich Scenario) ---");
const bayernStarters: MatchLineupPlayer[] = [
  { id: 3001, name: "Manuel Neuer", photo: null, number: 1, position: "G", grid: null, rating: null, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
  { id: 3002, name: "Joshua Kimmich", photo: null, number: 6, position: "D", grid: null, rating: null, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
  { id: 3003, name: "Dayot Upamecano", photo: null, number: 2, position: "D", grid: null, rating: null, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
  { id: 3004, name: "Kim Min-jae", photo: null, number: 3, position: "D", grid: null, rating: null, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
  { id: 3005, name: "Alphonso Davies", photo: null, number: 19, position: "D", grid: null, rating: null, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
  { id: 3006, name: "Aleksandar Pavlovic", photo: null, number: 45, position: "M", grid: null, rating: null, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
  { id: 3007, name: "Leon Goretzka", photo: null, number: 8, position: "M", grid: null, rating: null, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
  { id: 3008, name: "Leroy Sane", photo: null, number: 10, position: "M", grid: null, rating: null, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
  { id: 3009, name: "Jamal Musiala", photo: null, number: 42, position: "M", grid: null, rating: null, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
  { id: 3010, name: "Kingsley Coman", photo: null, number: 11, position: "F", grid: null, rating: null, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
  { id: 3011, name: "Harry Kane", photo: null, number: 9, position: "F", grid: null, rating: null, goals: 0, assists: 0, yellowCards: 0, redCards: 0 },
];

const home4231 = layoutFormation(bayernStarters, "4-2-3-1", "home");
assert(home4231.length === 11, "4-2-3-1 lays out exactly 11 players");

// Verify 5 distinct lines exist (Line 0: GK, Line 1: DEF, Line 2: CDM, Line 3: CAM, Line 4: ST)
const linesPresent = new Set(home4231.map((p) => p.lineIndex));
assert(linesPresent.size === 5, "4-2-3-1 has exactly 5 depth lines (GK + 4 outfield lines)");

// Verify line counts: Line 0 has 1, Line 1 has 4, Line 2 has 2, Line 3 has 3, Line 4 has 1
const lineCounts = [0, 1, 2, 3, 4].map(
  (idx) => home4231.filter((p) => p.lineIndex === idx).length
);
assert(
  JSON.stringify(lineCounts) === JSON.stringify([1, 4, 2, 3, 1]),
  "4-2-3-1 line distribution is [1 GK, 4 DEF, 2 CDM, 3 CAM, 1 ST]",
  `Got: ${JSON.stringify(lineCounts)}`
);

// Verify Kane is the lone striker in Line 4 at the deepest attacking position
const kaneLayout = home4231.find((p) => p.player.name === "Harry Kane");
assert(
  kaneLayout !== undefined && kaneLayout.lineIndex === 4 && kaneLayout.position.left === "44.50%",
  "Harry Kane is the lone striker in line 4 at depth 44.50%",
  `Kane line: ${kaneLayout?.lineIndex}, left: ${kaneLayout?.position.left}`
);

// Verify Neuer is the goalkeeper in Line 0
const neuerLayout = home4231.find((p) => p.player.name === "Manuel Neuer");
assert(
  neuerLayout !== undefined && neuerLayout.lineIndex === 0 && neuerLayout.position.left === "7.00%",
  "Neuer is in Line 0 at GK depth 7.00%",
  `Neuer line: ${neuerLayout?.lineIndex}, left: ${neuerLayout?.position.left}`
);

// 3. Test Away Symmetrical Mirroring (PSG in 4-3-3 scenario)
console.log("\n--- 3. Testing Symmetrical Mirroring for Away Team ---");
const away4231 = layoutFormation(bayernStarters, "4-2-3-1", "away");
const awayNeuer = away4231.find((p) => p.player.name === "Manuel Neuer");
const awayKane = away4231.find((p) => p.player.name === "Harry Kane");

assert(
  awayNeuer !== undefined && awayNeuer.position.left === "93.00%",
  "Away Goalkeeper is mirrored at 93.00% (100 - 7%)",
  `Away Neuer: ${awayNeuer?.position.left}`
);

assert(
  awayKane !== undefined && awayKane.position.left === "55.50%",
  "Away Striker is mirrored at 55.50% (100 - 44.5%)",
  `Away Kane: ${awayKane?.position.left}`
);

// Verify clearance between Home striker (44.5%) and Away striker (55.5%)
const clearance = parseFloat(awayKane!.position.left) - parseFloat(kaneLayout!.position.left);
assert(
  clearance >= 10.0,
  "Home and Away teams maintain clear horizontal buffer across center line (> 10%)",
  `Clearance: ${clearance}%`
);

// 4. Test Red Card Dismissal (Rule 2: out of the match, team has 10 players)
console.log("\n--- 4. Testing Red Card Dismissal (Rule 2 Consistency) ---");
const redCardIds = new Set([3003]); // Upamecano red-carded
const redCardLayout = layoutFormation(bayernStarters, "4-2-3-1", "home", redCardIds);

assert(
  redCardLayout.length === 10,
  "Red card correctly reduces on-field players to exactly 10 players",
  `Count: ${redCardLayout.length}`
);

assert(
  !redCardLayout.some((p) => p.player.id === 3003),
  "Dismissed player (Upamecano) is removed from the pitch",
  `Found: ${redCardLayout.some((p) => p.player.id === 3003)}`
);

const defLineAfterRed = redCardLayout.filter((p) => p.lineIndex === 1);
assert(
  defLineAfterRed.length === 3,
  "Defense line now has 3 players instead of 4 and automatically re-centers",
  `Def players: ${defLineAfterRed.length}`
);

console.log("\n=================================================");
console.log(`FORMATION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("=================================================");

if (failed > 0) process.exit(1);
