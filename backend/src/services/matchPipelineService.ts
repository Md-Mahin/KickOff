import { pool } from "../db";
import {
  MOCK_BASIC_MATCHES,
  resolveMockDetailedMatch,
  generateMockDetailedMatch,
  DetailedMockMatch,
  BasicMatchItem,
} from "./mockMatchData";

const API_BASE = "https://v3.football.api-sports.io";

function apiKey(): string {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key || key === "your-api-football-key") {
    throw new Error("API key not configured or using placeholder");
  }
  return key;
}

const todayStr = () => new Date().toISOString().split("T")[0];

/**
 * Generic API-Football fetch helper with timeout
 */
async function callApiFootball(path: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "x-apisports-key": apiKey() },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`API-Football error ${res.status}: ${res.statusText}`);
    }
    const json = (await res.json()) as { response: any[] };
    return json.response ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================================
// 1. Initial Page Load: Fetch Basic Match List
// Only fetches teams and match status (FT, UPCOMING, LIVE)
// Error Handling: Uses backup mock data ONLY if API-Football call fails
// ============================================================================
export async function getBasicMatchList(): Promise<{
  source: "API-Football" | "Mock Fallback";
  matches: BasicMatchItem[];
}> {
  try {
    const items = await callApiFootball(`/fixtures?date=${todayStr()}`);

    if (Array.isArray(items) && items.length > 0) {
      const basicMatches: BasicMatchItem[] = items.map((item: any) => {
        const mins = item.fixture.status.elapsed;
        let status: "LIVE" | "FT" | "UPCOMING" = "UPCOMING";
        const shortStatus = (item.fixture.status.short || "").toUpperCase();

        if (["1H", "2H", "HT", "ET", "P", "LIVE"].includes(shortStatus)) {
          status = "LIVE";
        } else if (["FT", "AET", "PEN"].includes(shortStatus)) {
          status = "FT";
        }

        return {
          id: Number(item.fixture.id),
          leagueId: item.league?.id ? Number(item.league.id) : undefined,
          league: item.league?.name ?? "League",
          country: item.league?.country ?? "International",
          homeTeam: item.teams.home.name,
          homeTeamId: Number(item.teams.home.id),
          homeLogo: item.teams.home.logo ?? null,
          awayTeam: item.teams.away.name,
          awayTeamId: Number(item.teams.away.id),
          awayLogo: item.teams.away.logo ?? null,
          homeScore: item.goals.home ?? null,
          awayScore: item.goals.away ?? null,
          status,
          minute: mins,
          date: item.fixture.date,
        };
      });

      return {
        source: "API-Football",
        matches: basicMatches,
      };
    }

    throw new Error("No fixtures returned by API-Football");
  } catch (error) {
    console.warn(
      `[Basic Match List] API-Football call failed (${(error as Error).message}). Engaging backup mock data fallback.`
    );
    return {
      source: "Mock Fallback",
      matches: MOCK_BASIC_MATCHES,
    };
  }
}

// ============================================================================
// 2. Database Caching Strategy (Strict Pipeline)
// Step 1: Call API-Football to get relevant detailed data (or fallback mock)
// Step 2: Put and fill up the database with this data
// Step 3: Pull and show the data to the user directly from the database
// ============================================================================

/**
 * Step 2: Put and fill up the database with the detailed match data
 */
