export type DetailCategory =
  | "venue"
  | "referee"
  | "events"
  | "lineups"
  | "coaches"
  | "substitutes"
  | "playerStats"
  | "playerRatings";

export type ProviderCapabilityMap = Record<DetailCategory, boolean>;

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
    },
  },
};

export function getMissingDetailCategories(match: any): DetailCategory[] {
  const categories: DetailCategory[] = [];
  if (!match?.fixture?.venue?.name) categories.push("venue");
  if (!match?.fixture?.referees?.length) categories.push("referee");
  if (!match?.events?.length) categories.push("events");
  const hasLineupData = match?.lineups?.some((team: any) => (team.starters?.length ?? 0) > 0 || (team.substitutes?.length ?? 0) > 0);
  if (!hasLineupData) categories.push("lineups");
  const hasCoachData = match?.lineups?.some((team: any) => Boolean(team.coach?.name));
  if (!hasCoachData) categories.push("coaches");
  const hasSubstituteData = match?.lineups?.some((team: any) => (team.substitutes?.length ?? 0) > 0);
  if (!hasSubstituteData) categories.push("substitutes");
  const hasPlayerStats = match?.lineups?.some((team: any) => [...(team.starters ?? []), ...(team.substitutes ?? [])].some((player: any) => player.minutes != null || player.goals > 0 || player.assists > 0 || player.rating != null));
  if (!hasPlayerStats) categories.push("playerStats");
  return Array.from(new Set(categories));
}
