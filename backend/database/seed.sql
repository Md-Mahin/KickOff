-- Disable triggers and clear existing data
DO $$ 
BEGIN
  EXECUTE 'TRUNCATE TABLE 
    Comment, NewsEntityTag, NewsKeyword, Keyword, News,
    UserFollowsPlayer, UserFollowsTeam, UserSessions, Users,
    Foul, Card, Goal, Event, Lineup, MatchOfficiating, Match,
    Standing, TournamentParticipation, Tournament, Referee,
    TeamPlayerHistory, Player, Team, Club, Venue, Federation, Country 
  RESTART IDENTITY CASCADE';
END $$;

-- Countries
INSERT INTO Country (Name) VALUES 
('England'), ('Spain'), ('Germany'), ('France'), ('Italy'), ('Brazil'), ('Argentina'), ('Portugal');

-- Federation
INSERT INTO Federation (Name, Region) VALUES 
('UEFA', 'Europe'),
('CONMEBOL', 'South America');

-- Venues
INSERT INTO Venue (Name, City, CountryID) VALUES
('Emirates Stadium', 'London', (SELECT CountryID FROM Country WHERE Name = 'England')),
('Santiago Bernabeu', 'Madrid', (SELECT CountryID FROM Country WHERE Name = 'Spain')),
('Allianz Arena', 'Munich', (SELECT CountryID FROM Country WHERE Name = 'Germany')),
('Parc des Princes', 'Paris', (SELECT CountryID FROM Country WHERE Name = 'France')),
('San Siro', 'Milan', (SELECT CountryID FROM Country WHERE Name = 'Italy'));

-- Clubs
INSERT INTO Club (Name, CountryID, FederationID) VALUES
('Arsenal', (SELECT CountryID FROM Country WHERE Name = 'England'), 1),
('Real Madrid', (SELECT CountryID FROM Country WHERE Name = 'Spain'), 1),
('Bayern Munich', (SELECT CountryID FROM Country WHERE Name = 'Germany'), 1),
('Paris Saint-Germain', (SELECT CountryID FROM Country WHERE Name = 'France'), 1),
('AC Milan', (SELECT CountryID FROM Country WHERE Name = 'Italy'), 1);

-- Teams
INSERT INTO Team (Name, ClubID, CountryID, FederationID) VALUES
('Arsenal ', 1, (SELECT CountryID FROM Country WHERE Name = 'England'), 1),
('Real Madrid ', 2, (SELECT CountryID FROM Country WHERE Name = 'Spain'), 1),
('Bayern Munich ', 3, (SELECT CountryID FROM Country WHERE Name = 'Germany'), 1),
('PSG ', 4, (SELECT CountryID FROM Country WHERE Name = 'France'), 1),
('AC Milan ', 5, (SELECT CountryID FROM Country WHERE Name = 'Italy'), 1);

-- Players
INSERT INTO Player (PlayerID, Name, DateOfBirth, NationalityCountryID, Position) VALUES
  (1, 'David Raya', '1995-09-15', (SELECT CountryID FROM Country WHERE Name = 'Spain'), 'G'),
  (2, 'Ben White', '1997-10-08', (SELECT CountryID FROM Country WHERE Name = 'England'), 'D'),
  (3, 'William Saliba', '2001-03-24', (SELECT CountryID FROM Country WHERE Name = 'France'), 'D'),
  (4, 'Gabriel Magalhaes', '1997-12-19', (SELECT CountryID FROM Country WHERE Name = 'Brazil'), 'D'),
  (5, 'Oleksandr Zinchenko', '1996-12-15', (SELECT CountryID FROM Country WHERE Name = 'England'), 'D'),
  (6, 'Declan Rice', '1999-01-14', (SELECT CountryID FROM Country WHERE Name = 'England'), 'M'),
  (7, 'Martin Odegaard', '1998-12-17', (SELECT CountryID FROM Country WHERE Name = 'England'), 'M'),
  (8, 'Kai Havertz', '1999-06-11', (SELECT CountryID FROM Country WHERE Name = 'Germany'), 'M'),
  (9, 'Bukayo Saka', '2001-09-05', (SELECT CountryID FROM Country WHERE Name = 'England'), 'F'),
  (10, 'Gabriel Jesus', '1997-04-03', (SELECT CountryID FROM Country WHERE Name = 'Brazil'), 'F'),
  (11, 'Gabriel Martinelli', '2001-06-18', (SELECT CountryID FROM Country WHERE Name = 'Brazil'), 'F'),
  (12, 'Thibaut Courtois', '1992-05-11', (SELECT CountryID FROM Country WHERE Name = 'Spain'), 'G'),
  (13, 'Dani Carvajal', '1992-01-11', (SELECT CountryID FROM Country WHERE Name = 'Spain'), 'D'),
  (14, 'Antonio Rudiger', '1993-03-03', (SELECT CountryID FROM Country WHERE Name = 'Germany'), 'D'),
  (15, 'Eder Militao', '1998-01-18', (SELECT CountryID FROM Country WHERE Name = 'Brazil'), 'D'),
  (16, 'Ferland Mendy', '1995-06-08', (SELECT CountryID FROM Country WHERE Name = 'France'), 'D'),
  (17, 'Federico Valverde', '1998-07-22', (SELECT CountryID FROM Country WHERE Name = 'Spain'), 'M'),
  (18, 'Aurelien Tchouameni', '2000-01-27', (SELECT CountryID FROM Country WHERE Name = 'France'), 'M'),
  (19, 'Jude Bellingham', '2003-06-29', (SELECT CountryID FROM Country WHERE Name = 'England'), 'M'),
  (20, 'Rodrygo', '2001-01-09', (SELECT CountryID FROM Country WHERE Name = 'Brazil'), 'F'),
  (21, 'Kylian Mbappe', '1998-12-20', (SELECT CountryID FROM Country WHERE Name = 'France'), 'F'),
  (22, 'Vinicius Junior', '2000-07-12', (SELECT CountryID FROM Country WHERE Name = 'Brazil'), 'F'),
  (23, 'Harry Kane', '1993-07-28', (SELECT CountryID FROM Country WHERE Name = 'England'), 'F'),
  (24, 'Rafael Leao', '1999-06-10', (SELECT CountryID FROM Country WHERE Name = 'Portugal'), 'F');

