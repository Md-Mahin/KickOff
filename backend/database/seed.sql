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
INSERT INTO Country (CountryID, Name) VALUES 
(1, 'England'), (2, 'Spain'), (3, 'Germany'), (4, 'France'), (5, 'Italy'),
(6, 'Brazil'), (7, 'Argentina'), (8, 'Portugal'), (9, 'Poland'), (10, 'Netherlands');

-- Federation
INSERT INTO Federation (FederationID, Name, Region) VALUES 
(1, 'UEFA', 'Europe'),
(2, 'CONMEBOL', 'South America');

-- Venues
INSERT INTO Venue (VenueID, Name, City, CountryID) VALUES
(1, 'Emirates Stadium', 'London', 1),
(2, 'Santiago Bernabeu', 'Madrid', 2),
(3, 'Allianz Arena', 'Munich', 3),
(4, 'Parc des Princes', 'Paris', 4),
(5, 'San Siro', 'Milan', 5),
(6, 'Etihad Stadium', 'Manchester', 1),
(7, 'Anfield', 'Liverpool', 1),
(8, 'Stamford Bridge', 'London', 1),
(9, 'Old Trafford', 'Manchester', 1),
(10, 'Spotify Camp Nou', 'Barcelona', 2),
(11, 'Signal Iduna Park', 'Dortmund', 3),
(12, 'Civitas Metropolitano', 'Madrid', 2),
(13, 'Allianz Stadium', 'Turin', 5),
(14, 'BayArena', 'Leverkusen', 3);

-- Clubs
INSERT INTO Club (ClubID, Name, CountryID, FederationID) VALUES
(1, 'Arsenal', 1, 1),
(2, 'Real Madrid', 2, 1),
(3, 'Bayern Munich', 3, 1),
(4, 'Paris Saint-Germain', 4, 1),
(5, 'AC Milan', 5, 1),
(6, 'Manchester City', 1, 1),
(7, 'Liverpool', 1, 1),
(8, 'Chelsea', 1, 1),
(9, 'Manchester United', 1, 1),
(10, 'Barcelona', 2, 1),
(11, 'Inter Milan', 5, 1),
(12, 'Borussia Dortmund', 3, 1),
(13, 'Atletico Madrid', 2, 1),
(14, 'Juventus', 5, 1),
(15, 'Bayer Leverkusen', 3, 1);

-- Teams
INSERT INTO Team (TeamID, Name, Logo, ClubID, CountryID, FederationID) VALUES
(1, 'Arsenal', 'https://media.api-sports.io/football/teams/42.png', 1, 1, 1),
(2, 'Real Madrid', 'https://media.api-sports.io/football/teams/541.png', 2, 2, 1),
(3, 'Bayern Munich', 'https://media.api-sports.io/football/teams/157.png', 3, 3, 1),
(4, 'PSG', 'https://media.api-sports.io/football/teams/85.png', 4, 4, 1),
(5, 'AC Milan', 'https://media.api-sports.io/football/teams/489.png', 5, 5, 1),
(6, 'Manchester City', 'https://media.api-sports.io/football/teams/50.png', 6, 1, 1),
(7, 'Liverpool', 'https://media.api-sports.io/football/teams/40.png', 7, 1, 1),
(8, 'Chelsea', 'https://media.api-sports.io/football/teams/49.png', 8, 1, 1),
(9, 'Manchester United', 'https://media.api-sports.io/football/teams/33.png', 9, 1, 1),
(10, 'Barcelona', 'https://media.api-sports.io/football/teams/529.png', 10, 2, 1),
(11, 'Inter Milan', 'https://media.api-sports.io/football/teams/505.png', 11, 5, 1),
(12, 'Borussia Dortmund', 'https://media.api-sports.io/football/teams/165.png', 12, 3, 1),
(13, 'Atletico Madrid', 'https://media.api-sports.io/football/teams/530.png', 13, 2, 1),
(14, 'Juventus', 'https://media.api-sports.io/football/teams/496.png', 14, 5, 1),
(15, 'Bayer Leverkusen', 'https://media.api-sports.io/football/teams/168.png', 15, 3, 1);

-- Referees
INSERT INTO Referee (RefereeID, Name, Level, NationalityCountryID) VALUES
(1, 'Michael Oliver', 'FIFA', 1),
(2, 'Antonio Mateu Lahoz', 'FIFA', 2),
(3, 'Anthony Taylor', 'FIFA', 1),
(4, 'Szymon Marciniak', 'FIFA', 9),
(5, 'Clement Turpin', 'FIFA', 4),
(6, 'Daniele Orsato', 'FIFA', 5),
(7, 'Felix Zwayer', 'FIFA', 3);

