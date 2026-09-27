
import bcrypt from "bcrypt";
import { pool } from "../src/db";

async function seed100Users() {
  console.log("Starting 100 users seeding...");

  // 1. Fetch clubs (Team where ClubID IS NOT NULL)
  const clubsRes = await pool.query(
    `SELECT TeamID FROM Team WHERE ClubID IS NOT NULL ORDER BY TeamID`
  );
  const clubIds: number[] = clubsRes.rows.map((r) => r.teamid);
  console.log(`Found ${clubIds.length} clubs in database.`);
  if (clubIds.length < 4) {
    throw new Error(`Need at least 4 clubs, found ${clubIds.length}`);
  }

  // 2. Fetch country teams (Team where ClubID IS NULL)
  const countriesRes = await pool.query(
    `SELECT TeamID FROM Team WHERE ClubID IS NULL ORDER BY TeamID`
  );
  const countryIds: number[] = countriesRes.rows.map((r) => r.teamid);
  console.log(`Found ${countryIds.length} country teams in database.`);
  if (countryIds.length < 2) {
    throw new Error(`Need at least 2 country teams, found ${countryIds.length}`);
  }

  // 3. Fetch players
  const playersRes = await pool.query(
    `SELECT PlayerID FROM Player ORDER BY PlayerID`
  );
  const playerIds: number[] = playersRes.rows.map((r) => r.playerid);
  console.log(`Found ${playerIds.length} players in database.`);
  if (playerIds.length < 10) {
    throw new Error(`Need at least 10 players, found ${playerIds.length}`);
  }

  // 4. Precompute bcrypt hash for 'password123'
  console.log("Generating bcrypt password hash...");
  const passwordHash = await bcrypt.hash("password123", 10);

  // Helper to pick N distinct random elements from an array
  function pickRandomDistinct<T>(arr: T[], n: number): T[] {
    const copy = [...arr];
    // Fisher-Yates shuffle
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Clean up any existing seeded users (user1 to user100) to make it idempotent
    const deleteRes = await client.query(
      `DELETE FROM Users WHERE Username ~ '^fan_user_([1-9]|[1-9][0-9]|100)$' OR Email ~ '^user([1-9]|[1-9][0-9]|100)@kickoff\\.com$' RETURNING UserID`
    );
    if (deleteRes.rowCount && deleteRes.rowCount > 0) {
      console.log(`Cleaned up ${deleteRes.rowCount} previous seed users.`);
    }

    let insertedUsersCount = 0;
    let insertedTeamFollowsCount = 0;
    let insertedPlayerFollowsCount = 0;

    for (let i = 1; i <= 100; i++) {
      const username = `fan_user_${i}`;
      const email = `user${i}@kickoff.com`;

      const userInsert = await client.query(
        `INSERT INTO Users (Username, Email, PasswordHash, Role)
         VALUES ($1, $2, $3, 'fan')
         RETURNING UserID`,
        [username, email, passwordHash]
      );
      const userId: number = userInsert.rows[0].userid;
      insertedUsersCount++;

      // Pick 4 clubs
      const pickedClubs = pickRandomDistinct(clubIds, 4);
      for (const clubId of pickedClubs) {
        await client.query(
          `INSERT INTO UserFollowsTeam (UserID, TeamID)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [userId, clubId]
        );
        insertedTeamFollowsCount++;
      }

      // Pick 2 countries
      const pickedCountries = pickRandomDistinct(countryIds, 2);
      for (const countryId of pickedCountries) {
        await client.query(
          `INSERT INTO UserFollowsTeam (UserID, TeamID)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [userId, countryId]
        );
        insertedTeamFollowsCount++;
      }

      // Pick 10 players
      const pickedPlayers = pickRandomDistinct(playerIds, 10);
      for (const playerId of pickedPlayers) {
        await client.query(
          `INSERT INTO UserFollowsPlayer (UserID, PlayerID)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [userId, playerId]
        );
        insertedPlayerFollowsCount++;
      }
    }

    await client.query("COMMIT");
    console.log(`Successfully seeded ${insertedUsersCount} users!`);
    console.log(`Inserted ${insertedTeamFollowsCount} team follows (4 clubs + 2 countries per user).`);
    console.log(`Inserted ${insertedPlayerFollowsCount} player follows (10 players per user).`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error during seeding, transaction rolled back:", error);
    throw error;
  } finally {
    client.release();
  }

  // Verification queries
  console.log("\n--- Verification Queries ---");
  const usersCheck = await pool.query(
    `SELECT count(*)::int as count FROM Users WHERE Username ~ '^fan_user_'`
  );
  console.log(`Total seeded users in DB: ${usersCheck.rows[0].count}`);

  const teamFollowsCheck = await pool.query(
    `SELECT u.UserID,
            COUNT(CASE WHEN t.ClubID IS NOT NULL THEN 1 END)::int as clubs_count,
            COUNT(CASE WHEN t.ClubID IS NULL THEN 1 END)::int as countries_count,
            COUNT(*)::int as total_teams
     FROM Users u
     JOIN UserFollowsTeam f ON u.UserID = f.UserID
     JOIN Team t ON f.TeamID = t.TeamID
     WHERE u.Username ~ '^fan_user_'
     GROUP BY u.UserID
     ORDER BY u.UserID
     LIMIT 5`
  );
  console.log("Sample 5 users team follows breakdown (expected: 4 clubs, 2 countries, 6 total):");
  console.table(teamFollowsCheck.rows);

  const playerFollowsCheck = await pool.query(
    `SELECT u.UserID, COUNT(*)::int as players_count
     FROM Users u
     JOIN UserFollowsPlayer f ON u.UserID = f.UserID
     WHERE u.Username ~ '^fan_user_'
     GROUP BY u.UserID
     ORDER BY u.UserID
     LIMIT 5`
  );
  console.log("Sample 5 users player follows breakdown (expected: 10 players):");
  console.table(playerFollowsCheck.rows);

  const aggregateCheck = await pool.query(
    `WITH user_stats AS (
       SELECT u.UserID,
              COUNT(DISTINCT CASE WHEN t.ClubID IS NOT NULL THEN t.TeamID END) as clubs,
              COUNT(DISTINCT CASE WHEN t.ClubID IS NULL THEN t.TeamID END) as countries,
              (SELECT COUNT(*) FROM UserFollowsPlayer p WHERE p.UserID = u.UserID) as players
       FROM Users u
       LEFT JOIN UserFollowsTeam f ON u.UserID = f.UserID
       LEFT JOIN Team t ON f.TeamID = t.TeamID
       WHERE u.Username ~ '^fan_user_'
       GROUP BY u.UserID
     )
     SELECT
       COUNT(*)::int as total_users,
       SUM(CASE WHEN clubs = 4 THEN 1 ELSE 0 END)::int as users_with_4_clubs,
       SUM(CASE WHEN countries = 2 THEN 1 ELSE 0 END)::int as users_with_2_countries,
       SUM(CASE WHEN players = 10 THEN 1 ELSE 0 END)::int as users_with_10_players
     FROM user_stats;`
  );
  console.log("Aggregate verification of all 100 users:");
  console.table(aggregateCheck.rows);

  process.exit(0);
}

seed100Users().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});

