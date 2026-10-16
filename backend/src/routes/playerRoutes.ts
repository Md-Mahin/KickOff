
import { Router } from "express";
import { pool } from "../db";
import { optionalAuth } from "../middleware/auth";
import { callApiFootball } from "../services/apiFootballClient";
import {
  createPlayerProfileProviderCache,
  extractApiFootballPlayerFields,
  loadVerifiedProfileFields,
  missingProviderFields,
  normalizeStoredPlayerStats,
  type ApiFootballPlayerIdentity,
  type ApiFootballPlayerRecord,
  type PlayerProfileFields,
} from "../services/playerProfileService";

const router = Router();

const loadApiFootballPlayer = createPlayerProfileProviderCache(async (providerPlayerId: number) => {
  const season = new Date().getUTCFullYear();
  const response = await callApiFootball(`/players?id=${providerPlayerId}&season=${season}`, { purpose: "user-detail" });
  return response.find((item) => Number(item.player?.id) === providerPlayerId) as ApiFootballPlayerRecord | undefined ?? null;
});

const PROFILE_PLAYER_SELECT = `SELECT p.PlayerID, p.Name, p.DateOfBirth, p.NationalityCountryID,
  c.Name AS Nationality, p.Position, p.Photo, p.HeightCm, p.PreferredFoot,
  p.ApiPlayerID, p.ApiPlayerTeamID, p.ApiPlayerLeagueID
  FROM Player p LEFT JOIN Country c ON c.CountryID = p.NationalityCountryID`;

