import { pool } from "../db";
import type {
  DetailedMockMatch,
  BasicMatchItem,
} from "./mockMatchData";
import { callApiFootball as requestApiFootball } from "./apiFootballClient";
import { syncFixtureToDb, upsertApiPlayer, upsertApiTeam, upsertApiTournament } from "./footballService";

const todayStr = () => new Date().toISOString().split("T")[0];

/**
 * Generic API-Football fetch helper with timeout
 */
async function callApiFootball(path: string) {
  return requestApiFootball(path);
}

async function markFixtureListSync(unavailable = false) {
  await pool.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
    VALUES (0, 'fixtures', $1::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
    [JSON.stringify({ unavailable })]);
}

// ============================================================================
// 1. Initial Page Load: Fetch Basic Match List
// Only fetches teams and match status (FT, UPCOMING, LIVE)
// Match lists are database-first; API-Football fills the DB only when today's rows are missing.
// ============================================================================
export async function getBasicMatchList(): Promise<{
  source: "Database" | "Mock Fallback";
  matches: BasicMatchItem[];
}> {
  const today = todayStr();
  let databaseRows: any[] = [];
  try {
    const { rows } = await pool.query(`
      SELECT COALESCE(m.ApiFixtureID, m.MatchID) AS MatchID, m.MatchDate, m.HomeGoals, m.AwayGoals,
        t.TournamentID, t.Name AS TournamentName,
        h.TeamID AS HomeTeamID, h.Name AS HomeTeamName, h.Logo AS HomeLogo,
        a.TeamID AS AwayTeamID, a.Name AS AwayTeamName, a.Logo AS AwayLogo
      FROM Match m JOIN Tournament t ON t.TournamentID = m.TournamentID
      JOIN Team h ON h.TeamID = m.HomeTeamID JOIN Team a ON a.TeamID = m.AwayTeamID
      WHERE m.ApiFixtureID IS NOT NULL AND m.MatchDate::date = $1::date ORDER BY m.MatchDate
    `, [today]);
    databaseRows = rows;
  } catch (error) {
    console.warn("[DB] Match list query failed:", (error as Error).message);
  }

  try {
    const cache = await pool.query(`SELECT Payload, FetchedAt FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = 'fixtures'`);
    const age = cache.rows[0] ? Date.now() - new Date(cache.rows[0].fetchedat).getTime() : Infinity;
    const unavailable = Boolean(cache.rows[0]?.payload?.unavailable);
    const ttl = unavailable ? 5 * 60_000 : 3 * 60 * 60_000;
    if (age < ttl) {
      if (databaseRows.length) {
        console.log("[DB] Match list served from database");
        return { source: "Database", matches: databaseRows.map((r: any) => mapBasicMatch(r)) };
      }
      console.log(unavailable ? "[CACHE] API fixture refresh is cooling down" : "[CACHE] No fixtures in the recent database sync");
      return { source: "Database", matches: [] };
    }
  } catch (error) {
    console.warn("[DB] Fixture list freshness check failed:", (error as Error).message);
    if (databaseRows.length) return { source: "Database", matches: databaseRows.map((r: any) => mapBasicMatch(r)) };
  }

  try {
    const items = await callApiFootball(`/fixtures?date=${today}`);

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) await syncFixtureToDb(item);
      await markFixtureListSync();
      const { rows: syncedRows } = await pool.query(`
        SELECT COALESCE(m.ApiFixtureID, m.MatchID) AS MatchID, m.MatchDate, m.HomeGoals, m.AwayGoals,
          t.TournamentID, t.Name AS TournamentName,
          h.TeamID AS HomeTeamID, h.Name AS HomeTeamName, h.Logo AS HomeLogo,
          a.TeamID AS AwayTeamID, a.Name AS AwayTeamName, a.Logo AS AwayLogo
        FROM Match m JOIN Tournament t ON t.TournamentID = m.TournamentID
        JOIN Team h ON h.TeamID = m.HomeTeamID JOIN Team a ON a.TeamID = m.AwayTeamID
        WHERE m.ApiFixtureID IS NOT NULL AND m.MatchDate::date = $1::date ORDER BY m.MatchDate
      `, [today]);
      console.log("[DB] API match list synchronized");
      return { source: "Database", matches: syncedRows.map((r: any) => mapBasicMatch(r)) };
    }

    if (Array.isArray(items)) {
      await markFixtureListSync();
      return { source: "Database", matches: databaseRows.map((r: any) => mapBasicMatch(r)) };
    }

    throw new Error("No fixtures returned by API-Football");
  } catch (error) {
    await markFixtureListSync(true).catch(() => {});
    console.warn(
      `[Basic Match List] API-Football unavailable; using database data when available (${(error as Error).message}).`
    );
    if (databaseRows.length) return { source: "Database", matches: databaseRows.map((r: any) => mapBasicMatch(r)) };
    try {
      const { rows } = await pool.query(`
        SELECT m.MatchID, m.MatchDate, m.HomeGoals, m.AwayGoals,
          t.TournamentID, t.Name AS TournamentName,
          h.TeamID AS HomeTeamID, h.Name AS HomeTeamName, h.Logo AS HomeLogo,
          a.TeamID AS AwayTeamID, a.Name AS AwayTeamName, a.Logo AS AwayLogo
        FROM Match m JOIN Tournament t ON t.TournamentID = m.TournamentID
        JOIN Team h ON h.TeamID = m.HomeTeamID JOIN Team a ON a.TeamID = m.AwayTeamID
        WHERE m.ApiFixtureID IS NULL AND m.MatchDate::date = $1::date ORDER BY m.MatchDate
      `, [today]);
      if (rows.length) return { source: "Mock Fallback", matches: rows.map((r: any) => mapBasicMatch(r)) };
    } catch { }
    return { source: "Database", matches: [] };
  }
}

