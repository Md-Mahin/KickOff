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
  return items.length > 0 ? items[0] : null;
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

  const venueObj = row.venuename
    ? {
        name: row.venuename,
        city: row.venuecity ?? null,
        country: row.venuecountry ?? null,
      }
    : null;

  return {
    fixture: {
      id: row.matchid,
      date: row.matchdate,
      status: { short: status, elapsed },
      venue: venueObj,
    },
    venue: venueObj,
    league: { id: row.tournamentid, name: row.tournamentname, country: "International" },
    teams: {
      home: { id: row.hometeamid, name: row.hometeamname, logo: row.hometeamlogo },
      away: { id: row.awayteamid, name: row.awayteamname, logo: row.awayteamlogo },
    },
    goals: { home: row.homegoals, away: row.awaygoals },
  };
}

// ── DB Sync helpers (Populate DB from API) ───────────────────────────────────

export async function syncFixtureToDb(item: any) {
  if (!item?.fixture?.id || !item?.teams?.home?.id || !item?.teams?.away?.id) return;
  try {
    const fixtureId = Number(item.fixture.id);
    const league = item.league ?? { id: 1, name: "International", season: "2024" };
    const home = item.teams.home;
    const away = item.teams.away;
    const venue = item.fixture.venue;
    const goals = item.goals ?? { home: 0, away: 0 };
    const refereeStr = item.fixture.referee;

    // 1. Country (if provided)
    let countryId: number | null = null;
    if (league.country) {
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

    // 2. Tournament
    try {
      await pool.query(
        `INSERT INTO Tournament (TournamentID, Name, Type, Edition)
         VALUES ($1, $2, 'Club', $3)
         ON CONFLICT (TournamentID) DO UPDATE SET
           Name = EXCLUDED.Name,
           Edition = COALESCE(EXCLUDED.Edition, Tournament.Edition)`,
        [league.id, league.name, String(league.season ?? new Date().getFullYear())]
      );
    } catch {}

    // 3. Venue
    let venueId: number | null = null;
    if (venue?.name) {
      try {
        const vCheck = await pool.query(
          `SELECT VenueID FROM Venue WHERE Name = $1 LIMIT 1`,
          [venue.name]
        );
        if (vCheck.rows.length > 0) {
          venueId = vCheck.rows[0].venueid;
        } else {
          const vInsert = await pool.query(
            `INSERT INTO Venue (Name, City, CountryID)
             VALUES ($1, $2, $3)
             RETURNING VenueID`,
            [venue.name, venue.city ?? null, countryId]
          );
          venueId = vInsert.rows[0]?.venueid ?? null;
        }
      } catch {}
    }

    // 4. Teams (Home and Away)
    try {
      await pool.query(
        `INSERT INTO Team (TeamID, Name, Logo, CountryID)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (TeamID) DO UPDATE SET
           Name = EXCLUDED.Name,
           Logo = COALESCE(EXCLUDED.Logo, Team.Logo)`,
        [home.id, home.name, home.logo ?? null, countryId]
      );
      await pool.query(
        `INSERT INTO Team (TeamID, Name, Logo, CountryID)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (TeamID) DO UPDATE SET
           Name = EXCLUDED.Name,
           Logo = COALESCE(EXCLUDED.Logo, Team.Logo)`,
        [away.id, away.name, away.logo ?? null, countryId]
      );
    } catch {}

    // 5. Match
    const matchDate = item.fixture.date ? new Date(item.fixture.date) : new Date();
    try {
      await pool.query(
        `INSERT INTO Match (MatchID, TournamentID, HomeTeamID, AwayTeamID, VenueID, MatchDate, HomeGoals, AwayGoals)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (MatchID) DO UPDATE SET
           HomeGoals = EXCLUDED.HomeGoals,
           AwayGoals = EXCLUDED.AwayGoals,
           MatchDate = EXCLUDED.MatchDate,
           VenueID = COALESCE(EXCLUDED.VenueID, Match.VenueID)`,
        [
          fixtureId,
          league.id,
          home.id,
          away.id,
          venueId,
          matchDate,
          goals.home ?? 0,
          goals.away ?? 0,
        ]
      );
    } catch (mErr) {
      console.warn("sync Match error:", (mErr as Error).message);
    }

    // 6. Referee & MatchOfficiating
    if (refereeStr && typeof refereeStr === "string") {
      const refName = refereeStr.split(",")[0].trim();
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
              [fixtureId, refId]
            );
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn("syncFixtureToDb error:", (err as Error).message);
  }
}

export async function syncLineupsToDb(fixtureId: number, apiLineups: any[]) {
  if (!Array.isArray(apiLineups) || apiLineups.length === 0) return;
  try {
    for (const item of apiLineups) {
      const teamId = Number(item.team?.id);
      const formation = item.formation ?? "4-3-3";
      if (!teamId) continue;

      if (item.team?.name) {
        try {
          await pool.query(
            `INSERT INTO Team (TeamID, Name, Logo)
             VALUES ($1, $2, $3)
             ON CONFLICT (TeamID) DO UPDATE SET
               Name = EXCLUDED.Name,
               Logo = COALESCE(EXCLUDED.Logo, Team.Logo)`,
            [teamId, item.team.name, item.team.logo ?? null]
          );
        } catch {}
      }

      // Starters
      for (const entry of item.startXI ?? []) {
        const p = entry.player;
        if (!p?.id || !p?.name) continue;
        const pid = Number(p.id);

        try {
          await pool.query(
            `INSERT INTO Player (PlayerID, Name, Position)
             VALUES ($1, $2, $3)
             ON CONFLICT (PlayerID) DO UPDATE SET
               Name = EXCLUDED.Name,
               Position = COALESCE(EXCLUDED.Position, Player.Position)`,
            [pid, p.name, p.pos ?? null]
          );

          await pool.query(
            `INSERT INTO Lineup (MatchID, TeamID, PlayerID, Status, Formation, Position, JerseyNumber)
             VALUES ($1, $2, $3, 'Starter', $4, $5, $6)
             ON CONFLICT (MatchID, TeamID, PlayerID) DO UPDATE SET
               Status = EXCLUDED.Status,
               Formation = EXCLUDED.Formation,
               Position = EXCLUDED.Position,
               JerseyNumber = EXCLUDED.JerseyNumber`,
            [fixtureId, teamId, pid, formation, p.pos ?? null, p.number ?? null]
          );
        } catch (pErr) {
          console.warn("sync starter error:", (pErr as Error).message);
        }
      }

      // Substitutes
      for (const entry of item.substitutes ?? []) {
        const p = entry.player;
        if (!p?.id || !p?.name) continue;
        const pid = Number(p.id);

        try {
          await pool.query(
            `INSERT INTO Player (PlayerID, Name, Position)
             VALUES ($1, $2, $3)
             ON CONFLICT (PlayerID) DO UPDATE SET
               Name = EXCLUDED.Name,
               Position = COALESCE(EXCLUDED.Position, Player.Position)`,
            [pid, p.name, p.pos ?? null]
          );

          await pool.query(
            `INSERT INTO Lineup (MatchID, TeamID, PlayerID, Status, Formation, Position, JerseyNumber)
             VALUES ($1, $2, $3, 'Sub', $4, $5, $6)
             ON CONFLICT (MatchID, TeamID, PlayerID) DO UPDATE SET
               Status = EXCLUDED.Status,
               Formation = EXCLUDED.Formation,
               Position = EXCLUDED.Position,
               JerseyNumber = EXCLUDED.JerseyNumber`,
            [fixtureId, teamId, pid, formation, p.pos ?? null, p.number ?? null]
          );
        } catch (pErr) {
          console.warn("sync sub error:", (pErr as Error).message);
        }
      }
    }
  } catch (err) {
    console.warn("syncLineupsToDb error:", (err as Error).message);
  }
}

const DEFAULT_SQUAD_POSITIONS = [
  { role: "Goalkeeper", pos: "G", num: 1 },
  { role: "Right Back", pos: "D", num: 2 },
  { role: "Center Back", pos: "D", num: 4 },
  { role: "Center Back", pos: "D", num: 5 },
  { role: "Left Back", pos: "D", num: 3 },
  { role: "Defensive Mid", pos: "M", num: 6 },
  { role: "Central Mid", pos: "M", num: 8 },
  { role: "Attacking Mid", pos: "M", num: 10 },
  { role: "Right Wing", pos: "F", num: 7 },
  { role: "Striker", pos: "F", num: 9 },
  { role: "Left Wing", pos: "F", num: 11 },
];

const DEFAULT_SUB_POSITIONS = [
  { role: "Sub GK", pos: "G", num: 13 },
  { role: "Sub Def", pos: "D", num: 14 },
  { role: "Sub Mid", pos: "M", num: 17 },
  { role: "Sub Fwd", pos: "F", num: 19 },
];

export async function seedDefaultLineupForMatch(matchId: number, homeTeamId: number, awayTeamId: number) {
  try {
    for (const teamId of [homeTeamId, awayTeamId]) {
      const countRes = await pool.query(
        `SELECT COUNT(*) FROM Lineup WHERE MatchID = $1 AND TeamID = $2 AND Status = 'Starter'`,
        [matchId, teamId]
      );
      if (parseInt(countRes.rows[0].count, 10) >= 11) continue;

      const tRes = await pool.query(`SELECT Name FROM Team WHERE TeamID = $1`, [teamId]);
      const teamName = tRes.rows[0]?.name?.trim() ?? "Player";
      const shortTeam = teamName.split(" ")[0];

      // Insert starters
      for (const s of DEFAULT_SQUAD_POSITIONS) {
        const pName = `${shortTeam} ${s.role}`;
        const pRes = await pool.query(
          `INSERT INTO Player (Name, Position) VALUES ($1, $2) RETURNING PlayerID`,
          [pName, s.pos]
        );
        const pid = pRes.rows[0].playerid;

        await pool.query(
          `INSERT INTO Lineup (MatchID, TeamID, PlayerID, Status, Formation, Position, JerseyNumber)
           VALUES ($1, $2, $3, 'Starter', '4-3-3', $4, $5)
           ON CONFLICT (MatchID, TeamID, PlayerID) DO UPDATE SET
             Formation = EXCLUDED.Formation,
             Position = EXCLUDED.Position,
             JerseyNumber = EXCLUDED.JerseyNumber`,
          [matchId, teamId, pid, s.pos, s.num]
        );
      }

      // Insert subs
      for (const s of DEFAULT_SUB_POSITIONS) {
        const pName = `${shortTeam} ${s.role}`;
        const pRes = await pool.query(
          `INSERT INTO Player (Name, Position) VALUES ($1, $2) RETURNING PlayerID`,
          [pName, s.pos]
        );
        const pid = pRes.rows[0].playerid;

        await pool.query(
          `INSERT INTO Lineup (MatchID, TeamID, PlayerID, Status, Formation, Position, JerseyNumber)
           VALUES ($1, $2, $3, 'Sub', '4-3-3', $4, $5)
           ON CONFLICT (MatchID, TeamID, PlayerID) DO UPDATE SET
             Formation = EXCLUDED.Formation,
             Position = EXCLUDED.Position,
             JerseyNumber = EXCLUDED.JerseyNumber`,
          [matchId, teamId, pid, s.pos, s.num]
        );
      }
    }
  } catch (err) {
    console.warn("seedDefaultLineupForMatch error:", (err as Error).message);
  }
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
  // 1. Fetch fresh fixtures from API-Football and sync into DB
  try {
    const rawItems = await apiFetch(`/fixtures?date=${todayStr()}`);
    if (Array.isArray(rawItems) && rawItems.length > 0) {
      console.log(`Syncing ${rawItems.length} fixtures from API into DB...`);
      for (const item of rawItems) {
        syncFixtureToDb(item).catch(() => {});
      }
    }
  } catch (e) {
    console.warn("API getFixtures fetch/sync:", (e as Error).message);
  }

  // 2. Read all fixtures from PostgreSQL DB!
  try {
    const { rows } = await pool.query(`${BASE_QUERY} ORDER BY m.MatchDate DESC`);
    if (rows.length > 0) {
      return { response: sortByLeague(rows.map(mapDbRow)) };
    }
  } catch (e) {
    console.warn("DB getFixtures query:", (e as Error).message);
  }

  // 3. Hardcoded fallback
  console.warn("Using hardcoded fallback fixtures");
  return { response: FALLBACK };
}

/** Top matches sorted by league tier (biggest leagues first). */
export async function getPopularFixtures() {
  try {
    const { rows } = await pool.query(`${BASE_QUERY} ORDER BY m.MatchDate DESC LIMIT 8`);
    if (rows.length > 0) {
      return { response: sortByLeague(rows.map(mapDbRow)) };
    }
  } catch (e) {
    console.warn("DB getPopularFixtures query:", (e as Error).message);
  }
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

    // Get today's fixtures from DB
    const { rows } = await pool.query(`${BASE_QUERY} ORDER BY m.MatchDate DESC`);
    const allMatches = rows.map(mapDbRow);

    const teamMatches = allMatches.filter(f =>
      teamIds.has(Number(f.teams.home.id)) || teamIds.has(Number(f.teams.away.id))
    );
    const teamMatchIds = new Set(teamMatches.map(f => f.fixture.id));
    const otherMatches = allMatches.filter(f => !teamMatchIds.has(f.fixture.id));

    return { response: [...teamMatches, ...otherMatches].slice(0, 10) };
  } catch (e) {
    console.warn("getFavouriteFixtures:", (e as Error).message);
    return { response: [] };
  }
}