async function persistMissingProviderFields(playerId: number, providerPlayerId: number, fields: PlayerProfileFields) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      `SELECT DateOfBirth, NationalityCountryID, Position, Photo, HeightCm
       FROM Player WHERE PlayerID = $1 FOR UPDATE`,
      [playerId],
    );
    if (!current.rows[0]) {
      await client.query("COMMIT");
      return;
    }

    const row = current.rows[0];
    const updates: string[] = [];
    const values: unknown[] = [playerId];
    const provenance: string[] = [];
    const addUpdate = (column: string, field: keyof PlayerProfileFields, existing: unknown) => {
      const candidate = fields[field];
      if ((existing == null || existing === "") && candidate != null && candidate !== "") {
        values.push(candidate);
        updates.push(`${column} = $${values.length}`);
        provenance.push(String(field));
      }
    };

    addUpdate("DateOfBirth", "dateOfBirth", row.dateofbirth);
    addUpdate("Position", "position", row.position);
    addUpdate("Photo", "photo", row.photo);
    addUpdate("HeightCm", "heightCm", row.heightcm);

    if ((row.nationalitycountryid == null) && fields.nationality) {
      const country = await client.query(
        `INSERT INTO Country (Name) VALUES ($1) ON CONFLICT (Name) DO UPDATE SET Name = EXCLUDED.Name RETURNING CountryID`,
        [fields.nationality],
      );
      values.push(country.rows[0].countryid);
      updates.push(`NationalityCountryID = $${values.length}`);
      provenance.push("nationality");
    }

    if (updates.length) {
      await client.query(`UPDATE Player SET ${updates.join(", ")} WHERE PlayerID = $1`, values);
      for (const fieldName of provenance) {
        await client.query(
          `INSERT INTO PlayerFieldProvenance (PlayerID, FieldName, Source, ProviderPlayerID)
           VALUES ($1, $2, 'api-football', $3)
           ON CONFLICT (PlayerID, FieldName) DO NOTHING`,
          [playerId, fieldName, providerPlayerId],
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// GET /api/players/:id
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const playerId = Number(req.params.id);

    if (!Number.isSafeInteger(playerId) || playerId <= 0) {
      return res.status(400).json({ message: "Invalid player ID" });
    }

    let playerResult = await pool.query(`${PROFILE_PLAYER_SELECT} WHERE p.PlayerID = $1`, [playerId]);

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ message: "Player not found" });
    }

    let playerRow = playerResult.rows[0];
    const storedFields: PlayerProfileFields = {
      dateOfBirth: playerRow.dateofbirth ? new Date(playerRow.dateofbirth).toISOString().slice(0, 10) : null,
      nationality: playerRow.nationality ?? null,
      position: playerRow.position ?? null,
      photo: playerRow.photo ?? null,
      heightCm: playerRow.heightcm == null ? null : Number(playerRow.heightcm),
    };

    // Provider identity is usable only with a persisted API-Football player ID
    // and matching team or league context. Player names are never used to bind
    // an external profile to a local Player row.
    const providerPlayerId = Number(playerRow.apiplayerid);
    const identity: ApiFootballPlayerIdentity = {
      playerId: Number.isSafeInteger(providerPlayerId) && providerPlayerId > 0 ? providerPlayerId : null,
      teamId: playerRow.apiplayerteamid == null ? null : Number(playerRow.apiplayerteamid),
      leagueId: playerRow.apiplayerleagueid == null ? null : Number(playerRow.apiplayerleagueid),
    };
    if (missingProviderFields(storedFields).length && identity.playerId && (identity.teamId || identity.leagueId)) {
      try {
        // The shared API-Football client checks PostgreSQL cache, single-flights
        // concurrent requests, and enforces its quota pause before networking.
        let providerFields: PlayerProfileFields | null = null;
        const merged = await loadVerifiedProfileFields(storedFields, identity, async (externalId) => {
          const record = await loadApiFootballPlayer(externalId);
          if (record) providerFields = extractApiFootballPlayerFields(record, identity);
          return record;
        });
        if (merged.filled.length && providerFields) {
          await persistMissingProviderFields(playerId, identity.playerId, providerFields);
          playerResult = await pool.query(`${PROFILE_PLAYER_SELECT} WHERE p.PlayerID = $1`, [playerId]);
          playerRow = playerResult.rows[0];
        }
      } catch (error) {
        console.warn("[PlayerProfile] API-Football fallback unavailable:", (error as Error).message);
      }
    }

    // 2. Followers & Following status
    const followersResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM UserFollowsPlayer WHERE PlayerID = $1`,
      [playerId]
    );
    const followers = followersResult.rows[0]?.count ?? 0;

    let isFollowing = false;
    if (req.auth?.userId) {
      const followCheck = await pool.query(
        `SELECT 1 FROM UserFollowsPlayer WHERE UserID = $1 AND PlayerID = $2`,
        [req.auth.userId, playerId]
      );
      isFollowing = (followCheck.rowCount ?? 0) > 0;
    }

    // 3. Current Club
    const clubResult = await pool.query(
      `SELECT t.TeamID as id, t.Name, t.Logo, tph.Type as position, tph.BeginDate as joinDate
       FROM TeamPlayerHistory tph
       JOIN Team t ON tph.TeamID = t.TeamID
       WHERE tph.PlayerID = $1 AND tph.EndDate IS NULL
       ORDER BY tph.BeginDate DESC, tph.HistoryID DESC
       LIMIT 1`,
      [playerId]
    );

    let club = null;
    if (clubResult.rows.length > 0) {
      const clubRow = clubResult.rows[0];
      club = {
        id: clubRow.id,
        name: clubRow.name,
        logo: clubRow.logo,
        position: clubRow.position,
        joinDate: clubRow.joindate,
      };
    }

    // 4. Stats
    const performanceResult = await pool.query(
      `WITH relevant_matches AS (
         SELECT MatchID FROM PlayerMatchStat WHERE PlayerID = $1
         UNION
         SELECT MatchID FROM Event WHERE PlayerID = $1 AND EventType = 'Goal'
         UNION
         SELECT e.MatchID FROM Goal g JOIN Event e ON e.EventID = g.EventID WHERE g.AssistPlayerID = $1
       ), per_match AS (
         SELECT rm.MatchID, pms.PlayerID IS NOT NULL AS has_match_stats,
           pms.Goals AS stat_goals, pms.Assists AS stat_assists,
           (SELECT COUNT(*) FROM Event e WHERE e.MatchID = rm.MatchID AND e.PlayerID = $1 AND e.EventType = 'Goal') AS event_goals,
           (SELECT COUNT(*) FROM Goal g JOIN Event e ON e.EventID = g.EventID WHERE e.MatchID = rm.MatchID AND g.AssistPlayerID = $1) AS event_assists
         FROM relevant_matches rm
         LEFT JOIN PlayerMatchStat pms ON pms.MatchID = rm.MatchID AND pms.PlayerID = $1
       )
       SELECT COUNT(*)::int AS tracked_matches,
         CASE WHEN COUNT(*) = 0 THEN NULL ELSE SUM(CASE WHEN has_match_stats THEN stat_goals ELSE event_goals END)::int END AS total_goals,
         CASE WHEN COUNT(*) = 0 THEN NULL ELSE SUM(CASE WHEN has_match_stats THEN stat_assists ELSE event_assists END)::int END AS total_assists,
         CASE WHEN COUNT(*) = 0 THEN NULL
           WHEN BOOL_OR(has_match_stats) AND BOOL_OR(NOT has_match_stats) THEN 'PlayerMatchStat + Event'
           WHEN BOOL_OR(has_match_stats) THEN 'PlayerMatchStat' ELSE 'Event' END AS source
       FROM per_match`,
      [playerId],
    );
    const performance = performanceResult.rows[0];
    const stats = normalizeStoredPlayerStats({
      total_goals: performance?.total_goals,
      total_assists: performance?.total_assists,
      tracked_matches: performance?.tracked_matches,
    });
    const seasonStatsResult = await pool.query(
      `SELECT t.TournamentID AS competition_id, t.Name AS competition, t.Edition AS season,
         team.TeamID AS team_id, team.Name AS team,
         COUNT(DISTINCT pms.MatchID)::int AS appearances,
         CASE WHEN BOOL_AND(pms.Goals IS NULL) THEN NULL ELSE SUM(pms.Goals)::int END AS goals,
         CASE WHEN BOOL_AND(pms.Assists IS NULL) THEN NULL ELSE SUM(pms.Assists)::int END AS assists
       FROM PlayerMatchStat pms
       JOIN Match m ON m.MatchID = pms.MatchID
       JOIN Tournament t ON t.TournamentID = m.TournamentID
       LEFT JOIN LATERAL (
         SELECT tm.TeamID, tm.Name FROM Lineup l JOIN Team tm ON tm.TeamID = l.TeamID
         WHERE l.PlayerID = pms.PlayerID AND l.MatchID = pms.MatchID
         ORDER BY l.Status = 'Starter' DESC, l.TeamID LIMIT 1
       ) team ON TRUE
       WHERE pms.PlayerID = $1
       GROUP BY t.TournamentID, t.Name, t.Edition, team.TeamID, team.Name
       ORDER BY t.Edition DESC NULLS LAST, t.Name, team.Name`,
      [playerId],
    );
    const seasonStats = seasonStatsResult.rows.map((row) => ({
      competitionId: Number(row.competition_id),
      competition: row.competition,
      season: row.season ?? null,
      teamId: row.team_id == null ? null : Number(row.team_id),
      team: row.team ?? null,
      appearances: Number(row.appearances),
      goals: row.goals == null ? null : Number(row.goals),
      assists: row.assists == null ? null : Number(row.assists),
    }));
    const ratingHistoryResult = await pool.query(
      `SELECT Season, Rating, Rank, CalculatedAt FROM PlayerRatingHistory
       WHERE PlayerID = $1 ORDER BY CalculatedAt DESC`,
      [playerId],
    );
    const ratingHistory = ratingHistoryResult.rows.map((row) => ({
      season: row.season ?? null,
      rating: row.rating == null ? null : Number(row.rating),
      rank: row.rank == null ? null : Number(row.rank),
      calculatedAt: row.calculatedat,
    }));

    let shirtNumber: number | null = null;
    const numberResult = await pool.query(
      `SELECT l.JerseyNumber FROM Lineup l JOIN Match m ON m.MatchID = l.MatchID
       WHERE l.PlayerID = $1 AND ($2::int IS NULL OR l.TeamID = $2) AND l.JerseyNumber IS NOT NULL
       ORDER BY m.MatchDate DESC, m.MatchID DESC LIMIT 1`,
      [playerId, club?.id ?? null],
    );
    shirtNumber = numberResult.rows[0]?.jerseynumber == null ? null : Number(numberResult.rows[0].jerseynumber);

    const player = {
      id: playerRow.playerid,
      name: playerRow.name,
      dateOfBirth: playerRow.dateofbirth,
      nationality: playerRow.nationality,
      position: playerRow.position ?? null,
      photo: playerRow.photo ?? null,
      heightCm: playerRow.heightcm == null ? null : Number(playerRow.heightcm),
      preferredFoot: playerRow.preferredfoot ?? null,
      shirtNumber,
      isFollowing,
    };

    const provenanceResult = await pool.query(
      `SELECT FieldName, Source, ProviderPlayerID, RetrievedAt FROM PlayerFieldProvenance WHERE PlayerID = $1`,
      [playerId],
    );
    const storedProvenance = new Map<string, any>(provenanceResult.rows.map((row: any) => [row.fieldname, row]));
    const sourceFor = (field: string, value: unknown) => {
      if (value == null || value === "") return { source: "unavailable" };
      const origin = storedProvenance.get(field);
      return origin
        ? { source: origin.source, providerPlayerId: origin.providerplayerid == null ? null : Number(origin.providerplayerid), retrievedAt: origin.retrievedat }
        : { source: "PostgreSQL" };
    };

    // 5. Matches (Prev & Next)
    let finalMatches: any[] = [];
    
    if (club && club.id) {
      const teamId = club.id;
      const matchesResult = await pool.query(
        `SELECT m.MatchID, m.MatchDate,
                m.HomeGoals, m.AwayGoals,
                m.HomeTeamID, m.AwayTeamID,
                ht.Name AS HomeTeamName, ht.Logo AS HomeTeamLogo,
                at.Name AS AwayTeamName, at.Logo AS AwayTeamLogo,
                t.Name AS TournamentName,
                v.Name AS VenueName
         FROM Match m
         JOIN Team ht ON m.HomeTeamID = ht.TeamID
         JOIN Team at ON m.AwayTeamID = at.TeamID
         JOIN Tournament t ON m.TournamentID = t.TournamentID
         LEFT JOIN Venue v ON m.VenueID = v.VenueID
         WHERE m.HomeTeamID = $1 OR m.AwayTeamID = $1
         ORDER BY m.MatchDate DESC`,
        [teamId]
      );

      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      const matches = matchesResult.rows.map((row: any) => {
        const matchDate = new Date(row.matchdate);
        let status: string;
        if (matchDate > now) {
          status = "UPCOMING";
        } else if (matchDate > twoHoursAgo) {
          status = "LIVE";
        } else {
          status = "FT";
        }

        const isHome = row.hometeamid === teamId;
        const teamGoals = isHome ? row.homegoals : row.awaygoals;
        const opponentGoals = isHome ? row.awaygoals : row.homegoals;
        let result: string;
        if (teamGoals > opponentGoals) {
          result = "W";
        } else if (teamGoals < opponentGoals) {
          result = "L";
        } else {
          result = "D";
        }

        return {
          id: row.matchid,
          date: row.matchdate,
          status,
          homeTeam: {
            id: row.hometeamid,
            name: row.hometeamname,
            logo: row.hometeamlogo,
          },
          awayTeam: {
            id: row.awayteamid,
            name: row.awayteamname,
            logo: row.awayteamlogo,
          },
          homeGoals: row.homegoals,
          awayGoals: row.awaygoals,
          result,
          tournament: row.tournamentname,
          venue: row.venuename,
        };
      });

      const ftMatches = matches.filter((m: any) => m.status === "FT");
      const prevMatch = ftMatches.length > 0 ? ftMatches[0] : null;

      const futureMatches = matches.filter((m: any) => m.status !== "FT");
      const nextMatch = futureMatches.length > 0 ? futureMatches[futureMatches.length - 1] : null;

      if (prevMatch) finalMatches.push(prevMatch);
      if (nextMatch) finalMatches.push(nextMatch);
      
      // Sort the final matches array by date
      finalMatches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    res.json({
      player,
      followers,
      isFollowing,
      club,
      matches: finalMatches,
      stats,
      seasonStats,
      ratingHistory,
      provenance: {
        name: { source: "PostgreSQL" },
        photo: sourceFor("photo", player.photo),
        dateOfBirth: sourceFor("dateOfBirth", player.dateOfBirth),
        nationality: sourceFor("nationality", player.nationality),
        position: sourceFor("position", player.position),
        heightCm: sourceFor("heightCm", player.heightCm),
        preferredFoot: sourceFor("preferredFoot", player.preferredFoot),
        shirtNumber: sourceFor("shirtNumber", player.shirtNumber),
        club: sourceFor("club", club?.id),
        followers: { source: "UserFollowsPlayer" },
        totalGoals: sourceFor("totalGoals", stats.totalGoals),
        totalAssists: sourceFor("totalAssists", stats.totalAssists),
        performanceSource: performance?.source ?? "unavailable",
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch player data" });
  }
});

export default router;

