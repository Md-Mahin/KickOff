import { pool } from "../src/db";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const API_URL = "https://v3.football.api-sports.io";
const API_KEY = process.env.API_FOOTBALL_KEY;

async function fetchEvents(fixtureId: number) {
  if (!API_KEY || API_KEY === "your-api-football-key") {
    throw new Error("Please set a valid API_FOOTBALL_KEY in backend/.env");
  }

  const response = await fetch(
    `${API_URL}/fixtures/events?fixture=${fixtureId}`,
    {
      headers: {
        "x-apisports-key": API_KEY,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`API-Football request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.response;
}

async function getOrInsertPlayer(
  apiPlayerId: number,
  name: string
) {
  const result = await pool.query(
    `SELECT PlayerID
     FROM Player
     WHERE ApiPlayerID = $1`,
    [apiPlayerId]
  );

  if (result.rows.length > 0) {
    await pool.query(
      `UPDATE Player
       SET Name = $1
       WHERE PlayerID = $2`,
      [name, result.rows[0].playerid]
    );

    return result.rows[0].playerid;
  }

  const insert = await pool.query(
    `INSERT INTO Player (Name, ApiPlayerID)
     VALUES ($1, $2)
     RETURNING PlayerID`,
    [name, apiPlayerId]
  );

  return insert.rows[0].playerid;
}

async function getMatch(apiFixtureId: number) {
  const result = await pool.query(
    `SELECT
       m.MatchID,
       m.HomeTeamID,
       m.AwayTeamID
     FROM Match m
     WHERE m.ApiFixtureID = $1`,
    [apiFixtureId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

async function getLocalTeamId(apiTeamId: number) {
  const result = await pool.query(
    `SELECT TeamID
     FROM Team
     WHERE ApiTeamID = $1`,
    [apiTeamId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].teamid;
}

async function syncEvents(fixtureId: number) {
  const match = await getMatch(fixtureId);

  if (!match) {
    console.log(`Match not found for API fixture ${fixtureId}`);
    return;
  }

  const events = await fetchEvents(fixtureId);

  console.log(
    `Found ${events.length} events for fixture ${fixtureId}`
  );

  for (const item of events) {
    const type = item.type;

    if (!["Goal", "Card", "Foul"].includes(type)) {
      continue;
    }

    const playerId = item.player?.id
      ? await getOrInsertPlayer(
          item.player.id,
          item.player.name
        )
      : null;

    let teamId: number | null = null;

    if (item.team?.id) {
      teamId = await getLocalTeamId(item.team.id);
    }

    if (!teamId) {
      console.log(
        `Team not found for API team ${item.team?.id}`
      );
      continue;
    }

    const eventTime = item.time?.elapsed ?? null;

    const existing = await pool.query(
      `SELECT EventID
       FROM Event
       WHERE MatchID = $1
         AND PlayerID IS NOT DISTINCT FROM $2
         AND TeamID = $3
         AND EventTime IS NOT DISTINCT FROM $4
         AND EventType = $5`,
      [
        match.matchid,
        playerId,
        teamId,
        eventTime,
        type,
      ]
    );

    if (existing.rows.length > 0) {
      continue;
    }

    const eventResult = await pool.query(
      `INSERT INTO Event
       (
         MatchID,
         PlayerID,
         TeamID,
         EventTime,
         EventType
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING EventID`,
      [
        match.matchid,
        playerId,
        teamId,
        eventTime,
        type,
      ]
    );

    const eventId = eventResult.rows[0].eventid;

    if (type === "Goal") {
      const assistPlayerId = item.assist?.id
        ? await getOrInsertPlayer(
            item.assist.id,
            item.assist.name
          )
        : null;

      let goalType = "Open Play";

      if (item.detail === "Penalty") {
        goalType = "Penalty";
      } else if (item.detail === "Own Goal") {
        goalType = "Own Goal";
      }

      await pool.query(
        `INSERT INTO Goal
         (
           EventID,
           AssistPlayerID,
           GoalType
         )
         VALUES ($1, $2, $3)`,
        [
          eventId,
          assistPlayerId,
          goalType,
        ]
      );
    }

    if (type === "Card") {
      const cardType =
        item.detail === "Red Card" ||
        item.detail === "Second Yellow"
          ? "Red"
          : "Yellow";

      await pool.query(
        `INSERT INTO Card
         (
           EventID,
           CardType
         )
         VALUES ($1, $2)`,
        [
          eventId,
          cardType,
        ]
      );
    }

    if (type === "Foul") {
      await pool.query(
        `INSERT INTO Foul
         (
           EventID,
           FouledPlayerID
         )
         VALUES ($1, $2)`,
        [
          eventId,
          null,
        ]
      );
    }
  }

  console.log("Event sync complete!");
}

async function main() {
  try {
    const fixtureId = Number(process.argv[2]);

    if (!fixtureId) {
      throw new Error(
        "Please provide an API fixture ID. Example: npm run sync-events -- 12345"
      );
    }

    await syncEvents(fixtureId);
  } catch (error) {
    console.error("Event sync failed:", error);
  } finally {
    await pool.end();
  }
}

main();