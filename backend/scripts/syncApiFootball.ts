import { pool } from "../src/db";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const API_URL = "https://v3.football.api-sports.io";
const API_KEY = process.env.API_FOOTBALL_KEY;

async function fetchFixtures(date: string) {
  if (!API_KEY || API_KEY === "your-api-football-key") {
    throw new Error("Please set a valid API_FOOTBALL_KEY in backend/.env");
  }

  console.log(`Fetching fixtures for ${date} from API-Football...`);

  const response = await fetch(`${API_URL}/fixtures?date=${date}`, {
    headers: {
      "x-apisports-key": API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`API-Football request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.response;
}

async function getOrInsertTournament(name: string, season: number) {
  const selectRes = await pool.query(
    `SELECT TournamentID
     FROM Tournament
     WHERE Name = $1 AND Edition = $2`,
    [name, String(season)]
  );

  if (selectRes.rows.length > 0) {
    return selectRes.rows[0].tournamentid;
  }

  const insertRes = await pool.query(
    `INSERT INTO Tournament (Name, Type, Edition)
     VALUES ($1, 'League', $2)
     RETURNING TournamentID`,
    [name, String(season)]
  );

  return insertRes.rows[0].tournamentid;
}

async function getOrInsertTeam(
  apiTeamId: number,
  name: string,
  logo: string | null
) {
  // First try API ID
  let result = await pool.query(
    `SELECT TeamID
     FROM Team
     WHERE ApiTeamID = $1`,
    [apiTeamId]
  );

  if (result.rows.length > 0) {
    await pool.query(
      `UPDATE Team
       SET Name = $1, Logo = $2
       WHERE TeamID = $3`,
      [name, logo, result.rows[0].teamid]
    );

    return result.rows[0].teamid;
  }

  // Try existing team by name
  result = await pool.query(
    `SELECT TeamID
     FROM Team
     WHERE Name = $1`,
    [name]
  );

  if (result.rows.length > 0) {
    await pool.query(
      `UPDATE Team
       SET ApiTeamID = $1,
           Logo = $2
       WHERE TeamID = $3`,
      [apiTeamId, logo, result.rows[0].teamid]
    );

    return result.rows[0].teamid;
  }

  // Create new team
  const insert = await pool.query(
    `INSERT INTO Team (Name, Logo, ApiTeamID)
     VALUES ($1, $2, $3)
     RETURNING TeamID`,
    [name, logo, apiTeamId]
  );

  return insert.rows[0].teamid;
}

async function getOrInsertVenue(
  name: string | null,
  city: string | null
) {
  if (!name) {
    return null;
  }

  const result = await pool.query(
    `SELECT VenueID
     FROM Venue
     WHERE Name = $1
       AND COALESCE(City, '') = COALESCE($2, '')`,
    [name, city]
  );

  if (result.rows.length > 0) {
    return result.rows[0].venueid;
  }

  const insert = await pool.query(
    `INSERT INTO Venue (Name, City)
     VALUES ($1, $2)
     RETURNING VenueID`,
    [name, city]
  );

  return insert.rows[0].venueid;
}

async function getOrInsertReferee(name: string | null) {
  if (!name) {
    return null;
  }

  const result = await pool.query(
    `SELECT RefereeID
     FROM Referee
     WHERE Name = $1`,
    [name]
  );

  if (result.rows.length > 0) {
    return result.rows[0].refereeid;
  }

  const insert = await pool.query(
    `INSERT INTO Referee (Name)
     VALUES ($1)
     RETURNING RefereeID`,
    [name]
  );

  return insert.rows[0].refereeid;
}

async function addMatchOfficiating(
  matchId: number,
  refereeId: number | null
) {
  if (!refereeId) {
    return;
  }

  const result = await pool.query(
    `SELECT 1
     FROM MatchOfficiating
     WHERE MatchID = $1`,
    [matchId]
  );

  if (result.rows.length === 0) {
    await pool.query(
      `INSERT INTO MatchOfficiating (MatchID, RefereeID)
       VALUES ($1, $2)`,
      [matchId, refereeId]
    );
  } else {
    await pool.query(
      `UPDATE MatchOfficiating
       SET RefereeID = $1
       WHERE MatchID = $2`,
      [refereeId, matchId]
    );
  }
}

async function findExistingMatch(
  apiFixtureId: number,
  tournamentId: number,
  homeTeamId: number,
  awayTeamId: number,
  matchDate: Date
) {
  // First try API fixture ID
  let result = await pool.query(
    `SELECT MatchID
     FROM Match
     WHERE ApiFixtureID = $1`,
    [apiFixtureId]
  );

  if (result.rows.length > 0) {
    return result.rows[0].matchid;
  }

  // Then try the existing match information
  result = await pool.query(
    `SELECT MatchID
     FROM Match
     WHERE TournamentID = $1
       AND HomeTeamID = $2
       AND AwayTeamID = $3
       AND MatchDate = $4`,
    [
      tournamentId,
      homeTeamId,
      awayTeamId,
      matchDate,
    ]
  );

  if (result.rows.length > 0) {
    const matchId = result.rows[0].matchid;

    await pool.query(
      `UPDATE Match
       SET ApiFixtureID = $1
       WHERE MatchID = $2`,
      [apiFixtureId, matchId]
    );

    return matchId;
  }

  return null;
}

async function sync() {
  try {
    const dbInfo = await pool.query(
      `SELECT current_database(), current_user, current_schema()`
    );

    console.log("SYNC DATABASE:", dbInfo.rows[0]);

    const requestedDate =
      process.argv[2] ?? new Date().toISOString().split("T")[0];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      throw new Error("Date must be in YYYY-MM-DD format.");
    }

    const fixtures = await fetchFixtures(requestedDate);

    console.log(
      `Found ${fixtures.length} fixtures. Syncing to database...`
    );

    let inserted = 0;
    let updated = 0;

    for (const item of fixtures) {
      const leagueName = item.league.name;
      const leagueSeason = item.league.season;

      const homeTeamName = item.teams.home.name;
      const awayTeamName = item.teams.away.name;

      const homeTeamLogo = item.teams.home.logo ?? null;
      const awayTeamLogo = item.teams.away.logo ?? null;

      const apiHomeTeamId = item.teams.home.id;
      const apiAwayTeamId = item.teams.away.id;
      const apiFixtureId = item.fixture.id;

      const matchDate = new Date(item.fixture.date);

      const homeGoals = item.goals.home ?? 0;
      const awayGoals = item.goals.away ?? 0;

      // Tournament
      const tournamentId = await getOrInsertTournament(
        leagueName,
        leagueSeason
      );

      // Teams
      const homeTeamId = await getOrInsertTeam(
        apiHomeTeamId,
        homeTeamName,
        homeTeamLogo
      );

      const awayTeamId = await getOrInsertTeam(
        apiAwayTeamId,
        awayTeamName,
        awayTeamLogo
      );

      // Venue
      const venueId = await getOrInsertVenue(
        item.fixture.venue?.name ?? null,
        item.fixture.venue?.city ?? null
      );

      // Referee
      const refereeId = await getOrInsertReferee(
        item.fixture.referee ?? null
      );

      // Find existing match
      const existingMatchId = await findExistingMatch(
        apiFixtureId,
        tournamentId,
        homeTeamId,
        awayTeamId,
        matchDate
      );

      let matchId: number;

      if (existingMatchId === null) {
        const insertRes = await pool.query(
          `INSERT INTO Match
           (
             TournamentID,
             HomeTeamID,
             AwayTeamID,
             VenueID,
             MatchDate,
             HomeGoals,
             AwayGoals,
             ApiFixtureID
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING MatchID`,
          [
            tournamentId,
            homeTeamId,
            awayTeamId,
            venueId,
            matchDate,
            homeGoals,
            awayGoals,
            apiFixtureId,
          ]
        );

        matchId = insertRes.rows[0].matchid;
        inserted++;
      } else {
        matchId = existingMatchId;

        await pool.query(
          `UPDATE Match
           SET TournamentID = $1,
               HomeTeamID = $2,
               AwayTeamID = $3,
               VenueID = $4,
               MatchDate = $5,
               HomeGoals = $6,
               AwayGoals = $7,
               ApiFixtureID = $8
           WHERE MatchID = $9`,
          [
            tournamentId,
            homeTeamId,
            awayTeamId,
            venueId,
            matchDate,
            homeGoals,
            awayGoals,
            apiFixtureId,
            matchId,
          ]
        );

        updated++;
      }

      // Match referee
      await addMatchOfficiating(matchId, refereeId);
    }

    console.log("Database sync complete!");
    console.log(`Inserted: ${inserted}`);
    console.log(`Updated: ${updated}`);
  } catch (error) {
    console.error("Sync failed:", error);
  } finally {
    await pool.end();
  }
}

sync();