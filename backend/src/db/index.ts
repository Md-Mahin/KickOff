
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
      ADD COLUMN IF NOT EXISTS JerseyNumber INT,
      ADD COLUMN IF NOT EXISTS LineupOrder INT;

    ALTER TABLE Player
      ADD COLUMN IF NOT EXISTS Position VARCHAR(10),
      ADD COLUMN IF NOT EXISTS Photo TEXT,
      ADD COLUMN IF NOT EXISTS OverallRating NUMERIC(4, 2) DEFAULT 6.00;

    ALTER TABLE Team
      ADD COLUMN IF NOT EXISTS CoachName VARCHAR(255),
      ADD COLUMN IF NOT EXISTS CoachPhoto TEXT;

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

    CREATE TABLE IF NOT EXISTS UserFollowsTournament (
      UserID INT NOT NULL REFERENCES Users(UserID) ON DELETE CASCADE,
      TournamentID INT NOT NULL REFERENCES Tournament(TournamentID) ON DELETE CASCADE,
      PRIMARY KEY (UserID, TournamentID)
    );

    CREATE INDEX IF NOT EXISTS idx_user_follows_tournament ON UserFollowsTournament(UserID);
    CREATE INDEX IF NOT EXISTS idx_tournament_follows ON UserFollowsTournament(TournamentID);

    CREATE TABLE IF NOT EXISTS TeamMatchCoach (
      MatchID INT NOT NULL REFERENCES Match(MatchID) ON DELETE CASCADE,
      TeamID INT NOT NULL REFERENCES Team(TeamID) ON DELETE CASCADE,
      CoachID INT,
      CoachName VARCHAR(255),
      CoachPhoto TEXT,
      PRIMARY KEY (MatchID, TeamID)
    );

    CREATE TABLE IF NOT EXISTS MatchUnavailablePlayer (
      MatchID INT NOT NULL REFERENCES Match(MatchID) ON DELETE CASCADE,
      TeamID INT NOT NULL REFERENCES Team(TeamID) ON DELETE CASCADE,
      PlayerID INT NOT NULL REFERENCES Player(PlayerID) ON DELETE CASCADE,
      Reason VARCHAR(255),
      Status VARCHAR(50),
      PRIMARY KEY (MatchID, TeamID, PlayerID)
    );

    CREATE TABLE IF NOT EXISTS PlayerMatchStat (
      PlayerMatchStatID SERIAL PRIMARY KEY,
      PlayerID          INT NOT NULL REFERENCES Player(PlayerID) ON DELETE CASCADE,
      MatchID           INT NOT NULL REFERENCES Match(MatchID) ON DELETE CASCADE,
      MinutesPlayed     INT NOT NULL DEFAULT 0 CHECK (MinutesPlayed >= 0 AND MinutesPlayed <= 130),
      Goals             INT NOT NULL DEFAULT 0 CHECK (Goals >= 0),
      Assists           INT NOT NULL DEFAULT 0 CHECK (Assists >= 0),
      Shots             INT NOT NULL DEFAULT 0 CHECK (Shots >= 0),
      ShotsOnTarget     INT NOT NULL DEFAULT 0 CHECK (ShotsOnTarget >= 0),
      Passes            INT NOT NULL DEFAULT 0 CHECK (Passes >= 0),
      KeyPasses         INT NOT NULL DEFAULT 0 CHECK (KeyPasses >= 0),
      Tackles           INT NOT NULL DEFAULT 0 CHECK (Tackles >= 0),
      Interceptions     INT NOT NULL DEFAULT 0 CHECK (Interceptions >= 0),
      Clearances        INT NOT NULL DEFAULT 0 CHECK (Clearances >= 0),
      Saves             INT NOT NULL DEFAULT 0 CHECK (Saves >= 0),
      CleanSheet        INT NOT NULL DEFAULT 0 CHECK (CleanSheet IN (0, 1)),
      YellowCards       INT NOT NULL DEFAULT 0 CHECK (YellowCards >= 0 AND YellowCards <= 2),
      RedCards          INT NOT NULL DEFAULT 0 CHECK (RedCards IN (0, 1)),
      GoalsConceded     INT NOT NULL DEFAULT 0 CHECK (GoalsConceded >= 0),
      Rating            NUMERIC(4, 2) CHECK (Rating >= 0.0 AND Rating <= 10.0),
      CreatedAt         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_player_match_stat UNIQUE (PlayerID, MatchID)
    );

    CREATE INDEX IF NOT EXISTS idx_pms_player ON PlayerMatchStat(PlayerID);
    CREATE INDEX IF NOT EXISTS idx_pms_match ON PlayerMatchStat(MatchID);

    CREATE TABLE IF NOT EXISTS PlayerRatingHistory (
      HistoryID         SERIAL PRIMARY KEY,
      PlayerID          INT NOT NULL REFERENCES Player(PlayerID) ON DELETE CASCADE,
      Rating            NUMERIC(4, 2) NOT NULL CHECK (Rating >= 0.0 AND Rating <= 10.0),
      Rank              INT,
      Season            VARCHAR(50) DEFAULT '2025/2026',
      CalculatedAt      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_rating_history_player ON PlayerRatingHistory(PlayerID, CalculatedAt DESC);
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

    CREATE OR REPLACE VIEW PlayerSeasonStatsView AS
    SELECT
      p.PlayerID,
      p.Name AS PlayerName,
      p.Position,
      p.Photo,
      p.OverallRating,
      tm.TeamID,
      tm.TeamName,
      COUNT(pms.MatchID)::int AS MatchesPlayed,
      COALESCE(SUM(pms.MinutesPlayed), 0)::int AS TotalMinutes,
      COALESCE(SUM(pms.Goals), 0)::int AS TotalGoals,
      COALESCE(SUM(pms.Assists), 0)::int AS TotalAssists,
      COALESCE(SUM(pms.Shots), 0)::int AS TotalShots,
      COALESCE(SUM(pms.ShotsOnTarget), 0)::int AS TotalShotsOnTarget,
      COALESCE(SUM(pms.Passes), 0)::int AS TotalPasses,
      COALESCE(SUM(pms.KeyPasses), 0)::int AS TotalKeyPasses,
      COALESCE(SUM(pms.Tackles), 0)::int AS TotalTackles,
      COALESCE(SUM(pms.Interceptions), 0)::int AS TotalInterceptions,
      COALESCE(SUM(pms.Clearances), 0)::int AS TotalClearances,
      COALESCE(SUM(pms.Saves), 0)::int AS TotalSaves,
      COALESCE(SUM(pms.CleanSheet), 0)::int AS TotalCleanSheets,
      COALESCE(SUM(pms.YellowCards), 0)::int AS TotalYellowCards,
      COALESCE(SUM(pms.RedCards), 0)::int AS TotalRedCards,
      COALESCE(SUM(pms.GoalsConceded), 0)::int AS TotalGoalsConceded,
      ROUND((COALESCE(SUM(pms.Goals), 0)::numeric * 90.0 / NULLIF(SUM(pms.MinutesPlayed), 0)), 2) AS GoalsPer90,
      ROUND((COALESCE(SUM(pms.Assists), 0)::numeric * 90.0 / NULLIF(SUM(pms.MinutesPlayed), 0)), 2) AS AssistsPer90,
      ROUND((COALESCE(SUM(pms.KeyPasses), 0)::numeric * 90.0 / NULLIF(SUM(pms.MinutesPlayed), 0)), 2) AS KeyPassesPer90,
      ROUND((COALESCE(SUM(pms.Tackles), 0)::numeric * 90.0 / NULLIF(SUM(pms.MinutesPlayed), 0)), 2) AS TacklesPer90
    FROM Player p
    LEFT JOIN PlayerMatchStat pms ON p.PlayerID = pms.PlayerID
    LEFT JOIN LATERAL (
      SELECT l.TeamID, t.Name AS TeamName
      FROM Lineup l
      JOIN Team t ON l.TeamID = t.TeamID
      WHERE l.PlayerID = p.PlayerID
      ORDER BY l.MatchID DESC
      LIMIT 1
    ) tm ON true
    GROUP BY p.PlayerID, p.Name, p.Position, p.Photo, p.OverallRating, tm.TeamID, tm.TeamName;

    CREATE OR REPLACE PROCEDURE update_all_player_ratings(p_season VARCHAR DEFAULT '2025/2026')
    LANGUAGE plpgsql
    AS $proc$
    DECLARE
      v_max_goals_f INT;
      v_max_assists_f INT;
      v_max_shots_f INT;
      v_max_keypasses_f INT;
      v_max_passes_f INT;
      v_max_mins_f INT;

      v_max_goals_m INT;
      v_max_assists_m INT;
      v_max_keypasses_m INT;
      v_max_passes_m INT;
      v_max_tackles_m INT;
      v_max_mins_m INT;

      v_max_tackles_d INT;
      v_max_interceptions_d INT;
      v_max_clearances_d INT;
      v_max_cleansheets_d INT;
      v_max_passes_d INT;
      v_max_mins_d INT;

      v_max_saves_g INT;
      v_max_cleansheets_g INT;
      v_max_conceded_per90_g NUMERIC;
      v_max_mins_g INT;

      rec RECORD;
      v_pos VARCHAR(10);
      v_norm_goals NUMERIC;
      v_norm_assists NUMERIC;
      v_norm_shots NUMERIC;
      v_norm_keypasses NUMERIC;
      v_norm_passes NUMERIC;
      v_norm_tackles NUMERIC;
      v_norm_interceptions NUMERIC;
      v_norm_clearances NUMERIC;
      v_norm_saves NUMERIC;
      v_norm_cleansheets NUMERIC;
      v_norm_mins NUMERIC;
      v_save_pct NUMERIC;
      v_conceded_resist NUMERIC;
      v_card_penalty NUMERIC;
      v_base_score NUMERIC;
      v_confidence NUMERIC;
      v_final_rating NUMERIC(4, 2);
      v_current_rank INT := 0;
    BEGIN
      -- Maxima for Forwards
      SELECT
        COALESCE(MAX(tot_goals), 1),
        COALESCE(MAX(tot_assists), 1),
        COALESCE(MAX(tot_shots), 1),
        COALESCE(MAX(tot_keypasses), 1),
        COALESCE(MAX(tot_passes), 1),
        COALESCE(MAX(tot_mins), 90)
      INTO
        v_max_goals_f, v_max_assists_f, v_max_shots_f, v_max_keypasses_f, v_max_passes_f, v_max_mins_f
      FROM (
        SELECT p.PlayerID,
               SUM(pms.Goals) as tot_goals,
               SUM(pms.Assists) as tot_assists,
               SUM(pms.ShotsOnTarget) as tot_shots,
               SUM(pms.KeyPasses) as tot_keypasses,
               SUM(pms.Passes) as tot_passes,
               SUM(pms.MinutesPlayed) as tot_mins
        FROM Player p
        JOIN PlayerMatchStat pms ON p.PlayerID = pms.PlayerID
        WHERE UPPER(COALESCE(p.Position, '')) IN ('F', 'FORWARD', 'FWD')
        GROUP BY p.PlayerID
      ) agg_f;

      -- Maxima for Midfielders
      SELECT
        COALESCE(MAX(tot_goals), 1),
        COALESCE(MAX(tot_assists), 1),
        COALESCE(MAX(tot_keypasses), 1),
        COALESCE(MAX(tot_passes), 1),
        COALESCE(MAX(tot_tackles), 1),
        COALESCE(MAX(tot_mins), 90)
      INTO
        v_max_goals_m, v_max_assists_m, v_max_keypasses_m, v_max_passes_m, v_max_tackles_m, v_max_mins_m
      FROM (
        SELECT p.PlayerID,
               SUM(pms.Goals) as tot_goals,
               SUM(pms.Assists) as tot_assists,
               SUM(pms.KeyPasses) as tot_keypasses,
               SUM(pms.Passes) as tot_passes,
               SUM(pms.Tackles) as tot_tackles,
               SUM(pms.MinutesPlayed) as tot_mins
        FROM Player p
        JOIN PlayerMatchStat pms ON p.PlayerID = pms.PlayerID
        WHERE UPPER(COALESCE(p.Position, '')) IN ('M', 'MIDFIELDER', 'MID')
        GROUP BY p.PlayerID
      ) agg_m;

      -- Maxima for Defenders
      SELECT
        COALESCE(MAX(tot_tackles), 1),
        COALESCE(MAX(tot_interceptions), 1),
        COALESCE(MAX(tot_clearances), 1),
        COALESCE(MAX(tot_cleansheets), 1),
        COALESCE(MAX(tot_passes), 1),
        COALESCE(MAX(tot_mins), 90)
      INTO
        v_max_tackles_d, v_max_interceptions_d, v_max_clearances_d, v_max_cleansheets_d, v_max_passes_d, v_max_mins_d
      FROM (
        SELECT p.PlayerID,
               SUM(pms.Tackles) as tot_tackles,
               SUM(pms.Interceptions) as tot_interceptions,
               SUM(pms.Clearances) as tot_clearances,
               SUM(pms.CleanSheet) as tot_cleansheets,
               SUM(pms.Passes) as tot_passes,
               SUM(pms.MinutesPlayed) as tot_mins
        FROM Player p
        JOIN PlayerMatchStat pms ON p.PlayerID = pms.PlayerID
        WHERE UPPER(COALESCE(p.Position, '')) IN ('D', 'DEFENDER', 'DEF')
        GROUP BY p.PlayerID
      ) agg_d;

      -- Maxima for Goalkeepers
      SELECT
        COALESCE(MAX(tot_saves), 1),
        COALESCE(MAX(tot_cleansheets), 1),
        COALESCE(MAX(conceded_per90), 3.0),
        COALESCE(MAX(tot_mins), 90)
      INTO
        v_max_saves_g, v_max_cleansheets_g, v_max_conceded_per90_g, v_max_mins_g
      FROM (
        SELECT p.PlayerID,
               SUM(pms.Saves) as tot_saves,
               SUM(pms.CleanSheet) as tot_cleansheets,
               (COALESCE(SUM(pms.GoalsConceded), 0)::numeric * 90.0 / NULLIF(SUM(pms.MinutesPlayed), 0)) as conceded_per90,
               SUM(pms.MinutesPlayed) as tot_mins
        FROM Player p
        JOIN PlayerMatchStat pms ON p.PlayerID = pms.PlayerID
        WHERE UPPER(COALESCE(p.Position, '')) IN ('G', 'GK', 'GOALKEEPER')
        GROUP BY p.PlayerID
      ) agg_g;

      -- Calculate ratings for every player
      FOR rec IN
        SELECT
          p.PlayerID,
          p.Position,
          COALESCE(SUM(pms.MinutesPlayed), 0) AS minutes_played,
          COALESCE(SUM(pms.Goals), 0) AS goals,
          COALESCE(SUM(pms.Assists), 0) AS assists,
          COALESCE(SUM(pms.ShotsOnTarget), 0) AS shots_on_target,
          COALESCE(SUM(pms.Passes), 0) AS passes,
          COALESCE(SUM(pms.KeyPasses), 0) AS key_passes,
          COALESCE(SUM(pms.Tackles), 0) AS tackles,
          COALESCE(SUM(pms.Interceptions), 0) AS interceptions,
          COALESCE(SUM(pms.Clearances), 0) AS clearances,
          COALESCE(SUM(pms.Saves), 0) AS saves,
          COALESCE(SUM(pms.CleanSheet), 0) AS clean_sheets,
          COALESCE(SUM(pms.YellowCards), 0) AS yellow_cards,
          COALESCE(SUM(pms.RedCards), 0) AS red_cards,
          COALESCE(SUM(pms.GoalsConceded), 0) AS goals_conceded
        FROM Player p
        LEFT JOIN PlayerMatchStat pms ON p.PlayerID = pms.PlayerID
        GROUP BY p.PlayerID, p.Position
      LOOP
        v_pos := UPPER(COALESCE(rec.Position, 'M'));

        -- Discipline deduction: Yellow -0.15, Red -0.80
        v_card_penalty := (rec.yellow_cards * 0.15) + (rec.red_cards * 0.80);

        -- Playing-time volume confidence factor (threshold: 270 minutes ~ 3 full matches)
        v_confidence := LEAST(1.0, rec.minutes_played::numeric / 270.0);

        IF v_pos IN ('F', 'FORWARD', 'FWD') THEN
          v_norm_goals := LEAST(1.0, rec.goals::numeric / NULLIF(v_max_goals_f, 0));
          v_norm_assists := LEAST(1.0, rec.assists::numeric / NULLIF(v_max_assists_f, 0));
          v_norm_shots := LEAST(1.0, rec.shots_on_target::numeric / NULLIF(v_max_shots_f, 0));
          v_norm_keypasses := LEAST(1.0, rec.key_passes::numeric / NULLIF(v_max_keypasses_f, 0));
          v_norm_passes := LEAST(1.0, rec.passes::numeric / NULLIF(v_max_passes_f, 0));
          v_norm_mins := LEAST(1.0, rec.minutes_played::numeric / NULLIF(v_max_mins_f, 0));

          v_base_score := 5.50 + 4.50 * (
            (0.40 * COALESCE(v_norm_goals, 0)) +
            (0.20 * COALESCE(v_norm_assists, 0)) +
            (0.10 * COALESCE(v_norm_shots, 0)) +
            (0.10 * COALESCE(v_norm_keypasses, 0)) +
            (0.10 * COALESCE(v_norm_passes, 0)) +
            (0.10 * COALESCE(v_norm_mins, 0))
          );

        ELSIF v_pos IN ('M', 'MIDFIELDER', 'MID') THEN
          v_norm_goals := LEAST(1.0, rec.goals::numeric / NULLIF(v_max_goals_m, 0));
          v_norm_assists := LEAST(1.0, rec.assists::numeric / NULLIF(v_max_assists_m, 0));
          v_norm_keypasses := LEAST(1.0, rec.key_passes::numeric / NULLIF(v_max_keypasses_m, 0));
          v_norm_passes := LEAST(1.0, rec.passes::numeric / NULLIF(v_max_passes_m, 0));
          v_norm_tackles := LEAST(1.0, rec.tackles::numeric / NULLIF(v_max_tackles_m, 0));
          v_norm_mins := LEAST(1.0, rec.minutes_played::numeric / NULLIF(v_max_mins_m, 0));

          v_base_score := 5.50 + 4.50 * (
            (0.20 * COALESCE(v_norm_goals, 0)) +
            (0.20 * COALESCE(v_norm_assists, 0)) +
            (0.20 * COALESCE(v_norm_keypasses, 0)) +
            (0.15 * COALESCE(v_norm_passes, 0)) +
            (0.15 * COALESCE(v_norm_tackles, 0)) +
            (0.10 * COALESCE(v_norm_mins, 0))
          );

        ELSIF v_pos IN ('D', 'DEFENDER', 'DEF') THEN
          v_norm_tackles := LEAST(1.0, rec.tackles::numeric / NULLIF(v_max_tackles_d, 0));
          v_norm_interceptions := LEAST(1.0, rec.interceptions::numeric / NULLIF(v_max_interceptions_d, 0));
          v_norm_clearances := LEAST(1.0, rec.clearances::numeric / NULLIF(v_max_clearances_d, 0));
          v_norm_cleansheets := LEAST(1.0, rec.clean_sheets::numeric / NULLIF(v_max_cleansheets_d, 0));
          v_norm_passes := LEAST(1.0, rec.passes::numeric / NULLIF(v_max_passes_d, 0));
          v_norm_mins := LEAST(1.0, rec.minutes_played::numeric / NULLIF(v_max_mins_d, 0));

          v_base_score := 5.50 + 4.50 * (
            (0.20 * COALESCE(v_norm_tackles, 0)) +
            (0.20 * COALESCE(v_norm_interceptions, 0)) +
            (0.20 * COALESCE(v_norm_clearances, 0)) +
            (0.20 * COALESCE(v_norm_cleansheets, 0)) +
            (0.10 * COALESCE(v_norm_passes, 0)) +
            (0.10 * COALESCE(v_norm_mins, 0))
          );

        ELSIF v_pos IN ('G', 'GK', 'GOALKEEPER') THEN
          v_norm_saves := LEAST(1.0, rec.saves::numeric / NULLIF(v_max_saves_g, 0));
          v_norm_cleansheets := LEAST(1.0, rec.clean_sheets::numeric / NULLIF(v_max_cleansheets_g, 0));
          v_save_pct := rec.saves::numeric / NULLIF(rec.saves + rec.goals_conceded, 0);
          v_conceded_resist := GREATEST(0.0, 1.0 - (
            (rec.goals_conceded::numeric * 90.0 / NULLIF(rec.minutes_played, 0)) / NULLIF(v_max_conceded_per90_g, 0)
          ));
          v_norm_mins := LEAST(1.0, rec.minutes_played::numeric / NULLIF(v_max_mins_g, 0));

          v_base_score := 5.50 + 4.50 * (
            (0.30 * COALESCE(v_norm_saves, 0)) +
            (0.30 * COALESCE(v_norm_cleansheets, 0)) +
            (0.20 * COALESCE(v_save_pct, 0.65)) +
            (0.10 * COALESCE(v_conceded_resist, 0.50)) +
            (0.10 * COALESCE(v_norm_mins, 0))
          );

        ELSE
          v_base_score := 5.50;
        END IF;

        IF rec.minutes_played > 0 THEN
          v_final_rating := LEAST(10.00, GREATEST(1.00, ROUND(
            ((v_base_score - v_card_penalty) * v_confidence) + (5.50 * (1.0 - v_confidence)),
            2
          )));
        ELSE
          v_final_rating := NULL;
        END IF;

        UPDATE Player
        SET OverallRating = v_final_rating
        WHERE PlayerID = rec.PlayerID;

      END LOOP;

      -- 3. Calculate ranks and snapshot to PlayerRatingHistory (active rated players only)
      DELETE FROM PlayerRatingHistory WHERE Season = p_season;

      FOR rec IN
        SELECT PlayerID, OverallRating
        FROM Player
        WHERE OverallRating IS NOT NULL
        ORDER BY OverallRating DESC, PlayerID ASC
      LOOP
        v_current_rank := v_current_rank + 1;
        INSERT INTO PlayerRatingHistory (PlayerID, Rating, Rank, Season)
        VALUES (rec.PlayerID, rec.OverallRating, v_current_rank, p_season);
      END LOOP;

    END;
    $proc$;
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

    // Auto-provision admin accounts if missing (ensures teammates get working admin logins immediately)
    const adminCheck = await pool.query(`SELECT 1 FROM Users WHERE Role = 'admin' LIMIT 1`);
    if (adminCheck.rows.length === 0) {
      console.log("No administrator user found. Auto-creating default admin accounts...");
      const bcrypt = require("bcrypt");
      const hash = await bcrypt.hash("AdminPassword123!", 10);
      await pool.query(
        `INSERT INTO Users (Username, Email, PasswordHash, Role)
         VALUES ($1, $2, $3, 'admin')
         ON CONFLICT (Email) DO UPDATE SET Role = 'admin', PasswordHash = $3`,
        ["KickOff Admin", "admin@kickoff.com", hash]
      );
      await pool.query(
        `INSERT INTO Users (Username, Email, PasswordHash, Role)
         VALUES ($1, $2, $3, 'admin')
         ON CONFLICT (Email) DO UPDATE SET Role = 'admin', PasswordHash = $3`,
        ["System Admin", "admin2@kickoff.com", hash]
      );
      console.log("Admin accounts ready: admin@kickoff.com / admin2@kickoff.com (password: AdminPassword123!)");
    }

    // Auto-provision player match stats and compute ratings if empty
    const statsCheck = await pool.query(`SELECT COUNT(*) FROM PlayerMatchStat`);
    if (parseInt(statsCheck.rows[0].count, 10) === 0) {
      console.log("PlayerMatchStat table is empty. Generating match statistics & calculating initial ratings...");
      const { autoSeedPlayerMatchStats } = require("./autoSeedStats");
      await autoSeedPlayerMatchStats(pool);
      console.log("Player match stats and performance ratings generated successfully!");
    }
  } catch (err) {
    console.warn("Auto-provision check warning:", (err as Error).message);
  }
}