export async function getMatchById(id: number) {
  try {
    // 1. Check if match is in DB
    let { rows } = await pool.query(`${BASE_QUERY} WHERE m.MatchID = $1`, [id]);

    // 2. If not in DB, fetch from API and sync to DB!
    if (rows.length === 0) {
      try {
        const raw = await fetchById(id);
        if (raw) {
          await syncFixtureToDb(raw);
          const dbRes = await pool.query(`${BASE_QUERY} WHERE m.MatchID = $1`, [id]);
          rows = dbRes.rows;
        }
      } catch (e) {
        console.warn("API fetch in getMatchById:", (e as Error).message);
      }
    }

    if (rows.length > 0) {
      const matchObj = mapDbRow(rows[0]) as any;

      // Fetch referees from MatchOfficiating + Referee tables!
      const refResult = await pool.query(
        `SELECT r.Name
         FROM MatchOfficiating mo
         JOIN Referee r ON mo.RefereeID = r.RefereeID
         WHERE mo.MatchID = $1`,
        [id]
      );
      matchObj.referees = refResult.rows.map((r: any) => r.name);
      return matchObj;
    }
  } catch (e) {
    console.warn("DB getMatchById:", (e as Error).message);
  }

  // Fallback
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
  try {
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
      WHERE m.MatchID = $1
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
  } catch {
    return []
  }
}

