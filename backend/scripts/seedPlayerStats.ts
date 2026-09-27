import { pool } from "../src/db";

// Deterministic pseudo-random generator with seed
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

async function main() {
  console.log("=== Seeding Player Match Statistics & Running PL/SQL Scoring Algorithm ===");

  try {
    // 1. Get all matches and lineups
    const lineupsRes = await pool.query(`
      SELECT
        l.MatchID,
        l.TeamID,
        l.PlayerID,
        l.Status,
        p.Name AS PlayerName,
        UPPER(COALESCE(p.Position, 'M')) AS Position,
        m.HomeTeamID,
        m.AwayTeamID,
        COALESCE(m.HomeGoals, 0) AS HomeGoals,
        COALESCE(m.AwayGoals, 0) AS AwayGoals
      FROM Lineup l
      JOIN Player p ON l.PlayerID = p.PlayerID
      JOIN Match m ON l.MatchID = m.MatchID
      ORDER BY l.MatchID, l.TeamID, l.PlayerID
    `);

    console.log(`Found ${lineupsRes.rows.length} lineup appearances to generate match stats for...`);

    let insertedCount = 0;
    for (let i = 0; i < lineupsRes.rows.length; i++) {
      const row = lineupsRes.rows[i];
      const seed = row.matchid * 1000 + row.playerid;
      const isHome = row.teamid === row.hometeamid;
      const teamGoals = isHome ? row.homegoals : row.awaygoals;
      const opponentGoals = isHome ? row.awaygoals : row.homegoals;

      const isStarter = row.status === "Starter";
      const minutesPlayed = isStarter
        ? 75 + Math.floor(seededRandom(seed + 1) * 16) // 75 - 90 mins
        : 15 + Math.floor(seededRandom(seed + 1) * 20); // 15 - 34 mins

      let goals = 0;
      let assists = 0;
      let shots = 0;
      let shotsOnTarget = 0;
      let passes = 0;
      let keyPasses = 0;
      let tackles = 0;
      let interceptions = 0;
      let clearances = 0;
      let saves = 0;
      let cleanSheet = opponentGoals === 0 ? 1 : 0;
      let yellowCards = 0;
      let redCards = 0;
      let goalsConceded = opponentGoals;

      const pos = row.position;

      if (pos.startsWith("F")) {
        // Forward
        const scoredChance = seededRandom(seed + 2);
        if (scoredChance > 0.65 && teamGoals > 0) {
          goals = Math.min(teamGoals, 1 + (scoredChance > 0.90 ? 1 : 0));
        }
        const assistChance = seededRandom(seed + 3);
        if (assistChance > 0.75 && teamGoals > goals) {
          assists = 1;
        }
        shots = goals + Math.floor(seededRandom(seed + 4) * 4) + (isStarter ? 1 : 0);
        shotsOnTarget = goals + Math.floor(seededRandom(seed + 5) * (shots - goals + 1));
        passes = 15 + Math.floor(seededRandom(seed + 6) * 30);
        keyPasses = assists + (seededRandom(seed + 7) > 0.6 ? 1 : 0);
        tackles = Math.floor(seededRandom(seed + 8) * 3);
        interceptions = Math.floor(seededRandom(seed + 9) * 2);
        clearances = Math.floor(seededRandom(seed + 10) * 2);
        yellowCards = seededRandom(seed + 11) > 0.88 ? 1 : 0;

      } else if (pos.startsWith("M")) {
        // Midfielder
        if (seededRandom(seed + 2) > 0.85 && teamGoals > 0) {
          goals = 1;
        }
        if (seededRandom(seed + 3) > 0.70 && teamGoals > 0) {
          assists = 1;
        }
        shots = goals + Math.floor(seededRandom(seed + 4) * 3);
        shotsOnTarget = goals + (shots > goals && seededRandom(seed + 5) > 0.5 ? 1 : 0);
        passes = 35 + Math.floor(seededRandom(seed + 6) * 45);
        keyPasses = assists + Math.floor(seededRandom(seed + 7) * 4);
        tackles = 1 + Math.floor(seededRandom(seed + 8) * 5);
        interceptions = 1 + Math.floor(seededRandom(seed + 9) * 4);
        clearances = Math.floor(seededRandom(seed + 10) * 3);
        yellowCards = seededRandom(seed + 11) > 0.82 ? 1 : 0;

      } else if (pos.startsWith("D")) {
        // Defender
        if (seededRandom(seed + 2) > 0.96 && teamGoals > 0) {
          goals = 1;
        }
        if (seededRandom(seed + 3) > 0.92) {
          assists = 1;
        }
        shots = goals;
        shotsOnTarget = goals;
        passes = 25 + Math.floor(seededRandom(seed + 6) * 40);
        keyPasses = assists + (seededRandom(seed + 7) > 0.8 ? 1 : 0);
        tackles = 2 + Math.floor(seededRandom(seed + 8) * 6);
        interceptions = 2 + Math.floor(seededRandom(seed + 9) * 5);
        clearances = 3 + Math.floor(seededRandom(seed + 10) * 6);
        yellowCards = seededRandom(seed + 11) > 0.80 ? 1 : 0;

      } else if (pos.startsWith("G")) {
        // Goalkeeper
        saves = 2 + Math.floor(seededRandom(seed + 4) * 6);
        passes = 15 + Math.floor(seededRandom(seed + 6) * 20);
        clearances = 1 + Math.floor(seededRandom(seed + 10) * 3);
        yellowCards = seededRandom(seed + 11) > 0.97 ? 1 : 0;
      }

      await pool.query(`
        INSERT INTO PlayerMatchStat (
          PlayerID, MatchID, MinutesPlayed, Goals, Assists,
          Shots, ShotsOnTarget, Passes, KeyPasses,
          Tackles, Interceptions, Clearances, Saves, CleanSheet,
          YellowCards, RedCards, GoalsConceded
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (PlayerID, MatchID) DO UPDATE SET
          MinutesPlayed = EXCLUDED.MinutesPlayed,
          Goals = EXCLUDED.Goals,
          Assists = EXCLUDED.Assists,
          Shots = EXCLUDED.Shots,
          ShotsOnTarget = EXCLUDED.ShotsOnTarget,
          Passes = EXCLUDED.Passes,
          KeyPasses = EXCLUDED.KeyPasses,
          Tackles = EXCLUDED.Tackles,
          Interceptions = EXCLUDED.Interceptions,
          Clearances = EXCLUDED.Clearances,
          Saves = EXCLUDED.Saves,
          CleanSheet = EXCLUDED.CleanSheet,
          YellowCards = EXCLUDED.YellowCards,
          RedCards = EXCLUDED.RedCards,
          GoalsConceded = EXCLUDED.GoalsConceded
      `, [
        row.playerid, row.matchid, minutesPlayed, goals, assists,
        shots, shotsOnTarget, passes, keyPasses,
        tackles, interceptions, clearances, saves, cleanSheet,
        yellowCards, redCards, goalsConceded
      ]);

      insertedCount++;
    }

    console.log(`✓ Inserted/Updated ${insertedCount} match stats in PlayerMatchStat!`);

    // 2. Execute PL/SQL Stored Procedure to update all ratings
    console.log("\nExecuting PL/SQL Procedure: CALL update_all_player_ratings('2025/2026')...");
    const startTime = Date.now();
    await pool.query(`CALL update_all_player_ratings('2025/2026')`);
    const elapsed = Date.now() - startTime;
    console.log(`✓ PL/SQL calculation executed successfully in ${elapsed}ms!`);

    // 3. Inspect top rankings
    const rankings = await pool.query(`
      SELECT
        prh.Rank,
        p.PlayerID,
        p.Name AS PlayerName,
        p.Position,
        p.OverallRating,
        tm.TeamName,
        pss.MatchesPlayed,
        pss.TotalMinutes,
        pss.TotalGoals,
        pss.TotalAssists,
        pss.TotalTackles,
        pss.TotalSaves
      FROM PlayerRatingHistory prh
      JOIN Player p ON prh.PlayerID = p.PlayerID
      LEFT JOIN PlayerSeasonStatsView pss ON p.PlayerID = pss.PlayerID
      LEFT JOIN LATERAL (
        SELECT t.Name AS TeamName
        FROM Lineup l
        JOIN Team t ON l.TeamID = t.TeamID
        WHERE l.PlayerID = p.PlayerID
        ORDER BY l.MatchID DESC
        LIMIT 1
      ) tm ON true
      WHERE prh.Season = '2025/2026'
      ORDER BY prh.Rank ASC
      LIMIT 15
    `);

    console.log("\nTop 15 Overall Player Rankings:");
    console.table(rankings.rows.map(r => ({
      Rank: `#${r.rank}`,
      Name: r.playername,
      Pos: r.position,
      Team: r.teamname,
      Rating: r.overallrating,
      Mins: r.totalminutes,
      Goals: r.totalgoals,
      Assists: r.totalassists,
      Tackles: r.totaltackles,
      Saves: r.totalsaves,
    })));

    // 4. Position Leaders
    for (const pos of ['F', 'M', 'D', 'G']) {
      const posLabel = pos === 'F' ? 'Forwards' : pos === 'M' ? 'Midfielders' : pos === 'D' ? 'Defenders' : 'Goalkeepers';
      const leaders = await pool.query(`
        SELECT p.Name, p.OverallRating, tm.TeamName, pss.TotalGoals, pss.TotalAssists, pss.TotalTackles, pss.TotalSaves
        FROM Player p
        LEFT JOIN PlayerSeasonStatsView pss ON p.PlayerID = pss.PlayerID
        LEFT JOIN LATERAL (
          SELECT t.Name AS TeamName
          FROM Lineup l
          JOIN Team t ON l.TeamID = t.TeamID
          WHERE l.PlayerID = p.PlayerID
          ORDER BY l.MatchID DESC
          LIMIT 1
        ) tm ON true
        WHERE p.Position = $1 AND p.OverallRating IS NOT NULL
        ORDER BY p.OverallRating DESC NULLS LAST
        LIMIT 5
      `, [pos]);

      console.log(`\nTop 3 ${posLabel}:`);
      leaders.rows.forEach((l, idx) => {
        console.log(`  ${idx + 1}. ${l.name} (${l.teamname ?? 'Free Agent'}) — Rating: ${l.overallrating}`);
      });
    }

  } catch (err) {
    console.error("Error seeding player stats:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