-- Tournaments
INSERT INTO Tournament (TournamentID, Name, Type, Edition) VALUES
(1, 'UEFA Champions League', 'Club', '2024/2025'),
(2, 'Premier League', 'Club', '2024/2025'),
(3, 'La Liga', 'Club', '2024/2025'),
(4, 'Serie A', 'Club', '2024/2025'),
(5, 'Bundesliga', 'Club', '2024/2025');

-- Tournament Participation
INSERT INTO TournamentParticipation (TournamentID, TeamID) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 10), (1, 11), (1, 12), (1, 13),
(2, 1), (2, 6), (2, 7), (2, 8), (2, 9),
(3, 2), (3, 10), (3, 13),
(4, 5), (4, 11), (4, 14),
(5, 3), (5, 12), (5, 15);

-- Standings
INSERT INTO Standing (TournamentID, TeamID, Wins, Losses, Draws, Ranking, Points, GoalsFor, GoalsAgainst) VALUES
-- Champions League
(1, 1, 5, 1, 0, 1, 15, 14, 4),
(1, 2, 4, 1, 1, 2, 13, 16, 7),
(1, 3, 4, 2, 0, 3, 12, 15, 8),
(1, 6, 3, 1, 2, 4, 11, 11, 6),
(1, 10, 3, 2, 1, 5, 10, 12, 9),
(1, 4, 2, 2, 2, 6, 8, 9, 8),
(1, 11, 2, 3, 1, 7, 7, 7, 8),
(1, 5, 1, 3, 2, 8, 5, 6, 11),
-- Premier League
(2, 6, 6, 0, 1, 1, 19, 18, 5),
(2, 7, 5, 1, 1, 2, 16, 15, 7),
(2, 1, 5, 1, 1, 3, 16, 14, 6),
(2, 8, 3, 2, 2, 4, 11, 12, 10),
(2, 9, 2, 4, 1, 5, 7, 8, 14),
-- La Liga
(3, 2, 6, 0, 1, 1, 19, 17, 4),
(3, 10, 5, 1, 1, 2, 16, 18, 8),
(3, 13, 4, 1, 2, 3, 14, 11, 6),
-- Serie A
(4, 11, 5, 1, 1, 1, 16, 14, 5),
(4, 14, 4, 1, 2, 2, 14, 10, 4),
(4, 5, 3, 2, 2, 3, 11, 10, 8),
-- Bundesliga
(5, 3, 5, 0, 2, 1, 17, 21, 6),
(5, 15, 4, 1, 2, 2, 14, 14, 7),
(5, 12, 3, 2, 2, 3, 11, 12, 9);

-- Matches
INSERT INTO Match (MatchID, TournamentID, HomeTeamID, AwayTeamID, VenueID, MatchDate, HomeGoals, AwayGoals) VALUES
-- Premier League
(1, 2, 1, 6, 1, NOW() - INTERVAL '38 minutes', 1, 0),
(2, 2, 7, 8, 7, NOW() - INTERVAL '72 minutes', 2, 1),
(3, 2, 9, 1, 9, NOW() + INTERVAL '3 hours', 0, 0),
(4, 2, 6, 7, 6, NOW() - INTERVAL '1 day', 3, 1),
(5, 2, 8, 9, 8, NOW() + INTERVAL '1 day', 0, 0),
-- UEFA Champions League
(6, 1, 1, 2, 1, NOW() - INTERVAL '55 minutes', 1, 1),
(7, 1, 3, 4, 3, NOW() + INTERVAL '40 minutes', 0, 0),
(8, 1, 10, 11, 10, NOW() - INTERVAL '4 hours', 2, 0),
(9, 1, 12, 5, 11, NOW() + INTERVAL '4 hours', 0, 0),
(10, 1, 2, 3, 2, NOW() - INTERVAL '2 days', 2, 2),
-- La Liga
(11, 3, 2, 10, 2, NOW() + INTERVAL '1 day', 0, 0),
(12, 3, 13, 2, 12, NOW() - INTERVAL '5 hours', 1, 2),
(13, 3, 10, 13, 10, NOW() - INTERVAL '2 days', 3, 1),
-- Serie A
(14, 4, 5, 11, 5, NOW() - INTERVAL '22 minutes', 0, 0),
(15, 4, 14, 5, 13, NOW() + INTERVAL '5 hours', 0, 0),
(16, 4, 11, 14, 5, NOW() - INTERVAL '1 day', 2, 1),
-- Bundesliga
(17, 5, 3, 12, 3, NOW() - INTERVAL '80 minutes', 3, 2),
(18, 5, 15, 3, 14, NOW() + INTERVAL '6 hours', 0, 0);

