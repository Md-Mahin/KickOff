export type MatchStatus = "LIVE" | "FT" | "UPCOMING"

export type Match = {
  id: number
  homeTeam: string
  awayTeam: string
  homeLogo?: string
  awayLogo?: string
  homeScore: number
  awayScore: number
  status: MatchStatus
  minute?: string
  startTime?: string
  venue?: {
    name: string
    city: string | null
    country: string | null
  }
}

export type LeagueGroup = {
  league: string
  country: string
  matches: Match[]
}

export type MatchWithLeague = Match & {
  league: string
  country: string
}
export type MatchEvent = {
  eventid: number
  eventtime: number | null
  playerid?: number | null
  substitutionplayerid?: number | null
  eventtype: "Goal" | "Card" | "Foul" | "Substitution"
  playername: string | null
  teamname: string
  goaltype: string | null
  assistplayername: string | null
  cardtype: "Yellow" | "Red" | null
}

export type MatchLineupPlayer = {
  id: number
  name: string
  photo: string | null
  number: number | null
  position: string | null
  grid: string | null
  rating: string | null
  goals: number
  assists: number
  yellowCards: number
  redCards: number
}

export type MatchLineup = {
  team: { id: number; name: string; logo: string | null }
  formation: string | null
  coach: { name: string | null; photo: string | null }
  starters: MatchLineupPlayer[]
  substitutes: MatchLineupPlayer[]
}