import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL error:", err);
});

export async function initializeDatabase() {
  await pool.query(`
    ALTER TABLE Users
      ADD COLUMN IF NOT EXISTS Role VARCHAR(20) NOT NULL DEFAULT 'fan';

    ALTER TABLE Lineup
      ADD COLUMN IF NOT EXISTS Formation VARCHAR(20);

    -- Ensure seeded data has a formation
    UPDATE Lineup SET Formation = '4-2-3-1' WHERE MatchID = 1 AND TeamID = 1 AND Formation IS NULL;
    UPDATE Lineup SET Formation = '4-3-3' WHERE MatchID = 1 AND TeamID = 2 AND Formation IS NULL;
    UPDATE Lineup SET Formation = '3-5-2' WHERE MatchID = 2 AND TeamID = 3 AND Formation IS NULL;
    UPDATE Lineup SET Formation = '4-4-2' WHERE MatchID = 2 AND TeamID = 4 AND Formation IS NULL;

    CREATE TABLE IF NOT EXISTS UserSessions (
      SessionID UUID PRIMARY KEY,
      UserID INT NOT NULL REFERENCES Users(UserID) ON DELETE CASCADE,
      ExpiresAt TIMESTAMP NOT NULL,
      RevokedAt TIMESTAMP,
      CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON UserSessions(UserID);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_active
      ON UserSessions(SessionID) WHERE RevokedAt IS NULL;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
      ) THEN
        ALTER TABLE Users ADD CONSTRAINT users_role_check
          CHECK (Role IN ('fan', 'admin'));
      END IF;
    END
    $$;
  `);
}