-- Match Officiating (Linking Referees to Matches)
INSERT INTO MatchOfficiating (MatchID, RefereeID, Role, Status) VALUES
(1, 1, 'Main', 'Confirmed'),
(2, 3, 'Main', 'Confirmed'),
(3, 1, 'Main', 'Confirmed'),
(4, 3, 'Main', 'Confirmed'),
(5, 1, 'Main', 'Confirmed'),
(6, 4, 'Main', 'Confirmed'),
(7, 5, 'Main', 'Confirmed'),
(8, 2, 'Main', 'Confirmed'),
(9, 7, 'Main', 'Confirmed'),
(10, 4, 'Main', 'Confirmed'),
(11, 2, 'Main', 'Confirmed'),
(12, 2, 'Main', 'Confirmed'),
(13, 2, 'Main', 'Confirmed'),
(14, 6, 'Main', 'Confirmed'),
(15, 6, 'Main', 'Confirmed'),
(16, 6, 'Main', 'Confirmed'),
(17, 7, 'Main', 'Confirmed'),
(18, 7, 'Main', 'Confirmed');

-- Players (Squads)
INSERT INTO Player (PlayerID, Name, DateOfBirth, NationalityCountryID, Position) VALUES
  -- Arsenal
  (1, 'David Raya', '1995-09-15', 2, 'G'),
  (2, 'Ben White', '1997-10-08', 1, 'D'),
  (3, 'William Saliba', '2001-03-24', 4, 'D'),
  (4, 'Gabriel Magalhaes', '1997-12-19', 6, 'D'),
  (5, 'Oleksandr Zinchenko', '1996-12-15', 1, 'D'),
  (6, 'Declan Rice', '1999-01-14', 1, 'M'),
  (7, 'Martin Odegaard', '1998-12-17', 1, 'M'),
  (8, 'Kai Havertz', '1999-06-11', 3, 'M'),
  (9, 'Bukayo Saka', '2001-09-05', 1, 'F'),
  (10, 'Gabriel Jesus', '1997-04-03', 6, 'F'),
  (11, 'Gabriel Martinelli', '2001-06-18', 6, 'F'),
  -- Real Madrid
  (12, 'Thibaut Courtois', '1992-05-11', 2, 'G'),
  (13, 'Dani Carvajal', '1992-01-11', 2, 'D'),
  (14, 'Antonio Rudiger', '1993-03-03', 3, 'D'),
  (15, 'Eder Militao', '1998-01-18', 6, 'D'),
  (16, 'Ferland Mendy', '1995-06-08', 4, 'D'),
  (17, 'Federico Valverde', '1998-07-22', 2, 'M'),
  (18, 'Aurelien Tchouameni', '2000-01-27', 4, 'M'),
  (19, 'Jude Bellingham', '2003-06-29', 1, 'M'),
  (20, 'Rodrygo', '2001-01-09', 6, 'F'),
  (21, 'Kylian Mbappe', '1998-12-20', 4, 'F'),
  (22, 'Vinicius Junior', '2000-07-12', 6, 'F'),
  -- Man City
  (23, 'Ederson', '1993-08-17', 6, 'G'),
  (24, 'Kyle Walker', '1990-05-28', 1, 'D'),
  (25, 'Ruben Dias', '1997-05-14', 8, 'D'),
  (26, 'Manuel Akanji', '1995-07-19', 3, 'D'),
  (27, 'Josko Gvardiol', '2002-01-23', 1, 'D'),
  (28, 'Rodri', '1996-06-22', 2, 'M'),
  (29, 'Kevin De Bruyne', '1991-06-28', 1, 'M'),
  (30, 'Bernardo Silva', '1994-08-10', 8, 'M'),
  (31, 'Phil Foden', '2000-05-28', 1, 'F'),
  (32, 'Erling Haaland', '2000-07-21', 1, 'F'),
  (33, 'Jack Grealish', '1995-09-10', 1, 'F'),
  -- Liverpool
  (34, 'Alisson Becker', '1992-10-02', 6, 'G'),
  (35, 'Trent Alexander-Arnold', '1998-10-07', 1, 'D'),
  (36, 'Virgil van Dijk', '1991-07-08', 10, 'D'),
  (37, 'Ibrahima Konate', '1999-05-25', 4, 'D'),
  (38, 'Andy Robertson', '1994-03-11', 1, 'D'),
  (39, 'Alexis Mac Allister', '1998-12-24', 7, 'M'),
  (40, 'Dominik Szoboszlai', '2000-10-25', 1, 'M'),
  (41, 'Ryan Gravenberch', '2002-05-16', 10, 'M'),
  (42, 'Mohamed Salah', '1992-06-15', 1, 'F'),
  (43, 'Darwin Nunez', '1999-06-24', 7, 'F'),
  (44, 'Luis Diaz', '1997-01-13', 6, 'F'),
  -- Bayern Munich
  (45, 'Manuel Neuer', '1986-03-27', 3, 'G'),
  (46, 'Joshua Kimmich', '1995-02-08', 3, 'D'),
  (47, 'Dayot Upamecano', '1998-10-27', 4, 'D'),
  (48, 'Kim Min-jae', '1996-11-15', 3, 'D'),
  (49, 'Alphonso Davies', '2000-11-02', 1, 'D'),
  (50, 'Leon Goretzka', '1995-02-06', 3, 'M'),
  (51, 'Aleksandar Pavlovic', '2004-05-03', 3, 'M'),
  (52, 'Jamal Musiala', '2003-02-26', 3, 'M'),
  (53, 'Michael Olise', '2001-12-12', 4, 'F'),
  (54, 'Harry Kane', '1993-07-28', 1, 'F'),
  (55, 'Serge Gnabry', '1995-07-14', 3, 'F'),
  -- Barcelona
  (56, 'Marc-Andre ter Stegen', '1992-04-30', 3, 'G'),
  (57, 'Jules Kounde', '1998-11-12', 4, 'D'),
  (58, 'Pau Cubarsi', '2007-01-22', 2, 'D'),
  (59, 'Inigo Martinez', '1991-05-17', 2, 'D'),
  (60, 'Alejandro Balde', '2003-10-18', 2, 'D'),
  (61, 'Marc Casado', '2003-09-14', 2, 'M'),
  (62, 'Pedri', '2002-11-25', 2, 'M'),
  (63, 'Dani Olmo', '1998-05-07', 2, 'M'),
  (64, 'Lamine Yamal', '2007-07-13', 2, 'F'),
  (65, 'Robert Lewandowski', '1988-08-21', 9, 'F'),
  (66, 'Raphinha', '1996-12-14', 6, 'F'),
  -- Liverpool substitutes
  (67, 'Diogo Jota', '1996-12-04', 8, 'F'),
  (68, 'Cody Gakpo', '1999-05-07', 10, 'F'),
  (69, 'Curtis Jones', '2001-01-30', 1, 'M'),
  (70, 'Caoimhin Kelleher', '1998-11-23', 1, 'G'),
  -- Manchester City substitutes
  (71, 'Stefan Ortega', '1992-11-06', 3, 'G'),
  (72, 'Mateo Kovacic', '1994-05-06', 1, 'M'),
  (73, 'Jeremy Doku', '2002-05-27', 1, 'F'),
  (74, 'John Stones', '1994-05-28', 1, 'D');