export async function persistMatchDetailsToDatabase(
  matchId: number,
  data: DetailedMockMatch
): Promise<void> {
  const { fixture, league, teams, goals, lineups, events } = data;

  // 1. Country & Tournament
  let countryId: number | null = null;
  if (league?.country) {
    try {
      const cRes = await pool.query(
        `INSERT INTO Country (Name) VALUES ($1)
         ON CONFLICT (Name) DO UPDATE SET Name = EXCLUDED.Name
         RETURNING CountryID`,
        [league.country]
      );
      countryId = cRes.rows[0]?.countryid ?? null;
    } catch {}
  }

  const leagueId = league?.id ? Number(league.id) : 1;
  const leagueName = league?.name ?? "Tournament";
  try {
    await pool.query(
      `INSERT INTO Tournament (TournamentID, Name, Type, Edition)
       VALUES ($1, $2, 'Club', $3)
       ON CONFLICT (TournamentID) DO UPDATE SET
         Name = EXCLUDED.Name,
         Edition = COALESCE(EXCLUDED.Edition, Tournament.Edition)`,
      [leagueId, leagueName, String(league.season ?? new Date().getFullYear())]
    );
  } catch {}

  // 2. Venue
  let venueId: number | null = null;
  if (fixture.venue?.name) {
    try {
      const vCheck = await pool.query(
        `SELECT VenueID FROM Venue WHERE Name = $1 LIMIT 1`,
        [fixture.venue.name]
      );
      if (vCheck.rows.length > 0) {
        venueId = vCheck.rows[0].venueid;
      } else {
        const vInsert = await pool.query(
          `INSERT INTO Venue (Name, City, CountryID)
           VALUES ($1, $2, $3)
           RETURNING VenueID`,
          [fixture.venue.name, fixture.venue.city ?? null, countryId]
        );
        venueId = vInsert.rows[0]?.venueid ?? null;
      }
    } catch {}
  }

  // 3. Teams (Home and Away)
  const homeId = Number(teams.home.id);
  const awayId = Number(teams.away.id);
  try {
    await pool.query(
      `INSERT INTO Team (TeamID, Name, Logo, CountryID)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (TeamID) DO UPDATE SET
         Name = EXCLUDED.Name,
         Logo = COALESCE(EXCLUDED.Logo, Team.Logo)`,
      [homeId, teams.home.name, teams.home.logo ?? null, countryId]
    );
    await pool.query(
      `INSERT INTO Team (TeamID, Name, Logo, CountryID)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (TeamID) DO UPDATE SET
         Name = EXCLUDED.Name,
         Logo = COALESCE(EXCLUDED.Logo, Team.Logo)`,
      [awayId, teams.away.name, teams.away.logo ?? null, countryId]
    );
  } catch {}

  // 4. Match record
  const matchDate = fixture.date ? new Date(fixture.date) : new Date();
  await pool.query(
    `INSERT INTO Match (MatchID, TournamentID, HomeTeamID, AwayTeamID, VenueID, MatchDate, HomeGoals, AwayGoals)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (MatchID) DO UPDATE SET
       HomeTeamID = EXCLUDED.HomeTeamID,
       AwayTeamID = EXCLUDED.AwayTeamID,
       HomeGoals = EXCLUDED.HomeGoals,
       AwayGoals = EXCLUDED.AwayGoals,
       MatchDate = EXCLUDED.MatchDate,
       VenueID = COALESCE(EXCLUDED.VenueID, Match.VenueID)`,
    [
      matchId,
      leagueId,
      homeId,
      awayId,
      venueId,
      matchDate,
      goals.home ?? 0,
      goals.away ?? 0,
    ]
  );

  // 5. Referee
  if (fixture.referee) {
    const refName = fixture.referee.split(",")[0].trim();
    if (refName) {
      try {
        let refId: number | null = null;
        const refCheck = await pool.query(
          `SELECT RefereeID FROM Referee WHERE Name = $1 LIMIT 1`,
          [refName]
        );
        if (refCheck.rows.length > 0) {
          refId = refCheck.rows[0].refereeid;
        } else {
          const refInsert = await pool.query(
            `INSERT INTO Referee (Name, NationalityCountryID)
             VALUES ($1, $2)
             RETURNING RefereeID`,
            [refName, countryId]
          );
          refId = refInsert.rows[0]?.refereeid ?? null;
        }

        if (refId) {
          await pool.query(
            `INSERT INTO MatchOfficiating (MatchID, RefereeID, Role, Status)
             VALUES ($1, $2, 'Main', 'Confirmed')
             ON CONFLICT (MatchID, RefereeID, Role) DO NOTHING`,
            [matchId, refId]
          );
        }
      } catch {}
    }
  }

  // 6. Lineups & Coaches
  if (Array.isArray(lineups)) {
    for (const l of lineups) {
      const teamId = Number(l.team?.id);
      if (!teamId) continue;

      // Coach
      if (l.coach?.name) {
        await pool.query(
          `INSERT INTO TeamMatchCoach (MatchID, TeamID, CoachID, CoachName, CoachPhoto)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (MatchID, TeamID) DO UPDATE SET
             CoachName = EXCLUDED.CoachName,
             CoachPhoto = COALESCE(EXCLUDED.CoachPhoto, TeamMatchCoach.CoachPhoto)`,
          [matchId, teamId, l.coach.id ? Number(l.coach.id) : null, l.coach.name, l.coach.photo ?? null]
        );
      }

      // Starters
      for (const entry of l.startXI ?? []) {
        const player = entry.player;
        if (!player?.id) continue;
        const pId = Number(player.id);

        await pool.query(
          `INSERT INTO Player (PlayerID, Name, Position)
           VALUES ($1, $2, $3)
           ON CONFLICT (PlayerID) DO UPDATE SET
             Name = EXCLUDED.Name,
             Position = COALESCE(EXCLUDED.Position, Player.Position)`,
          [pId, player.name, player.pos ?? "M"]
        );

        await pool.query(
          `INSERT INTO Lineup (MatchID, TeamID, PlayerID, Status, Formation, Position, JerseyNumber)
           VALUES ($1, $2, $3, 'Starter', $4, $5, $6)
           ON CONFLICT (MatchID, TeamID, PlayerID) DO UPDATE SET
             Status = EXCLUDED.Status,
             Formation = EXCLUDED.Formation,
             Position = EXCLUDED.Position,
             JerseyNumber = EXCLUDED.JerseyNumber`,
          [matchId, teamId, pId, l.formation ?? "4-3-3", player.pos ?? null, player.number ?? null]
        );
      }

      // Substitutes
      for (const entry of l.substitutes ?? []) {
        const player = entry.player;
        if (!player?.id) continue;
        const pId = Number(player.id);

        await pool.query(
          `INSERT INTO Player (PlayerID, Name, Position)
           VALUES ($1, $2, $3)
           ON CONFLICT (PlayerID) DO UPDATE SET
             Name = EXCLUDED.Name,
             Position = COALESCE(EXCLUDED.Position, Player.Position)`,
          [pId, player.name, player.pos ?? "M"]
        );

        await pool.query(
          `INSERT INTO Lineup (MatchID, TeamID, PlayerID, Status, Formation, Position, JerseyNumber)
           VALUES ($1, $2, $3, 'Sub', $4, $5, $6)
           ON CONFLICT (MatchID, TeamID, PlayerID) DO UPDATE SET
             Status = EXCLUDED.Status,
             Formation = EXCLUDED.Formation,
             Position = EXCLUDED.Position,
             JerseyNumber = EXCLUDED.JerseyNumber`,
          [matchId, teamId, pId, l.formation ?? "4-3-3", player.pos ?? null, player.number ?? null]
        );
      }
    }
  }

  // 7. Events (Timeline)
  if (Array.isArray(events) && events.length > 0) {
    for (const ev of events) {
      const elapsed = ev.time?.elapsed ?? 0;
      const teamId = ev.team?.id ? Number(ev.team.id) : null;
      const playerId = ev.player?.id ? Number(ev.player.id) : null;
      const assistPlayerId = ev.assist?.id ? Number(ev.assist.id) : null;
      const typeStr = (ev.type || "").toLowerCase();

      let eventType: "Goal" | "Card" | "Substitution" | "Foul" = "Foul";
      if (typeStr.includes("goal")) eventType = "Goal";
      else if (typeStr.includes("card")) eventType = "Card";
      else if (typeStr.includes("sub")) eventType = "Substitution";

      // Ensure main player exists
      if (playerId && ev.player?.name) {
        await pool.query(
          `INSERT INTO Player (PlayerID, Name) VALUES ($1, $2)
           ON CONFLICT (PlayerID) DO UPDATE SET Name = EXCLUDED.Name`,
          [playerId, ev.player.name]
        );
      }

      // Ensure assist player exists
      if (assistPlayerId && ev.assist?.name) {
        await pool.query(
          `INSERT INTO Player (PlayerID, Name) VALUES ($1, $2)
           ON CONFLICT (PlayerID) DO UPDATE SET Name = EXCLUDED.Name`,
          [assistPlayerId, ev.assist.name]
        );
      }

      // Check duplicate
      const existRes = await pool.query(
        `SELECT EventID FROM Event
         WHERE MatchID = $1 AND EventTime IS NOT DISTINCT FROM $2
           AND EventType = $3 AND PlayerID IS NOT DISTINCT FROM $4
         LIMIT 1`,
        [matchId, elapsed, eventType, playerId]
      );

      let eventId: number;
      if (existRes.rows.length > 0) {
        eventId = existRes.rows[0].eventid;
      } else {
        const insRes = await pool.query(
          `INSERT INTO Event (MatchID, PlayerID, TeamID, EventTime, EventType)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING EventID`,
          [matchId, playerId, teamId, elapsed, eventType]
        );
        eventId = insRes.rows[0].eventid;
      }

      // Child table insertion
      if (eventType === "Goal") {
        await pool.query(
          `INSERT INTO Goal (EventID, AssistPlayerID, GoalType)
           VALUES ($1, $2, $3)
           ON CONFLICT (EventID) DO UPDATE SET
             AssistPlayerID = EXCLUDED.AssistPlayerID,
             GoalType = EXCLUDED.GoalType`,
          [eventId, assistPlayerId, ev.detail ?? "Normal Goal"]
        );
      } else if (eventType === "Card") {
        const cardType = (ev.detail || "").toLowerCase().includes("red") ? "Red" : "Yellow";
        await pool.query(
          `INSERT INTO Card (EventID, CardType)
           VALUES ($1, $2)
           ON CONFLICT (EventID) DO UPDATE SET CardType = EXCLUDED.CardType`,
          [eventId, cardType]
        );
      } else if (eventType === "Substitution" && assistPlayerId) {
        await pool.query(
          `INSERT INTO Substitution (EventID, InPlayerID)
           VALUES ($1, $2)
           ON CONFLICT (EventID) DO UPDATE SET InPlayerID = EXCLUDED.InPlayerID`,
          [eventId, assistPlayerId]
        );
      }
    }
  }
}

