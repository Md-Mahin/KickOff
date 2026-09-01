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
    ClubID        INT REFERENCES Club(ClubID),
    CountryID     INT REFERENCES Country(CountryID),
    FederationID  INT REFERENCES Federation(FederationID)
);

CREATE TABLE Player (
    PlayerID      SERIAL PRIMARY KEY,
    Name          VARCHAR(150) NOT NULL,
    DateOfBirth   DATE,
    NationalityCountryID INT REFERENCES Country(CountryID)
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
    PRIMARY KEY (MatchID, TeamID, PlayerID)
);

CREATE TABLE Event (
    EventID       SERIAL PRIMARY KEY,
    MatchID       INT NOT NULL REFERENCES Match(MatchID),
    PlayerID      INT REFERENCES Player(PlayerID),
    TeamID        INT REFERENCES Team(TeamID),
    EventTime     INT,
    EventType     VARCHAR(20) NOT NULL CHECK (EventType IN ('Goal','Card','Foul'))
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

CREATE TABLE Users (
    UserID       SERIAL PRIMARY KEY,
    Username     VARCHAR(100) NOT NULL UNIQUE,
    Email        VARCHAR(255) NOT NULL UNIQUE,
    PasswordHash TEXT NOT NULL,
    CreatedAt    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

CREATE UNIQUE INDEX idx_tph_one_current_per_player
    ON TeamPlayerHistory(PlayerID)
    WHERE EndDate IS NULL;

CREATE OR REPLACE FUNCTION recompute_match_goals() RETURNS TRIGGER AS $$
DECLARE
    m_id INT;
BEGIN
    m_id := COALESCE(NEW.MatchID, OLD.MatchID);

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