function mapBasicMatch(r: any): BasicMatchItem {
  const matchDate = new Date(r.matchdate);
  const minute = Math.floor((Date.now() - matchDate.getTime()) / 60_000);
  const status: BasicMatchItem["status"] = minute < 0 ? "UPCOMING" : minute < 120 ? "LIVE" : "FT";
  return {
    id: Number(r.matchid), leagueId: Number(r.tournamentid), league: r.tournamentname,
    country: "International", homeTeam: r.hometeamname, homeTeamId: Number(r.hometeamid), homeLogo: r.homelogo,
    awayTeam: r.awayteamname, awayTeamId: Number(r.awayteamid), awayLogo: r.awaylogo,
    homeScore: r.homegoals, awayScore: r.awaygoals, status,
    minute: status === "LIVE" ? Math.max(0, Math.min(minute, 90)) : null, date: r.matchdate,
  };
}

// ============================================================================
// 2. Database synchronization for API-backed detail data.
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

  const leagueId = await upsertApiTournament(league);

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

  // 3. Resolve external teams to stable local TeamIDs.
  const homeId = await upsertApiTeam(teams.home, countryId);
  const awayId = await upsertApiTeam(teams.away, countryId);

  // 4. Match record. Resolve external fixture ID to the local MatchID.
  const matchDate = fixture.date ? new Date(fixture.date) : new Date();
  let databaseMatchId: number;
  const existingMatch = await pool.query(
    `SELECT MatchID FROM Match WHERE ApiFixtureID = $1 OR MatchID = $1 LIMIT 1`,
    [fixture.id ?? matchId]
  );
  if (existingMatch.rows.length) {
    databaseMatchId = Number(existingMatch.rows[0].matchid);
    await pool.query(
      `UPDATE Match SET ApiFixtureID = $2, TournamentID = $3, HomeTeamID = $4, AwayTeamID = $5,
         VenueID = COALESCE($6, VenueID), MatchDate = $7, HomeGoals = $8, AwayGoals = $9
       WHERE MatchID = $1`,
      [databaseMatchId, fixture.id ?? matchId, leagueId, homeId, awayId, venueId, matchDate, goals.home ?? 0, goals.away ?? 0]
    );
  } else {
    const insertedMatch = await pool.query(
      `INSERT INTO Match (ApiFixtureID, TournamentID, HomeTeamID, AwayTeamID, VenueID, MatchDate, HomeGoals, AwayGoals)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING MatchID`,
      [fixture.id ?? matchId, leagueId, homeId, awayId, venueId, matchDate, goals.home ?? 0, goals.away ?? 0]
    );
    databaseMatchId = Number(insertedMatch.rows[0].matchid);
  }

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
            [databaseMatchId, refId]
          );
        }
      } catch {}
    }
  }

  // 6. Lineups & Coaches
  if (Array.isArray(lineups)) {
    for (const l of lineups) {
      const teamId = await upsertApiTeam(l.team, countryId);

      // Coach
      if (l.coach?.name) {
        const coachPhoto = l.coach.photo ?? (l.coach.id ? `https://media.api-sports.io/football/coachs/${Number(l.coach.id)}.png` : null);
        await pool.query(
          `INSERT INTO TeamMatchCoach (MatchID, TeamID, CoachID, CoachName, CoachPhoto)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (MatchID, TeamID) DO UPDATE SET
             CoachName = EXCLUDED.CoachName,
             CoachPhoto = COALESCE(EXCLUDED.CoachPhoto, TeamMatchCoach.CoachPhoto)`,
          [databaseMatchId, teamId, l.coach.id ? Number(l.coach.id) : null, l.coach.name, coachPhoto]
        );
      }

      // Starters
      for (const entry of l.startXI ?? []) {
        const player = entry.player;
        if (!player?.id) continue;
        if (!player.name) continue;
        const pId = await upsertApiPlayer(player);
        if (!pId) continue;

        await pool.query(
          `INSERT INTO Lineup (MatchID, TeamID, PlayerID, Status, Formation, Position, JerseyNumber)
           VALUES ($1, $2, $3, 'Starter', $4, $5, $6)
           ON CONFLICT (MatchID, TeamID, PlayerID) DO UPDATE SET
             Status = EXCLUDED.Status,
             Formation = EXCLUDED.Formation,
             Position = EXCLUDED.Position,
             JerseyNumber = EXCLUDED.JerseyNumber`,
          [databaseMatchId, teamId, pId, l.formation ?? null, player.pos ?? null, player.number ?? null]
        );
      }

      // Substitutes
      for (const entry of l.substitutes ?? []) {
        const player = entry.player;
        if (!player?.id) continue;
        if (!player.name) continue;
        const pId = await upsertApiPlayer(player);
        if (!pId) continue;

        await pool.query(
          `INSERT INTO Lineup (MatchID, TeamID, PlayerID, Status, Formation, Position, JerseyNumber)
           VALUES ($1, $2, $3, 'Sub', $4, $5, $6)
           ON CONFLICT (MatchID, TeamID, PlayerID) DO UPDATE SET
             Status = EXCLUDED.Status,
             Formation = EXCLUDED.Formation,
             Position = EXCLUDED.Position,
             JerseyNumber = EXCLUDED.JerseyNumber`,
          [databaseMatchId, teamId, pId, l.formation ?? null, player.pos ?? null, player.number ?? null]
        );
      }
    }
  }

  // 7. Events (Timeline)
  if (Array.isArray(events) && events.length > 0) {
    for (const ev of events) {
      const elapsed = ev.time?.elapsed ?? 0;
      const teamId = ev.team?.name ? await upsertApiTeam(ev.team, countryId) : null;
      const playerId = ev.player?.id && ev.player?.name ? await upsertApiPlayer(ev.player) : null;
      const assistPlayerId = ev.assist?.id && ev.assist?.name ? await upsertApiPlayer(ev.assist) : null;
      const typeStr = (ev.type || "").toLowerCase();

      let eventType: "Goal" | "Card" | "Substitution" | "Foul" | null = null;
      if (typeStr.includes("goal")) eventType = "Goal";
      else if (typeStr.includes("card")) eventType = "Card";
      else if (typeStr.includes("sub")) eventType = "Substitution";
      else if (typeStr.includes("foul")) eventType = "Foul";
      if (!eventType) continue;

      // Ensure main player exists
      // Check duplicate
      const existRes = await pool.query(
        `SELECT EventID FROM Event
         WHERE MatchID = $1 AND EventTime IS NOT DISTINCT FROM $2
           AND EventType = $3 AND PlayerID IS NOT DISTINCT FROM $4
         LIMIT 1`,
        [databaseMatchId, elapsed, eventType, playerId]
      );

      let eventId: number;
      if (existRes.rows.length > 0) {
        eventId = existRes.rows[0].eventid;
      } else {
        const insRes = await pool.query(
          `INSERT INTO Event (MatchID, PlayerID, TeamID, EventTime, EventType)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING EventID`,
          [databaseMatchId, playerId, teamId, elapsed, eventType]
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
      m.ApiFixtureID,
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
    WHERE m.MatchID = $1 OR m.ApiFixtureID = $1
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
    [row.matchid]
  );

  const unavailableRes = await pool.query(
    `SELECT mup.TeamID, mup.PlayerID, p.Name AS PlayerName, p.Photo AS PlayerPhoto,
            mup.Reason, mup.Status
     FROM MatchUnavailablePlayer mup JOIN Player p ON p.PlayerID = mup.PlayerID
     WHERE mup.MatchID = $1 ORDER BY mup.TeamID, p.Name`,
    [row.matchid]
  );
  const coachesRes = await pool.query(
    `SELECT TeamID, CoachName, CoachPhoto FROM TeamMatchCoach WHERE MatchID = $1`,
    [row.matchid]
  );

  const homeTeamId = Number(row.hometeamid);
  const awayTeamId = Number(row.awayteamid);

  const buildTeamLineup = (teamId: number, teamName: string, teamLogo: string | null) => {
    const teamRows = lineupsRes.rows.filter((r) => Number(r.teamid) === teamId);
    const starters = teamRows.filter((r) => r.status === "Starter");
    const subs = teamRows.filter((r) => r.status === "Sub");
    const firstRow = teamRows[0];
    const coachRes = coachesRes.rows.find((r) => Number(r.teamid) === teamId);
    const unavailable = unavailableRes.rows.filter((r) => Number(r.teamid) === teamId).map((r) => ({
      id: Number(r.playerid), name: r.playername, photo: r.playerphoto ?? null,
      reason: r.reason ?? "Unavailable", status: r.status ?? "Unavailable",
    }));

    const mappedStarters = starters.map((s) => ({
      id: Number(s.playerid),
      name: s.playername,
      photo: s.playerphoto ?? null,
      number: s.jerseynumber == null ? null : Number(s.jerseynumber),
      position: s.position ?? null,
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
      number: s.jerseynumber == null ? null : Number(s.jerseynumber),
      position: s.position ?? null,
      grid: null,
      rating: null,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
    }));

    return {
      team: { id: teamId, name: teamName, logo: teamLogo },
      formation: firstRow?.formation ?? null,
      coach: coachRes?.coachname ? { name: coachRes.coachname, photo: coachRes.coachphoto ?? null } : { name: null, photo: null },
      starters: mappedStarters,
      substitutes: mappedSubs,
      unavailable,
      startXI: starters.map((s) => ({
        player: {
          id: Number(s.playerid),
          name: s.playername,
          number: s.jerseynumber == null ? null : Number(s.jerseynumber),
          pos: s.position ?? null,
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
    [row.matchid]
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
    _databaseMatchId: Number(row.matchid),
    _apiFixtureId: row.apifixtureid == null ? null : Number(row.apifixtureid),
    fixture: {
      id: Number(row.apifixtureid ?? row.matchid),
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
// Database-first detail hydration. Detail endpoints are loaded only when requested.
async function hydrateMatch(matchId: number) {
  let dbData = await pullMatchDetailsFromDatabase(matchId);
  if (dbData) {
    console.log('[DB] Match data served from database');
    return dbData;
  }
  const fixtures = await callApiFootball(`/fixtures?id=${matchId}`);
  if (!fixtures.length) return null;
  const item = fixtures[0];
  const rawData = {
    fixture: { id: Number(item.fixture.id), date: item.fixture.date, venue: item.fixture.venue ?? null, referee: item.fixture.referee, status: item.fixture.status },
    league: { id: Number(item.league.id), name: item.league.name, country: item.league.country, season: item.league.season },
    teams: { home: item.teams.home, away: item.teams.away }, goals: item.goals, lineups: [], events: [],
  } as DetailedMockMatch;
  await syncFixtureToDb(item);
  await persistMatchDetailsToDatabase(matchId, rawData);
  dbData = await pullMatchDetailsFromDatabase(matchId);
  return dbData;
}

async function loadCachedMatchEndpoint(matchId: number, endpoint: 'events' | 'lineups') {
  const dbData = await hydrateMatch(matchId);
  if (!dbData) return null;
  const fixtureId = dbData._apiFixtureId;
  if (fixtureId == null) {
    console.log('[DB] Local match data served; no API fixture mapping exists');
    return { match: dbData, payload: endpoint === 'events' ? dbData.events : dbData.lineups };
  }
  const cache = await pool.query('SELECT Payload, FetchedAt FROM MatchApiCache WHERE MatchID = $1 AND Endpoint = $2', [fixtureId, endpoint]);
  const payload = cache.rows[0]?.payload;
  const age = cache.rows[0] ? Date.now() - new Date(cache.rows[0].fetchedat).getTime() : Infinity;
  const hasData = Array.isArray(payload) && payload.length > 0;
  const live = dbData.fixture.status.short === 'LIVE';
  const maxAge = endpoint === 'events' ? (live ? 5 * 60_000 : 24 * 60 * 60_000) : (hasData ? 7 * 24 * 60 * 60_000 : 30 * 60_000);
  if (cache.rows[0] && age < maxAge) {
    console.log('[CACHE] Reusing existing match data');
    let cachedMatch = dbData;
    // Older cached lineups may have been synchronized without image URLs.
    // Repair them from the already-cached API payload, without another API call.
    const cachedPlayerCount = endpoint === 'lineups' && hasData
      ? payload.reduce((total: number, team: any) => total + (team.startXI?.length ?? 0) + (team.substitutes?.length ?? 0), 0)
      : 0;
    const databasePlayerCount = dbData.lineups.reduce((total: number, team: any) => total + team.starters.length + team.substitutes.length, 0);
    if (endpoint === 'lineups' && hasData && (
      (cachedPlayerCount > 0 && databasePlayerCount === 0) ||
      dbData.lineups.some((team: any) =>
        (team.coach?.name && !team.coach.photo) ||
        [...(team.starters ?? []), ...(team.substitutes ?? [])].some((player: any) => !player.photo)
      )
    )) {
      await persistMatchDetailsToDatabase(fixtureId, {
        fixture: { id: dbData.fixture.id, date: dbData.fixture.date, venue: dbData.fixture.venue, status: dbData.fixture.status },
        league: {
          id: dbData.league.id, name: dbData.league.name, country: dbData.league.country,
          season: new Date(dbData.fixture.date).getFullYear(),
        },
        teams: dbData.teams, goals: dbData.goals,
        lineups: payload, events: [],
      } as DetailedMockMatch);
      cachedMatch = await pullMatchDetailsFromDatabase(fixtureId) ?? dbData;
      console.log('[DB] Cached lineup image URLs repaired');
    }
    // An empty endpoint cache means the API had no new detail data. Preserve
    // any lineup, coach, and unavailable-player rows already stored in PostgreSQL.
    const match = !hasData && endpoint === 'events'
      ? { ...cachedMatch, events: [] }
      : cachedMatch;
    return { match, payload };
  }
  if (endpoint === 'lineups' && dbData.lineups.some((team: any) => team.starters.length || team.substitutes.length)) {
    console.log('[DB] Lineup served from database');
    return { match: dbData, payload: dbData.lineups };
  }
  if (endpoint === 'events' && dbData.fixture.status.short === 'UPCOMING') {
    return { match: { ...dbData, events: [] }, payload: [] };
  }
  if (endpoint === 'events' && !live && dbData.events.length > 0) {
    console.log('[DB] Match events served from database');
    return { match: dbData, payload: dbData.events };
  }
  try {
    console.log(`[API] Fetching missing ${endpoint} data for match ${fixtureId}`);
    const fresh = await callApiFootball(endpoint === 'events' ? `/fixtures/events?fixture=${fixtureId}` : `/fixtures/lineups?fixture=${fixtureId}`);
    const detail = {
      fixture: { id: dbData.fixture.id, date: dbData.fixture.date, venue: dbData.fixture.venue, status: dbData.fixture.status },
      league: dbData.league, teams: dbData.teams, goals: dbData.goals,
      lineups: endpoint === 'lineups' ? fresh : [], events: endpoint === 'events' ? fresh : [],
    } as DetailedMockMatch;
    await persistMatchDetailsToDatabase(fixtureId, detail);
    await pool.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
      VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
      ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
      [fixtureId, endpoint, JSON.stringify(fresh)]);
    console.log(`[DB] ${endpoint === 'lineups' ? 'Lineup' : 'Match events'} synchronized`);
    const synced = await pullMatchDetailsFromDatabase(fixtureId) ?? dbData;
    // A successful empty lineup response is not permission to erase existing
    // PostgreSQL lineup data. API responses are only additive/updating here.
    const match = fresh.length ? synced : endpoint === 'events'
      ? { ...synced, events: [] }
      : synced;
    return { match, payload: fresh };
  } catch (error) {
    console.warn(`[API] ${endpoint} unavailable; serving database data: ${(error as Error).message}`);
    return { match: dbData, payload: endpoint === 'events' ? dbData.events : dbData.lineups };
  }
}

const detailInFlight = new Map<string, ReturnType<typeof loadCachedMatchEndpoint>>();
export function getCachedMatchEndpoint(matchId: number, endpoint: 'events' | 'lineups') {
  const key = `${matchId}:${endpoint}`;
  const existing = detailInFlight.get(key);
  if (existing) {
    console.log('[CACHE] Reusing in-flight match detail sync');
    return existing;
  }
  const request = loadCachedMatchEndpoint(matchId, endpoint).finally(() => detailInFlight.delete(key));
  detailInFlight.set(key, request);
  return request;
}

export async function executeMatchDetailPipeline(matchId: number) {
  const dbData = await hydrateMatch(matchId);
  if (!dbData) throw new Error(`Match ${matchId} not found in PostgreSQL or API-Football`);
  const [lineups, events] = await Promise.all([
    getCachedMatchEndpoint(matchId, 'lineups'), getCachedMatchEndpoint(matchId, 'events'),
  ]);
  return { ...(events?.match ?? lineups?.match ?? dbData),
    _pipelineMetadata: { source: 'PostgreSQL', databaseVerified: true, retrievedDirectlyFromDatabase: true } };
}
