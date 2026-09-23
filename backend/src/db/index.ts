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
      ADD COLUMN IF NOT EXISTS Formation VARCHAR(20),
      ADD COLUMN IF NOT EXISTS Position VARCHAR(10),
      ADD COLUMN IF NOT EXISTS JerseyNumber INT;

    ALTER TABLE Player
      ADD COLUMN IF NOT EXISTS Position VARCHAR(10),
      ADD COLUMN IF NOT EXISTS Photo TEXT;

    -- Ensure seeded data has a formation and positions
    UPDATE Lineup SET Formation = '4-3-3' WHERE MatchID = 1 AND Formation IS NULL;
    UPDATE Lineup SET Formation = '3-5-2' WHERE MatchID = 2 AND TeamID = 3 AND Formation IS NULL;
    UPDATE Lineup SET Formation = '4-4-2' WHERE MatchID = 2 AND TeamID = 4 AND Formation IS NULL;

    -- Ensure Match 1 has full 11-player squads
    INSERT INTO Player (PlayerID, Name, Position) VALUES
      (1, 'David Raya', 'G'),
      (2, 'Ben White', 'D'),
      (3, 'William Saliba', 'D'),
      (4, 'Gabriel Magalhaes', 'D'),
      (5, 'Oleksandr Zinchenko', 'D'),
      (6, 'Declan Rice', 'M'),
      (7, 'Martin Odegaard', 'M'),
      (8, 'Kai Havertz', 'M'),
      (9, 'Bukayo Saka', 'F'),
      (10, 'Gabriel Jesus', 'F'),
      (11, 'Gabriel Martinelli', 'F'),
      (12, 'Thibaut Courtois', 'G'),
      (13, 'Dani Carvajal', 'D'),
      (14, 'Antonio Rudiger', 'D'),
      (15, 'Eder Militao', 'D'),
      (16, 'Ferland Mendy', 'D'),
      (17, 'Federico Valverde', 'M'),
      (18, 'Aurelien Tchouameni', 'M'),
      (19, 'Jude Bellingham', 'M'),
      (20, 'Rodrygo', 'F'),
      (21, 'Kylian Mbappe', 'F'),
      (22, 'Vinicius Junior', 'F')
    ON CONFLICT (PlayerID) DO UPDATE SET
      Name = EXCLUDED.Name,
      Position = EXCLUDED.Position;

    INSERT INTO Lineup (MatchID, TeamID, PlayerID, Status, Formation, Position, JerseyNumber) VALUES
      (1, 1, 1, 'Starter', '4-3-3', 'G', 22),
      (1, 1, 2, 'Starter', '4-3-3', 'D', 4),
      (1, 1, 3, 'Starter', '4-3-3', 'D', 2),
      (1, 1, 4, 'Starter', '4-3-3', 'D', 6),
      (1, 1, 5, 'Starter', '4-3-3', 'D', 35),
      (1, 1, 6, 'Starter', '4-3-3', 'M', 41),
      (1, 1, 7, 'Starter', '4-3-3', 'M', 8),
      (1, 1, 8, 'Starter', '4-3-3', 'M', 29),
      (1, 1, 9, 'Starter', '4-3-3', 'F', 7),
      (1, 1, 10, 'Starter', '4-3-3', 'F', 9),
      (1, 1, 11, 'Starter', '4-3-3', 'F', 11),
      (1, 2, 12, 'Starter', '4-3-3', 'G', 1),
      (1, 2, 13, 'Starter', '4-3-3', 'D', 2),
      (1, 2, 14, 'Starter', '4-3-3', 'D', 22),
      (1, 2, 15, 'Starter', '4-3-3', 'D', 3),
      (1, 2, 16, 'Starter', '4-3-3', 'D', 23),
      (1, 2, 17, 'Starter', '4-3-3', 'M', 15),
      (1, 2, 18, 'Starter', '4-3-3', 'M', 14),
      (1, 2, 19, 'Starter', '4-3-3', 'M', 5),
      (1, 2, 20, 'Starter', '4-3-3', 'F', 11),
      (1, 2, 21, 'Starter', '4-3-3', 'F', 9),
      (1, 2, 22, 'Starter', '4-3-3', 'F', 7)
    ON CONFLICT (MatchID, TeamID, PlayerID) DO UPDATE SET
      Status = EXCLUDED.Status,
      Formation = EXCLUDED.Formation,
      Position = EXCLUDED.Position,
      JerseyNumber = EXCLUDED.JerseyNumber;

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
