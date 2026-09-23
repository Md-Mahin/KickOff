import type {
  LeagueGroup,
  MatchStatus,
  MatchWithLeague,
  MatchEvent,
  MatchLineup,
  TeamProfile,
  PlayerProfile,
  TournamentProfile,
} from "@/lib/matches"

const API_URL =
  process.env.BACKEND_URL ?? "http://localhost:5000"

type ApiFixture = {
  fixture: {
    id: number
    date?: string | null
    venue?: {
      name: string | null
      city: string | null
      country: string | null
    } | null
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
      id?: number
      name: string
      logo: string | null
    }
    away: {
      id?: number
      name: string
      logo: string | null
    }
  }

  goals: {
    home: number | null
    away: number | null
  }

  referees?: string[]
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
    referees: fixture.referees,
    venue: fixture.fixture.venue?.name
      ? {
          name: fixture.fixture.venue.name,
          city: fixture.fixture.venue.city,
          country: fixture.fixture.venue.country,
        }
      : undefined,
    
    homeTeam: fixture.teams.home.name,
    awayTeam: fixture.teams.away.name,

    homeTeamId: fixture.teams.home.id,
    awayTeamId: fixture.teams.away.id,

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
    leagueId: fixture.league.id,
    country: fixture.league.country ?? "International",
  }
}

  const TOP_LEAGUE_ORDER = [
    "premier league",
    "champions league",
    "la liga",
    "world cup",
    "bundesliga",
    "ligue 1",
    "serie a",
    "europa league",
    "copa del rey",
    "copa america",
    "uefa euro",
    "nations league",
    "africa cup",
    "asian cup",
    "gold cup",
    "concacaf",
    "olympic",
    "qualification",
    "friendlies",
  ]

  function leagueOrder(name: string, country: string) {
    const normalized = name.toLowerCase()
    const normalizedCountry = country.toLowerCase()

    if (normalized.includes("premier league") && !normalizedCountry.includes("england")) {
      return TOP_LEAGUE_ORDER.length
    }

    const index = TOP_LEAGUE_ORDER.findIndex((league) => normalized.includes(league))
    return index === -1 ? TOP_LEAGUE_ORDER.length : index
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
        leagueId: match.leagueId ?? fixture.league.id,
        league: match.league,
        country: match.country,
        matches: [],
      }

    group.matches.push(match)
    groups.set(key, group)
  }

    return [...groups.values()].sort((left, right) => {
      const priorityDifference = leagueOrder(left.league, left.country) - leagueOrder(right.league, right.country)
      if (priorityDifference !== 0) return priorityDifference
      return left.league.localeCompare(right.league)
    })
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

export async function getMatchLineups(id: number): Promise<MatchLineup[]> {
  try {
    const response = await fetch(`${API_URL}/api/matches/${id}/lineups`, {
      cache: "no-store",
    })

    if (!response.ok) return []

    const data = (await response.json()) as { lineups: MatchLineup[] }
    return data.lineups ?? []
  } catch {
    return []
  }
}

export async function getTeamProfile(
  id: number
): Promise<TeamProfile | null> {
  try {
    const response = await fetch(
      `${API_URL}/api/teams/${id}`,
      { cache: "no-store" }
    )

    if (response.status === 404) return null
    if (!response.ok) throw new Error(`Team API returned ${response.status}`)

    return (await response.json()) as TeamProfile
  } catch (error) {
    console.error("Unable to load team profile:", error)
    return null
  }
}

export async function getPlayerProfile(
  id: number
): Promise<PlayerProfile | null> {
  try {
    const response = await fetch(
      `${API_URL}/api/players/${id}`,
      { cache: "no-store" }
    )

    if (response.status === 404) return null
    if (!response.ok) throw new Error(`Player API returned ${response.status}`)

    return (await response.json()) as PlayerProfile
  } catch (error) {
    console.error("Unable to load player profile:", error)
    return null
  }
}

export async function getTournamentProfile(
  id: number
): Promise<TournamentProfile | null> {
  try {
    const response = await fetch(
      `${API_URL}/api/tournaments/${id}`,
      { cache: "no-store" }
    )

    if (response.status === 404) return null
    if (!response.ok) throw new Error(`Tournament API returned ${response.status}`)

    return (await response.json()) as TournamentProfile
  } catch (error) {
    console.error("Unable to load tournament profile:", error)
    return null
  }
}