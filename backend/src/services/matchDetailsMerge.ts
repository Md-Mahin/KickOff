import { getMissingDetailCategories, type DetailCategory } from "./providerCapabilities";

const EMPTY = new Set([null, undefined, ""]);

export function canonicalTeamName(name: unknown) {
  return String(name ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\b(fc|cf|ac|us|ssc|calcio|football|club)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function dayNumber(value: unknown) {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 86_400_000) : null;
}

export function isVerifiedFixtureMapping(primary: any, candidate: any) {
  const id = Number(candidate?._providerFixture?.id ?? candidate?._apiFixtureId ?? candidate?.fixture?.id);
  if (!Number.isSafeInteger(id) || id <= 0) return false;
  const primaryHome = canonicalTeamName(primary?.teams?.home?.name);
  const primaryAway = canonicalTeamName(primary?.teams?.away?.name);
  const candidateHome = canonicalTeamName(candidate?.teams?.home?.name);
  const candidateAway = canonicalTeamName(candidate?.teams?.away?.name);
  if (!primaryHome || !primaryAway || primaryHome !== candidateHome || primaryAway !== candidateAway) return false;
  const primaryDay = dayNumber(primary?.fixture?.date);
  const candidateDay = dayNumber(candidate?._providerFixture?.date ?? candidate?.fixture?.date);
  return primaryDay !== null && candidateDay !== null && Math.abs(primaryDay - candidateDay) <= 1;
}

export function selectVerifiedProviderFixture(fixtures: any[], homeName: string, awayName: string, date: unknown) {
  const targetDay = dayNumber(date);
  if (targetDay === null) return null;
  const home = canonicalTeamName(homeName);
  const away = canonicalTeamName(awayName);
  const matches = fixtures.filter((fixture) => {
    const id = Number(fixture?.id ?? fixture?.fixture?.id);
    const fixtureDay = dayNumber(fixture?.kickoff_utc ?? fixture?.datetime ?? fixture?.date ?? fixture?.fixture?.date);
    return Number.isSafeInteger(id) && id > 0 && fixtureDay !== null && Math.abs(fixtureDay - targetDay) <= 1 &&
      canonicalTeamName(fixture?.home_team ?? fixture?.teams?.home?.name) === home &&
      canonicalTeamName(fixture?.away_team ?? fixture?.teams?.away?.name) === away;
  });
  return matches.length === 1 ? matches[0] : null;
}

function fillMissing(primary: any, fallback: any): any {
  if (EMPTY.has(primary)) return fallback;
  if (Array.isArray(primary)) return mergeArray(primary, Array.isArray(fallback) ? fallback : []);
  if (primary && fallback && typeof primary === "object" && typeof fallback === "object") {
    const output = { ...primary };
    for (const [key, value] of Object.entries(fallback)) output[key] = fillMissing(primary[key], value);
    return output;
  }
  return primary;
}

function rowIdentity(row: any, index: number, kind: string) {
  if (kind === "player") return `${kind}:${canonicalTeamName(row?.name)}:${row?.number ?? ""}`;
  if (kind === "event") return `${kind}:${row?.eventtime ?? row?.time?.elapsed ?? ""}:${row?.eventextratime ?? row?.time?.injuryTime ?? ""}:${canonicalTeamName(row?.teamname ?? row?.team?.name)}:${row?.eventtype ?? row?.type}:${canonicalTeamName(row?.playername ?? row?.player?.name)}:${row?.eventdetail ?? row?.detail}`;
  if (kind === "meeting") return `${kind}:${dayNumber(row?.date)}:${canonicalTeamName(row?.homeTeam)}:${canonicalTeamName(row?.awayTeam)}`;
  if (kind === "standing") return `${kind}:${canonicalTeamName(row?.teamName)}`;
  if (row?.id != null && Number(row.id) > 0) return `${kind}:id:${row.id}`;
  return `${kind}:${index}`;
}

function mergeArray(primary: any[], fallback: any[]) {
  if (!primary.length) return fallback;
  if (!fallback.length) return primary;
  const kind = primary.some((row) => row?.eventtype || row?.eventtype === "") || fallback.some((row) => row?.eventtype)
    ? "event"
    : primary.some((row) => row?.homeTeam && row?.awayTeam) || fallback.some((row) => row?.homeTeam && row?.awayTeam)
      ? "meeting"
      : primary.some((row) => row?.teamName) || fallback.some((row) => row?.teamName)
        ? "standing"
        : primary.some((row) => row?.minutes != null || row?.rating != null) || fallback.some((row) => row?.minutes != null || row?.rating != null)
          ? "player"
          : "record";
  const result = primary.slice();
  const indices = new Map(result.map((row, index) => [rowIdentity(row, index, kind), index]));
  for (let index = 0; index < fallback.length; index++) {
    const row = fallback[index];
    const key = rowIdentity(row, index, kind);
    const existingIndex = indices.get(key);
    if (existingIndex === undefined) {
      indices.set(key, result.length);
      result.push(row);
    } else result[existingIndex] = fillMissing(result[existingIndex], row);
  }
  return result;
}

export function mergeMatchDetails(primary: any, fallback: any) {
  if (!primary) return fallback;
  if (!fallback) return primary;
  const home = primary.teams?.home;
  const away = primary.teams?.away;
  const lineups = [0, 1].map((index) => {
    const first = primary.lineups?.[index];
    const second = fallback.lineups?.[index];
    if (!first) return second;
    if (!second) return first;
    const mergePlayers = (a: any[] = [], b: any[] = []) => mergeArray(a, b);
    return {
      ...first,
      team: { ...first.team, logo: first.team?.logo ?? second.team?.logo },
      formation: first.formation ?? second.formation,
      coach: fillMissing(first.coach, second.coach),
      starters: mergePlayers(first.starters, second.starters),
      substitutes: mergePlayers(first.substitutes, second.substitutes),
      unavailable: mergePlayers(first.unavailable, second.unavailable),
      startXI: mergePlayers(first.startXI, second.startXI),
    };
  }).filter(Boolean);
  const refereeSet = new Set((primary.fixture?.referees ?? []).map((value: string) => value.toLowerCase()));
  const referees = [...(primary.fixture?.referees ?? []), ...(fallback.fixture?.referees ?? []).filter((value: string) => !refereeSet.has(value.toLowerCase()))];
  const teamStatistics = primary.teamStatistics || fallback.teamStatistics ? {
    home: fillMissing(primary.teamStatistics?.home, fallback.teamStatistics?.home),
    away: fillMissing(primary.teamStatistics?.away, fallback.teamStatistics?.away),
  } : null;
  const result = {
    ...primary,
    // Keep the database match's provider identity; alternate IDs live only in provenance metadata.
    _apiFixtureId: primary._apiFixtureId,
    _fallbackProviderIds: [...new Set([...(primary._fallbackProviderIds ?? []), ...(fallback._fallbackProviderIds ?? []), fallback._providerFixture?.id ?? fallback._apiFixtureId].map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))],
    _fieldProvenance: { ...(fallback._fieldProvenance ?? {}), ...(primary._fieldProvenance ?? {}) },
    fixture: {
      ...primary.fixture,
      venue: fillMissing(primary.fixture?.venue, fallback.fixture?.venue),
      referees,
    },
    teams: { home: fillMissing(home, fallback.teams?.home), away: fillMissing(away, fallback.teams?.away) },
    goals: fillMissing(primary.goals, fallback.goals),
    lineups,
    events: mergeArray(primary.events ?? [], fallback.events ?? []),
    playerStatistics: mergeArray(primary.playerStatistics ?? [], fallback.playerStatistics ?? []),
    teamStatistics,
    headToHead: mergeArray(primary.headToHead ?? [], fallback.headToHead ?? []),
    standings: mergeArray(primary.standings ?? [], fallback.standings ?? []),
    league: fillMissing(primary.league, fallback.league),
  };
  return result;
}

export function mergeVerifiedProviderFallback(primary: any, candidate: any) {
  if (!primary) return candidate;
  if (!candidate || !isVerifiedFixtureMapping(primary, candidate)) return primary;
  return mergeMatchDetails(primary, candidate);
}

export function unresolvedDetailCategories(match: any): DetailCategory[] {
  return getMissingDetailCategories(match);
}

export function matchDetailSnapshotTtl(match: any, hasUsefulDetails: boolean) {
  if (!hasUsefulDetails) return 60 * 60_000;
  if (match?.fixture?.status?.short === "LIVE") return 60_000;
  if (match?.fixture?.status?.short === "UPCOMING") return 60 * 60_000;
  return 24 * 60 * 60_000;
}

export function isMatchDetailSnapshotFresh(payload: any, fetchedAt: unknown, now = Date.now()) {
  const age = now - new Date(String(fetchedAt ?? "")).getTime();
  return Number.isFinite(age) && age >= 0 && age < Number(payload?.ttlMs ?? 0);
}