-- Lineups for Key Matches
-- Match 1: Arsenal (Team 1) vs Manchester City (Team 6)
INSERT INTO Lineup (MatchID, TeamID, PlayerID, Status, Formation, Position, JerseyNumber) VALUES
-- Arsenal (4-3-3)
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
-- Man City (4-3-3)
(1, 6, 23, 'Starter', '4-3-3', 'G', 31),
(1, 6, 24, 'Starter', '4-3-3', 'D', 2),
(1, 6, 25, 'Starter', '4-3-3', 'D', 3),
(1, 6, 26, 'Starter', '4-3-3', 'D', 25),
(1, 6, 27, 'Starter', '4-3-3', 'D', 24),
(1, 6, 28, 'Starter', '4-3-3', 'M', 16),
(1, 6, 29, 'Starter', '4-3-3', 'M', 17),
(1, 6, 30, 'Starter', '4-3-3', 'M', 20),
(1, 6, 31, 'Starter', '4-3-3', 'F', 47),
(1, 6, 32, 'Starter', '4-3-3', 'F', 9),
(1, 6, 33, 'Starter', '4-3-3', 'F', 10);

-- Match 6: Arsenal (Team 1) vs Real Madrid (Team 2)
INSERT INTO Lineup (MatchID, TeamID, PlayerID, Status, Formation, Position, JerseyNumber) VALUES
-- Arsenal
(6, 1, 1, 'Starter', '4-3-3', 'G', 22),
(6, 1, 2, 'Starter', '4-3-3', 'D', 4),
(6, 1, 3, 'Starter', '4-3-3', 'D', 2),
(6, 1, 4, 'Starter', '4-3-3', 'D', 6),
(6, 1, 5, 'Starter', '4-3-3', 'D', 35),
(6, 1, 6, 'Starter', '4-3-3', 'M', 41),
(6, 1, 7, 'Starter', '4-3-3', 'M', 8),
(6, 1, 8, 'Starter', '4-3-3', 'M', 29),
(6, 1, 9, 'Starter', '4-3-3', 'F', 7),
(6, 1, 10, 'Starter', '4-3-3', 'F', 9),
(6, 1, 11, 'Starter', '4-3-3', 'F', 11),
-- Real Madrid
(6, 2, 12, 'Starter', '4-3-3', 'G', 1),
(6, 2, 13, 'Starter', '4-3-3', 'D', 2),
(6, 2, 14, 'Starter', '4-3-3', 'D', 22),
(6, 2, 15, 'Starter', '4-3-3', 'D', 3),
(6, 2, 16, 'Starter', '4-3-3', 'D', 23),
(6, 2, 17, 'Starter', '4-3-3', 'M', 15),
(6, 2, 18, 'Starter', '4-3-3', 'M', 14),
(6, 2, 19, 'Starter', '4-3-3', 'M', 5),
(6, 2, 20, 'Starter', '4-3-3', 'F', 11),
(6, 2, 21, 'Starter', '4-3-3', 'F', 9),
(6, 2, 22, 'Starter', '4-3-3', 'F', 7);

