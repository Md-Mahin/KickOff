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
('Arsenal First Team', 1, (SELECT CountryID FROM Country WHERE Name = 'England'), 1),
('Real Madrid First Team', 2, (SELECT CountryID FROM Country WHERE Name = 'Spain'), 1),
('Bayern Munich First Team', 3, (SELECT CountryID FROM Country WHERE Name = 'Germany'), 1),
('PSG First Team', 4, (SELECT CountryID FROM Country WHERE Name = 'France'), 1),
('AC Milan First Team', 5, (SELECT CountryID FROM Country WHERE Name = 'Italy'), 1);

-- Players
INSERT INTO Player (Name, DateOfBirth, NationalityCountryID) VALUES
('Bukayo Saka', '2001-09-05', (SELECT CountryID FROM Country WHERE Name = 'England')),
('Martin Odegaard', '1998-12-17', (SELECT CountryID FROM Country WHERE Name = 'England')),
('Vinicius Junior', '2000-07-12', (SELECT CountryID FROM Country WHERE Name = 'Brazil')),
('Jude Bellingham', '2003-06-29', (SELECT CountryID FROM Country WHERE Name = 'England')),
('Harry Kane', '1993-07-28', (SELECT CountryID FROM Country WHERE Name = 'England')),
('Kylian Mbappe', '1998-12-20', (SELECT CountryID FROM Country WHERE Name = 'France')),
('Rafael Leao', '1999-06-10', (SELECT CountryID FROM Country WHERE Name = 'Portugal'));

-- Team Player History (Current Roster)
INSERT INTO TeamPlayerHistory (PlayerID, TeamID, BeginDate, EndDate, Type) VALUES
(1, 1, '2019-07-01', NULL, 'Permanent'),
(2, 1, '2021-08-20', NULL, 'Permanent'),
(3, 2, '2018-07-12', NULL, 'Permanent'),
(4, 2, '2023-07-01', NULL, 'Permanent'),
(5, 3, '2023-08-12', NULL, 'Permanent'),
(6, 4, '2018-07-01', NULL, 'Permanent'),
(7, 5, '2019-08-01', NULL, 'Permanent');

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
INSERT INTO Lineup (MatchID, TeamID, PlayerID, Status) VALUES
(1, 1, 1, 'Starter'),
(1, 1, 2, 'Starter'),
(1, 2, 3, 'Starter'),
(1, 2, 4, 'Starter'),
(2, 3, 5, 'Starter'),
(2, 4, 6, 'Starter');

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
