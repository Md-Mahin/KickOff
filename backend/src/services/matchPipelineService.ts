import { pool } from "../db";
import type { MatchDetails, BasicMatchItem } from "./matchTypes";
import { callApiFootball as requestApiFootball } from "./apiFootballClient";
import { syncFixtureToDb, upsertApiPlayer, upsertApiTeam, upsertApiTournament } from "./footballService";
import { syncSecondaryFootballProvidersToday } from "./secondaryFootballProviders";
import { getMissingDetailCategories, PROVIDER_CAPABILITIES, type DetailCategory } from "./providerCapabilities";

const todayStr = () => new Date().toISOString().split("T")[0];
const matchDetailInFlight = new Map<number, Promise<boolean>>();
const fallbackRangeInFlight = new Map<string, Promise<void>>();
const fallbackRangeCheckedAt = new Map<string, number>();

function enrichMappedProviderMatchOnce(fixtureId: number, status: string) {
  const existing = matchDetailInFlight.get(fixtureId);
  if (existing) return existing;
  const request = Promise.resolve().then(() => {
    if (fixtureId >= 8_000_000_000_000 && fixtureId < 9_000_000_000_000) {
      const { syncSportsDbMatchDetails } = require("./sportsDbClient") as typeof import("./sportsDbClient");
      return syncSportsDbMatchDetails(fixtureId, status);
    }
    if (fixtureId >= 7_000_000_000_000 && fixtureId < 8_000_000_000_000) {
      const { syncFootballDataMatchDetails } = require("./footballDataClient") as typeof import("./footballDataClient");
      return syncFootballDataMatchDetails(fixtureId);
    }
    return false;
  })
    .finally(() => matchDetailInFlight.delete(fixtureId));
  matchDetailInFlight.set(fixtureId, request);
  return request;
}

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
  source: "Database";
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

    if (Array.isArray(items) && items.length === 0 && (process.env.FOOTBALL_DATA_TOKEN || process.env.SPORTSDB_API_KEY)) {
      await syncSecondaryFootballProvidersToday();
      const { rows } = await pool.query(`
        SELECT COALESCE(m.ApiFixtureID, m.MatchID) AS MatchID, m.MatchDate, m.HomeGoals, m.AwayGoals,
          t.TournamentID, t.Name AS TournamentName,
          h.TeamID AS HomeTeamID, h.Name AS HomeTeamName, h.Logo AS HomeLogo,
          a.TeamID AS AwayTeamID, a.Name AS AwayTeamName, a.Logo AS AwayLogo
        FROM Match m JOIN Tournament t ON t.TournamentID = m.TournamentID
        JOIN Team h ON h.TeamID = m.HomeTeamID JOIN Team a ON a.TeamID = m.AwayTeamID
        WHERE m.ApiFixtureID IS NOT NULL AND m.MatchDate::date = $1::date ORDER BY m.MatchDate
      `, [today]);
      await markFixtureListSync();
      return { source: "Database", matches: rows.map((r: any) => mapBasicMatch(r)) };
    }

    if (Array.isArray(items)) {
      await markFixtureListSync();
      return { source: "Database", matches: databaseRows.map((r: any) => mapBasicMatch(r)) };
    }
    throw new Error("API-Football returned an invalid fixture response");
  } catch (error) {
    await markFixtureListSync(true).catch(() => {});
    console.warn(
      `[Basic Match List] API-Football unavailable; using database data when available (${(error as Error).message}).`
    );
    if (databaseRows.length) return { source: "Database", matches: databaseRows.map((r: any) => mapBasicMatch(r)) };
    await syncSecondaryFootballProvidersToday();
    const { rows } = await pool.query(`
      SELECT COALESCE(m.ApiFixtureID, m.MatchID) AS MatchID, m.MatchDate, m.HomeGoals, m.AwayGoals,
        t.TournamentID, t.Name AS TournamentName,
        h.TeamID AS HomeTeamID, h.Name AS HomeTeamName, h.Logo AS HomeLogo,
        a.TeamID AS AwayTeamID, a.Name AS AwayTeamName, a.Logo AS AwayLogo
      FROM Match m JOIN Tournament t ON t.TournamentID = m.TournamentID
      JOIN Team h ON h.TeamID = m.HomeTeamID JOIN Team a ON a.TeamID = m.AwayTeamID
      WHERE m.ApiFixtureID IS NOT NULL AND m.MatchDate::date = $1::date ORDER BY m.MatchDate
    `, [today]);
    return { source: "Database", matches: rows.map((r: any) => mapBasicMatch(r)) };
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

// 
// 2. Database synchronization for API-backed detail data.
// 

export async function persistMatchDetailsToDatabase(
  matchId: number,
  data: MatchDetails
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
    `SELECT MatchID FROM Match WHERE ApiFixtureID = $1::bigint OR MatchID = $1::bigint
     ORDER BY CASE WHEN ApiFixtureID = $1::bigint THEN 0 ELSE 1 END LIMIT 1`,
    [fixture.id ?? matchId]
  );
  if (existingMatch.rows.length) {
    databaseMatchId = Number(existingMatch.rows[0].matchid);
    await pool.query(
      `UPDATE Match SET ApiFixtureID = $2, TournamentID = $3, HomeTeamID = $4, AwayTeamID = $5,
         VenueID = COALESCE($6, VenueID), MatchDate = $7,
         HomeGoals = COALESCE($8, HomeGoals), AwayGoals = COALESCE($9, AwayGoals),
         ApiStatus = COALESCE($10, ApiStatus), ApiElapsed = COALESCE($11, ApiElapsed),
         HalfTimeHomeGoals = COALESCE($12, HalfTimeHomeGoals), HalfTimeAwayGoals = COALESCE($13, HalfTimeAwayGoals),
         Matchday = COALESCE($14, Matchday), MatchStage = COALESCE($15, MatchStage)
       WHERE MatchID = $1`,
      [databaseMatchId, fixture.id ?? matchId, leagueId, homeId, awayId, venueId, matchDate,
        goals.home ?? null, goals.away ?? null, fixture.status?.short ?? null, fixture.status?.elapsed ?? null,
        goals.halftime?.home ?? null, goals.halftime?.away ?? null, fixture.round?.matchday ?? null, fixture.round?.stage ?? null]
    );
  } else {
    const insertedMatch = await pool.query(
      `INSERT INTO Match (ApiFixtureID, TournamentID, HomeTeamID, AwayTeamID, VenueID, MatchDate,
        HomeGoals, AwayGoals, ApiStatus, ApiElapsed, HalfTimeHomeGoals, HalfTimeAwayGoals, Matchday, MatchStage)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING MatchID`,
      [fixture.id ?? matchId, leagueId, homeId, awayId, venueId, matchDate, goals.home ?? 0, goals.away ?? 0,
        fixture.status?.short ?? null, fixture.status?.elapsed ?? null,
        goals.halftime?.home ?? null, goals.halftime?.away ?? null, fixture.round?.matchday ?? null, fixture.round?.stage ?? null]
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
      const extraTime = ev.time?.injuryTime ?? null;
      const teamId = ev.team?.name ? await upsertApiTeam(ev.team, countryId) : null;
      const playerId = ev.player?.id && ev.player?.name ? await upsertApiPlayer(ev.player) : null;
      const assistPlayerId = ev.assist?.id && ev.assist?.name ? await upsertApiPlayer(ev.assist) : null;
      const typeStr = (ev.type || "").toLowerCase();

      let eventType: "Goal" | "Card" | "Substitution" | "Foul" | "VAR" | null = null;
      if (typeStr.includes("goal")) eventType = "Goal";
      else if (typeStr.includes("card")) eventType = "Card";
      else if (typeStr.includes("sub")) eventType = "Substitution";
      else if (typeStr.includes("foul")) eventType = "Foul";
      else if (typeStr.includes("var")) eventType = "VAR";
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
        await pool.query(`UPDATE Event SET
          TeamID = COALESCE($2, TeamID),
          EventExtraTime = COALESCE($3, EventExtraTime),
          EventDetail = COALESCE($4, EventDetail)
          WHERE EventID = $1`, [eventId, teamId, extraTime, ev.detail ?? null]);
      } else {
        const insRes = await pool.query(
          `INSERT INTO Event (MatchID, PlayerID, TeamID, EventTime, EventExtraTime, EventDetail, EventType)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING EventID`,
          [databaseMatchId, playerId, teamId, elapsed, extraTime, ev.detail ?? null, eventType]
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
      m.HalfTimeHomeGoals,
      m.HalfTimeAwayGoals,
      m.Matchday,
      m.MatchStage,
      m.ApiStatus,
      m.ApiElapsed,
      m.round_status,
      m.round_position,
      t.TournamentID,
      t.Name AS TournamentName,
      t.Country AS TournamentCountry,
      t.Edition AS TournamentEdition,
      home.TeamID AS HomeTeamID,
      home.Name AS HomeTeamName,
      home.Logo AS HomeTeamLogo,
      away.TeamID AS AwayTeamID,
      away.Name AS AwayTeamName,
      away.Logo AS AwayTeamLogo,
      venue.Name AS VenueName,
      venue.City AS VenueCity,
      venueCountry.Name AS VenueCountry,
      COALESCE((
        SELECT array_agg(r.Name ORDER BY CASE WHEN mo.Role = 'Main' THEN 0 ELSE 1 END, r.Name)
        FROM MatchOfficiating mo JOIN Referee r ON r.RefereeID = mo.RefereeID
        WHERE mo.MatchID = m.MatchID
          AND LOWER(TRIM(r.Name)) NOT IN ('match official', 'referee', 'unknown', 'tbd')
      ), ARRAY[]::varchar[]) AS Referees
    FROM Match m
    JOIN Tournament t ON m.TournamentID = t.TournamentID
    JOIN Team home ON m.HomeTeamID = home.TeamID
    JOIN Team away ON m.AwayTeamID = away.TeamID
    LEFT JOIN Venue venue ON m.VenueID = venue.VenueID
    LEFT JOIN Country venueCountry ON venue.CountryID = venueCountry.CountryID
    WHERE m.MatchID = $1::bigint OR m.ApiFixtureID = $1::bigint
    ORDER BY CASE WHEN m.ApiFixtureID = $1::bigint THEN 0 ELSE 1 END
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
  const apiStatus = String(row.apistatus ?? "").toUpperCase();
  let status: "LIVE" | "FT" | "UPCOMING" = "UPCOMING";
  let elapsed: number | null = null;

  if (["1H", "2H", "HT", "ET", "BT", "P", "SUSP", "INT", "LIVE", "IN_PLAY", "PAUSED"].includes(apiStatus)) {
    status = "LIVE";
    elapsed = row.apielapsed == null ? (mins >= 0 ? Math.min(mins, 90) : null) : Number(row.apielapsed);
  } else if (["FT", "AET", "PEN", "FINISHED", "AWARDED"].includes(apiStatus)) {
    status = "FT";
    elapsed = 90;
  } else if (!apiStatus && mins >= 0 && mins < 120) {
    status = "LIVE";
    elapsed = Math.min(mins, 90);
  } else if (!apiStatus && mins >= 120) {
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
      l.LineupOrder,
      p.Name AS PlayerName,
      p.Photo AS PlayerPhoto,
      pms.Rating AS MatchRating,
      pms.MinutesPlayed AS MatchMinutes,
      pms.Goals AS MatchGoals,
      pms.Assists AS MatchAssists,
      pms.YellowCards AS MatchYellowCards,
      pms.RedCards AS MatchRedCards,
      tmc.CoachName,
      tmc.CoachPhoto
    FROM Lineup l
    JOIN Player p ON l.PlayerID = p.PlayerID
    LEFT JOIN PlayerMatchStat pms ON pms.MatchID = l.MatchID AND pms.PlayerID = l.PlayerID
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
  const playerStatsRes = await pool.query(`
    SELECT pms.PlayerID, p.Name AS PlayerName, l.TeamID, team.Name AS TeamName,
      pms.MinutesPlayed, pms.Goals, pms.Assists, pms.Shots, pms.ShotsOnTarget,
      pms.Passes, pms.KeyPasses, pms.Tackles, pms.Interceptions, pms.Clearances,
      pms.Saves, pms.YellowCards, pms.RedCards, pms.Rating
    FROM PlayerMatchStat pms
    JOIN Player p ON p.PlayerID = pms.PlayerID
    LEFT JOIN Lineup l ON l.MatchID = pms.MatchID AND l.PlayerID = pms.PlayerID
    LEFT JOIN Team team ON team.TeamID = l.TeamID
    WHERE pms.MatchID = $1
    ORDER BY team.Name NULLS LAST, p.Name
  `, [row.matchid]);
  const standingsRes = await pool.query(`
    SELECT s.TeamID, team.Name AS TeamName, s.Ranking, s.Wins, s.Draws, s.Losses,
      s.GoalsFor, s.GoalsAgainst, s.Points
    FROM Standing s JOIN Team team ON team.TeamID = s.TeamID
    WHERE s.TournamentID = $1 AND s.TeamID IN ($2, $3)
  `, [row.tournamentid, row.hometeamid, row.awayteamid]);
  const headToHeadRes = await pool.query(`
    SELECT m.MatchID, m.MatchDate, m.HomeTeamID, m.AwayTeamID,
      home.Name AS HomeTeam, away.Name AS AwayTeam, m.HomeGoals, m.AwayGoals
    FROM Match m
    JOIN Team home ON home.TeamID = m.HomeTeamID
    JOIN Team away ON away.TeamID = m.AwayTeamID
    WHERE m.MatchID <> $1
      AND ((m.HomeTeamID = $2 AND m.AwayTeamID = $3) OR (m.HomeTeamID = $3 AND m.AwayTeamID = $2))
      AND m.HomeGoals IS NOT NULL AND m.AwayGoals IS NOT NULL
    ORDER BY m.MatchDate DESC
    LIMIT 5
  `, [row.matchid, row.hometeamid, row.awayteamid]);

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
      rating: s.matchrating == null ? null : String(s.matchrating),
      minutes: s.matchminutes == null ? null : Number(s.matchminutes),
      goals: Number(s.matchgoals ?? 0),
      assists: Number(s.matchassists ?? 0),
      yellowCards: Number(s.matchyellowcards ?? 0),
      redCards: Number(s.matchredcards ?? 0),
    }));

    const mappedSubs = subs.map((s) => ({
      id: Number(s.playerid),
      name: s.playername,
      photo: s.playerphoto ?? null,
      number: s.jerseynumber == null ? null : Number(s.jerseynumber),
      position: s.position ?? null,
      grid: null,
      rating: s.matchrating == null ? null : String(s.matchrating),
      minutes: s.matchminutes == null ? null : Number(s.matchminutes),
      goals: Number(s.matchgoals ?? 0),
      assists: Number(s.matchassists ?? 0),
      yellowCards: Number(s.matchyellowcards ?? 0),
      redCards: Number(s.matchredcards ?? 0),
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
      e.EventExtraTime,
      e.EventDetail,
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
    ORDER BY e.EventTime ASC, e.EventID ASC
    `,
    [row.matchid]
  );

  const events = eventsRes.rows.map((ev) => ({
    eventid: Number(ev.eventid),
    eventtime: ev.eventtime == null ? null : Number(ev.eventtime),
    eventextratime: ev.eventextratime == null ? null : Number(ev.eventextratime),
    eventdetail: ev.eventdetail ?? null,
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
    round_status: row.round_status ?? "league",
    round_position: row.round_position ?? null,
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
      referees: row.referees ?? [],
      round: { matchday: row.matchday == null ? null : Number(row.matchday), stage: row.matchstage ?? null },
    },
    league: {
      id: Number(row.tournamentid),
      name: row.tournamentname,
      country: row.tournamentcountry ?? "International",
      edition: row.tournamentedition ?? null,
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
      halftime: row.halftimehomegoals == null && row.halftimeawaygoals == null
        ? null
        : {
            home: row.halftimehomegoals == null ? null : Number(row.halftimehomegoals),
            away: row.halftimeawaygoals == null ? null : Number(row.halftimeawaygoals),
          },
    },
    lineups,
    events,
    playerStatistics: playerStatsRes.rows.map((stat) => ({
      playerId: Number(stat.playerid), playerName: stat.playername,
      teamId: stat.teamid == null ? null : Number(stat.teamid), teamName: stat.teamname ?? null,
      minutes: Number(stat.minutesplayed), goals: Number(stat.goals), assists: Number(stat.assists),
      shots: Number(stat.shots), shotsOnTarget: Number(stat.shotsontarget), passes: Number(stat.passes),
      keyPasses: Number(stat.keypasses), tackles: Number(stat.tackles), interceptions: Number(stat.interceptions),
      clearances: Number(stat.clearances), saves: Number(stat.saves), yellowCards: Number(stat.yellowcards),
      redCards: Number(stat.redcards), rating: stat.rating == null ? null : Number(stat.rating),
    })),
    standings: standingsRes.rows.map((standing) => ({
      teamId: Number(standing.teamid), teamName: standing.teamname,
      rank: standing.ranking == null ? null : Number(standing.ranking),
      wins: Number(standing.wins ?? 0), draws: Number(standing.draws ?? 0), losses: Number(standing.losses ?? 0),
      goalsFor: Number(standing.goalsfor ?? 0), goalsAgainst: Number(standing.goalsagainst ?? 0),
      points: standing.points == null ? null : Number(standing.points),
    })),
    headToHead: headToHeadRes.rows.map((prior) => ({
      id: Number(prior.matchid), date: prior.matchdate,
      homeTeam: prior.hometeam, awayTeam: prior.awayteam,
      homeScore: prior.homegoals == null ? null : Number(prior.homegoals),
      awayScore: prior.awaygoals == null ? null : Number(prior.awaygoals),
    })),
    teamStatistics: null,
  };
}

// ============================================================================
// Database-first detail hydration. Detail endpoints are loaded only when requested.
async function hydrateMatch(matchId: number) {
  let dbData = await pullMatchDetailsFromDatabase(matchId);
  if (dbData) {
    // Enrich only IDs whose provider namespace is present in the database row.
    if (dbData._apiFixtureId != null && dbData._apiFixtureId >= 7_000_000_000_000 && dbData._apiFixtureId < 9_000_000_000_000) {
      try {
        const updated = await enrichMappedProviderMatchOnce(dbData._apiFixtureId, dbData.fixture.status.short);
        if (updated) dbData = await pullMatchDetailsFromDatabase(matchId) ?? dbData;
      } catch (error) {
        console.warn(`[match-provider] Detail enrichment unavailable for ${dbData._apiFixtureId}: ${(error as Error).message}`);
      }
    }
    console.log('[DB] Match data served from database');
    return dbData;
  }
  // An unknown URL ID has no verified provider mapping. Do not guess that it is
  // an API-Football fixture ID and query an unrelated provider with it.
  return null;
}

async function loadAlternateProviderDetails(match: any) {
  if (!process.env.FOOTBALL_DATA_TOKEN && !process.env.SPORTSDB_API_KEY) return null;
  const date = new Date(match.fixture.date).toISOString().slice(0, 10);
  if (Date.now() - (fallbackRangeCheckedAt.get(date) ?? 0) < 15 * 60_000) return null;
  let sync = fallbackRangeInFlight.get(date);
  if (!sync) {
    sync = import("./secondaryFootballProviders.js").then(({ syncSecondaryFootballProvidersRange }) =>
      syncSecondaryFootballProvidersRange(date, date).then(() => undefined),
    ).catch((error) => {
      console.warn(`[Provider] Alternate match lookup failed for ${date}: ${(error as Error).message}`);
    }).finally(() => fallbackRangeInFlight.delete(date));
    fallbackRangeInFlight.set(date, sync);
  }
  await sync;
  fallbackRangeCheckedAt.set(date, Date.now());

  const currentId = Number(match._apiFixtureId ?? 0);
  const candidates = await pool.query(`
    SELECT m.ApiFixtureID
    FROM Match m
    JOIN Team home ON home.TeamID = m.HomeTeamID
    JOIN Team away ON away.TeamID = m.AwayTeamID
    WHERE m.ApiFixtureID IS NOT NULL AND m.ApiFixtureID <> $1::bigint
      AND m.MatchDate::date = $2::date
      AND LOWER(TRIM(home.Name)) = LOWER(TRIM($3))
      AND LOWER(TRIM(away.Name)) = LOWER(TRIM($4))
      AND m.ApiFixtureID >= 7000000000000 AND m.ApiFixtureID < 9000000000000
      AND CASE
        WHEN $1::bigint >= 7000000000000 AND $1::bigint < 8000000000000
          THEN m.ApiFixtureID >= 8000000000000
        WHEN $1::bigint >= 8000000000000 AND $1::bigint < 9000000000000
          THEN m.ApiFixtureID < 8000000000000
        ELSE TRUE
      END
    ORDER BY CASE WHEN m.ApiFixtureID >= 8000000000000 THEN 0 ELSE 1 END
    LIMIT 2`, [currentId, date, match.teams.home.name, match.teams.away.name]);
  if (candidates.rows.length > 1) {
    console.warn(`[Provider] Ambiguous alternate mapping for ${match.teams.home.name} vs ${match.teams.away.name}; skipping cross-provider attachment`);
    return null;
  }
  const alternateId = Number(candidates.rows[0]?.apifixtureid);
  if (!alternateId) return null;
  try {
    await enrichMappedProviderMatchOnce(alternateId, match.fixture.status.short);
    return await pullMatchDetailsFromDatabase(alternateId);
  } catch (error) {
    console.warn(`[Provider] Alternate details unavailable for ${alternateId}: ${(error as Error).message}`);
    return null;
  }
}

async function syncApiFootballPlayerStats(fixtureId: number, databaseMatchId: number, status: string) {
  const cache = await pool.query(
    "SELECT Payload, FetchedAt FROM MatchApiCache WHERE MatchID = $1 AND Endpoint = 'players'",
    [fixtureId],
  );
  if (cache.rows[0]) {
    const age = Date.now() - new Date(cache.rows[0].fetchedat).getTime();
    const hasStats = Array.isArray(cache.rows[0].payload) && cache.rows[0].payload.length > 0;
    const ttl = status === "LIVE" ? 2 * 60_000 : status === "FT" ? (hasStats ? 7 : 1) * 24 * 60 * 60_000 : 30 * 60_000;
    if (age < ttl) return;
  }
  const response = await callApiFootball(`/fixtures/players?fixture=${fixtureId}`);
  for (const block of response) {
    for (const entry of block.players ?? []) {
      const player = entry.player;
      const stat = entry.statistics?.[0];
      if (!player?.name || !stat) continue;
      const playerId = await upsertApiPlayer({ id: player.id, name: player.name, photo: player.photo ?? null, pos: stat.games?.position ?? null });
      if (!playerId) continue;
      const number = (value: unknown, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      };
      await pool.query(`INSERT INTO PlayerMatchStat
        (PlayerID, MatchID, MinutesPlayed, Goals, Assists, Shots, ShotsOnTarget, Passes, KeyPasses,
         Tackles, Interceptions, Saves, CleanSheet, YellowCards, RedCards, GoalsConceded, Rating)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        ON CONFLICT (PlayerID, MatchID) DO UPDATE SET
          MinutesPlayed=EXCLUDED.MinutesPlayed, Goals=EXCLUDED.Goals, Assists=EXCLUDED.Assists,
          Shots=EXCLUDED.Shots, ShotsOnTarget=EXCLUDED.ShotsOnTarget, Passes=EXCLUDED.Passes,
          KeyPasses=EXCLUDED.KeyPasses, Tackles=EXCLUDED.Tackles, Interceptions=EXCLUDED.Interceptions,
          Saves=EXCLUDED.Saves, CleanSheet=EXCLUDED.CleanSheet,
          YellowCards=EXCLUDED.YellowCards, RedCards=EXCLUDED.RedCards,
          GoalsConceded=EXCLUDED.GoalsConceded, Rating=EXCLUDED.Rating`, [
        playerId, databaseMatchId,
        Math.max(0, Math.min(130, number(stat.games?.minutes))),
        Math.max(0, number(stat.goals?.total)), Math.max(0, number(stat.goals?.assists)),
        Math.max(0, number(stat.shots?.total)), Math.max(0, number(stat.shots?.on)),
        Math.max(0, number(stat.passes?.total)), Math.max(0, number(stat.passes?.key)),
        Math.max(0, number(stat.tackles?.total)), Math.max(0, number(stat.tackles?.interceptions)),
        Math.max(0, number(stat.goals?.saves)),
        stat.goals?.conceded === 0 ? 1 : 0,
        Math.max(0, Math.min(2, number(stat.cards?.yellow))),
        Math.max(0, Math.min(1, number(stat.cards?.red))),
        Math.max(0, number(stat.goals?.conceded)),
        stat.games?.rating == null || !Number.isFinite(Number(stat.games.rating)) ? null : Math.max(0, Math.min(10, Number(stat.games.rating))),
      ]);
    }
  }
  await pool.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
    VALUES ($1, 'players', $2::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
    [fixtureId, JSON.stringify(response)]);
}

async function hydratePlayerStats(match: any) {
  const fixtureId = match._apiFixtureId;
  if (fixtureId == null || fixtureId >= 7_000_000_000_000 || match.fixture.status.short === "UPCOMING" || match._databaseMatchId == null) return match;
  try {
    await syncApiFootballPlayerStats(fixtureId, match._databaseMatchId, match.fixture.status.short);
    return await pullMatchDetailsFromDatabase(fixtureId) ?? match;
  } catch (error) {
    console.warn(`[API] Player statistics unavailable: ${(error as Error).message}`);
    return match;
  }
}

async function loadCachedMatchEndpoint(matchId: number, endpoint: 'events' | 'lineups') {
  const dbData = await hydrateMatch(matchId);
  if (!dbData) return null;
  const fixtureId = dbData._apiFixtureId;
  if (fixtureId == null) {
    console.log('[DB] Local match data served; no API fixture mapping exists');
    return { match: dbData, payload: endpoint === 'events' ? dbData.events : dbData.lineups };
  }
  // Provider IDs are namespaced. Do not send football-data/TheSportsDB IDs to
  // API-Football; this avoids guaranteed failures and preserves the provider's
  // own detail data already synchronized into PostgreSQL.
  if (fixtureId >= 7_000_000_000_000) {
    return { match: dbData, payload: endpoint === 'events' ? dbData.events : dbData.lineups };
  }
  const cache = await pool.query('SELECT Payload, FetchedAt FROM MatchApiCache WHERE MatchID = $1 AND Endpoint = $2', [fixtureId, endpoint]);
  const payload = cache.rows[0]?.payload;
  const age = cache.rows[0] ? Date.now() - new Date(cache.rows[0].fetchedat).getTime() : Infinity;
  const hasData = Array.isArray(payload) && payload.length > 0;
  const live = dbData.fixture.status.short === 'LIVE';
  // Empty responses are often temporary provider gaps. Retry them frequently,
  // including for finished fixtures, instead of freezing missing timelines for a day.
  const maxAge = hasData
    ? endpoint === 'events' ? (live ? 5 * 60_000 : 24 * 60 * 60_000) : 7 * 24 * 60 * 60_000
    : 5 * 60_000;
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
      } as MatchDetails);
      cachedMatch = await pullMatchDetailsFromDatabase(fixtureId) ?? dbData;
      console.log('[DB] Cached lineup image URLs repaired');
    }
    // An empty endpoint cache means the API had no new detail data. Preserve
    // any lineup, coach, and unavailable-player rows already stored in PostgreSQL.
    const match = !hasData && endpoint === 'events'
      ? { ...cachedMatch, events: [] }
      : cachedMatch;
    return { match: endpoint === 'lineups' ? await hydratePlayerStats(match) : match, payload };
  }
  if (endpoint === 'lineups' && dbData.lineups.some((team: any) => team.starters.length || team.substitutes.length)) {
    console.log('[DB] Lineup served from database');
    return { match: await hydratePlayerStats(dbData), payload: dbData.lineups };
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
      fixture: { id: dbData.fixture.id, date: dbData.fixture.date, venue: dbData.fixture.venue, round: dbData.fixture.round, status: dbData.fixture.status },
      league: { ...dbData.league, season: Number(dbData.league.edition) || new Date(dbData.fixture.date).getUTCFullYear() },
      teams: dbData.teams, goals: dbData.goals,
      lineups: endpoint === 'lineups' ? fresh : [], events: endpoint === 'events' ? fresh : [],
    } as MatchDetails;
    await persistMatchDetailsToDatabase(fixtureId, detail);
    await pool.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
      VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
      ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
      [fixtureId, endpoint, JSON.stringify(fresh)]);
    console.log(`[DB] ${endpoint === 'lineups' ? 'Lineup' : 'Match events'} synchronized`);
    const synced = await pullMatchDetailsFromDatabase(fixtureId) ?? dbData;
    const withStats = endpoint === 'lineups' ? await hydratePlayerStats(synced) : synced;
    // A successful empty lineup response is not permission to erase existing
    // PostgreSQL lineup data. API responses are only additive/updating here.
    const match = fresh.length ? withStats : endpoint === 'events'
      ? { ...withStats, events: [] }
      : withStats;
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

async function applyFieldLevelFallback(match: any): Promise<{ match: any; providerId: number | null }> {
  const missing = getMissingDetailCategories(match);
  const enrichable = missing.some((category) =>
    ["venue", "referee", "events", "lineups", "coaches", "substitutes"].includes(category),
  );
  if (!enrichable) return { match, providerId: null };

  try {
    const alternate = await loadAlternateProviderDetails(match);
    if (!alternate) return { match, providerId: null };
    const mergeLineup = (primary: any, fallback: any) => {
      if (!primary) return fallback;
      if (!fallback) return primary;
      return {
        ...primary,
        formation: primary.formation ?? fallback.formation,
        coach: primary.coach?.name ? primary.coach : fallback.coach,
        starters: primary.starters?.length ? primary.starters : fallback.starters ?? [],
        substitutes: primary.substitutes?.length ? primary.substitutes : fallback.substitutes ?? [],
        unavailable: primary.unavailable?.length ? primary.unavailable : fallback.unavailable ?? [],
      };
    };
    return {
      providerId: alternate._apiFixtureId ?? null,
      match: {
        ...match,
        events: match.events?.length ? match.events : alternate.events ?? [],
        lineups: [0, 1].map((index) => mergeLineup(match.lineups?.[index], alternate.lineups?.[index])),
        fixture: {
          ...match.fixture,
          venue: match.fixture?.venue ?? alternate.fixture?.venue,
          referees: match.fixture?.referees?.length ? match.fixture.referees : alternate.fixture?.referees ?? [],
        },
        league: {
          ...match.league,
          country: match.league?.country === "International" ? alternate.league?.country : match.league?.country,
        },
      },
    };
  } catch (error) {
    console.warn(`[fallback] Alternate provider could not fill match details: ${(error as Error).message}`);
    return { match, providerId: null };
  }
}

export async function executeMatchDetailPipeline(matchId: number) {
  const dbData = await hydrateMatch(matchId);
  if (!dbData) throw new Error(`Match ${matchId} not found in PostgreSQL or without a verified provider mapping`);
  const [lineups, events] = await Promise.all([
    getCachedMatchEndpoint(matchId, 'lineups'), getCachedMatchEndpoint(matchId, 'events'),
  ]);
  let match = events?.match ?? lineups?.match ?? dbData;
  const fallback = await applyFieldLevelFallback(match);
  match = fallback.match;
  const fallbackProviderId = fallback.providerId;

  const providerEndpoint = Number(match._apiFixtureId ?? 0) >= 8_000_000_000_000 ? "tds-detail" : "fd-detail";
  const providerCache = match._apiFixtureId == null ? null : await pool.query(
    "SELECT Payload FROM MatchApiCache WHERE MatchID = $1 AND Endpoint = $2",
    [match._apiFixtureId, providerEndpoint],
  );
  const cacheData = providerCache?.rows[0]?.payload ?? {};
  const providerIds = [...new Set([Number(match._apiFixtureId), Number(fallbackProviderId)].filter((id) => id > 0))];
  const cachedProviderDetails = new Map<number, any>();
  for (const providerId of providerIds) {
    if (providerId >= 7_000_000_000_000 && providerId < 9_000_000_000_000) {
      const endpoint = providerId >= 8_000_000_000_000 ? "tds-detail" : "fd-detail";
      const result = await pool.query(
        "SELECT Payload FROM MatchApiCache WHERE MatchID = $1 AND Endpoint = $2",
        [providerId, endpoint],
      );
      cachedProviderDetails.set(providerId, result.rows[0]?.payload ?? {});
    } else {
      const result = await pool.query(
        "SELECT Endpoint, Payload FROM MatchApiCache WHERE MatchID = $1 AND Endpoint IN ('events', 'lineups')",
        [providerId],
      );
      cachedProviderDetails.set(providerId, {
        eventCount: result.rows.find((row) => row.endpoint === "events")?.payload?.length ?? 0,
        hasLineups: (result.rows.find((row) => row.endpoint === "lineups")?.payload ?? []).some(
          (team: any) => (team.startXI?.length ?? 0) > 0,
        ),
        hasSubstitutes: (result.rows.find((row) => row.endpoint === "lineups")?.payload ?? []).some(
          (team: any) => (team.substitutes?.length ?? 0) > 0,
        ),
      });
    }
  }
  const availableFields = {
    venue: Boolean(match.fixture.venue?.name),
    referee: Boolean(match.fixture.referees?.length),
    events: match.events.length > 0,
    lineups: match.lineups.some((team: any) => team.starters.length > 0),
    substitutes: match.lineups.some((team: any) => team.substitutes.length > 0),
    coaches: match.lineups.some((team: any) => Boolean(team.coach?.name)),
  };
  const providerField = {
    venue: "hasVenue",
    referee: "hasReferee",
    events: "eventCount",
    lineups: "hasLineups",
    substitutes: "hasSubstitutes",
    coaches: "hasCoaches",
  } as const;
  const providerName = (providerId: number) => providerId >= 8_000_000_000_000
    ? "TheSportsDB"
    : providerId >= 7_000_000_000_000 ? "football-data.org" : "API-Football";
  const fieldProviders = Object.fromEntries(Object.entries(availableFields).map(([field, available]) => {
    if (!available) return [field, null];
    const sourceId = providerIds.find((id) => {
      const value = cachedProviderDetails.get(id)?.[providerField[field as keyof typeof providerField]];
      return field === "events" ? Number(value) > 0 : Boolean(value);
    });
    return [field, sourceId ? providerName(sourceId) : "PostgreSQL (provider provenance not recorded)"];
  }));
  return { ...match,
    _detailAvailability: {
      source: fallbackProviderId != null && fallbackProviderId >= 8_000_000_000_000
        ? "TheSportsDB (fallback)"
        : fallbackProviderId != null && fallbackProviderId >= 7_000_000_000_000
          ? "football-data.org (fallback)"
          : match._apiFixtureId != null && match._apiFixtureId >= 8_000_000_000_000
            ? "TheSportsDB"
            : match._apiFixtureId != null && match._apiFixtureId >= 7_000_000_000_000 && match._apiFixtureId < 8_000_000_000_000
              ? "football-data.org"
              : match._apiFixtureId != null && match._apiFixtureId < 7_000_000_000_000
                ? "API-Football"
                : "PostgreSQL (provider provenance not recorded)",
      permission: cacheData.permission ?? null,
      venue: Boolean(match.fixture.venue?.name),
      referee: Boolean(match.fixture.referees?.length),
      events: match.events.length > 0,
      lineups: match.lineups.some((team: any) => team.starters.length > 0),
      coaches: match.lineups.some((team: any) => Boolean(team.coach?.name)),
      substitutes: match.lineups.some((team: any) => team.substitutes.length > 0),
      playerStats: match.lineups.some((team: any) => [...team.starters, ...team.substitutes].some((player: any) => player.goals || player.assists || player.minutes != null)),
      playerRatings: match.lineups.some((team: any) => [...team.starters, ...team.substitutes].some((player: any) => player.rating != null)),
      providers: fieldProviders,
    },
    _pipelineMetadata: { source: 'PostgreSQL', databaseVerified: true, retrievedDirectlyFromDatabase: true } };
}
