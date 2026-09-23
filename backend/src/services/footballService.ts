import { pool } from "../db";

// ── League priority (lower = bigger / shown first) ───────────────────────────
const LEAGUE_PRIORITY: Record<string, number> = {
  "Premier League": 1,
  "Champions League": 2,
  "UEFA Champions League": 2,
  "La Liga": 3,
  "World Cup": 4,
  "Bundesliga": 5,
  "Ligue 1": 6,
  "Serie A": 7,
  "Europa League": 8,
  "UEFA Europa League": 8,
  "Copa del Rey": 9,
  "Copa America": 10,
  "UEFA Euro": 11,
  "Nations League": 12,
  "Africa Cup": 13,
  "Asian Cup": 14,
  "Gold Cup": 15,
  "CONCACAF": 16,
  "Olympic": 17,
  "Qualification": 18,
  "Friendlies": 19,
  "Eredivisie": 20,
  "Primeira Liga": 21,
  "Scottish Premiership": 22,
  "Süper Lig": 23,
  "MLS": 24,
};

function leaguePriority(name: string, country = ""): number {
  if (name.toLowerCase().includes("premier league") && !country.toLowerCase().includes("england")) {
    return 99;
  }

  if (LEAGUE_PRIORITY[name] !== undefined) return LEAGUE_PRIORITY[name];
  for (const [league, priority] of Object.entries(LEAGUE_PRIORITY)) {
    if (name.toLowerCase().includes(league.toLowerCase())) return priority;
  }
  return 99;
}

function sortByLeague<T extends { league: { name: string; country?: string | null } }>(items: T[]): T[] {
  return [...items].sort((left, right) =>
    leaguePriority(left.league.name, left.league.country ?? "") -
    leaguePriority(right.league.name, right.league.country ?? "")
  );
}

// ── National vs Club detection ────────────────────────────────────────────────
const NATIONAL_KEYWORDS = [
  "World Cup", "Copa America", "Euro", "Nations League",
  "Africa Cup", "AFCON", "Gold Cup", "CONCACAF", "Asian Cup",
  "Olympic", "Friendlies", "Qualification",
];

export function isNationalLeague(name: string): boolean {
  return NATIONAL_KEYWORDS.some(k => name.toLowerCase().includes(k.toLowerCase()));
}

// ── API-Football helpers ──────────────────────────────────────────────────────
const API_BASE = "https://v3.football.api-sports.io";

function apiKey(): string {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key || key === "your-api-football-key") throw new Error("API key not configured");
  return key;
}

function mapApiItem(item: any) {
  return {
    fixture: {
      id: item.fixture.id,
      date: item.fixture.date,
      venue: item.fixture.venue
        ? {
            name: item.fixture.venue.name,
            city: item.fixture.venue.city,
            country: item.fixture.venue.country,
          }
        : null,
      status: { short: item.fixture.status.short, elapsed: item.fixture.status.elapsed },
    },
    league: { id: item.league.id, name: item.league.name, country: item.league.country },
    teams: {
      home: { id: item.teams.home.id, name: item.teams.home.name, logo: item.teams.home.logo },
      away: { id: item.teams.away.id, name: item.teams.away.name, logo: item.teams.away.logo },
    },
    goals: { home: item.goals.home, away: item.goals.away },
  };
}

async function apiFetch(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "x-apisports-key": apiKey() },
  });
  if (!res.ok) throw new Error(`API-Football ${path} → ${res.status}`);
  return ((await res.json()) as { response: any[] }).response;
}

async function fetchByDate(date: string) {
  const items = await apiFetch(`/fixtures?date=${date}`);
  return items.map(mapApiItem);
}
export async function fetchEvents(fixtureId: number) {
  return apiFetch(`/fixtures/events?fixture=${fixtureId}`);
}

export async function fetchLineups(fixtureId: number) {
  return apiFetch(`/fixtures/lineups?fixture=${fixtureId}`);
}

export async function fetchPlayerStats(fixtureId: number) {
  return apiFetch(`/fixtures/players?fixture=${fixtureId}`);
}

async function fetchById(id: number) {
  const items = await apiFetch(`/fixtures?id=${id}`);
  return items.length > 0 ? mapApiItem(items[0]) : null;
}

