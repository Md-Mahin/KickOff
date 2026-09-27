import { pool } from "../db";
import { getCoachForTeam } from "./coachData";

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
type FixtureItem = ReturnType<typeof mapApiItem>;

async function fetchByDate(date: string): Promise<FixtureItem[]> {
  const items = await apiFetch(`/fixtures?date=${date}`);
  return items.map(mapApiItem) as FixtureItem[];
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
      } catch { }
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
    } catch { }

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
      } catch { }
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
    } catch { }

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
        } catch { }
      }
    }
  } catch (err) {
    console.warn("syncFixtureToDb error:", (err as Error).message);
  }
}

export async function syncLineupsToDb(
  matchId: number,
  apiLineups: any[]
) {
  if (!Array.isArray(apiLineups) || apiLineups.length === 0) {
    return;
  }

  try {
    for (const item of apiLineups) {
      const teamApiId = Number(item.team?.id);

      if (!teamApiId) {
        continue;
      }

      const formation =
        item.formation ??
        null;

      // ------------------------------------------------------------
      // TEAM
      // ------------------------------------------------------------

      const teamResult = await pool.query(
        `
        SELECT TeamID
        FROM Team
        WHERE TeamID = $1
           OR ApiTeamID = $1
        LIMIT 1
        `,
        [teamApiId]
      );

      if (teamResult.rows.length === 0) {
        console.warn(
          `Lineup sync: team ${teamApiId} not found in database`
        );
        continue;
      }

      const teamId = Number(teamResult.rows[0].teamid);

      // ------------------------------------------------------------
      // COACH
      // API-Football lineup response contains:
      // coach: { id, name, photo }
      // ------------------------------------------------------------

      const coach = item.coach;

      if (coach?.name) {
        await pool.query(
          `
          INSERT INTO TeamMatchCoach
          (
            MatchID,
            TeamID,
            CoachID,
            CoachName,
            CoachPhoto
          )
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (MatchID, TeamID)
          DO UPDATE SET
            CoachID = EXCLUDED.CoachID,
            CoachName = EXCLUDED.CoachName,
            CoachPhoto = EXCLUDED.CoachPhoto
          `,
          [
            matchId,
            teamId,
            coach.id ? Number(coach.id) : null,
            coach.name ?? null,
            coach.photo ?? null,
          ]
        );
      }

      // ------------------------------------------------------------
      // HELPER: save player
      // ------------------------------------------------------------

      const savePlayer = async (
        player: any,
        status: "Starter" | "Sub"
      ) => {
        if (!player?.id || !player?.name) {
          return;
        }

        const playerId = Number(player.id);

        await pool.query(
          `
          INSERT INTO Player
          (
            PlayerID,
            Name,
            Position,
            Photo
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (PlayerID)
          DO UPDATE SET
            Name = EXCLUDED.Name,
            Position = COALESCE(EXCLUDED.Position, Player.Position),
            Photo = COALESCE(EXCLUDED.Photo, Player.Photo)
          `,
          [
            playerId,
            player.name,
            player.pos ?? null,
            player.photo ?? null,
          ]
        );

        await pool.query(
          `
          INSERT INTO Lineup
          (
            MatchID,
            TeamID,
            PlayerID,
            Status,
            Formation,
            Position,
            JerseyNumber
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (MatchID, TeamID, PlayerID)
          DO UPDATE SET
            Status = EXCLUDED.Status,
            Formation = EXCLUDED.Formation,
            Position = EXCLUDED.Position,
            JerseyNumber = EXCLUDED.JerseyNumber
          `,
          [
            matchId,
            teamId,
            playerId,
            status,
            formation,
            player.pos ?? null,
            player.number ?? null,
          ]
        );
      };

      // ------------------------------------------------------------
      // STARTING XI
      // ------------------------------------------------------------

      for (const entry of item.startXI ?? []) {
        await savePlayer(entry.player, "Starter");
      }

      // ------------------------------------------------------------
      // BENCH / SUBSTITUTES
      // ------------------------------------------------------------

      for (const entry of item.substitutes ?? []) {
        await savePlayer(entry.player, "Sub");
      }
    }

    console.log(
      `[Lineups] Synced ${apiLineups.length} teams for match ${matchId}`
    );
  } catch (error) {
    console.warn(
      "syncLineupsToDb error:",
      (error as Error).message
    );
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
    const mRes = await pool.query(`SELECT MatchDate FROM Match WHERE MatchID = $1`, [matchId]);
    const matchDate = mRes.rows[0]?.matchdate ? new Date(mRes.rows[0].matchdate) : null;
    const isUpcoming = matchDate ? matchDate.getTime() > Date.now() : false;

    // For upcoming matches, ensure no "Sub" records exist in Lineup
    if (isUpcoming) {
      await pool.query(`DELETE FROM Lineup WHERE MatchID = $1 AND Status = 'Sub'`, [matchId]);
    }

    for (const teamId of [homeTeamId, awayTeamId]) {
      // Ensure coach exists for this match & team
      const coachCheck = await pool.query(
        `SELECT 1 FROM TeamMatchCoach WHERE MatchID = $1 AND TeamID = $2`,
        [matchId, teamId]
      );
      if (coachCheck.rows.length === 0) {
        const tCoach = await pool.query(
          `SELECT Name, CoachName, CoachPhoto FROM Team WHERE TeamID = $1`,
          [teamId]
        );
        const tRow = tCoach.rows[0];
        const coachInfo = tRow?.coachname
          ? { name: tRow.coachname, photo: tRow.coachphoto }
          : getCoachForTeam(teamId, tRow?.name);

        await pool.query(
          `INSERT INTO TeamMatchCoach (MatchID, TeamID, CoachName, CoachPhoto)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (MatchID, TeamID) DO NOTHING`,
          [matchId, teamId, coachInfo.name, coachInfo.photo]
        );
      }

      const countRes = await pool.query(
        `SELECT COUNT(*) FROM Lineup WHERE MatchID = $1 AND TeamID = $2 AND Status = 'Starter'`,
        [matchId, teamId]
      );
      if (parseInt(countRes.rows[0].count, 10) >= 11) continue;

      // 1. Check if this team already has players registered from another match!
      const existingTeamPlayers = await pool.query(
        `SELECT DISTINCT p.PlayerID, p.Name, p.Position, l.JerseyNumber, l.Status
         FROM Lineup l
         JOIN Player p ON l.PlayerID = p.PlayerID
         WHERE l.TeamID = $1 ${isUpcoming ? "AND l.Status = 'Starter'" : ""}
         ORDER BY l.Status DESC, l.JerseyNumber ASC`,
        [teamId]
      );

      if (existingTeamPlayers.rows.length >= 11) {
        for (const ep of existingTeamPlayers.rows) {
          if (isUpcoming && ep.status === "Sub") continue;
          await pool.query(
            `INSERT INTO Lineup (MatchID, TeamID, PlayerID, Status, Formation, Position, JerseyNumber)
             VALUES ($1, $2, $3, $4, '4-3-3', $5, $6)
             ON CONFLICT (MatchID, TeamID, PlayerID) DO UPDATE SET
               Formation = EXCLUDED.Formation,
               Position = EXCLUDED.Position,
               JerseyNumber = EXCLUDED.JerseyNumber`,
            [matchId, teamId, ep.playerid, ep.status, ep.position, ep.jerseynumber]
          );
        }
        continue;
      }

      // 2. Synchronize PostgreSQL sequence to prevent duplicate key errors
      await pool.query(
        `SELECT setval(pg_get_serial_sequence('Player', 'playerid'), COALESCE(MAX(PlayerID), 1)) FROM Player`
      );

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

      // Insert subs ONLY if match has already started (LIVE or FT)
      // "subs should only occur while the match happens and no record before that but the record will stay after that"
      if (!isUpcoming) {
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
        syncFixtureToDb(item).catch(() => { });
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
    const { rows } = await pool.query(`${BASE_QUERY} ORDER BY m.MatchDate DESC LIMIT 12`);
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
      `SELECT TeamID
       FROM UserFollowsTeam
       WHERE UserID = $1`,
      [userId]
    );

    const teamIds = new Set(
      teamRows.map((row: any) => Number(row.teamid))
    );

    const { rows: playerRows } = await pool.query(
      `SELECT PlayerID
       FROM UserFollowsPlayer
       WHERE UserID = $1`,
      [userId]
    );

    const playerIds = new Set(
      playerRows.map((row: any) => Number(row.playerid))
    );

    if (teamIds.size === 0 && playerIds.size === 0) {
      const { rows } = await pool.query(
        `${BASE_QUERY} ORDER BY m.MatchDate DESC`
      );

      return {
        response: rows.map(mapDbRow),
      };
    }

    const playerTeamRows = await pool.query(
      `SELECT DISTINCT TeamID
       FROM TeamPlayerHistory
       WHERE PlayerID = ANY($1::int[])
         AND EndDate IS NULL`,
      [[...playerIds]]
    );

    const playerTeamIds = new Set(
      playerTeamRows.rows.map((row: any) => Number(row.teamid))
    );

    const { rows } = await pool.query(
      `${BASE_QUERY} ORDER BY m.MatchDate DESC`
    );

    const allMatches = rows.map(mapDbRow);

    const teamMatches = allMatches.filter((match) =>
      teamIds.has(Number(match.teams.home.id)) ||
      teamIds.has(Number(match.teams.away.id))
    );

    const teamMatchIds = new Set(
      teamMatches.map((match) => match.fixture.id)
    );

    const playerMatches = allMatches.filter((match) => {
      if (teamMatchIds.has(match.fixture.id)) {
        return false;
      }

      return (
        playerTeamIds.has(Number(match.teams.home.id)) ||
        playerTeamIds.has(Number(match.teams.away.id))
      );
    });

    const playerMatchIds = new Set(
      playerMatches.map((match) => match.fixture.id)
    );

    const otherMatches = allMatches.filter(
      (match) =>
        !teamMatchIds.has(match.fixture.id) &&
        !playerMatchIds.has(match.fixture.id)
    );

    return {
      response: [
        ...teamMatches,
        ...playerMatches,
        ...otherMatches,
      ],
    };
  } catch (e) {
    console.warn(
      "getFavouriteFixtures:",
      (e as Error).message
    );

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

function applyEventLifecycleFilter(events: any[], matchDate: Date | null) {
  if (!matchDate) return events;
  const mins = Math.floor((Date.now() - matchDate.getTime()) / 60000);

  if (mins < 0) {
    // Before kickoff: No events occur before the match happens
    return [];
  } else if (mins < 120) {
    // LIVE match: Only events that have occurred so far
    const currentElapsed = Math.min(mins, 90);
    return events.filter(e => (e.eventtime ?? 0) <= currentElapsed);
  }
  // FT (mins >= 120): Match completed, records stay forever
  return events;
}

export async function seedDefaultEventsForMatch(fixtureId: number) {
  try {
    const mRes = await pool.query(
      `SELECT MatchID, HomeTeamID, AwayTeamID, MatchDate, HomeGoals, AwayGoals FROM Match WHERE MatchID = $1`,
      [fixtureId]
    );
    if (mRes.rows.length === 0) return;
    const match = mRes.rows[0];
    const matchDate = match.matchdate ? new Date(match.matchdate) : null;

    if (!matchDate) return;
    const mins = Math.floor((Date.now() - matchDate.getTime()) / 60000);
    // Do NOT generate events for upcoming matches before kickoff
    if (mins < 0) return;

    const homeGoals = Number(match.homegoals ?? 0);
    const awayGoals = Number(match.awaygoals ?? 0);
    const homeTeamId = Number(match.hometeamid);
    const awayTeamId = Number(match.awayteamid);

    const evCountRes = await pool.query(
      `SELECT 
         COUNT(*)::int AS total_events,
         COUNT(CASE WHEN EventType = 'Goal' THEN 1 END)::int AS total_goals
       FROM Event WHERE MatchID = $1`,
      [fixtureId]
    );
    const totalEvents = evCountRes.rows[0].total_events;
    const totalGoals = evCountRes.rows[0].total_goals;

    if (totalEvents > 0 && totalGoals >= (homeGoals + awayGoals)) {
      return;
    }

    await seedDefaultLineupForMatch(fixtureId, homeTeamId, awayTeamId);

    const playersRes = await pool.query(
      `SELECT l.PlayerID, l.TeamID, l.Status, l.Position, p.Name
       FROM Lineup l
       JOIN Player p ON l.PlayerID = p.PlayerID
       WHERE l.MatchID = $1
       ORDER BY l.TeamID, l.Status DESC, l.JerseyNumber ASC`,
      [fixtureId]
    );

    const homeStarters = playersRes.rows.filter((r: any) => r.teamid === homeTeamId && r.status === 'Starter');
    const homeSubs = playersRes.rows.filter((r: any) => r.teamid === homeTeamId && r.status === 'Sub');
    const awayStarters = playersRes.rows.filter((r: any) => r.teamid === awayTeamId && r.status === 'Starter');
    const awaySubs = playersRes.rows.filter((r: any) => r.teamid === awayTeamId && r.status === 'Sub');

    const getAttackers = (starters: any[]) => {
      const att = starters.filter(p => p.position === 'F' || p.position === 'M');
      return att.length > 0 ? att : starters.filter(p => p.position !== 'G');
    };

    const homeAttackers = getAttackers(homeStarters);
    const awayAttackers = getAttackers(awayStarters);

    await pool.query(
      `SELECT setval(pg_get_serial_sequence('Event', 'eventid'), COALESCE(MAX(EventID), 1)) FROM Event`
    );

    // 1. Generate missing Goals
    if (totalGoals < (homeGoals + awayGoals)) {
      const goalTypes = ['Standard', 'Header', 'Counter', 'Penalty', 'Volley'];

      const homeTimes = [18, 34, 57, 72, 84, 89];
      for (let i = 0; i < homeGoals; i++) {
        const scorer = homeAttackers.length > 0 ? homeAttackers[i % homeAttackers.length] : (homeStarters[0] || null);
        const assist = homeStarters.filter((p: any) => p.playerid !== scorer?.playerid)[i % Math.max(1, homeStarters.length - 1)] || null;
        const time = homeTimes[i % homeTimes.length] + (i * 2);
        const gType = goalTypes[i % goalTypes.length];

        if (scorer) {
          const insEv = await pool.query(
            `INSERT INTO Event (MatchID, PlayerID, TeamID, EventTime, EventType)
             VALUES ($1, $2, $3, $4, 'Goal') RETURNING EventID`,
            [fixtureId, scorer.playerid, homeTeamId, time]
          );
          const evId = insEv.rows[0].eventid;
          await pool.query(
            `INSERT INTO Goal (EventID, AssistPlayerID, GoalType) VALUES ($1, $2, $3)`,
            [evId, assist ? assist.playerid : null, gType]
          );
        }
      }

      const awayTimes = [27, 45, 63, 79, 86, 90];
      for (let i = 0; i < awayGoals; i++) {
        const scorer = awayAttackers.length > 0 ? awayAttackers[i % awayAttackers.length] : (awayStarters[0] || null);
        const assist = awayStarters.filter((p: any) => p.playerid !== scorer?.playerid)[i % Math.max(1, awayStarters.length - 1)] || null;
        const time = awayTimes[i % awayTimes.length] + (i * 2);
        const gType = goalTypes[(i + 1) % goalTypes.length];

        if (scorer) {
          const insEv = await pool.query(
            `INSERT INTO Event (MatchID, PlayerID, TeamID, EventTime, EventType)
             VALUES ($1, $2, $3, $4, 'Goal') RETURNING EventID`,
            [fixtureId, scorer.playerid, awayTeamId, time]
          );
          const evId = insEv.rows[0].eventid;
          await pool.query(
            `INSERT INTO Goal (EventID, AssistPlayerID, GoalType) VALUES ($1, $2, $3)`,
            [evId, assist ? assist.playerid : null, gType]
          );
        }
      }
    }

    // 2. Generate Cards if this match had no events at all
    if (totalEvents === 0) {
      const homeDefenders = homeStarters.filter((p: any) => p.position === 'D' || p.position === 'M');
      const awayDefenders = awayStarters.filter((p: any) => p.position === 'D' || p.position === 'M');

      if (homeDefenders.length > 0) {
        const cardPlayer = homeDefenders[0];
        const insEv = await pool.query(
          `INSERT INTO Event (MatchID, PlayerID, TeamID, EventTime, EventType)
           VALUES ($1, $2, $3, 29, 'Card') RETURNING EventID`,
          [fixtureId, cardPlayer.playerid, homeTeamId]
        );
        await pool.query(`INSERT INTO Card (EventID, CardType) VALUES ($1, 'Yellow')`, [insEv.rows[0].eventid]);
      }

      if (awayDefenders.length > 0) {
        const cardPlayer = awayDefenders[0];
        const insEv = await pool.query(
          `INSERT INTO Event (MatchID, PlayerID, TeamID, EventTime, EventType)
           VALUES ($1, $2, $3, 68, 'Card') RETURNING EventID`,
          [fixtureId, cardPlayer.playerid, awayTeamId]
        );
        await pool.query(`INSERT INTO Card (EventID, CardType) VALUES ($1, 'Yellow')`, [insEv.rows[0].eventid]);
      }

      // 3. Generate Substitutions if subs exist
      if (homeSubs.length > 0 && homeStarters.length > 0) {
        const outPlayer = homeStarters.find((p: any) => p.position === 'F' || p.position === 'M') || homeStarters[homeStarters.length - 1];
        const inPlayer = homeSubs[0];
        const insEv = await pool.query(
          `INSERT INTO Event (MatchID, PlayerID, TeamID, EventTime, EventType)
           VALUES ($1, $2, $3, 62, 'Substitution') RETURNING EventID`,
          [fixtureId, outPlayer.playerid, homeTeamId]
        );
        await pool.query(
          `INSERT INTO Substitution (EventID, InPlayerID) VALUES ($1, $2)`,
          [insEv.rows[0].eventid, inPlayer.playerid]
        );
      }

      if (awaySubs.length > 0 && awayStarters.length > 0) {
        const outPlayer = awayStarters.find((p: any) => p.position === 'F' || p.position === 'M') || awayStarters[awayStarters.length - 1];
        const inPlayer = awaySubs[0];
        const insEv = await pool.query(
          `INSERT INTO Event (MatchID, PlayerID, TeamID, EventTime, EventType)
           VALUES ($1, $2, $3, 73, 'Substitution') RETURNING EventID`,
          [fixtureId, outPlayer.playerid, awayTeamId]
        );
        await pool.query(
          `INSERT INTO Substitution (EventID, InPlayerID) VALUES ($1, $2)`,
          [insEv.rows[0].eventid, inPlayer.playerid]
        );
      }
    }

    await pool.query(
      `SELECT setval(pg_get_serial_sequence('Event', 'eventid'), COALESCE(MAX(EventID), 1)) FROM Event`
    );
  } catch (err) {
    console.warn("seedDefaultEventsForMatch error:", (err as Error).message);
  }
}

export async function getMatchEvents(fixtureId: number) {
  let matchDate: Date | null = null;
  try {
    const mRes = await pool.query(`SELECT MatchDate FROM Match WHERE MatchID = $1`, [fixtureId]);
    if (mRes.rows.length > 0 && mRes.rows[0].matchdate) {
      matchDate = new Date(mRes.rows[0].matchdate);
    }
  } catch { }

  // If matchDate is in the future (kickoff not reached):
  if (matchDate) {
    const mins = Math.floor((Date.now() - matchDate.getTime()) / 60000);
    if (mins < 0) {
      // Kickoff has not occurred yet; no events recorded or shown before kickoff
      return [];
    }
  }

  // The timeline belongs to the selected fixture, so fetch it only from the
  // detail request instead of depending on a pre-synced local match row.
  try {
    const apiEvents = await fetchEvents(fixtureId)

    const mapped = apiEvents
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

    if (mapped.length > 0) {
      return applyEventLifecycleFilter(mapped, matchDate);
    }
  } catch (error) {
    console.warn("API getMatchEvents:", (error as Error).message)
  }

  // Ensure default events exist for matches after kickoff
  await seedDefaultEventsForMatch(fixtureId);

  // Keep locally synced events available when API-Football is unavailable.
  try {
    const { rows } = await pool.query(
      `
      SELECT
        e.EventID,
        e.EventTime,
        e.EventType,
        e.PlayerID,
        p.Name AS PlayerName,
        t.Name AS TeamName,
        g.GoalType,
        ap.Name AS AssistPlayerName,
        c.CardType,
        sub.InPlayerID AS SubstitutionPlayerID,
        subp.Name AS InPlayerName
      FROM Event e
      JOIN Match m ON e.MatchID = m.MatchID
      LEFT JOIN Team t ON e.TeamID = t.TeamID
      LEFT JOIN Player p ON e.PlayerID = p.PlayerID
      LEFT JOIN Goal g ON e.EventID = g.EventID
      LEFT JOIN Player ap ON ap.PlayerID = g.AssistPlayerID
      LEFT JOIN Card c ON e.EventID = c.EventID
      LEFT JOIN Substitution sub ON e.EventID = sub.EventID
      LEFT JOIN Player subp ON sub.InPlayerID = subp.PlayerID
      WHERE m.MatchID = $1
      ORDER BY e.EventTime ASC
      `,
      [fixtureId]
    )

    const mappedDb = rows.map((row: any) => ({
      eventid: row.eventid,
      eventtime: row.eventtime,
      eventtype: row.eventtype,
      playerid: row.playerid,
      playername: row.playername,
      substitutionplayerid: row.substitutionplayerid ?? null,
      assistplayername: row.inplayername ?? row.assistplayername ?? null,
      teamname: row.teamname ?? "",
      goaltype: row.goaltype,
      cardtype: row.cardtype,
    }))

    return applyEventLifecycleFilter(mappedDb, matchDate);
  } catch {
    return []
  }
}

export async function getMatchLineups(fixtureId: number) {
  try {
    // ============================================================
    // 1. Resolve database match
    // ============================================================

    let matchRes = await pool.query(
      `SELECT MatchID, HomeTeamID, AwayTeamID
   FROM Match
   WHERE MatchID = $1
   LIMIT 1`,
      [fixtureId]
    );

    // If match isn't stored yet, try API-Football once.
    if (matchRes.rows.length === 0) {
      try {
        const raw = await fetchById(fixtureId);

        if (raw) {
          await syncFixtureToDb(raw);

          matchRes = await pool.query(
            `SELECT MatchID, HomeTeamID, AwayTeamID
   FROM Match
   WHERE MatchID = $1
   LIMIT 1`,
            [fixtureId]
          );
        }
      } catch (error) {
        console.warn(
          "getMatchLineups fixture sync:",
          (error as Error).message
        );
      }
    }

    if (matchRes.rows.length === 0) {
      return [];
    }

    const matchRow = matchRes.rows[0];

    const matchId = Number(matchRow.matchid);

    const apiFixtureId = fixtureId;

    // ============================================================
    // 2. Try to get fresh API-Football lineup data
    // ============================================================

    let apiLineups: any[] = [];

    if (apiFixtureId !== null) {
      try {
        const fetched = await fetchLineups(apiFixtureId);

        if (Array.isArray(fetched)) {
          apiLineups = fetched;
        }

        if (apiLineups.length > 0) {
          await syncLineupsToDb(matchId, apiLineups);
        }
      } catch (error) {
        console.warn(
          "API lineup unavailable; using database lineup:",
          (error as Error).message
        );
      }
    }

    // ============================================================
    // 3. Fetch player match statistics
    //
    // API-Football's /fixtures/players endpoint contains
    // ratings and match statistics.
    // ============================================================

    const playerStats = new Map<
      number,
      {
        rating: number | null;
        goals: number;
        assists: number;
        yellowCards: number;
        redCards: number;
        minutes: number | null;
      }
    >();

    if (apiFixtureId !== null) {
      try {
        const stats = await fetchPlayerStats(apiFixtureId);

        if (Array.isArray(stats)) {
          for (const teamBlock of stats) {
            for (const playerBlock of teamBlock.players ?? []) {
              const player = playerBlock.player;
              const statistics = playerBlock.statistics?.[0];

              if (!player?.id) {
                continue;
              }

              const statsNumber = Number(player.id);

              playerStats.set(statsNumber, {
                rating:
                  statistics?.games?.rating != null
                    ? Number(statistics.games.rating)
                    : null,

                goals:
                  statistics?.goals?.total != null
                    ? Number(statistics.goals.total)
                    : 0,

                assists:
                  statistics?.goals?.assists != null
                    ? Number(statistics.goals.assists)
                    : 0,

                yellowCards:
                  statistics?.cards?.yellow != null
                    ? Number(statistics.cards.yellow)
                    : 0,

                redCards:
                  statistics?.cards?.red != null
                    ? Number(statistics.cards.red)
                    : 0,

                minutes:
                  statistics?.games?.minutes != null
                    ? Number(statistics.games.minutes)
                    : null,
              });
            }
          }
        }
      } catch (error) {
        console.warn(
          "API player statistics unavailable:",
          (error as Error).message
        );
      }
    }

    // ============================================================
    // 4. Get teams
    // ============================================================

    const teamIds = [
      Number(matchRow.hometeamid),
      Number(matchRow.awayteamid),
    ];

    const results: any[] = [];

    // ============================================================
    // 5. Build lineup for each team
    // ============================================================

    for (const teamId of teamIds) {
      const teamRes = await pool.query(
        `
        SELECT
          TeamID,
          Name,
          Logo
        FROM Team
        WHERE TeamID = $1
        `,
        [teamId]
      );

      if (teamRes.rows.length === 0) {
        continue;
      }

      const team = teamRes.rows[0];

      // ----------------------------------------------------------
      // Lineup players
      // ----------------------------------------------------------

      const lineupRes = await pool.query(
        `
        SELECT
          l.Status,
          l.Formation,
          l.Position,
          l.JerseyNumber,

          p.PlayerID,
          p.Name,
          p.Photo

        FROM Lineup l

        JOIN Player p
          ON p.PlayerID = l.PlayerID

        WHERE l.MatchID = $1
          AND l.TeamID = $2

        ORDER BY
          CASE
            WHEN l.Status = 'Starter' THEN 0
            ELSE 1
          END,
          l.JerseyNumber NULLS LAST,
          p.Name
        `,
        [matchId, teamId]
      );

      // ----------------------------------------------------------
      // Coach
      // ----------------------------------------------------------

      const coachRes = await pool.query(
        `
        SELECT
          CoachID,
          CoachName,
          CoachPhoto
        FROM TeamMatchCoach
        WHERE MatchID = $1
          AND TeamID = $2
        LIMIT 1
        `,
        [matchId, teamId]
      );

      const coachRow = coachRes.rows[0];
      let coachId = coachRow?.coachid ? Number(coachRow.coachid) : null;
      let coachName = coachRow?.coachname ?? null;
      let coachPhoto = coachRow?.coachphoto ?? null;

      if (!coachName) {
        const teamRes = await pool.query(
          `SELECT Name, CoachName, CoachPhoto FROM Team WHERE TeamID = $1`,
          [teamId]
        );
        const tRow = teamRes.rows[0];
        if (tRow?.coachname) {
          coachName = tRow.coachname;
          coachPhoto = tRow.coachphoto;
        } else {
          const fallback = getCoachForTeam(teamId, tRow?.name);
          coachName = fallback.name;
          coachPhoto = fallback.photo;
        }

        // Cache into TeamMatchCoach
        if (coachName) {
          pool.query(
            `INSERT INTO TeamMatchCoach (MatchID, TeamID, CoachID, CoachName, CoachPhoto)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (MatchID, TeamID) DO UPDATE SET
               CoachName = EXCLUDED.CoachName,
               CoachPhoto = EXCLUDED.CoachPhoto`,
            [matchId, teamId, coachId, coachName, coachPhoto]
          ).catch((e) => console.warn("Failed caching coach into TeamMatchCoach:", e.message));
        }
      }

      const coach = {
        id: coachId,
        name: coachName,
        photo: coachPhoto,
      };

      // ----------------------------------------------------------
      // Players
      // ----------------------------------------------------------

      const starters: any[] = [];
      const substitutes: any[] = [];

      let formation: string | null = null;

      for (const row of lineupRes.rows) {
        if (row.formation) {
          formation = row.formation;
        }

        const stats =
          playerStats.get(Number(row.playerid)) ?? null;

        const player = {
          id: Number(row.playerid),

          name: row.name,

          photo: row.photo ?? null,

          number:
            row.jerseynumber !== null
              ? Number(row.jerseynumber)
              : null,

          position: row.position ?? null,

          // API-Football gives a grid such as "1:1", "2:3", etc.
          // Your current DB does not store grid, so this remains null
          // when reading persisted data.
          grid: null,

          rating: stats?.rating ?? null,

          goals: stats?.goals ?? 0,

          assists: stats?.assists ?? 0,

          yellowCards: stats?.yellowCards ?? 0,

          redCards: stats?.redCards ?? 0,

          minutes: stats?.minutes ?? null,
        };

        if (row.status === "Starter") {
          starters.push(player);
        } else {
          substitutes.push(player);
        }
      }

      // ----------------------------------------------------------
      // Injured / unavailable players
      // ----------------------------------------------------------

      const unavailableRes = await pool.query(
        `
        SELECT
          mup.PlayerID,
          p.Name,
          p.Photo,
          mup.Reason,
          mup.Status
        FROM MatchUnavailablePlayer mup
        JOIN Player p
          ON p.PlayerID = mup.PlayerID
        WHERE mup.MatchID = $1
          AND mup.TeamID = $2
        ORDER BY p.Name
        `,
        [matchId, teamId]
      );

      const unavailable = unavailableRes.rows.map(
        (row: any) => ({
          id: Number(row.playerid),
          name: row.name,
          photo: row.photo ?? null,
          reason: row.reason ?? "Unavailable",
          status: row.status ?? "Unavailable",
        })
      );

      // ----------------------------------------------------------
      // Don't return empty fake lineup
      // ----------------------------------------------------------

      if (
        starters.length === 0 &&
        substitutes.length === 0 &&
        unavailable.length === 0 &&
        !coach.name
      ) {
        continue;
      }

      results.push({
        team: {
          id: team.teamid,
          name: team.name,
          logo: team.logo ?? null,
        },

        formation,

        coach,

        starters,

        substitutes,

        unavailable,
      });
    }

    return results;
  } catch (error) {
    console.warn(
      "DB/API getMatchLineups:",
      (error as Error).message
    );

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
/** Team catalog for signup/search — PostgreSQL only. */
export async function getTeamsCatalog() {
  try {
    const { rows } = await pool.query(`
      SELECT
        TeamID AS id,
        Name AS name,
        Logo AS logo,
        COALESCE(Type, 'club') AS type
      FROM Team
      ORDER BY Name
    `);

    const national = rows.filter((t: any) => t.type === "national");
    const club = rows.filter((t: any) => t.type !== "national");

    return {
      national,
      club,
    };
  } catch (error) {
    console.warn("DB getTeamsCatalog:", (error as Error).message);
    return {
      national: [],
      club: [],
    };
  }
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

