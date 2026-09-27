
import { pool } from "../src/db";

async function run() {
  console.log("Creating UserFollowsTournament table if not exists...");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS UserFollowsTournament (
      UserID INT NOT NULL REFERENCES Users(UserID) ON DELETE CASCADE,
      TournamentID INT NOT NULL REFERENCES Tournament(TournamentID) ON DELETE CASCADE,
      PRIMARY KEY (UserID, TournamentID)
    );

    CREATE INDEX IF NOT EXISTS idx_user_follows_tournament ON UserFollowsTournament(UserID);
    CREATE INDEX IF NOT EXISTS idx_tournament_follows ON UserFollowsTournament(TournamentID);
  `);
  console.log("UserFollowsTournament table created / verified.");
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});