// ── DB helpers ────────────────────────────────────────────────────────────────
const BASE_QUERY = `
  SELECT m.MatchID, m.HomeGoals, m.AwayGoals, m.MatchDate,
    venue.Name AS VenueName, venue.City AS VenueCity,
    venueCountry.Name AS VenueCountry,
    t.TournamentID, t.Name AS TournamentName,
    home.TeamID AS HomeTeamID, home.Name AS HomeTeamName,
    away.TeamID AS AwayTeamID, away.Name AS AwayTeamName,
    home.Logo AS HomeTeamLogo, away.Logo AS AwayTeamLogo
  FROM Match m
  JOIN Tournament t ON m.TournamentID = t.TournamentID
  JOIN Team home ON m.HomeTeamID = home.TeamID
  JOIN Team away ON m.AwayTeamID = away.TeamID
  LEFT JOIN Venue venue ON m.VenueID = venue.VenueID
  LEFT JOIN Country venueCountry ON venue.CountryID = venueCountry.CountryID
`;

function mapDbRow(row: any) {
  const date = new Date(row.matchdate);
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  let status = "UPCOMING", elapsed: number | null = null;
  if (mins >= 0 && mins < 120) { status = "LIVE"; elapsed = Math.min(mins, 90); }
  else if (mins >= 120) { status = "FT"; elapsed = 90; }
  return {
    fixture: { id: row.matchid, date: row.matchdate, status: { short: status, elapsed } },
    venue: row.venuename
      ? { name: row.venuename, city: row.venuecity, country: row.venuecountry }
      : null,
    league: { id: row.tournamentid, name: row.tournamentname, country: "International" },
    teams: {
      home: { id: row.hometeamid, name: row.hometeamname, logo: row.hometeamlogo },
      away: { id: row.awayteamid, name: row.awayteamname, logo: row.awayteamlogo },
    },
    goals: { home: row.homegoals, away: row.awaygoals },
  };
}

// ── Hardcoded fallback ────────────────────────────────────────────────────────
const FALLBACK = [
  { fixture: { id: 991, status: { short: "LIVE", elapsed: 45 } }, league: { id: 4, name: "UEFA Champions League", country: "International" }, teams: { home: { id: 1, name: "Arsenal", logo: null }, away: { id: 2, name: "Real Madrid", logo: null } }, goals: { home: 1, away: 0 } },
  { fixture: { id: 992, status: { short: "UPCOMING", elapsed: null } }, league: { id: 4, name: "UEFA Champions League", country: "International" }, teams: { home: { id: 3, name: "Bayern Munich", logo: null }, away: { id: 4, name: "PSG", logo: null } }, goals: { home: 0, away: 0 } },
  { fixture: { id: 993, status: { short: "FT", elapsed: 90 } }, league: { id: 7, name: "Premier League", country: "England" }, teams: { home: { id: 5, name: "Manchester City", logo: null }, away: { id: 6, name: "Liverpool", logo: null } }, goals: { home: 2, away: 1 } },
];

const todayStr = () => new Date().toISOString().split("T")[0];

// ── Public service functions ──────────────────────────────────────────────────

export async function getFixtures() {
  const combined: any[] = [];
  
  // 1. Local DB (Prioritize SQL data as user requested)
  try {
    const { rows } = await pool.query(`${BASE_QUERY} ORDER BY m.MatchDate DESC`);
    if (rows.length > 0) {
      console.log(`Serving ${rows.length} fixtures from DB`);
      combined.push(...rows.map(mapDbRow));
    }
  } catch (e) { console.warn("DB getFixtures:", (e as Error).message); }

  // 2. API-Football
  try {
    const items = await fetchByDate(todayStr());
    if (items.length > 0) {
      console.log(`Serving ${items.length} fixtures from API-Football`);
      combined.push(...sortByLeague(items));
    }
  } catch (e) { console.warn("API getFixtures:", (e as Error).message); }

  if (combined.length > 0) return { response: combined };

  // 3. Hardcoded fallback
  console.warn("Using hardcoded fallback fixtures");
  return { response: FALLBACK };
}