-- Match 2: Liverpool (Team 7) vs Chelsea (Team 8)
INSERT INTO Lineup (MatchID, TeamID, PlayerID, Status, Formation, Position, JerseyNumber) VALUES
-- Liverpool (4-3-3)
(2, 7, 34, 'Starter', '4-3-3', 'G', 1),
(2, 7, 35, 'Starter', '4-3-3', 'D', 66),
(2, 7, 36, 'Starter', '4-3-3', 'D', 4),
(2, 7, 37, 'Starter', '4-3-3', 'D', 5),
(2, 7, 38, 'Starter', '4-3-3', 'D', 26),
(2, 7, 39, 'Starter', '4-3-3', 'M', 10),
(2, 7, 40, 'Starter', '4-3-3', 'M', 8),
(2, 7, 41, 'Starter', '4-3-3', 'M', 38),
(2, 7, 42, 'Starter', '4-3-3', 'F', 11),
(2, 7, 43, 'Starter', '4-3-3', 'F', 9),
(2, 7, 44, 'Starter', '4-3-3', 'F', 7),
(2, 7, 67, 'Sub', '4-3-3', 'F', 20),
(2, 7, 68, 'Sub', '4-3-3', 'F', 18),
(2, 7, 69, 'Sub', '4-3-3', 'M', 17),
(2, 7, 70, 'Sub', '4-3-3', 'G', 62);

