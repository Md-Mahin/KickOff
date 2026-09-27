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
  unavailable?: { id: number; name: string; photo: string | null; reason: string; status: string }[]
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
  isFollowing?: boolean
  manager?: {
    name: string | null
    photo: string | null
  }
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
  isFollowing?: boolean
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
  isFollowing?: boolean
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
  isFollowing?: boolean
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
  isFollowing?: boolean
  matches: TeamMatch[]
  standings: TournamentStandingRow[]
}

// ── Admin Performance & Rating Types ──────────────────────────────────────────

export type PlayerRankingItem = {
  rank: number
  playerId: number
  name: string
  position: string
  photo: string | null
  team: string
  teamId: number | null
  rating: number
  matchesPlayed: number
  totalMinutes: number
  goals: number
  assists: number
  shots: number
  shotsOnTarget: number
  passes: number
  keyPasses: number
  tackles: number
  interceptions: number
  clearances: number
  saves: number
  cleanSheets: number
  yellowCards: number
  redCards: number
  goalsConceded: number
  goalsPer90: number
  assistsPer90: number
}

export type PlayerRankingsResponse = {
  rankings: PlayerRankingItem[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export type TopPositionPlayer = {
  playerId: number
  name: string
  position: string
  photo: string | null
  team: string
  rating: number
  matchesPlayed: number
  totalMinutes: number
  goals: number
  assists: number
  tackles: number
  saves: number
  cleanSheets: number
  posRank: number
}

export type PositionBreakdownResponse = {
  forwards: TopPositionPlayer[]
  midfielders: TopPositionPlayer[]
  defenders: TopPositionPlayer[]
  goalkeepers: TopPositionPlayer[]
  positionAverages: {
    position: string
    count: number
    avgrating: string
    maxrating: string
    minrating: string
  }[]
}

export type RatingTier = {
  id: string
  name: string
  description: string
  count: number
  percentage: number
  color: string
}

export type RatingDistributionResponse = {
  tiers: RatingTier[]
  totalPlayers: number
  averageRating: number
  highestRating: number
  lowestRating: number
  topPlayer: {
    id: number
    name: string
    position: string
    rating: number
    team: string
  } | null
}
