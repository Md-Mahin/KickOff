import { pool } from "../db";
import { syncFixtureToDb } from "./footballService";

const API_BASE = "https://api.football-data.org/v4";
// Keep this provider's IDs in their own numeric namespace in the existing BIGINT column.
const ID_OFFSET = 7_000_000_000_000;

type FootballDataMatch = {
  id: number;
  utcDate: string;
  status: string;
  matchday?: number | null;
  competition?: { id: number; name: string; area?: { name?: string }; season?: { startDate?: string } };
  homeTeam: { id: number; name: string; crest?: string | null };
  awayTeam: { id: number; name: string; crest?: string | null };
  score?: { fullTime?: { home?: number | null; away?: number | null } };
  venue?: string | null;
};

function toFixture(match: FootballDataMatch) {
  const id = ID_OFFSET + Number(match.id);
  if (!Number.isSafeInteger(id)) throw new Error("football-data.org returned an invalid match ID");
  return {
    fixture: { id, date: match.utcDate, venue: match.venue ? { name: match.venue } : null, referee: null, status: { short: match.status } },
    league: {
      id: match.competition?.id,
      name: match.competition?.name ?? "Football",
      country: match.competition?.area?.name ?? "International",
      season: Number(match.competition?.season?.startDate?.slice(0, 4)) || new Date(match.utcDate).getUTCFullYear(),
    },
    teams: {
      home: { id: match.homeTeam.id, name: match.homeTeam.name, logo: match.homeTeam.crest ?? null },
      away: { id: match.awayTeam.id, name: match.awayTeam.name, logo: match.awayTeam.crest ?? null },
    },
    goals: { home: match.score?.fullTime?.home ?? null, away: match.score?.fullTime?.away ?? null },
  };
}

export async function syncFootballDataToday(): Promise<number> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error("FOOTBALL_DATA_TOKEN is not configured");
  const response = await fetch(`${API_BASE}/matches`, {
    headers: { "X-Auth-Token": token },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`football-data.org returned ${response.status}`);
  const body = await response.json() as { matches?: FootballDataMatch[] };
  const matches = Array.isArray(body.matches) ? body.matches : [];
  for (const match of matches) await syncFixtureToDb(toFixture(match));
  await pool.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
    VALUES (0, 'fd-fixtures', $1::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
    [JSON.stringify({ count: matches.length })]);
  return matches.length;
}
