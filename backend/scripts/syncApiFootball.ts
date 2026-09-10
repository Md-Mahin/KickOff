import { pool } from "../src/db";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

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
  const selectRes = await pool.query(`SELECT TournamentID FROM Tournament WHERE Name = $1 AND Edition = $2`, [name, String(season)]);
  if (selectRes.rows.length > 0) return selectRes.rows[0].tournamentid;

  const insertRes = await pool.query(
    `INSERT INTO Tournament (Name, Type, Edition) VALUES ($1, 'League', $2) RETURNING TournamentID`,
    [name, String(season)]
  );
  return insertRes.rows[0].tournamentid;
}

async function getOrInsertTeam(name: string) {
  const selectRes = await pool.query(`SELECT TeamID FROM Team WHERE Name = $1`, [name]);
  if (selectRes.rows.length > 0) return selectRes.rows[0].teamid;

  const insertRes = await pool.query(`INSERT INTO Team (Name) VALUES ($1) RETURNING TeamID`, [name]);
  return insertRes.rows[0].teamid;
}

async function sync() {
  try {
    const today = new Date().toISOString().split("T")[0];
    const fixtures = await fetchFixtures(today);

    console.log(`Found ${fixtures.length} fixtures. Syncing to database...`);

    for (const item of fixtures) {
      const leagueName = item.league.name;
      const leagueSeason = item.league.season;
      const homeTeamName = item.teams.home.name;
      const awayTeamName = item.teams.away.name;
      const matchDate = new Date(item.fixture.date);
      const homeGoals = item.goals.home ?? 0;
      const awayGoals = item.goals.away ?? 0;

      // 1. Ensure Tournament exists
      const tournamentId = await getOrInsertTournament(leagueName, leagueSeason);

      // 2. Ensure Teams exist
      const homeTeamId = await getOrInsertTeam(homeTeamName);
      const awayTeamId = await getOrInsertTeam(awayTeamName);

      // 3. Insert or Update Match
      // Note: We check if a match with the same teams and date exists to avoid duplicates
      const matchRes = await pool.query(
        `SELECT MatchID FROM Match WHERE TournamentID = $1 AND HomeTeamID = $2 AND AwayTeamID = $3 AND MatchDate = $4`,
        [tournamentId, homeTeamId, awayTeamId, matchDate]
      );

      if (matchRes.rows.length === 0) {
        await pool.query(
          `INSERT INTO Match (TournamentID, HomeTeamID, AwayTeamID, MatchDate, HomeGoals, AwayGoals)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [tournamentId, homeTeamId, awayTeamId, matchDate, homeGoals, awayGoals]
        );
      } else {
        await pool.query(
          `UPDATE Match SET HomeGoals = $1, AwayGoals = $2 WHERE MatchID = $3`,
          [homeGoals, awayGoals, matchRes.rows[0].matchid]
        );
      }
    }

    console.log("Database sync complete!");
  } catch (error) {
    console.error("Sync failed:", error);
  } finally {
    await pool.end();
  }
}

sync();

