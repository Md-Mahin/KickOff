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
  eventtype: "Goal" | "Card" | "Foul"
  playername: string | null
  teamname: string
  goaltype: string | null
  assistplayername: string | null
  cardtype: "Yellow" | "Red" | null
}