/**
 * Step 3: Pull and show the data to the user DIRECTLY from the database
 */
export async function pullMatchDetailsFromDatabase(matchId: number) {
  // 1. Match header and venue from DB
  const matchRes = await pool.query(
    `
    SELECT
      m.MatchID,
      m.MatchDate,
      m.HomeGoals,
      m.AwayGoals,
      t.TournamentID,
      t.Name AS TournamentName,
      home.TeamID AS HomeTeamID,
      home.Name AS HomeTeamName,
      home.Logo AS HomeTeamLogo,
      away.TeamID AS AwayTeamID,
      away.Name AS AwayTeamName,
      away.Logo AS AwayTeamLogo,
      venue.Name AS VenueName,
      venue.City AS VenueCity,
      venueCountry.Name AS VenueCountry,
      ref.Name AS RefereeName
    FROM Match m
    JOIN Tournament t ON m.TournamentID = t.TournamentID
    JOIN Team home ON m.HomeTeamID = home.TeamID
    JOIN Team away ON m.AwayTeamID = away.TeamID
    LEFT JOIN Venue venue ON m.VenueID = venue.VenueID
    LEFT JOIN Country venueCountry ON venue.CountryID = venueCountry.CountryID
    LEFT JOIN MatchOfficiating mo ON m.MatchID = mo.MatchID
    LEFT JOIN Referee ref ON mo.RefereeID = ref.RefereeID
    WHERE m.MatchID = $1
    LIMIT 1
    `,
    [matchId]
  );

  if (matchRes.rows.length === 0) {
    return null;
  }

  const row = matchRes.rows[0];
  const date = new Date(row.matchdate);
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  let status: "LIVE" | "FT" | "UPCOMING" = "UPCOMING";
  let elapsed: number | null = null;

  if (mins >= 0 && mins < 120) {
    status = "LIVE";
    elapsed = Math.min(mins, 90);
  } else if (mins >= 120) {
    status = "FT";
    elapsed = 90;
  }

  // 2. Lineups and Coaches from DB
  const lineupsRes = await pool.query(
    `
    SELECT
      l.TeamID,
      l.PlayerID,
      l.Status,
      l.Formation,
      l.Position,
      l.JerseyNumber,
      p.Name AS PlayerName,
      p.Photo AS PlayerPhoto,
      tmc.CoachName,
      tmc.CoachPhoto
    FROM Lineup l
    JOIN Player p ON l.PlayerID = p.PlayerID
    LEFT JOIN TeamMatchCoach tmc ON l.MatchID = tmc.MatchID AND l.TeamID = tmc.TeamID
    WHERE l.MatchID = $1
    ORDER BY l.TeamID, l.Status DESC,
      CASE
        WHEN UPPER(COALESCE(l.Position, p.Position, '')) LIKE 'G%' THEN 1
        WHEN UPPER(COALESCE(l.Position, p.Position, '')) LIKE 'D%' THEN 2
        WHEN UPPER(COALESCE(l.Position, p.Position, '')) LIKE 'M%' THEN 3
        WHEN UPPER(COALESCE(l.Position, p.Position, '')) LIKE 'F%' OR UPPER(COALESCE(l.Position, p.Position, '')) LIKE 'A%' THEN 4
        ELSE 5
      END ASC,
      l.JerseyNumber ASC
    `,
    [matchId]
  );

  const homeTeamId = Number(row.hometeamid);
  const awayTeamId = Number(row.awayteamid);

  const buildTeamLineup = (teamId: number, teamName: string, teamLogo: string | null) => {
    const teamRows = lineupsRes.rows.filter((r) => Number(r.teamid) === teamId);
    const starters = teamRows.filter((r) => r.status === "Starter");
    const subs = teamRows.filter((r) => r.status === "Sub");
    const firstRow = teamRows[0];

    const mappedStarters = starters.map((s) => ({
      id: Number(s.playerid),
      name: s.playername,
      photo: s.playerphoto ?? null,
      number: s.jerseynumber ? Number(s.jerseynumber) : 10,
      position: s.position ?? "M",
      grid: null,
      rating: null,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
    }));

    const mappedSubs = subs.map((s) => ({
      id: Number(s.playerid),
      name: s.playername,
      photo: s.playerphoto ?? null,
      number: s.jerseynumber ? Number(s.jerseynumber) : 12,
      position: s.position ?? "M",
      grid: null,
      rating: null,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
    }));

    return {
      team: { id: teamId, name: teamName, logo: teamLogo },
      formation: firstRow?.formation ?? "4-3-3",
      coach: {
        name: firstRow?.coachname ?? `${teamName} Coach`,
        photo: firstRow?.coachphoto ?? null,
      },
      starters: mappedStarters,
      substitutes: mappedSubs,
      startXI: starters.map((s) => ({
        player: {
          id: Number(s.playerid),
          name: s.playername,
          number: s.jerseynumber ? Number(s.jerseynumber) : 10,
          pos: s.position ?? "M",
          photo: s.playerphoto,
        },
      })),
    };
  };

  const lineups = [
    buildTeamLineup(homeTeamId, row.hometeamname, row.hometeamlogo),
    buildTeamLineup(awayTeamId, row.awayteamname, row.awayteamlogo),
  ];

  // 3. Events Timeline from DB
  const eventsRes = await pool.query(
    `
    SELECT
      e.EventID,
      e.EventTime,
      e.EventType,
      e.TeamID,
      t.Name AS TeamName,
      e.PlayerID,
      p.Name AS PlayerName,
      g.GoalType,
      ap.Name AS AssistPlayerName,
      c.CardType,
      sub.InPlayerID,
      subp.Name AS InPlayerName
    FROM Event e
    LEFT JOIN Team t ON e.TeamID = t.TeamID
    LEFT JOIN Player p ON e.PlayerID = p.PlayerID
    LEFT JOIN Goal g ON e.EventID = g.EventID
    LEFT JOIN Player ap ON g.AssistPlayerID = ap.PlayerID
    LEFT JOIN Card c ON e.EventID = c.EventID
    LEFT JOIN Substitution sub ON e.EventID = sub.EventID
    LEFT JOIN Player subp ON sub.InPlayerID = subp.PlayerID
    WHERE e.MatchID = $1
    ORDER BY e.EventTime ASC
    `,
    [matchId]
  );

  const events = eventsRes.rows.map((ev) => ({
    eventid: Number(ev.eventid),
    eventtime: ev.eventtime ? Number(ev.eventtime) : null,
    eventtype: ev.eventtype,
    teamid: ev.teamid ? Number(ev.teamid) : null,
    teamname: ev.teamname ?? "",
    playerid: ev.playerid ? Number(ev.playerid) : null,
    playername: ev.playername ?? "",
    substitutionplayerid: ev.inplayerid ? Number(ev.inplayerid) : null,
    assistplayername: ev.inplayername ?? ev.assistplayername ?? null,
    goaltype: ev.goaltype ?? null,
    cardtype: ev.cardtype ?? null,
  }));

  return {
    fixture: {
      id: Number(row.matchid),
      date: row.matchdate,
      status: { short: status, elapsed },
      venue: row.venuename
        ? {
            name: row.venuename,
            city: row.venuecity ?? "",
            country: row.venuecountry ?? "",
          }
        : null,
      referees: row.refereename ? [row.refereename] : [],
    },
    league: {
      id: Number(row.tournamentid),
      name: row.tournamentname,
      country: row.venuecountry ?? "International",
    },
    teams: {
      home: {
        id: homeTeamId,
        name: row.hometeamname,
        logo: row.hometeamlogo,
      },
      away: {
        id: awayTeamId,
        name: row.awayteamname,
        logo: row.awayteamlogo,
      },
    },
    goals: {
      home: row.homegoals !== null ? Number(row.homegoals) : null,
      away: row.awaygoals !== null ? Number(row.awaygoals) : null,
    },
    lineups,
    events,
  };
}

