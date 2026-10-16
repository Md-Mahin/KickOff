export type DetailCategory =
  | "venue"
  | "referee"
  | "events"
  | "lineups"
  | "coaches"
  | "substitutes"
  | "playerStats"
  | "playerRatings"
  | "statistics"
  | "headToHead"
  | "standings";

export type ProviderCapabilityMap = Record<DetailCategory, boolean>;

type MatchCoverage = {
  fixture?: { venue?: { name?: string | null } | null; referees?: unknown[] | null };
  events?: unknown[] | null;
  lineups?: Array<{
    starters?: Array<{ minutes?: number | null; goals?: number; assists?: number; rating?: number | null }>;
    substitutes?: Array<{ minutes?: number | null; goals?: number; assists?: number; rating?: number | null }>;
    coach?: { name?: string | null } | null;
  }> | null;
  playerStatistics?: unknown[] | null;
  teamStatistics?: { home?: unknown; away?: unknown } | null;
  headToHead?: unknown[] | null;
  standings?: unknown[] | null;
};

export const PROVIDER_CAPABILITIES: Record<string, { priority: number; categories: ProviderCapabilityMap }> = {
  "api-football": {
    priority: 100,
    categories: {
      venue: true,
      referee: true,
      events: true,
      lineups: true,
      coaches: true,
      substitutes: true,
      playerStats: true,
      playerRatings: false,
      statistics: true,
      headToHead: true,
      standings: true,
    },
  },
  "football-data.org": {
    priority: 90,
    categories: {
      venue: true,
      referee: true,
      events: true,
      lineups: true,
      coaches: true,
      substitutes: true,
      playerStats: false,
      playerRatings: false,
      statistics: false,
      headToHead: false,
      standings: false,
    },
  },
  "the-sportsdb": {
    priority: 80,
    categories: {
      venue: true,
      referee: true,
      events: true,
      lineups: true,
      coaches: true,
      substitutes: true,
      playerStats: false,
      playerRatings: false,
      statistics: false,
      headToHead: false,
      standings: false,
    },
  },
  "sportapi.ai": {
    priority: 85,
    categories: {
      venue: true,
      referee: false,
      events: true,
      lineups: true,
      coaches: true,
      substitutes: true,
      playerStats: false,
      playerRatings: false,
      statistics: true,
      headToHead: true,
      standings: true,
    },
  },
};

export function getMissingDetailCategories(match: MatchCoverage): DetailCategory[] {
  const categories: DetailCategory[] = [];
  if (!match?.fixture?.venue?.name) categories.push("venue");
  if (!match?.fixture?.referees?.length) categories.push("referee");
  if (!match?.events?.length) categories.push("events");
  const hasLineupData = (match.lineups?.length ?? 0) >= 2 && match.lineups!.slice(0, 2).every((team) =>
    (team.starters?.length ?? 0) > 0 || (team.substitutes?.length ?? 0) > 0,
  );
  if (!hasLineupData) categories.push("lineups");
  const hasCoachData = (match.lineups?.length ?? 0) >= 2 && match.lineups!.slice(0, 2).every((team) => Boolean(team.coach?.name));
  if (!hasCoachData) categories.push("coaches");
  const hasSubstituteData = (match.lineups?.length ?? 0) >= 2 && match.lineups!.slice(0, 2).every((team) => (team.substitutes?.length ?? 0) > 0);
  if (!hasSubstituteData) categories.push("substitutes");
  const hasPlayerStats = Boolean(match.playerStatistics?.length);
  if (!hasPlayerStats) categories.push("playerStats");
  if (!match.teamStatistics?.home || !match.teamStatistics?.away) categories.push("statistics");
  if (!match.headToHead?.length) categories.push("headToHead");
  if (!match.standings?.length) categories.push("standings");
  return Array.from(new Set(categories));
}
