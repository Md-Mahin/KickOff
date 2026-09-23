import type {
  LeagueGroup,
  MatchStatus,
  MatchWithLeague,
  MatchEvent,
} from "@/lib/matches"

const API_URL =
  process.env.BACKEND_URL ?? "http://localhost:5000"

type ApiFixture = {
  fixture: {
    id: number
    date?: string | null
    status: {
      short: string
      elapsed: number | null
    }
  }

  league: {
    id: number
    name: string
    country: string | null
  }

  teams: {
    home: {
      name: string
      logo: string | null
    }
    away: {
      name: string
      logo: string | null
    }
  }

  goals: {
    home: number | null
    away: number | null
  }
}

function getStatus(status: string): MatchStatus {
  if (
    [
      "1H",
      "2H",
      "HT",
      "ET",
      "BT",
      "P",
      "SUSP",
      "INT",
      "LIVE",
    ].includes(status)
  ) {
    return "LIVE"
  }

  if (["FT", "AET", "PEN"].includes(status)) {
    return "FT"
  }

  return "UPCOMING"
}

function toMatch(fixture: ApiFixture): MatchWithLeague {
  const status = getStatus(fixture.fixture.status.short)

  return {
    id: fixture.fixture.id,
    startTime: fixture.fixture.date ?? undefined,
    
    homeTeam: fixture.teams.home.name,
    awayTeam: fixture.teams.away.name,

    homeLogo: fixture.teams.home.logo ?? undefined,
    awayLogo: fixture.teams.away.logo ?? undefined,

    homeScore: fixture.goals.home ?? 0,
    awayScore: fixture.goals.away ?? 0,

    status,

    minute:
      status === "LIVE" &&
      fixture.fixture.status.elapsed !== null
        ? `${fixture.fixture.status.elapsed}'`
        : undefined,

    league: fixture.league.name,
    country: fixture.league.country ?? "International",
  }
}

export async function getMatches(cookie?: string): Promise<LeagueGroup[]> {
  let data: { response?: ApiFixture[] }

  try {
    const response = await fetch(
      `${API_URL}/api/matches`,
      {
        cache: "no-store",
        headers: cookie ? { cookie } : undefined,
      }
    )

    if (!response.ok) {
      throw new Error(`Match API returned ${response.status}`)
    }

    data = (await response.json()) as { response?: ApiFixture[] }
  } catch (error) {
    console.error("Unable to load live matches:", error)
    return []
  }

  const groups = new Map<string, LeagueGroup>()

  for (const fixture of data.response ?? []) {
    const match = toMatch(fixture)

    const key = `${match.league}:${match.country}`

    const group =
      groups.get(key) ?? {
        league: match.league,
        country: match.country,
        matches: [],
      }

    group.matches.push(match)
    groups.set(key, group)
  }

  return [...groups.values()]
}

export async function getMatchById(
  id: number
): Promise<MatchWithLeague | null> {
  const response = await fetch(
    `${API_URL}/api/matches/${id}`,
    {
      cache: "no-store",
    }
  )

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error("Failed to fetch match")
  }

  const data = (await response.json()) as ApiFixture

  return toMatch(data)
}

export async function getPopularMatches(): Promise<MatchWithLeague[]> {
  try {
    const response = await fetch(`${API_URL}/api/matches/popular`, { cache: "no-store" })
    if (!response.ok) return []
    const data = (await response.json()) as { response?: ApiFixture[] }
    return (data.response ?? []).map(toMatch)
  } catch {
    return []
  }
}

export async function getFavouriteMatches(cookie: string): Promise<MatchWithLeague[]> {
  try {
    const response = await fetch(`${API_URL}/api/matches/favourites`, {
      cache: "no-store",
      headers: { cookie },
    })
    if (!response.ok) return []
    const data = (await response.json()) as { response?: ApiFixture[] }
    return (data.response ?? []).map(toMatch)
  } catch {
    return []
  }
}

export type TeamEntry = { id: number; name: string; logo: string | null; type: "national" | "club" }
export type PlayerEntry = { id: number; name: string }

export async function getTeamsCatalog(): Promise<{ national: TeamEntry[]; club: TeamEntry[] }> {
  try {
    const response = await fetch(`${API_URL}/api/users/teams/catalog`, { cache: "no-store" })
    if (!response.ok) return { national: [], club: [] }
    return response.json()
  } catch {
    return { national: [], club: [] }
  }
}

export async function getPlayersCatalog(): Promise<PlayerEntry[]> {
  try {
    const response = await fetch(`${API_URL}/api/users/players/catalog`, { cache: "no-store" })
    if (!response.ok) return []
    const data = (await response.json()) as { players: PlayerEntry[] }
    return data.players ?? []
  } catch {
    return []
  }
}
export async function getMatchEvents(
  id: number
): Promise<MatchEvent[]> {
  try {
    const response = await fetch(
      `${API_URL}/api/matches/${id}/events`,
      {
        cache: "no-store",
      }
    )

    if (!response.ok) {
      return []
    }

    const data = (await response.json()) as {
      events: MatchEvent[]
    }

    return data.events ?? []
  } catch {
    return []
  }
}