/** Top matches sorted by league tier (biggest leagues first). */
export async function getPopularFixtures() {
  const combined: any[] = [];
  
  // 1. Local DB matches first (so seeded data is accessible)
  try {
    const { rows } = await pool.query(`${BASE_QUERY} ORDER BY m.MatchDate DESC LIMIT 4`);
    if (rows.length > 0) {
      combined.push(...rows.map(mapDbRow));
    }
  } catch (e) { console.warn("DB getPopularFixtures:", (e as Error).message); }

  // 2. API Matches
  try {
    const items = await fetchByDate(todayStr());
    combined.push(...sortByLeague(items).slice(0, 8 - combined.length));
  } catch (e) {
    console.warn("API getPopularFixtures:", (e as Error).message);
  }

  if (combined.length > 0) return { response: combined };
  return { response: FALLBACK };
}

/** Matches involving teams the user follows (requires DB). */
export async function getFavouriteFixtures(userId: number) {
  try {
    const { rows: teamRows } = await pool.query(
      `SELECT TeamID FROM UserFollowsTeam WHERE UserID = $1`, [userId]
    );
    const teamIds = new Set(teamRows.map((r: any) => Number(r.teamid)));

    const { rows: playerRows } = await pool.query(
      `SELECT ufp.PlayerID FROM UserFollowsPlayer ufp WHERE ufp.UserID = $1`, [userId]
    );
    const playerIds = new Set(playerRows.map((r: any) => Number(r.playerid)));

    if (teamIds.size === 0 && playerIds.size === 0) return { response: [] };

    // Get today's fixtures, filter by followed teams
    const items = await fetchByDate(todayStr());

    // Prioritise: team matches first, then player matches
    const teamMatches = items.filter(f =>
      teamIds.has(Number(f.teams.home.id)) || teamIds.has(Number(f.teams.away.id))
    );
    const teamMatchIds = new Set(teamMatches.map(f => f.fixture.id));
    const otherMatches = items.filter(f => !teamMatchIds.has(f.fixture.id));

    return { response: [...teamMatches, ...otherMatches].slice(0, 10) };
  } catch (e) {
    console.warn("getFavouriteFixtures:", (e as Error).message);
    return { response: [] };
  }
}

export async function getMatchById(id: number) {
  // 1. Local DB (primary since user wants SQL data)
  try {
    const { rows } = await pool.query(`${BASE_QUERY} WHERE m.MatchID = $1`, [id]);
    if (rows.length > 0) {
      const matchObj = mapDbRow(rows[0]) as ReturnType<typeof mapDbRow> & { referees?: string[] };
      
      // Fetch referees
      const refResult = await pool.query(
        `SELECT r.Name FROM MatchOfficiating mo JOIN Referee r ON mo.RefereeID = r.RefereeID WHERE mo.MatchID = $1`,
        [id]
      );
      matchObj.referees = refResult.rows.map((r: any) => r.name);
      return matchObj;
    }
  } catch (e) { console.warn("DB getMatchById:", (e as Error).message); }

  // 2. API-Football
  try {
    const f = await fetchById(id);
    if (f) return f;
  } catch (e) { console.warn("API getMatchById:", (e as Error).message); }

  // 3. Fallback
  return FALLBACK.find(m => m.fixture.id === id) ?? null;
}
export async function getMatchEvents(fixtureId: number) {
  // The timeline belongs to the selected fixture, so fetch it only from the
  // detail request instead of depending on a pre-synced local match row.
  try {
    const apiEvents = await fetchEvents(fixtureId)

    return apiEvents
      .map((event: any, index: number) => {
        const type = event.type?.toLowerCase()
        let eventType: "Goal" | "Card" | "Foul" | "Substitution" | null = null

        if (type === "goal") eventType = "Goal"
        else if (type === "card") eventType = "Card"
        else if (type === "foul") eventType = "Foul"
        else if (type === "subst") eventType = "Substitution"

        if (!eventType) return null

        const detail = event.detail ?? ""
        const cardDetail = detail.toLowerCase()

        return {
          eventid: event.id ?? `${fixtureId}-${index}`,
          playerid: event.player?.id ?? null,
          substitutionplayerid: event.assist?.id ?? null,
          eventtime: event.time?.elapsed ?? null,
          eventtype: eventType,
          playername: event.player?.name ?? null,
          teamname: event.team?.name ?? "",
          goaltype: eventType === "Goal" ? detail || null : null,
          assistplayername: event.assist?.name ?? null,
          cardtype:
            eventType === "Card"
              ? cardDetail.includes("red")
                ? "Red"
                : cardDetail.includes("yellow")
                  ? "Yellow"
                  : null
              : null,
        }
      })
      .filter((event): event is NonNullable<typeof event> => event !== null)
  } catch (error) {
    console.warn("API getMatchEvents:", (error as Error).message)
  }

  // Keep locally synced events available when API-Football is unavailable.
  const { rows } = await pool.query(
    `
    SELECT
      e.EventID,
      e.EventTime,
      e.EventType,
      p.Name AS PlayerName,
      t.Name AS TeamName,
      g.GoalType,
      ap.Name AS AssistPlayerName,
      c.CardType
    FROM Event e
    JOIN Match m ON e.MatchID = m.MatchID
    LEFT JOIN Team t ON e.TeamID = t.TeamID
    LEFT JOIN Player p ON e.PlayerID = p.PlayerID
    LEFT JOIN Goal g ON e.EventID = g.EventID
    LEFT JOIN Player ap ON ap.PlayerID = g.AssistPlayerID
    LEFT JOIN Card c ON e.EventID = c.EventID
    WHERE m.ApiFixtureID = $1
    ORDER BY e.EventTime ASC
    `,
    [fixtureId]
  )

  return rows.map((row: any) => ({
    eventid: row.eventid,
    eventtime: row.eventtime,
    eventtype: row.eventtype,
    playername: row.playername,
    teamname: row.teamname ?? "",
    goaltype: row.goaltype,
    assistplayername: row.assistplayername,
    cardtype: row.cardtype,
  }))
}