// ============================================================================
// Core Execution Pipeline (Triggered on User Click of a Match)
// Strict Flow:
// 1. Call API-Football for details (Fallback to mock data on failure)
// 2. Put and fill up the database with this data
// 3. Pull and show the data to the user DIRECTLY from the database
// ============================================================================
export async function executeMatchDetailPipeline(matchId: number) {
  let rawData: DetailedMockMatch | null = null;
  let dataSource: "API-Football" | "Mock Fallback" = "API-Football";

  // Step 1: Call API-Football (with automatic fallback to mock data on failure)
  try {
    const [fixtureItems, lineupsItems, eventsItems] = await Promise.all([
      callApiFootball(`/fixtures?id=${matchId}`),
      callApiFootball(`/fixtures/lineups?fixture=${matchId}`),
      callApiFootball(`/fixtures/events?fixture=${matchId}`),
    ]);

    if (Array.isArray(fixtureItems) && fixtureItems.length > 0) {
      const item = fixtureItems[0];
      rawData = {
        fixture: {
          id: Number(item.fixture.id),
          date: item.fixture.date,
          venue: item.fixture.venue
            ? {
                name: item.fixture.venue.name,
                city: item.fixture.venue.city,
                country: item.fixture.venue.country,
              }
            : null,
          referee: item.fixture.referee,
          status: {
            short: item.fixture.status.short,
            elapsed: item.fixture.status.elapsed,
          },
        },
        league: {
          id: Number(item.league.id),
          name: item.league.name,
          country: item.league.country,
          season: item.league.season,
        },
        teams: {
          home: {
            id: Number(item.teams.home.id),
            name: item.teams.home.name,
            logo: item.teams.home.logo,
          },
          away: {
            id: Number(item.teams.away.id),
            name: item.teams.away.name,
            logo: item.teams.away.logo,
          },
        },
        goals: {
          home: item.goals.home,
          away: item.goals.away,
        },
        lineups: Array.isArray(lineupsItems) ? lineupsItems : [],
        events: Array.isArray(eventsItems) ? eventsItems : [],
      };
    } else {
      throw new Error(`API-Football returned no fixture items for #${matchId}`);
    }
  } catch (error) {
    console.warn(
      `[Pipeline Step 1] API-Football call failed for match #${matchId} (${(error as Error).message}). Engaging backup mock data fallback.`
    );
    dataSource = "Mock Fallback";
    rawData = await resolveMockDetailedMatch(matchId);
  }

  // Step 2: Put and fill up the database with this data
  await persistMatchDetailsToDatabase(matchId, rawData);

  // Step 3: Pull and show the data to the user DIRECTLY from the database
  const dbData = await pullMatchDetailsFromDatabase(matchId);

  if (!dbData) {
    throw new Error(`Failed to retrieve persisted match #${matchId} from database`);
  }

  return {
    ...dbData,
    _pipelineMetadata: {
      sequence: "1. Fetch API/Mock -> 2. Store to DB -> 3. Pull from DB -> 4. Send to User",
      source: dataSource,
      databaseVerified: true,
      retrievedDirectlyFromDatabase: true,
      timestamp: new Date().toISOString(),
    },
  };
}