-- Team Player History (Current Roster)
INSERT INTO TeamPlayerHistory (PlayerID, TeamID, BeginDate, EndDate, Type) VALUES
  (9, 1, '2019-07-01', NULL, 'Permanent'),
  (7, 1, '2021-08-20', NULL, 'Permanent'),
  (22, 2, '2018-07-12', NULL, 'Permanent'),
  (19, 2, '2023-07-01', NULL, 'Permanent'),
  (23, 3, '2023-08-12', NULL, 'Permanent'),
  (21, 2, '2024-07-01', NULL, 'Permanent'),
  (24, 5, '2019-08-01', NULL, 'Permanent');

-- Referees
INSERT INTO Referee (Name, Level, NationalityCountryID) VALUES
('Michael Oliver', 'FIFA', (SELECT CountryID FROM Country WHERE Name = 'England')),
('Antonio Mateu Lahoz', 'FIFA', (SELECT CountryID FROM Country WHERE Name = 'Spain'));

-- Tournaments
INSERT INTO Tournament (Name, Type, Edition) VALUES
('UEFA Champions League', 'Club', '2023/2024'),
('Premier League', 'Club', '2023/2024');

-- Tournament Participation
INSERT INTO TournamentParticipation (TournamentID, TeamID) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5),
(2, 1);

-- Standings
INSERT INTO Standing (TournamentID, TeamID, Wins, Losses, Draws, Ranking, Points, GoalsFor, GoalsAgainst) VALUES
(1, 1, 4, 1, 1, 1, 13, 16, 4),
(1, 2, 6, 0, 0, 1, 18, 16, 7),
(1, 3, 5, 0, 1, 1, 16, 12, 6);

-- Matches
INSERT INTO Match (TournamentID, HomeTeamID, AwayTeamID, VenueID, MatchDate, HomeGoals, AwayGoals) VALUES
(1, 1, 2, 1, '2024-04-09 20:00:00', 0, 0),
(1, 3, 4, 3, '2024-04-10 20:00:00', 0, 0),
(2, 5, 1, 5, NOW() + INTERVAL '1 day', 0, 0),
(2, 2, 3, 2, NOW() - INTERVAL '45 minutes', 0, 0);

-- Match Officiating
INSERT INTO MatchOfficiating (MatchID, RefereeID, Role, Status) VALUES
(1, 1, 'Main', 'Confirmed'),
(2, 2, 'Main', 'Confirmed');

-- Lineups
INSERT INTO Lineup (MatchID, TeamID, PlayerID, Status, Formation, Position, JerseyNumber) VALUES
-- Arsenal Starters (4-3-3)
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
-- Real Madrid Starters (4-3-3)
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
(1, 2, 22, 'Starter', '4-3-3', 'F', 7);

-- Events
INSERT INTO Event (MatchID, PlayerID, TeamID, EventTime, EventType) VALUES
(1, 1, 1, 12, 'Goal'),
(1, 4, 2, 45, 'Goal'),
(2, 5, 3, 30, 'Goal');

-- Goals
INSERT INTO Goal (EventID, AssistPlayerID, GoalType) VALUES
((SELECT EventID FROM Event WHERE PlayerID = 1 AND MatchID = 1), 2, 'Standard'),
((SELECT EventID FROM Event WHERE PlayerID = 4 AND MatchID = 1), 3, 'Standard'),
((SELECT EventID FROM Event WHERE PlayerID = 5 AND MatchID = 2), NULL, 'Penalty');

-- Users (Password is 'password123')
INSERT INTO Users (Username, Email, PasswordHash, Role) VALUES
('admin', 'admin@kickoff.com', '$2b$10$X7/E4Z1l3Q.Kz3.3.3.3.3.3.3.3.3.3.3.3.3.3.3.3.3.3.3.3', 'admin'),
('john_doe', 'john@example.com', '$2b$10$X7/E4Z1l3Q.Kz3.3.3.3.3.3.3.3.3.3.3.3.3.3.3.3.3.3.3.3', 'fan');