-- Match 4: Manchester City (Team 6) vs Liverpool (Team 7)
INSERT INTO Lineup (MatchID, TeamID, PlayerID, Status, Formation, Position, JerseyNumber) VALUES
-- Man City (4-3-3)
(4, 6, 23, 'Starter', '4-3-3', 'G', 31),
(4, 6, 24, 'Starter', '4-3-3', 'D', 2),
(4, 6, 25, 'Starter', '4-3-3', 'D', 3),
(4, 6, 26, 'Starter', '4-3-3', 'D', 25),
(4, 6, 27, 'Starter', '4-3-3', 'D', 24),
(4, 6, 28, 'Starter', '4-3-3', 'M', 16),
(4, 6, 29, 'Starter', '4-3-3', 'M', 17),
(4, 6, 30, 'Starter', '4-3-3', 'M', 20),
(4, 6, 31, 'Starter', '4-3-3', 'F', 47),
(4, 6, 32, 'Starter', '4-3-3', 'F', 9),
(4, 6, 33, 'Starter', '4-3-3', 'F', 10),
(4, 6, 71, 'Sub', '4-3-3', 'G', 18),
(4, 6, 72, 'Sub', '4-3-3', 'M', 8),
(4, 6, 73, 'Sub', '4-3-3', 'F', 11),
(4, 6, 74, 'Sub', '4-3-3', 'D', 5),
-- Liverpool (4-3-3)
(4, 7, 34, 'Starter', '4-3-3', 'G', 1),
(4, 7, 35, 'Starter', '4-3-3', 'D', 66),
(4, 7, 36, 'Starter', '4-3-3', 'D', 4),
(4, 7, 37, 'Starter', '4-3-3', 'D', 5),
(4, 7, 38, 'Starter', '4-3-3', 'D', 26),
(4, 7, 39, 'Starter', '4-3-3', 'M', 10),
(4, 7, 40, 'Starter', '4-3-3', 'M', 8),
(4, 7, 41, 'Starter', '4-3-3', 'M', 38),
(4, 7, 42, 'Starter', '4-3-3', 'F', 11),
(4, 7, 43, 'Starter', '4-3-3', 'F', 9),
(4, 7, 44, 'Starter', '4-3-3', 'F', 7),
(4, 7, 67, 'Sub', '4-3-3', 'F', 20),
(4, 7, 68, 'Sub', '4-3-3', 'F', 18),
(4, 7, 69, 'Sub', '4-3-3', 'M', 17),
(4, 7, 70, 'Sub', '4-3-3', 'G', 62);

-- Events
INSERT INTO Event (EventID, MatchID, PlayerID, TeamID, EventTime, EventType) VALUES
(1, 1, 9, 1, 23, 'Goal'),
(2, 2, 42, 7, 31, 'Goal'),
(3, 2, 43, 7, 54, 'Goal'),
(4, 6, 9, 1, 15, 'Goal'),
(5, 6, 22, 2, 44, 'Goal'),
(6, 2, 43, 7, 63, 'Substitution'),
(7, 4, 33, 6, 61, 'Substitution'),
(8, 4, 43, 7, 74, 'Substitution');

-- Goals
INSERT INTO Goal (EventID, AssistPlayerID, GoalType) VALUES
(1, 7, 'Standard'),
(2, 35, 'Standard'),
(3, 42, 'Header'),
(4, 6, 'Standard'),
(5, 19, 'Counter');

-- Substitutions
INSERT INTO Substitution (EventID, InPlayerID) VALUES
(6, 67),
(7, 73),
(8, 68);

-- Users (Password is 'password123')
INSERT INTO Users (Username, Email, PasswordHash, Role) VALUES
('admin', 'admin@kickoff.com', '$2b$10$X7/E4Z1l3Q.Kz3.3.3.3.3.3.3.3.3.3.3.3.3.3.3.3.3.3.3.3', 'admin'),
('john_doe', 'john@example.com', '$2b$10$X7/E4Z1l3Q.Kz3.3.3.3.3.3.3.3.3.3.3.3.3.3.3.3.3.3.3.3', 'fan');

-- User Follows
INSERT INTO UserFollowsTeam (UserID, TeamID) VALUES
(1, 1),
(2, 1),
(2, 7)
ON CONFLICT DO NOTHING;

-- Synchronize sequences with current max IDs
SELECT setval(pg_get_serial_sequence('Player', 'playerid'), COALESCE(MAX(PlayerID), 1)) FROM Player;
SELECT setval(pg_get_serial_sequence('Match', 'matchid'), COALESCE(MAX(MatchID), 1)) FROM Match;
SELECT setval(pg_get_serial_sequence('Team', 'teamid'), COALESCE(MAX(TeamID), 1)) FROM Team;
SELECT setval(pg_get_serial_sequence('Venue', 'venueid'), COALESCE(MAX(VenueID), 1)) FROM Venue;
SELECT setval(pg_get_serial_sequence('Tournament', 'tournamentid'), COALESCE(MAX(TournamentID), 1)) FROM Tournament;
SELECT setval(pg_get_serial_sequence('Referee', 'refereeid'), COALESCE(MAX(RefereeID), 1)) FROM Referee;
SELECT setval(pg_get_serial_sequence('Event', 'eventid'), COALESCE(MAX(EventID), 1)) FROM Event;