export async function getMatchLineups(fixtureId: number) {
  try {
    // 1. Ensure match exists in DB
    let matchRes = await pool.query(
      `SELECT HomeTeamID, AwayTeamID FROM Match WHERE MatchID = $1`,
      [fixtureId]
    );

    if (matchRes.rows.length === 0) {
      try {
        const raw = await fetchById(fixtureId);
        if (raw) {
          await syncFixtureToDb(raw);
          matchRes = await pool.query(
            `SELECT HomeTeamID, AwayTeamID FROM Match WHERE MatchID = $1`,
            [fixtureId]
          );
        }
      } catch (e) {
        console.warn("getMatchLineups fixture sync error:", (e as Error).message);
      }
    }

    if (matchRes.rows.length === 0) return [];
    const matchRow = matchRes.rows[0];

    // 2. Check how many starters are in Lineup table for this match
    let countRes = await pool.query(
      `SELECT COUNT(*) FROM Lineup WHERE MatchID = $1`,
      [fixtureId]
    );
    let lineupCount = parseInt(countRes.rows[0].count, 10);

    // 3. If no lineups in DB, try fetching from API and syncing into Lineup table
    if (lineupCount === 0) {
      try {
        const apiLineups = await fetchLineups(fixtureId);
        if (Array.isArray(apiLineups) && apiLineups.length > 0) {
          await syncLineupsToDb(fixtureId, apiLineups);
          countRes = await pool.query(
            `SELECT COUNT(*) FROM Lineup WHERE MatchID = $1`,
            [fixtureId]
          );
          lineupCount = parseInt(countRes.rows[0].count, 10);
        }
      } catch (e) {
        console.warn("fetchLineups from API error:", (e as Error).message);
      }
    }

    // 4. If STILL 0 (e.g. upcoming match with no live API lineups, or local match needing squads):
    if (lineupCount === 0) {
      await seedDefaultLineupForMatch(fixtureId, matchRow.hometeamid, matchRow.awayteamid);
    }

    // 5. Query Lineup directly from the PostgreSQL DB table!
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

      // Get Lineup Players from Lineup and Player tables!
      const lineupRes = await pool.query(
        `
        SELECT l.Status, l.Formation, l.Position, l.JerseyNumber, p.PlayerID, p.Name, p.Photo
        FROM Lineup l
        JOIN Player p ON l.PlayerID = p.PlayerID
        WHERE l.MatchID = $1 AND l.TeamID = $2
        ORDER BY l.Status DESC, l.JerseyNumber ASC, p.PlayerID ASC
        `,
        [fixtureId, teamId]
      );

      const starters: any[] = [];
      const substitutes: any[] = [];
      let dbFormation = "4-3-3";
      let starterIdx = 0;
      const defaultPositions = ["G", "D", "D", "D", "D", "M", "M", "M", "F", "F", "F"];

      lineupRes.rows.forEach((row: any) => {
        if (row.formation) dbFormation = row.formation;

        let pos = row.position;
        if (!pos) {
          if (row.status === "Starter") {
            pos = defaultPositions[starterIdx % defaultPositions.length];
          } else {
            pos = "Sub";
          }
        }

        const playerObj = {
          id: row.playerid,
          name: row.name,
          photo: row.photo ?? null,
          number: row.jerseynumber ?? ((row.playerid % 99) + 1),
          position: pos,
          grid: null,
          rating: (Math.random() * 2 + 7).toFixed(1),
          goals: 0,
          assists: 0,
          yellowCards: 0,
          redCards: 0,
        };

        if (row.status === "Starter") {
          starters.push(playerObj);
          starterIdx++;
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
        formation: dbFormation,
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
