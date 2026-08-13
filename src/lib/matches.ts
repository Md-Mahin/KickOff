export type MatchStatus = "LIVE" | "FT" | "UPCOMING"

export type MatchEvent = {
  id: number
  type: "goal" | "yellow" | "red" | "sub"
  team: "home" | "away"
  player: string
  minute: string
}

export type MatchStat = {
  label: string
  home: number
  away: number
}

export type Match = {
  id: number
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  status: MatchStatus
  minute?: string
  events?: MatchEvent[]
  stats?: MatchStat[]
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

export const leagues: LeagueGroup[] = [
  {
    league: "Premier League",
    country: "England",
    matches: [
      {
        id: 1,
        homeTeam: "Arsenal",
        awayTeam: "Chelsea",
        homeScore: 2,
        awayScore: 1,
        status: "LIVE",
        minute: "78'",
        events: [
          {
            id: 1,
            type: "goal",
            team: "home",
            player: "Bukayo Saka",
            minute: "12'",
          },
          {
            id: 2,
            type: "goal",
            team: "away",
            player: "Cole Palmer",
            minute: "34'",
          },
          {
            id: 3,
            type: "yellow",
            team: "away",
            player: "Moises Caicedo",
            minute: "51'",
          },
          {
            id: 4,
            type: "goal",
            team: "home",
            player: "Martin Odegaard",
            minute: "71'",
          },
        ],
        stats: [
          { label: "Possession", home: 58, away: 42 },
          { label: "Shots", home: 14, away: 9 },
          { label: "Shots on target", home: 6, away: 3 },
          { label: "Corners", home: 7, away: 4 },
          { label: "Fouls", home: 8, away: 11 },
        ],
      },
      {
        id: 2,
        homeTeam: "Liverpool",
        awayTeam: "Manchester City",
        homeScore: 0,
        awayScore: 0,
        status: "LIVE",
        minute: "64'",
        events: [
          {
            id: 1,
            type: "yellow",
            team: "home",
            player: "Alexis Mac Allister",
            minute: "22'",
          },
          {
            id: 2,
            type: "yellow",
            team: "away",
            player: "Rodri",
            minute: "39'",
          },
        ],
        stats: [
          { label: "Possession", home: 52, away: 48 },
          { label: "Shots", home: 8, away: 10 },
          { label: "Shots on target", home: 2, away: 3 },
          { label: "Corners", home: 4, away: 5 },
          { label: "Fouls", home: 9, away: 7 },
        ],
      },
    ],
  },
  {
    league: "La Liga",
    country: "Spain",
    matches: [
      {
        id: 3,
        homeTeam: "Barcelona",
        awayTeam: "Sevilla",
        homeScore: 3,
        awayScore: 0,
        status: "FT",
        events: [
          {
            id: 1,
            type: "goal",
            team: "home",
            player: "Robert Lewandowski",
            minute: "18'",
          },
          {
            id: 2,
            type: "goal",
            team: "home",
            player: "Pedri",
            minute: "44'",
          },
          {
            id: 3,
            type: "goal",
            team: "home",
            player: "Lamine Yamal",
            minute: "77'",
          },
        ],
        stats: [
          { label: "Possession", home: 67, away: 33 },
          { label: "Shots", home: 18, away: 5 },
          { label: "Shots on target", home: 9, away: 1 },
          { label: "Corners", home: 8, away: 2 },
          { label: "Fouls", home: 6, away: 12 },
        ],
      },
      {
        id: 4,
        homeTeam: "Real Madrid",
        awayTeam: "Atletico Madrid",
        homeScore: 0,
        awayScore: 0,
        status: "UPCOMING",
      },
    ],
  },
]

export const allMatches: MatchWithLeague[] = leagues.flatMap((league) =>
  league.matches.map((match) => ({
    ...match,
    league: league.league,
    country: league.country,
  }))
)

export function getMatchById(id: number): MatchWithLeague | undefined {
  return allMatches.find((match) => match.id === id)
}