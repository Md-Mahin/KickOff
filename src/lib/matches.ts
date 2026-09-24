export type MatchStatus = "LIVE" | "FT" | "UPCOMING"

export type Match = {
  id: number
  homeTeam: string
  awayTeam: string
  homeTeamId?: number
  awayTeamId?: number
  homeLogo?: string
  awayLogo?: string
  homeScore: number
  awayScore: number
  status: MatchStatus
  minute?: string
  startTime?: string
  referees?: string[]
  leagueId?: number
  venue?: {
    name: string
    city: string | null
    country: string | null
  }
}

export type LeagueGroup = {
  leagueId: number
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

// ── Team Profile Types ────────────────────────────────────────────────────────

export type TeamInfo = {
  id: number
  name: string
  logo: string | null
  country: string | null
  club: string | null
  federation: string | null
  followers?: number
}

export type TeamVenue = {
  name: string
  city: string | null
}

export type TeamTournament = {
  id: number
  name: string
  type: string | null
  edition: string | null
}

export type TeamMatch = {
  id: number
  date: string
  status: MatchStatus
  homeTeam: { id: number; name: string; logo: string | null }
  awayTeam: { id: number; name: string; logo: string | null }
  homeGoals: number
  awayGoals: number
  result: "W" | "L" | "D" | null
  tournament: string
  venue: string | null
}

export type TeamStandingRow = {
  rank: number | null
  teamId: number
  teamName: string
  country: string | null
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
}

export type TeamStanding = {
  tournamentId: number
  tournamentName: string
  rows: TeamStandingRow[]
}

export type TeamSquadPlayer = {
  id: number
  name: string
  dateOfBirth: string | null
  nationality: string | null
  position: string | null
}

export type TeamProfile = {
  team: TeamInfo
  homeVenue: TeamVenue | null
  tournaments: TeamTournament[]
  matches: TeamMatch[]
  standings: TeamStanding[]
  squad: TeamSquadPlayer[]
}

// ── Player Profile Types ──────────────────────────────────────────────────────

export type PlayerInfo = {
  id: number
  name: string
  dateOfBirth: string | null
  nationality: string | null
}

export type PlayerClubInfo = {
  id: number
  name: string
  logo: string | null
  position: string | null
  joinDate: string | null
}

export type PlayerStats = {
  totalGoals: number
  totalAssists: number
}

export type PlayerProfile = {
  player: PlayerInfo
  followers: number
  club: PlayerClubInfo | null
  matches: TeamMatch[]
  stats: PlayerStats
}

// ── Tournament Profile Types ───────────────────────────────────────────────────

export type TournamentInfo = {
  id: number
  name: string
  type: string | null
  edition: string | null
  logo: string | null
  country: string | null
}

export type TournamentStandingRow = {
  rank: number | null
  teamId: number
  teamName: string
  teamLogo: string | null
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  last5: ("W" | "L" | "D" | null)[]
}

export type TournamentProfile = {
  tournament: TournamentInfo
  followers: number
  matches: TeamMatch[]
  standings: TournamentStandingRow[]
}