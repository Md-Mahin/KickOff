export interface BasicMatchItem {
  id: number; leagueId?: number; league: string; country: string;
  homeTeam: string; homeTeamId: number; homeLogo?: string | null;
  awayTeam: string; awayTeamId: number; awayLogo?: string | null;
  homeScore?: number | null; awayScore?: number | null;
  status: "LIVE" | "FT" | "UPCOMING"; minute?: number | null; date: string;
}

export interface MatchDetails {
  fixture: { id: number; date: string; venue: { name: string; city: string; country: string } | null; referee?: string | null; round?: { matchday: number | null; stage: string | null }; status: { short: "LIVE" | "FT" | "UPCOMING"; elapsed: number | null } };
  league: { id: number; name: string; country: string; season: number; edition?: string | null };
  teams: { home: { id: number; name: string; logo: string | null }; away: { id: number; name: string; logo: string | null } };
  goals: { home: number | null; away: number | null; halftime?: { home: number | null; away: number | null } | null };
  lineups: Array<{ team: { id: number; name: string; logo: string | null }; coach: { id: number; name: string; photo: string | null }; formation: string; startXI: Array<{ player: { id: number; name: string; number: number; pos: string; photo?: string | null } }>; substitutes: Array<{ player: { id: number; name: string; number: number; pos: string; photo?: string | null } }> }>;
  events: Array<{ time: { elapsed: number; injuryTime?: number | null }; team: { id: number; name: string }; player: { id: number; name: string }; assist?: { id: number; name: string } | null; type: "Goal" | "Card" | "Substitution" | "Foul" | "VAR"; detail: string }>;
  playerStatistics?: Array<Record<string, unknown>>;
  standings?: Array<Record<string, unknown>>;
  headToHead?: Array<Record<string, unknown>>;
  teamStatistics?: null;
}
