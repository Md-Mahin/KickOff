import { pool } from "../src/db";
import { fetchEvents } from "../src/services/footballService";

type DbMatch = {
  apifixtureid: number;
  matchdate: Date;
};

type ApiEvent = {
  time?: {
    elapsed?: number | null;
  };
  team?: {
    id?: number | null;
  };
  player?: {
    id?: number | null;
  };
  assist?: {
    id?: number | null;
  };
  type?: string | null;
  detail?: string | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function syncFixtureEvents(fixtureId: number) {
  const apiResult: unknown = await fetchEvents(fixtureId);
  const response =
    apiResult && typeof apiResult === "object"
      ? (apiResult as { response?: unknown; data?: unknown })
      : null;
  const events: ApiEvent[] = Array.isArray(apiResult)
    ? (apiResult as ApiEvent[])
    : response && Array.isArray(response.response)
      ? (response.response as ApiEvent[])
      : response &&
          response.data &&
          typeof response.data === "object" &&
          Array.isArray((response.data as { response?: unknown }).response)
        ? ((response.data as { response: ApiEvent[] }).response ?? [])
        : [];

  console.log(`Found ${events.length} events for fixture ${fixtureId}`);

  if (events.length === 0) {
    return;
  }

  const matchResult = await pool.query(
    `
    SELECT MatchID
    FROM Match
    WHERE ApiFixtureID = $1
    `,
    [fixtureId]
  );

  if (matchResult.rows.length === 0) {
    console.log(`Match not found for fixture ${fixtureId}`);
    return;
  }

  const matchId = matchResult.rows[0].matchid;

  for (const event of events) {
    const elapsed = event.time?.elapsed ?? null;
    const teamApiId = event.team?.id ?? null;
    const playerApiId = event.player?.id ?? null;
    const assistApiId = event.assist?.id ?? null;

    let eventType: "Goal" | "Card" | "Foul" | null = null;

    const eventTypeName = event.type?.toLowerCase();

    if (eventTypeName === "goal") {
      eventType = "Goal";
    } else if (eventTypeName === "card") {
      eventType = "Card";
    } else if (eventTypeName === "foul") {
      eventType = "Foul";
    }

    if (!eventType) {
      continue;
    }

    const teamResult = await pool.query(
      `
      SELECT TeamID
      FROM Team
      WHERE ApiTeamID = $1
      `,
      [teamApiId]
    );

    const teamId =
      teamResult.rows.length > 0 ? teamResult.rows[0].teamid : null;

    const playerResult = playerApiId
      ? await pool.query(
          `
          SELECT PlayerID
          FROM Player
          WHERE ApiPlayerID = $1
          `,
          [playerApiId]
        )
      : { rows: [] };

    const playerId =
      playerResult.rows.length > 0
        ? playerResult.rows[0].playerid
        : null;

    const existingEvent = await pool.query(
      `
      SELECT EventID
      FROM Event
      WHERE MatchID = $1
        AND EventTime IS NOT DISTINCT FROM $2
        AND EventType = $3
        AND TeamID IS NOT DISTINCT FROM $4
        AND PlayerID IS NOT DISTINCT FROM $5
      LIMIT 1
      `,
      [matchId, elapsed, eventType, teamId, playerId]
    );

    let eventId: number;

    if (existingEvent.rows.length > 0) {
      eventId = existingEvent.rows[0].eventid;
    } else {
      const insertedEvent = await pool.query(
        `
        INSERT INTO Event (
          MatchID,
          PlayerID,
          TeamID,
          EventTime,
          EventType
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING EventID
        `,
        [matchId, playerId, teamId, elapsed, eventType]
      );

      eventId = insertedEvent.rows[0].eventid;
    }

    if (eventType === "Goal") {
      const assistResult = assistApiId
        ? await pool.query(
            `
            SELECT PlayerID
            FROM Player
            WHERE ApiPlayerID = $1
            `,
            [assistApiId]
          )
        : { rows: [] };

      const assistPlayerId =
        assistResult.rows.length > 0
          ? assistResult.rows[0].playerid
          : null;

      await pool.query(
        `
        INSERT INTO Goal (
          EventID,
          AssistPlayerID,
          GoalType
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (EventID)
        DO UPDATE SET
          AssistPlayerID = EXCLUDED.AssistPlayerID,
          GoalType = EXCLUDED.GoalType
        `,
        [
          eventId,
          assistPlayerId,
          event.detail ?? null,
        ]
      );
    }

    if (eventType === "Card") {
      let cardType: "Yellow" | "Red" | null = null;

      if (event.detail?.toLowerCase().includes("yellow")) {
        cardType = "Yellow";
      } else if (event.detail?.toLowerCase().includes("red")) {
        cardType = "Red";
      }

      if (cardType) {
        await pool.query(
          `
          INSERT INTO Card (
            EventID,
            CardType
          )
          VALUES ($1, $2)
          ON CONFLICT (EventID)
          DO UPDATE SET
            CardType = EXCLUDED.CardType
          `,
          [eventId, cardType]
        );
      }
    }

    if (eventType === "Foul") {
      const fouledPlayerId = null;

      await pool.query(
        `
        INSERT INTO Foul (
          EventID,
          FouledPlayerID
        )
        VALUES ($1, $2)
        ON CONFLICT (EventID)
        DO UPDATE SET
          FouledPlayerID = EXCLUDED.FouledPlayerID
        `,
        [eventId, fouledPlayerId]
      );
    }
  }
}

async function syncSingleFixture(fixtureId: number) {
  try {
    await syncFixtureEvents(fixtureId);
    console.log(`Event sync complete for fixture ${fixtureId}!`);
  } catch (error) {
    console.error(`Failed fixture ${fixtureId}:`, error);
  }
}

async function syncAllEvents() {
  /*
   * Only sync recent matches.
   *
   * This prevents us from making hundreds of API-Football
   * event requests and hitting the API rate limit.
   *
   * We use:
   *   - yesterday
   *   - today
   *
   * Upcoming matches are naturally excluded.
   */

  const result = await pool.query<DbMatch>(
    `
    SELECT
      ApiFixtureID,
      MatchDate
    FROM Match
    WHERE ApiFixtureID IS NOT NULL
      AND MatchDate >= CURRENT_DATE - INTERVAL '1 day'
      AND MatchDate <= NOW()
    ORDER BY MatchDate ASC
    `
  );

  const matches = result.rows;

  console.log(`Found ${matches.length} recent matches to sync.`);

  for (const match of matches) {
    await syncSingleFixture(match.apifixtureid);

    /*
     * Do not immediately hammer API-Football again.
     * 1.2 seconds between requests is intentionally conservative.
     */
    await sleep(1200);
  }

  console.log("All recent match events synced!");
}

async function main() {
  const fixtureId = process.argv[2];

  /*
   * Specific fixture:
   *
   * npm run sync-events -- 1628498
   */
  if (fixtureId) {
    const id = Number(fixtureId);

    if (Number.isNaN(id)) {
      console.error("Invalid fixture ID.");
      process.exit(1);
    }

    await syncSingleFixture(id);
    await pool.end();
    return;
  }

  /*
   * No fixture specified:
   *
   * npm run sync-events
   *
   * Sync only yesterday + today's completed/live matches.
   */
  await syncAllEvents();

  await pool.end();
}

main().catch(async (error) => {
  console.error("Event sync failed:", error);

  await pool.end();
  process.exit(1);
});