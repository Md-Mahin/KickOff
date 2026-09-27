import { pool } from "../src/db";
import { getCoachForTeam } from "../src/services/coachData";

async function main() {
  console.log("=== KickOff Coach Seeding & Schema Migration ===");

  try {
    // 1. Ensure columns exist on Team table
    await pool.query(`
      ALTER TABLE Team
        ADD COLUMN IF NOT EXISTS CoachName VARCHAR(255),
        ADD COLUMN IF NOT EXISTS CoachPhoto TEXT;
    `);
    console.log("✓ Team table verified with CoachName and CoachPhoto columns.");

    // 2. Ensure TeamMatchCoach table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS TeamMatchCoach (
        MatchID INT NOT NULL REFERENCES Match(MatchID) ON DELETE CASCADE,
        TeamID INT NOT NULL REFERENCES Team(TeamID) ON DELETE CASCADE,
        CoachID INT,
        CoachName VARCHAR(255),
        CoachPhoto TEXT,
        PRIMARY KEY (MatchID, TeamID)
      );
    `);
    console.log("✓ TeamMatchCoach table verified.");

    // 3. Update all teams with authentic coach data
    const teamsRes = await pool.query(`SELECT TeamID, Name FROM Team ORDER BY TeamID`);
    console.log(`Found ${teamsRes.rows.length} teams to update with managers...`);

    let teamsUpdated = 0;
    for (const t of teamsRes.rows) {
      const coach = getCoachForTeam(t.teamid, t.name);
      await pool.query(
        `UPDATE Team
         SET CoachName = $1, CoachPhoto = $2
         WHERE TeamID = $3`,
        [coach.name, coach.photo, t.teamid]
      );
      teamsUpdated++;
    }
    console.log(`✓ Updated ${teamsUpdated} teams with realistic head coaches!`);

    // 4. Update all matches in TeamMatchCoach
    const matchesRes = await pool.query(`
      SELECT m.MatchID, m.HomeTeamID, m.AwayTeamID,
             ht.Name AS HomeTeamName, ht.CoachName AS HomeCoachName, ht.CoachPhoto AS HomeCoachPhoto,
             at.Name AS AwayTeamName, at.CoachName AS AwayCoachName, at.CoachPhoto AS AwayCoachPhoto
      FROM Match m
      JOIN Team ht ON m.HomeTeamID = ht.TeamID
      JOIN Team at ON m.AwayTeamID = at.TeamID
      ORDER BY m.MatchID
    `);
    console.log(`Found ${matchesRes.rows.length} matches to populate coaches for...`);

    let coachesInserted = 0;
    for (const m of matchesRes.rows) {
      // Home Coach
      const homeCoachName = m.homecoachname ?? getCoachForTeam(m.hometeamid, m.hometeamname).name;
      const homeCoachPhoto = m.homecoachphoto ?? getCoachForTeam(m.hometeamid, m.hometeamname).photo;

      await pool.query(
        `INSERT INTO TeamMatchCoach (MatchID, TeamID, CoachName, CoachPhoto)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (MatchID, TeamID) DO UPDATE SET
           CoachName = EXCLUDED.CoachName,
           CoachPhoto = EXCLUDED.CoachPhoto`,
        [m.matchid, m.hometeamid, homeCoachName, homeCoachPhoto]
      );
      coachesInserted++;

      // Away Coach
      const awayCoachName = m.awaycoachname ?? getCoachForTeam(m.awayteamid, m.awayteamname).name;
      const awayCoachPhoto = m.awaycoachphoto ?? getCoachForTeam(m.awayteamid, m.awayteamname).photo;

      await pool.query(
        `INSERT INTO TeamMatchCoach (MatchID, TeamID, CoachName, CoachPhoto)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (MatchID, TeamID) DO UPDATE SET
           CoachName = EXCLUDED.CoachName,
           CoachPhoto = EXCLUDED.CoachPhoto`,
        [m.matchid, m.awayteamid, awayCoachName, awayCoachPhoto]
      );
      coachesInserted++;
    }

    console.log(`✓ Populated ${coachesInserted} coach records into TeamMatchCoach!`);

    // 5. Verification
    const countRes = await pool.query(`SELECT COUNT(*) FROM TeamMatchCoach`);
    console.log(`\nFinal TeamMatchCoach record count: ${countRes.rows[0].count}`);

    const sampleRes = await pool.query(`
      SELECT tmc.MatchID, t.Name AS TeamName, tmc.CoachName, tmc.CoachPhoto
      FROM TeamMatchCoach tmc
      JOIN Team t ON tmc.TeamID = t.TeamID
      WHERE tmc.MatchID IN (1, 2, 6, 8, 10, 11)
      ORDER BY tmc.MatchID, tmc.TeamID
    `);

    console.log("\nSample Match Coaches:");
    sampleRes.rows.forEach(r => {
      console.log(`Match ${r.matchid} - ${r.teamname}: Coach "${r.coachname}" (${r.coachphoto})`);
    });

    console.log("\nCoach seeding successfully finished!");
  } catch (err) {
    console.error("Coach seeding failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
