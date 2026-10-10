import { syncFixtureToDb } from "./footballService";

const ID_OFFSET = 8_000_000_000_000;

type SportsDbEvent = {
  idEvent?: string;
  idLeague?: string;
  strLeague?: string;
  strCountry?: string;
  dateEvent?: string;
  strTime?: string;
  strTimestamp?: string;
  idHomeTeam?: string;
  strHomeTeam?: string;
  strHomeTeamBadge?: string | null;
  idAwayTeam?: string;
  strAwayTeam?: string;
  strAwayTeamBadge?: string | null;
  intHomeScore?: string | null;
  intAwayScore?: string | null;
  strVenue?: string | null;
};

function asNumber(value?: string | null): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toFixture(event: SportsDbEvent) {
  const eventId = asNumber(event.idEvent);
  const homeId = asNumber(event.idHomeTeam);
  const awayId = asNumber(event.idAwayTeam);
  if (!eventId || !homeId || !awayId || !event.strHomeTeam || !event.strAwayTeam) return null;
  const date = event.strTimestamp ?? `${event.dateEvent ?? new Date().toISOString().slice(0, 10)}T${event.strTime || "00:00:00"}Z`;
  return {
    fixture: {
      id: ID_OFFSET + eventId,
      date,
      venue: event.strVenue ? { name: event.strVenue } : null,
      referee: null,
      status: { short: "NS" },
    },
    league: {
      id: asNumber(event.idLeague),
      name: event.strLeague ?? "Football",
      country: event.strCountry ?? "International",
      season: Number(event.dateEvent?.slice(0, 4)) || new Date().getUTCFullYear(),
    },
    teams: {
      home: { id: homeId, name: event.strHomeTeam, logo: event.strHomeTeamBadge ?? null },
      away: { id: awayId, name: event.strAwayTeam, logo: event.strAwayTeamBadge ?? null },
    },
    goals: { home: asNumber(event.intHomeScore), away: asNumber(event.intAwayScore) },
  };
}

export async function syncSportsDbToday(): Promise<number> {
  const key = process.env.SPORTSDB_API_KEY;
  if (!key) throw new Error("SPORTSDB_API_KEY is not configured");
  const today = new Date().toISOString().slice(0, 10);
  const response = await fetch(`https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(key)}/eventsday.php?d=${today}&s=Soccer`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`TheSportsDB returned ${response.status}`);
  const body = await response.json() as { events?: SportsDbEvent[] | null };
  const events = Array.isArray(body.events) ? body.events : [];
  let count = 0;
  for (const event of events) {
    const fixture = toFixture(event);
    if (fixture) {
      await syncFixtureToDb(fixture);
      count++;
    }
  }
  return count;
}