export async function getMatchLineups(fixtureId: number) {
  try {
    // Check if match exists and get teams
    const matchRes = await pool.query(
      `SELECT HomeTeamID, AwayTeamID FROM Match WHERE MatchID = $1`,
      [fixtureId]
    );

    if (matchRes.rows.length === 0) {
      // Fallback to API if match isn't in our local DB
      const [lineups, playerStats] = await Promise.all([
        fetchLineups(fixtureId),
        fetchPlayerStats(fixtureId).catch(() => []),
      ]);

      const statsByPlayer = new Map<number, any>();
      for (const team of playerStats) {
        for (const entry of team.players ?? []) {
          statsByPlayer.set(Number(entry.player?.id), entry);
        }
      }

      const mapPlayer = (entry: any) => {
        const player = entry.player ?? {};
        const stats = statsByPlayer.get(Number(player.id));
        const statistics = stats?.statistics?.[0];

        return {
          id: Number(player.id),
          name: player.name ?? "Unknown player",
          photo: stats?.player?.photo ?? player.photo ?? null,
          number: player.number ?? null,
          position: player.pos ?? statistics?.games?.position ?? null,
          grid: player.grid ?? null,
          rating: statistics?.games?.rating ?? null,
          goals: statistics?.goals?.total ?? 0,
          assists: statistics?.goals?.assists ?? 0,
          yellowCards: statistics?.cards?.yellow ?? 0,
          redCards: statistics?.cards?.red ?? 0,
        };
      };

      return lineups.map((lineup: any) => ({
        team: {
          id: Number(lineup.team?.id),
          name: lineup.team?.name ?? "",
          logo: lineup.team?.logo ?? null,
        },
        formation: lineup.formation ?? null,
        coach: {
          name: lineup.coach?.name ?? null,
          photo: lineup.coach?.photo ?? null,
        },
        starters: (lineup.startXI ?? []).map(mapPlayer),
        substitutes: (lineup.substitutes ?? []).map(mapPlayer),
      }));
    }
    const matchRow = matchRes.rows[0];

    const teamsToFetch = [matchRow.hometeamid, matchRow.awayteamid];
    const results = [];

    for (const teamId of teamsToFetch) {
      // Get Team Info
      const teamRes = await pool.query(
        `SELECT Name, Logo FROM Team WHERE TeamID = $1`,
        [teamId]
      );
      if (teamRes.rows.length === 0) continue;
      const teamRow = teamRes.rows[0];

      // Get Lineup Players
      const lineupRes = await pool.query(
        `
        SELECT l.Status, p.PlayerID, p.Name
        FROM Lineup l
        JOIN Player p ON l.PlayerID = p.PlayerID
        WHERE l.MatchID = $1 AND l.TeamID = $2
        `,
        [fixtureId, teamId]
      );

      const starters: any[] = [];
      const substitutes: any[] = [];

      let starterCount = 0;
      lineupRes.rows.forEach((row: any) => {
        // Deterministically mock positions if they don't exist in DB so players spread across the pitch
        const mockPositions = ["G", "D", "D", "D", "D", "M", "M", "M", "F", "F", "F"];
        
        let pos = "M"; // default
        if (row.status === 'Starter') {
          pos = mockPositions[starterCount % mockPositions.length];
        }

        const playerObj = {
          id: row.playerid,
          name: row.name,
          photo: null,
          number: (row.playerid % 99) + 1,
          position: pos,
          grid: null,
          rating: (Math.random() * 3 + 6).toFixed(1), // mock rating between 6.0 and 9.0
          goals: 0,
          assists: 0,
          yellowCards: 0,
          redCards: 0,
        };

        if (row.status === 'Starter') {
          starters.push(playerObj);
          starterCount++;
        } else {
          substitutes.push(playerObj);
        }
      });

      results.push({
        team: {
          id: teamId,
          name: teamRow.name,
          logo: teamRow.logo,
        },
        formation: "4-3-3", // Mock formation for now
        coach: {
          name: "Manager of " + teamRow.name,
          photo: null,
        },
        starters,
        substitutes,
      });
    }

    return results;

  } catch (error) {
    console.warn("DB/API getMatchLineups:", (error as Error).message);
    return [];
  }
}

