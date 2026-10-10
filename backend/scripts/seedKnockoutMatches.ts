import { pool } from "../src/db";

async function seedKnockout() {
  console.log("Seeding knockout matches for UEFA Champions League (Tournament 4)...");

  // 1. Check existing matches in Tournament 4
  const existing = await pool.query(
    "SELECT MatchID, HomeTeamID, AwayTeamID, MatchDate FROM Match WHERE TournamentID = 4 ORDER BY MatchID"
  );
  console.log(`Found ${existing.rows.length} existing matches in Tournament 4`);

  // Let's update existing UCL matches to represent knockout stages:
  // Match 206 (Real Madrid vs Barcelona): Grand Final (GF)!
  // Match 210 (PSG vs Real Madrid): Semi-Final (SF)!
  // Match 14 (AC Milan vs Inter Milan): Semi-Final (SF)!
  // Match 16 (Inter Milan vs Juventus): Quarter-Final (QF)!
  // Match 15 (Juventus vs AC Milan): Round of 16 (RO16)!

  if (existing.rows.some((r) => r.matchid === 206)) {
    await pool.query(
      "UPDATE Match SET round_status = 'knockout', round_position = 'GF' WHERE MatchID = 206"
    );
  }
  if (existing.rows.some((r) => r.matchid === 210)) {
    await pool.query(
      "UPDATE Match SET round_status = 'knockout', round_position = 'SF' WHERE MatchID = 210"
    );
  }
  if (existing.rows.some((r) => r.matchid === 14)) {
    await pool.query(
      "UPDATE Match SET round_status = 'knockout', round_position = 'SF' WHERE MatchID = 14"
    );
  }
  if (existing.rows.some((r) => r.matchid === 16)) {
    await pool.query(
      "UPDATE Match SET round_status = 'knockout', round_position = 'QF' WHERE MatchID = 16"
    );
  }
  if (existing.rows.some((r) => r.matchid === 15)) {
    await pool.query(
      "UPDATE Match SET round_status = 'knockout', round_position = 'RO16' WHERE MatchID = 15"
    );
  }

  // Find some top club team IDs
  const topTeams = await pool.query(`
    SELECT TeamID, Name FROM Team 
    WHERE Name IN ('Real Madrid', 'Barcelona', 'PSG', 'Bayern Munich', 'Manchester City', 'Arsenal', 'Liverpool', 'Inter Milan', 'Juventus', 'AC Milan', 'Chelsea', 'Atletico Madrid', 'Borussia Dortmund')
  `);
  const teamMap: Record<string, number> = {};
  topTeams.rows.forEach((t) => {
    teamMap[t.name] = t.teamid;
  });

  console.log("Found teams:", Object.keys(teamMap));

  // Let's add more knockout matches if needed to have a full set across RO32, RO16, QF, SF, GF
  const extraMatches = [
    {
      home: "Bayern Munich",
      away: "Arsenal",
      homeGoals: 3,
      awayGoals: 1,
      stage: "QF",
      date: "2026-05-12T19:00:00Z",
    },
    {
      home: "Manchester City",
      away: "Real Madrid",
      homeGoals: 1,
      awayGoals: 2,
      stage: "QF",
      date: "2026-05-13T19:00:00Z",
    },
    {
      home: "Barcelona",
      away: "PSG",
      homeGoals: 3,
      awayGoals: 2,
      stage: "QF",
      date: "2026-05-14T19:00:00Z",
    },
    {
      home: "Arsenal",
      away: "Chelsea",
      homeGoals: 2,
      awayGoals: 0,
      stage: "RO16",
      date: "2026-04-10T19:00:00Z",
    },
    {
      home: "Liverpool",
      away: "Bayern Munich",
      homeGoals: 1,
      awayGoals: 2,
      stage: "RO16",
      date: "2026-04-11T19:00:00Z",
    },
    {
      home: "Borussia Dortmund",
      away: "Atletico Madrid",
      homeGoals: 1,
      awayGoals: 0,
      stage: "RO16",
      date: "2026-04-12T19:00:00Z",
    },
    {
      home: "Chelsea",
      away: "Borussia Dortmund",
      homeGoals: 2,
      awayGoals: 1,
      stage: "RO32",
      date: "2026-03-05T19:00:00Z",
    },
  ];

  for (const m of extraMatches) {
    const homeId = teamMap[m.home];
    const awayId = teamMap[m.away];
    if (homeId && awayId) {
      // Check if match already exists
      const chk = await pool.query(
        "SELECT MatchID FROM Match WHERE TournamentID = 4 AND HomeTeamID = $1 AND AwayTeamID = $2 AND round_position = $3",
        [homeId, awayId, m.stage]
      );
      if (chk.rows.length === 0) {
        await pool.query(
          `INSERT INTO Match (TournamentID, HomeTeamID, AwayTeamID, MatchDate, HomeGoals, AwayGoals, round_status, round_position)
           VALUES (4, $1, $2, $3, $4, $5, 'knockout', $6)`,
          [homeId, awayId, m.date, m.homeGoals, m.awayGoals, m.stage]
        );
        console.log(`Inserted knockout match: ${m.home} vs ${m.away} (${m.stage})`);
      }
    }
  }

  // Verify resulting knockout matches in UCL
  const uclMatches = await pool.query(`
    SELECT m.MatchID, m.round_status, m.round_position, ht.Name as home, at.Name as away, m.HomeGoals, m.AwayGoals, m.MatchDate
    FROM Match m
    JOIN Team ht ON m.HomeTeamID = ht.TeamID
    JOIN Team at ON m.AwayTeamID = at.TeamID
    WHERE m.TournamentID = 4
    ORDER BY 
      CASE m.round_position
        WHEN 'GF' THEN 1
        WHEN 'SF' THEN 2
        WHEN 'QF' THEN 3
        WHEN 'RO16' THEN 4
        WHEN 'RO32' THEN 5
        ELSE 6
      END,
      m.MatchDate DESC
  `);

  console.log("\n=== UEFA Champions League Matches in DB ===");
  console.table(uclMatches.rows);

  await pool.end();
}

seedKnockout().catch(console.error);

