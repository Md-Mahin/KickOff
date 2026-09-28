
CREATE TABLE Country (
    CountryID     SERIAL PRIMARY KEY,
    Name          VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE Federation (
    FederationID  SERIAL PRIMARY KEY,
    Name          VARCHAR(100) NOT NULL,
    Region        VARCHAR(100)
);

CREATE TABLE Venue (
    VenueID       SERIAL PRIMARY KEY,
    Name          VARCHAR(150) NOT NULL,
    City          VARCHAR(100),
    CountryID     INT REFERENCES Country(CountryID)
);

CREATE TABLE Club (
    ClubID        SERIAL PRIMARY KEY,
    Name          VARCHAR(150) NOT NULL,
    CountryID     INT REFERENCES Country(CountryID),
    FederationID  INT REFERENCES Federation(FederationID)
);

CREATE TABLE Team (
    TeamID        SERIAL PRIMARY KEY,
    Name          VARCHAR(150) NOT NULL,
    Logo          TEXT,
    CoachName     VARCHAR(255),
    CoachPhoto    TEXT,
    Type          VARCHAR(20) DEFAULT 'club',
    ClubID        INT REFERENCES Club(ClubID),
    CountryID     INT REFERENCES Country(CountryID),
    FederationID  INT REFERENCES Federation(FederationID)
);

CREATE TABLE Player (
    PlayerID      SERIAL PRIMARY KEY,
    Name          VARCHAR(150) NOT NULL,
    DateOfBirth   DATE,
    NationalityCountryID INT REFERENCES Country(CountryID),
    Position      VARCHAR(10),
    Photo         TEXT,
    OverallRating NUMERIC(4, 2) DEFAULT 6.00 CHECK (OverallRating >= 0.0 AND OverallRating <= 10.0)
);

CREATE TABLE TeamPlayerHistory (
    HistoryID     SERIAL PRIMARY KEY,
    PlayerID      INT NOT NULL REFERENCES Player(PlayerID),
    TeamID        INT NOT NULL REFERENCES Team(TeamID),
    BeginDate     DATE NOT NULL,
    EndDate       DATE,
    Type          VARCHAR(50)
);

CREATE TABLE Referee (
    RefereeID     SERIAL PRIMARY KEY,
    Name          VARCHAR(150) NOT NULL,
    Level         VARCHAR(50),
    NationalityCountryID INT REFERENCES Country(CountryID)
);

CREATE TABLE Tournament (
    TournamentID  SERIAL PRIMARY KEY,
    Name          VARCHAR(150) NOT NULL,
    Type          VARCHAR(50),
    Edition       VARCHAR(50)
);

CREATE TABLE TournamentParticipation (
    TournamentID  INT NOT NULL REFERENCES Tournament(TournamentID),
    TeamID        INT NOT NULL REFERENCES Team(TeamID),
    PRIMARY KEY (TournamentID, TeamID)
);

CREATE TABLE Standing (
    StandingID    SERIAL PRIMARY KEY,
    TournamentID  INT NOT NULL REFERENCES Tournament(TournamentID),
    TeamID        INT NOT NULL REFERENCES Team(TeamID),
    Wins          INT DEFAULT 0,
    Losses        INT DEFAULT 0,
    Draws         INT DEFAULT 0,
    Ranking       INT,
    Points        INT,
    GoalsFor      INT,
    GoalsAgainst  INT,
    UNIQUE (TournamentID, TeamID)
);

CREATE TABLE Match (
    MatchID       SERIAL PRIMARY KEY,
    TournamentID  INT NOT NULL REFERENCES Tournament(TournamentID),
    HomeTeamID    INT NOT NULL REFERENCES Team(TeamID),
    AwayTeamID    INT NOT NULL REFERENCES Team(TeamID),
    VenueID       INT REFERENCES Venue(VenueID),
    MatchDate     TIMESTAMP,
    HomeGoals     INT DEFAULT 0,
    AwayGoals     INT DEFAULT 0,
    CHECK (HomeTeamID <> AwayTeamID)
);

CREATE TABLE MatchOfficiating (
    MatchID       INT NOT NULL REFERENCES Match(MatchID),
    RefereeID     INT NOT NULL REFERENCES Referee(RefereeID),
    Role          VARCHAR(50) DEFAULT 'Main',
    Status        VARCHAR(50),
    PRIMARY KEY (MatchID, RefereeID, Role)
);

CREATE TABLE Lineup (
    MatchID       INT NOT NULL REFERENCES Match(MatchID),
    TeamID        INT NOT NULL REFERENCES Team(TeamID),
    PlayerID      INT NOT NULL REFERENCES Player(PlayerID),
    Status        VARCHAR(10) NOT NULL CHECK (Status IN ('Starter','Sub')),
    Formation     VARCHAR(20),
    Position      VARCHAR(10),
    JerseyNumber  INT,
    PRIMARY KEY (MatchID, TeamID, PlayerID)
);

CREATE TABLE TeamMatchCoach (
    MatchID       INT NOT NULL REFERENCES Match(MatchID) ON DELETE CASCADE,
    TeamID        INT NOT NULL REFERENCES Team(TeamID) ON DELETE CASCADE,
    CoachID       INT,
    CoachName     VARCHAR(255),
    CoachPhoto    TEXT,
    PRIMARY KEY (MatchID, TeamID)
);

CREATE TABLE PlayerMatchStat (
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

CREATE TABLE PlayerRatingHistory (
    HistoryID         SERIAL PRIMARY KEY,
    PlayerID          INT NOT NULL REFERENCES Player(PlayerID) ON DELETE CASCADE,
    Rating            NUMERIC(4, 2) NOT NULL CHECK (Rating >= 0.0 AND Rating <= 10.0),
    Rank              INT,
    Season            VARCHAR(50) DEFAULT '2025/2026',
    CalculatedAt      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Event (
    EventID       SERIAL PRIMARY KEY,
    MatchID       INT NOT NULL REFERENCES Match(MatchID),
    PlayerID      INT REFERENCES Player(PlayerID),
    TeamID        INT REFERENCES Team(TeamID),
    EventTime     INT,
    EventType     VARCHAR(20) NOT NULL CHECK (EventType IN ('Goal','Card','Foul','Substitution'))
);

CREATE TABLE Goal (
    EventID       INT PRIMARY KEY REFERENCES Event(EventID),
    AssistPlayerID INT REFERENCES Player(PlayerID),
    GoalType      VARCHAR(50)
);

CREATE TABLE Card (
    EventID       INT PRIMARY KEY REFERENCES Event(EventID),
    CardType      VARCHAR(10) NOT NULL CHECK (CardType IN ('Yellow','Red'))
);

CREATE TABLE Foul (
    EventID       INT PRIMARY KEY REFERENCES Event(EventID),
    FouledPlayerID INT REFERENCES Player(PlayerID)
);

CREATE TABLE Substitution (
    EventID       INT PRIMARY KEY REFERENCES Event(EventID) ON DELETE CASCADE,
    InPlayerID    INT REFERENCES Player(PlayerID)
);

CREATE TABLE Users (
    UserID       SERIAL PRIMARY KEY,
    Username     VARCHAR(100) NOT NULL UNIQUE,
    Email        VARCHAR(255) NOT NULL UNIQUE,
    PasswordHash TEXT NOT NULL,
    Role          VARCHAR(20) NOT NULL DEFAULT 'fan' CHECK (Role IN ('fan', 'admin')),
    CreatedAt    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE UserSessions (
    SessionID    UUID PRIMARY KEY,
    UserID       INT NOT NULL REFERENCES Users(UserID) ON DELETE CASCADE,
    ExpiresAt    TIMESTAMP NOT NULL,
    RevokedAt    TIMESTAMP,
    CreatedAt    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_sessions_user ON UserSessions(UserID);
CREATE INDEX idx_user_sessions_active ON UserSessions(SessionID) WHERE RevokedAt IS NULL;

CREATE TABLE UserFollowsTeam (
    UserID        INT NOT NULL REFERENCES Users(UserID),
    TeamID        INT NOT NULL REFERENCES Team(TeamID),
    PRIMARY KEY (UserID, TeamID)
);

CREATE TABLE UserFollowsPlayer (
    UserID        INT NOT NULL REFERENCES Users(UserID),
    PlayerID      INT NOT NULL REFERENCES Player(PlayerID),
    PRIMARY KEY (UserID, PlayerID)
);

CREATE TABLE UserFollowsTournament (
    UserID        INT NOT NULL REFERENCES Users(UserID) ON DELETE CASCADE,
    TournamentID  INT NOT NULL REFERENCES Tournament(TournamentID) ON DELETE CASCADE,
    PRIMARY KEY (UserID, TournamentID)
);

CREATE TABLE News (
    NewsID        SERIAL PRIMARY KEY,
    Title         VARCHAR(250) NOT NULL,
    Body          TEXT,
    PublishedAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Keyword (
    KeywordID     SERIAL PRIMARY KEY,
    Text          VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE NewsKeyword (
    NewsID        INT NOT NULL REFERENCES News(NewsID),
    KeywordID     INT NOT NULL REFERENCES Keyword(KeywordID),
    PRIMARY KEY (NewsID, KeywordID)
);

CREATE TABLE NewsEntityTag (
    NewsID        INT NOT NULL REFERENCES News(NewsID),
    EntityType    VARCHAR(20) NOT NULL CHECK (EntityType IN ('Team','Player','Tournament')),
    EntityID      INT NOT NULL,
    PRIMARY KEY (NewsID, EntityType, EntityID)
);

CREATE TABLE Comment (
    CommentID     SERIAL PRIMARY KEY,
    NewsID        INT NOT NULL REFERENCES News(NewsID),
    UserID        INT NOT NULL REFERENCES Users(UserID),
    ParentCommentID INT REFERENCES Comment(CommentID),
    Text          TEXT NOT NULL,
    PostedAt      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Notification (
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

CREATE INDEX idx_notification_user     ON Notification(UserID, IsRead);
CREATE INDEX idx_notification_match    ON Notification(MatchID);

CREATE INDEX idx_team_club            ON Team(ClubID);
CREATE INDEX idx_team_country         ON Team(CountryID);
CREATE INDEX idx_player_nationality   ON Player(NationalityCountryID);
CREATE INDEX idx_tph_player           ON TeamPlayerHistory(PlayerID);
CREATE INDEX idx_tph_team             ON TeamPlayerHistory(TeamID);
CREATE INDEX idx_tph_current          ON TeamPlayerHistory(TeamID) WHERE EndDate IS NULL;

CREATE INDEX idx_match_tournament     ON Match(TournamentID);
CREATE INDEX idx_match_home           ON Match(HomeTeamID);
CREATE INDEX idx_match_away           ON Match(AwayTeamID);
CREATE INDEX idx_match_date           ON Match(MatchDate);
CREATE INDEX idx_match_venue          ON Match(VenueID);

CREATE INDEX idx_standing_tournament  ON Standing(TournamentID);
CREATE INDEX idx_standing_ranking     ON Standing(TournamentID, Ranking);

CREATE INDEX idx_lineup_player        ON Lineup(PlayerID);

CREATE INDEX idx_event_match          ON Event(MatchID);
CREATE INDEX idx_event_player         ON Event(PlayerID);
CREATE INDEX idx_event_type           ON Event(EventType);

CREATE INDEX idx_officiating_referee  ON MatchOfficiating(RefereeID);

CREATE INDEX idx_news_published       ON News(PublishedAt DESC);
CREATE INDEX idx_newsentitytag_lookup ON NewsEntityTag(EntityType, EntityID);
CREATE INDEX idx_comment_news         ON Comment(NewsID);
CREATE INDEX idx_comment_user         ON Comment(UserID);
CREATE INDEX idx_comment_parent       ON Comment(ParentCommentID);

CREATE INDEX idx_follows_team_team    ON UserFollowsTeam(TeamID);
CREATE INDEX idx_follows_player_pl    ON UserFollowsPlayer(PlayerID);
CREATE INDEX idx_player_rating        ON Player(OverallRating DESC NULLS LAST);
CREATE INDEX idx_player_position      ON Player(Position);
CREATE INDEX idx_lineup_match_team    ON Lineup(MatchID, TeamID);
CREATE INDEX idx_lineup_player_match  ON Lineup(PlayerID, MatchID DESC);
CREATE INDEX idx_match_date_desc      ON Match(MatchDate DESC);
CREATE INDEX idx_match_home_away      ON Match(HomeTeamID, AwayTeamID);

CREATE OR REPLACE FUNCTION check_lineup_team_in_match() RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM Match
        WHERE MatchID = NEW.MatchID
          AND (HomeTeamID = NEW.TeamID OR AwayTeamID = NEW.TeamID)
    ) THEN
        RAISE EXCEPTION 'TeamID % is not a participant in MatchID %', NEW.TeamID, NEW.MatchID;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lineup_team_check
BEFORE INSERT OR UPDATE ON Lineup
FOR EACH ROW EXECUTE FUNCTION check_lineup_team_in_match();

-- ============================================================================
-- TRIGGER: trg_match_club_country_check
-- Strictly enforces that club teams only play clubs and national teams only
-- play national teams. A matchup between a club and national team is forbidden.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_check_match_team_types()
RETURNS TRIGGER AS $$
DECLARE
    v_home_type VARCHAR(20);
    v_away_type VARCHAR(20);
BEGIN
    SELECT COALESCE(Type, 'club') INTO v_home_type FROM Team WHERE TeamID = NEW.HomeTeamID;
    SELECT COALESCE(Type, 'club') INTO v_away_type FROM Team WHERE TeamID = NEW.AwayTeamID;

    IF v_home_type IS NOT NULL AND v_away_type IS NOT NULL AND v_home_type != v_away_type THEN
        RAISE EXCEPTION 'Forbidden: Club teams cannot play national teams (Home %: %, Away %: %)',
            NEW.HomeTeamID, v_home_type, NEW.AwayTeamID, v_away_type;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_match_club_country_check ON Match;
CREATE TRIGGER trg_match_club_country_check
BEFORE INSERT OR UPDATE ON Match
FOR EACH ROW EXECUTE FUNCTION fn_check_match_team_types();

CREATE UNIQUE INDEX idx_tph_one_current_per_player
    ON TeamPlayerHistory(PlayerID)
    WHERE EndDate IS NULL;

CREATE OR REPLACE FUNCTION recompute_match_goals() RETURNS TRIGGER AS $$
DECLARE
    m_id INT;
BEGIN
    SELECT MatchID INTO m_id FROM Event WHERE EventID = COALESCE(NEW.EventID, OLD.EventID);

    UPDATE Match SET
        HomeGoals = (
            SELECT COUNT(*) FROM Event e JOIN Goal g ON g.EventID = e.EventID
            WHERE e.MatchID = m_id AND e.TeamID = Match.HomeTeamID
        ),
        AwayGoals = (
            SELECT COUNT(*) FROM Event e JOIN Goal g ON g.EventID = e.EventID
            WHERE e.MatchID = m_id AND e.TeamID = Match.AwayTeamID
        )
    WHERE MatchID = m_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_goal_insert
AFTER INSERT ON Goal
FOR EACH ROW EXECUTE FUNCTION recompute_match_goals();

CREATE TRIGGER trg_event_goal_delete
AFTER DELETE ON Event
FOR EACH ROW WHEN (OLD.EventType = 'Goal')
EXECUTE FUNCTION recompute_match_goals();

CREATE VIEW CurrentRoster AS
SELECT t.TeamID, t.Name AS TeamName, p.PlayerID, p.Name AS PlayerName, tph.BeginDate
FROM TeamPlayerHistory tph
JOIN Team t ON t.TeamID = tph.TeamID
JOIN Player p ON p.PlayerID = tph.PlayerID
WHERE tph.EndDate IS NULL;

CREATE VIEW MatchGoalSheet AS
SELECT e.MatchID, e.TeamID, t.Name AS TeamName, e.EventTime AS Minute,
       p.Name AS Scorer, ap.Name AS Assist, g.GoalType
FROM Event e
JOIN Goal g ON g.EventID = e.EventID
JOIN Team t ON t.TeamID = e.TeamID
LEFT JOIN Player p ON p.PlayerID = e.PlayerID
LEFT JOIN Player ap ON ap.PlayerID = g.AssistPlayerID
ORDER BY e.MatchID, e.EventTime;

CREATE VIEW TournamentLeaderboard AS
SELECT s.TournamentID, tr.Name AS TournamentName, t.Name AS TeamName,
       s.Wins, s.Draws, s.Losses, s.Points, s.GoalsFor, s.GoalsAgainst,
       (s.GoalsFor - s.GoalsAgainst) AS GoalDifference, s.Ranking
FROM Standing s
JOIN Team t ON t.TeamID = s.TeamID
JOIN Tournament tr ON tr.TournamentID = s.TournamentID
ORDER BY s.TournamentID, s.Ranking;

CREATE VIEW NewsWithTags AS
SELECT n.NewsID, n.Title, n.PublishedAt,
       array_agg(DISTINCT k.Text) FILTER (WHERE k.Text IS NOT NULL) AS Keywords,
       COUNT(DISTINCT c.CommentID) AS CommentCount
FROM News n
LEFT JOIN NewsKeyword nk ON nk.NewsID = n.NewsID
LEFT JOIN Keyword k ON k.KeywordID = nk.KeywordID
LEFT JOIN Comment c ON c.NewsID = n.NewsID
GROUP BY n.NewsID, n.Title, n.PublishedAt;

-- ============================================================================
-- Aggregated Season-Level Statistics View
-- ============================================================================
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
    -- Per-90 Statistics (safe division)
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

-- ============================================================================
-- PL/SQL Stored Procedure: Update All Player Performance Ratings (0 - 10 scale)
-- ============================================================================
CREATE OR REPLACE PROCEDURE update_all_player_ratings(p_season VARCHAR DEFAULT '2025/2026')
LANGUAGE plpgsql
AS $$
DECLARE
    -- Cohort maximums for normalization
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
    -- 1. Compute cohort maxima
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

    -- 2. Calculate performance ratings
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

        -- Playing-time volume confidence factor (threshold: 270 mins ~ 3 full matches)
        v_confidence := LEAST(1.0, rec.minutes_played::numeric / 270.0);

        IF v_pos IN ('F', 'FORWARD', 'FWD') THEN
            v_norm_goals := LEAST(1.0, rec.goals::numeric / NULLIF(v_max_goals_f, 0));
            v_norm_assists := LEAST(1.0, rec.assists::numeric / NULLIF(v_max_assists_f, 0));
            v_norm_shots := LEAST(1.0, rec.shots_on_target::numeric / NULLIF(v_max_shots_f, 0));
            v_norm_keypasses := LEAST(1.0, rec.key_passes::numeric / NULLIF(v_max_keypasses_f, 0));
            v_norm_passes := LEAST(1.0, rec.passes::numeric / NULLIF(v_max_passes_f, 0));
            v_norm_mins := LEAST(1.0, rec.minutes_played::numeric / NULLIF(v_max_mins_f, 0));

            -- Forward: Goals 40%, Assists 20%, Shots 10%, Key passes 10%, Passes 10%, Minutes 10%
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

            -- Midfielder: Goals 20%, Assists 20%, Key passes 20%, Passes 15%, Tackles 15%, Minutes 10%
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

            -- Defender: Tackles 20%, Interceptions 20%, Clearances 20%, Clean sheets 20%, Passes 10%, Minutes 10%
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

            -- Goalkeeper: Saves 30%, Clean sheets 30%, Save percentage 20%, Conceded resistance 10%, Minutes 10%
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

        -- Regress towards baseline 5.50 for low-minute samples, NULL if 0 minutes
        IF rec.minutes_played > 0 THEN
            v_final_rating := LEAST(10.00, GREATEST(1.00, ROUND(
                ((v_base_score - v_card_penalty) * v_confidence) + (5.50 * (1.0 - v_confidence)),
                2
            )));
        ELSE
            v_final_rating := NULL;
        END IF;

        -- Store in Player.OverallRating
        UPDATE Player
        SET OverallRating = v_final_rating
        WHERE PlayerID = rec.PlayerID;

    END LOOP;

    -- 3. Calculate rankings and snapshot to PlayerRatingHistory (active rated players only)
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
$$;

-- ============================================================================
-- Shadow Tables for Sensitive Action Auditing
-- ============================================================================
CREATE TABLE IF NOT EXISTS PlayerTransferAudit (
    AuditID SERIAL PRIMARY KEY,
    PlayerID INT NOT NULL REFERENCES Player(PlayerID) ON DELETE CASCADE,
    OldTeamID INT REFERENCES Team(TeamID) ON DELETE SET NULL,
    NewTeamID INT REFERENCES Team(TeamID) ON DELETE SET NULL,
    TransferDate DATE NOT NULL DEFAULT CURRENT_DATE,
    TransferType VARCHAR(50),
    Action VARCHAR(20) NOT NULL,
    ChangedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_transfer_audit_player ON PlayerTransferAudit(PlayerID);

CREATE TABLE IF NOT EXISTS SecurityAuditLog (
    AuditID SERIAL PRIMARY KEY,
    UserID INT NOT NULL REFERENCES Users(UserID) ON DELETE CASCADE,
    Action VARCHAR(50) NOT NULL,
    OldRole VARCHAR(20),
    NewRole VARCHAR(20),
    ChangedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_security_audit_user ON SecurityAuditLog(UserID);

-- ============================================================================
-- Triggers: Transfer Sync & Security Shadow Audits
-- ============================================================================
CREATE OR REPLACE FUNCTION trg_fn_sync_player_transfer() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.EndDate IS NULL THEN
            UPDATE TeamPlayerHistory
            SET EndDate = NEW.BeginDate
            WHERE PlayerID = NEW.PlayerID
              AND HistoryID <> NEW.HistoryID
              AND EndDate IS NULL;
        END IF;

        INSERT INTO PlayerTransferAudit (PlayerID, OldTeamID, NewTeamID, TransferDate, TransferType, Action)
        VALUES (
            NEW.PlayerID,
            (SELECT TeamID FROM TeamPlayerHistory WHERE PlayerID = NEW.PlayerID AND HistoryID <> NEW.HistoryID ORDER BY BeginDate DESC LIMIT 1),
            NEW.TeamID,
            NEW.BeginDate,
            NEW.Type,
            'INSERT'
        );
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.TeamID <> NEW.TeamID OR (OLD.EndDate IS NULL AND NEW.EndDate IS NOT NULL)) THEN
            INSERT INTO PlayerTransferAudit (PlayerID, OldTeamID, NewTeamID, TransferDate, TransferType, Action)
            VALUES (NEW.PlayerID, OLD.TeamID, NEW.TeamID, COALESCE(NEW.BeginDate, CURRENT_DATE), NEW.Type, 'UPDATE');
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_player_transfer_sync ON TeamPlayerHistory;
CREATE TRIGGER trg_player_transfer_sync
AFTER INSERT OR UPDATE ON TeamPlayerHistory
FOR EACH ROW EXECUTE FUNCTION trg_fn_sync_player_transfer();

CREATE OR REPLACE FUNCTION trg_fn_user_security_audit() RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.Role IS DISTINCT FROM NEW.Role) THEN
        INSERT INTO SecurityAuditLog (UserID, Action, OldRole, NewRole)
        VALUES (NEW.UserID, 'ROLE_CHANGE', OLD.Role, NEW.Role);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_security_audit ON Users;
CREATE TRIGGER trg_user_security_audit
AFTER UPDATE ON Users
FOR EACH ROW EXECUTE FUNCTION trg_fn_user_security_audit();

-- ============================================================================
-- Functions: Statistical & Computed Values
-- ============================================================================

-- Function 1: Compute statistical performance rating for a player (0 - 10 scale)
CREATE OR REPLACE FUNCTION fn_calculate_player_rating(p_player_id INT)
RETURNS NUMERIC(4, 2) AS $$
DECLARE
    v_pos VARCHAR(10);
    v_mins INT;
    v_goals INT;
    v_assists INT;
    v_shots INT;
    v_keypasses INT;
    v_passes INT;
    v_tackles INT;
    v_interceptions INT;
    v_clearances INT;
    v_saves INT;
    v_cleansheets INT;
    v_yellows INT;
    v_reds INT;
    v_conceded INT;
    v_card_penalty NUMERIC;
    v_confidence NUMERIC;
    v_base_score NUMERIC;
    v_final_rating NUMERIC(4, 2);
BEGIN
    SELECT
        COALESCE(p.Position, 'M'),
        COALESCE(SUM(pms.MinutesPlayed), 0),
        COALESCE(SUM(pms.Goals), 0),
        COALESCE(SUM(pms.Assists), 0),
        COALESCE(SUM(pms.ShotsOnTarget), 0),
        COALESCE(SUM(pms.KeyPasses), 0),
        COALESCE(SUM(pms.Passes), 0),
        COALESCE(SUM(pms.Tackles), 0),
        COALESCE(SUM(pms.Interceptions), 0),
        COALESCE(SUM(pms.Clearances), 0),
        COALESCE(SUM(pms.Saves), 0),
        COALESCE(SUM(pms.CleanSheet), 0),
        COALESCE(SUM(pms.YellowCards), 0),
        COALESCE(SUM(pms.RedCards), 0),
        COALESCE(SUM(pms.GoalsConceded), 0)
    INTO
        v_pos, v_mins, v_goals, v_assists, v_shots, v_keypasses, v_passes,
        v_tackles, v_interceptions, v_clearances, v_saves, v_cleansheets,
        v_yellows, v_reds, v_conceded
    FROM Player p
    LEFT JOIN PlayerMatchStat pms ON p.PlayerID = pms.PlayerID
    WHERE p.PlayerID = p_player_id
    GROUP BY p.PlayerID, p.Position;

    IF NOT FOUND OR v_mins = 0 THEN
        RETURN NULL;
    END IF;

    v_pos := UPPER(v_pos);
    v_card_penalty := (v_yellows * 0.15) + (v_reds * 0.80);
    v_confidence := LEAST(1.0, v_mins::numeric / 270.0);

    IF v_pos IN ('F', 'FORWARD', 'FWD') THEN
        v_base_score := 5.50 + 4.50 * (
            0.40 * LEAST(1.0, v_goals::numeric / 5.0) +
            0.20 * LEAST(1.0, v_assists::numeric / 4.0) +
            0.10 * LEAST(1.0, v_shots::numeric / 10.0) +
            0.10 * LEAST(1.0, v_keypasses::numeric / 8.0) +
            0.10 * LEAST(1.0, v_passes::numeric / 120.0) +
            0.10 * LEAST(1.0, v_mins::numeric / 450.0)
        );
    ELSIF v_pos IN ('M', 'MIDFIELDER', 'MID') THEN
        v_base_score := 5.50 + 4.50 * (
            0.20 * LEAST(1.0, v_goals::numeric / 3.0) +
            0.20 * LEAST(1.0, v_assists::numeric / 4.0) +
            0.20 * LEAST(1.0, v_keypasses::numeric / 10.0) +
            0.15 * LEAST(1.0, v_passes::numeric / 180.0) +
            0.15 * LEAST(1.0, v_tackles::numeric / 10.0) +
            0.10 * LEAST(1.0, v_mins::numeric / 450.0)
        );
    ELSIF v_pos IN ('D', 'DEFENDER', 'DEF') THEN
        v_base_score := 5.50 + 4.50 * (
            0.20 * LEAST(1.0, v_tackles::numeric / 12.0) +
            0.20 * LEAST(1.0, v_interceptions::numeric / 10.0) +
            0.20 * LEAST(1.0, v_clearances::numeric / 15.0) +
            0.20 * LEAST(1.0, v_cleansheets::numeric / 3.0) +
            0.10 * LEAST(1.0, v_passes::numeric / 150.0) +
            0.10 * LEAST(1.0, v_mins::numeric / 450.0)
        );
    ELSIF v_pos IN ('G', 'GK', 'GOALKEEPER') THEN
        v_base_score := 5.50 + 4.50 * (
            0.30 * LEAST(1.0, v_saves::numeric / 15.0) +
            0.30 * LEAST(1.0, v_cleansheets::numeric / 3.0) +
            0.20 * COALESCE(v_saves::numeric / NULLIF(v_saves + v_conceded, 0), 0.65) +
            0.10 * GREATEST(0.0, 1.0 - (v_conceded::numeric * 90.0 / NULLIF(v_mins, 0)) / 3.0) +
            0.10 * LEAST(1.0, v_mins::numeric / 450.0)
        );
    ELSE
        v_base_score := 5.50;
    END IF;

    v_final_rating := LEAST(10.00, GREATEST(1.00, ROUND(
        ((v_base_score - v_card_penalty) * v_confidence) + (5.50 * (1.0 - v_confidence)),
        2
    )));

    RETURN v_final_rating;
END;
$$ LANGUAGE plpgsql;

-- Function 2: Compute statistical win ratio for a team
CREATE OR REPLACE FUNCTION fn_get_team_win_ratio(p_team_id INT, p_tournament_id INT DEFAULT NULL)
RETURNS NUMERIC(5, 2) AS $$
DECLARE
    v_total_matches INT;
    v_wins INT;
BEGIN
    SELECT
        COUNT(*),
        COALESCE(SUM(CASE
            WHEN (HomeTeamID = p_team_id AND HomeGoals > AwayGoals) OR
                 (AwayTeamID = p_team_id AND AwayGoals > HomeGoals) THEN 1
            ELSE 0
        END), 0)
    INTO v_total_matches, v_wins
    FROM Match
    WHERE (HomeTeamID = p_team_id OR AwayTeamID = p_team_id)
      AND (p_tournament_id IS NULL OR TournamentID = p_tournament_id)
      AND HomeGoals IS NOT NULL AND AwayGoals IS NOT NULL;

    IF v_total_matches = 0 THEN
        RETURN 0.00;
    END IF;

    RETURN ROUND((v_wins::numeric / v_total_matches::numeric) * 100.0, 2);
END;
$$ LANGUAGE plpgsql;

-- Function 3: Compute player recent form (average rating over last N matches)
CREATE OR REPLACE FUNCTION fn_get_player_form(p_player_id INT, p_last_n INT DEFAULT 5)
RETURNS NUMERIC(4, 2) AS $$
DECLARE
    v_avg_form NUMERIC(4, 2);
BEGIN
    SELECT ROUND(AVG(Rating), 2)
    INTO v_avg_form
    FROM (
        SELECT Rating
        FROM PlayerMatchStat
        WHERE PlayerID = p_player_id AND Rating IS NOT NULL
        ORDER BY CreatedAt DESC, MatchID DESC
        LIMIT p_last_n
    ) recent_stats;

    RETURN COALESCE(v_avg_form, 6.00);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Procedure: Multi-Step Player Transfer Workflow
-- ============================================================================
CREATE OR REPLACE PROCEDURE sp_process_player_transfer(
    p_player_id INT,
    p_new_team_id INT,
    p_transfer_date DATE DEFAULT CURRENT_DATE,
    p_transfer_type VARCHAR DEFAULT 'Transfer'
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Player WHERE PlayerID = p_player_id) THEN
        RAISE EXCEPTION 'Player with ID % does not exist', p_player_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM Team WHERE TeamID = p_new_team_id) THEN
        RAISE EXCEPTION 'Team with ID % does not exist', p_new_team_id;
    END IF;

    UPDATE TeamPlayerHistory
    SET EndDate = p_transfer_date
    WHERE PlayerID = p_player_id
      AND EndDate IS NULL;

    INSERT INTO TeamPlayerHistory (PlayerID, TeamID, BeginDate, EndDate, Type)
    VALUES (p_player_id, p_new_team_id, p_transfer_date, NULL, p_transfer_type);
END;
$$;