export async function syncMatchEvents(fixtureId: number) {
  const apiResult = await fetchEvents(fixtureId);

  const events = Array.isArray(apiResult) ? apiResult : [];

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
    return;
  }

  const matchId = matchResult.rows[0].matchid;

  for (const event of events) {
    const elapsed = event.time?.elapsed ?? null;
    const teamApiId = event.team?.id ?? null;
    const playerApiId = event.player?.id ?? null;
    const assistApiId = event.assist?.id ?? null;

    let eventType: "Goal" | "Card" | "Foul" | null = null;

    const type = event.type?.toLowerCase();

    if (type === "goal") eventType = "Goal";
    else if (type === "card") eventType = "Card";
    else if (type === "foul") eventType = "Foul";

    if (!eventType) continue;

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
        [eventId, assistPlayerId, event.detail ?? null]
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
          INSERT INTO Card (EventID, CardType)
          VALUES ($1, $2)
          ON CONFLICT (EventID)
          DO UPDATE SET CardType = EXCLUDED.CardType
          `,
          [eventId, cardType]
        );
      }
    }

    if (eventType === "Foul") {
      await pool.query(
        `
        INSERT INTO Foul (EventID, FouledPlayerID)
        VALUES ($1, $2)
        ON CONFLICT (EventID)
        DO UPDATE SET FouledPlayerID = EXCLUDED.FouledPlayerID
        `,
        [eventId, null]
      );
    }
  }
}
/** Team catalog for signup (national + club, sourced from today's fixtures). */
export async function getTeamsCatalog() {
  const teamMap = new Map<number, { id: number; name: string; logo: string | null; type: "national" | "club" }>();

  try {
    const items = await fetchByDate(todayStr());
    for (const f of items) {
      const type = isNationalLeague(f.league.name) ? "national" : "club";
      if (!teamMap.has(f.teams.home.id)) teamMap.set(f.teams.home.id, { ...f.teams.home, type });
      if (!teamMap.has(f.teams.away.id)) teamMap.set(f.teams.away.id, { ...f.teams.away, type });
    }
  } catch (e) { console.warn("API getTeamsCatalog:", (e as Error).message); }

  // Also merge from DB
  try {
    const { rows } = await pool.query(
      `SELECT TeamID AS id, Name AS name, Logo AS logo, COALESCE(Type, 'club') AS type FROM Team ORDER BY Name`
    );
    for (const row of rows) { if (!teamMap.has(row.id)) teamMap.set(row.id, row); }
  } catch {}

  const all = [...teamMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { national: all.filter(t => t.type === "national"), club: all.filter(t => t.type === "club") };
}

/** Player catalog for signup (from DB only). */
export async function getPlayersCatalog() {
  try {
    const { rows } = await pool.query(`SELECT PlayerID AS id, Name AS name FROM Player ORDER BY Name`);
    return { players: rows as { id: number; name: string }[] };
  } catch {
    return { players: [] };
  }
}
