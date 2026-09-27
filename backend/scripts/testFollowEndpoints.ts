
import { pool } from "../src/db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

async function testEndpoints() {
  console.log("Testing follow/unfollow backend queries and sync...");

  // 1. Pick user1
  const userRes = await pool.query(`SELECT UserID, Username, Email, Role FROM Users WHERE Email = 'user1@kickoff.com'`);
  if (!userRes.rows.length) throw new Error("user1@kickoff.com not found");
  const user = userRes.rows[0];
  const userId = user.userid;
  console.log(`Testing with user: ${user.username} (ID: ${userId})`);

  // 2. Check team follows before
  const initialTeams = await pool.query(`SELECT TeamID FROM UserFollowsTeam WHERE UserID = $1`, [userId]);
  console.log(`Initial followed teams count for user: ${initialTeams.rows.length}`);

  // 3. Find a team that user1 does NOT follow yet
  const unFollowedTeamRes = await pool.query(
    `SELECT TeamID, Name FROM Team WHERE TeamID NOT IN (SELECT TeamID FROM UserFollowsTeam WHERE UserID = $1) LIMIT 1`,
    [userId]
  );
  if (!unFollowedTeamRes.rows.length) throw new Error("No unfollowed team found");
  const testTeam = unFollowedTeamRes.rows[0];
  console.log(`Found unfollowed test team: ${testTeam.name} (ID: ${testTeam.teamid})`);

  // Get initial team follower count in DB
  const teamCountBefore = await pool.query(`SELECT COUNT(*)::int as count FROM UserFollowsTeam WHERE TeamID = $1`, [testTeam.teamid]);
  console.log(`Team ${testTeam.name} initial followers in DB: ${teamCountBefore.rows[0].count}`);

  // Test Follow Team query
  await pool.query(
    `INSERT INTO UserFollowsTeam (UserID, TeamID) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, testTeam.teamid]
  );
  const teamCountAfterFollow = await pool.query(`SELECT COUNT(*)::int as count FROM UserFollowsTeam WHERE TeamID = $1`, [testTeam.teamid]);
  console.log(`Team ${testTeam.name} followers after follow: ${teamCountAfterFollow.rows[0].count}`);
  if (teamCountAfterFollow.rows[0].count !== teamCountBefore.rows[0].count + 1) {
    throw new Error("Follow team count increment failed");
  }

  // Test Unfollow Team query
  await pool.query(
    `DELETE FROM UserFollowsTeam WHERE UserID = $1 AND TeamID = $2`,
    [userId, testTeam.teamid]
  );
  const teamCountAfterUnfollow = await pool.query(`SELECT COUNT(*)::int as count FROM UserFollowsTeam WHERE TeamID = $1`, [testTeam.teamid]);
  console.log(`Team ${testTeam.name} followers after unfollow: ${teamCountAfterUnfollow.rows[0].count}`);
  if (teamCountAfterUnfollow.rows[0].count !== teamCountBefore.rows[0].count) {
    throw new Error("Unfollow team count decrement failed");
  }

  // 4. Test Tournament Follow
  const testTournRes = await pool.query(`SELECT TournamentID, Name FROM Tournament LIMIT 1`);
  const testTournament = testTournRes.rows[0];
  console.log(`\nTesting tournament follow for: ${testTournament.name} (ID: ${testTournament.tournamentid})`);

  const tournCountBefore = await pool.query(`SELECT COUNT(*)::int as count FROM UserFollowsTournament WHERE TournamentID = $1`, [testTournament.tournamentid]);
  console.log(`Tournament initial followers in DB: ${tournCountBefore.rows[0].count}`);

  await pool.query(
    `INSERT INTO UserFollowsTournament (UserID, TournamentID) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, testTournament.tournamentid]
  );
  const tournCountAfterFollow = await pool.query(`SELECT COUNT(*)::int as count FROM UserFollowsTournament WHERE TournamentID = $1`, [testTournament.tournamentid]);
  console.log(`Tournament followers after follow: ${tournCountAfterFollow.rows[0].count}`);
  if (tournCountAfterFollow.rows[0].count !== tournCountBefore.rows[0].count + 1) {
    throw new Error("Follow tournament count increment failed");
  }

  await pool.query(
    `DELETE FROM UserFollowsTournament WHERE UserID = $1 AND TournamentID = $2`,
    [userId, testTournament.tournamentid]
  );
  const tournCountAfterUnfollow = await pool.query(`SELECT COUNT(*)::int as count FROM UserFollowsTournament WHERE TournamentID = $1`, [testTournament.tournamentid]);
  console.log(`Tournament followers after unfollow: ${tournCountAfterUnfollow.rows[0].count}`);
  if (tournCountAfterUnfollow.rows[0].count !== tournCountBefore.rows[0].count) {
    throw new Error("Unfollow tournament count decrement failed");
  }

  // 5. Test Player Follow
  const unFollowedPlayerRes = await pool.query(
    `SELECT PlayerID, Name FROM Player WHERE PlayerID NOT IN (SELECT PlayerID FROM UserFollowsPlayer WHERE UserID = $1) LIMIT 1`,
    [userId]
  );
  const testPlayer = unFollowedPlayerRes.rows[0];
  console.log(`\nTesting player follow for: ${testPlayer.name} (ID: ${testPlayer.playerid})`);

  const playerCountBefore = await pool.query(`SELECT COUNT(*)::int as count FROM UserFollowsPlayer WHERE PlayerID = $1`, [testPlayer.playerid]);
  console.log(`Player initial followers in DB: ${playerCountBefore.rows[0].count}`);

  await pool.query(
    `INSERT INTO UserFollowsPlayer (UserID, PlayerID) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, testPlayer.playerid]
  );
  const playerCountAfterFollow = await pool.query(`SELECT COUNT(*)::int as count FROM UserFollowsPlayer WHERE PlayerID = $1`, [testPlayer.playerid]);
  console.log(`Player followers after follow: ${playerCountAfterFollow.rows[0].count}`);
  if (playerCountAfterFollow.rows[0].count !== playerCountBefore.rows[0].count + 1) {
    throw new Error("Follow player count increment failed");
  }

  await pool.query(
    `DELETE FROM UserFollowsPlayer WHERE UserID = $1 AND PlayerID = $2`,
    [userId, testPlayer.playerid]
  );
  const playerCountAfterUnfollow = await pool.query(`SELECT COUNT(*)::int as count FROM UserFollowsPlayer WHERE PlayerID = $1`, [testPlayer.playerid]);
  console.log(`Player followers after unfollow: ${playerCountAfterUnfollow.rows[0].count}`);
  if (playerCountAfterUnfollow.rows[0].count !== playerCountBefore.rows[0].count) {
    throw new Error("Unfollow player count decrement failed");
  }

  console.log("\nALL follow/unfollow and database synchronization tests PASSED!");
  process.exit(0);
}

testEndpoints().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

