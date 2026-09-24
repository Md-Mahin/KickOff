import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

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
      ADD COLUMN IF NOT EXISTS Formation VARCHAR(20),
      ADD COLUMN IF NOT EXISTS Position VARCHAR(10),
      ADD COLUMN IF NOT EXISTS JerseyNumber INT;

    ALTER TABLE Player
      ADD COLUMN IF NOT EXISTS Position VARCHAR(10),
      ADD COLUMN IF NOT EXISTS Photo TEXT;

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

    ALTER TABLE Event DROP CONSTRAINT IF EXISTS event_eventtype_check;
    ALTER TABLE Event ADD CONSTRAINT event_eventtype_check
      CHECK (EventType IN ('Goal', 'Card', 'Foul', 'Substitution'));

    CREATE TABLE IF NOT EXISTS Substitution (
      EventID INT PRIMARY KEY REFERENCES Event(EventID) ON DELETE CASCADE,
      InPlayerID INT REFERENCES Player(PlayerID)
    );

    CREATE TABLE IF NOT EXISTS Notification (
      NotificationID SERIAL PRIMARY KEY,
      UserID         INT NOT NULL REFERENCES Users(UserID) ON DELETE CASCADE,
      MatchID        INT NOT NULL REFERENCES Match(MatchID) ON DELETE CASCADE,
      Type           VARCHAR(30) NOT NULL CHECK (Type IN ('ABOUT_TO_START', 'JUST_STARTED', 'FINISHED')),
      Title          VARCHAR(255) NOT NULL,
      Message        TEXT NOT NULL,
      EntityName     VARCHAR(100),
      EntityType     VARCHAR(20) CHECK (EntityType IN ('Team', 'Player')),
      IsRead         BOOLEAN NOT NULL DEFAULT FALSE,
      CreatedAt      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_user_match_type UNIQUE (UserID, MatchID, Type)
    );

    CREATE INDEX IF NOT EXISTS idx_notification_user ON Notification(UserID, IsRead);
    CREATE INDEX IF NOT EXISTS idx_notification_match ON Notification(MatchID);
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

  try {
    const matchCountRes = await pool.query(`SELECT COUNT(*) FROM Match`);
    if (parseInt(matchCountRes.rows[0].count, 10) < 10) {
      console.log("Database has fewer than 10 matches. Populating full match schedule from seed.sql...");
      const seedSqlPath = path.resolve(__dirname, "../../database/seed.sql");
      if (fs.existsSync(seedSqlPath)) {
        const seedSql = fs.readFileSync(seedSqlPath, "utf-8");
        await pool.query(seedSql);
        console.log("Successfully populated 18 matches, squads, and standings!");
      }
    }
  } catch (err) {
    console.warn("Auto-seed check warning:", (err as Error).message);
  }
}
