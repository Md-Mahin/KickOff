export type PlayerProfileField = "dateOfBirth" | "nationality" | "position" | "photo" | "heightCm";

export type ApiFootballPlayerIdentity = {
  playerId: number | null;
  teamId: number | null;
  leagueId: number | null;
};

export type ApiFootballPlayerRecord = {
  player?: {
    id?: number | string | null;
    birth?: { date?: string | null } | null;
    nationality?: string | null;
    photo?: string | null;
    height?: string | null;
  };
  statistics?: Array<{
    team?: { id?: number | string | null } | null;
    league?: { id?: number | string | null } | null;
    games?: { position?: string | null } | null;
  }>;
};

export type PlayerProfileFields = Record<PlayerProfileField, string | number | null>;

export function normalizeStoredPlayerStats(row: { tracked_matches?: unknown; total_goals?: unknown; total_assists?: unknown } | null | undefined) {
  const trackedMatches = Math.max(0, Number(row?.tracked_matches ?? 0));
  if (!trackedMatches) return { totalGoals: null, totalAssists: null, trackedMatches: 0 };
  return {
    totalGoals: row?.total_goals == null ? null : Number(row.total_goals),
    totalAssists: row?.total_assists == null ? null : Number(row.total_assists),
    trackedMatches,
  };
}

function asProviderId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isVerifiedApiFootballPlayer(
  identity: ApiFootballPlayerIdentity,
  providerRecord: ApiFootballPlayerRecord,
): boolean {
  const storedPlayerId = asProviderId(identity.playerId);
  const returnedPlayerId = asProviderId(providerRecord.player?.id);
  if (!storedPlayerId || storedPlayerId !== returnedPlayerId) return false;

  const expectedTeamId = asProviderId(identity.teamId);
  const expectedLeagueId = asProviderId(identity.leagueId);
  if (!expectedTeamId && !expectedLeagueId) return false;

  return (providerRecord.statistics ?? []).some((stat) => {
    const teamMatches = !expectedTeamId || asProviderId(stat.team?.id) === expectedTeamId;
    const leagueMatches = !expectedLeagueId || asProviderId(stat.league?.id) === expectedLeagueId;
    return teamMatches && leagueMatches;
  });
}

export function extractApiFootballPlayerFields(
  providerRecord: ApiFootballPlayerRecord,
  identity: ApiFootballPlayerIdentity,
): PlayerProfileFields {
  const matchingStats = (providerRecord.statistics ?? []).find((stat) => {
    const teamMatches = !identity.teamId || asProviderId(stat.team?.id) === asProviderId(identity.teamId);
    const leagueMatches = !identity.leagueId || asProviderId(stat.league?.id) === asProviderId(identity.leagueId);
    return teamMatches && leagueMatches;
  });
  const height = providerRecord.player?.height?.match(/^(\d{2,3})\s*cm$/i)?.[1];
  const birthDate = providerRecord.player?.birth?.date;

  return {
    dateOfBirth: birthDate && /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? birthDate : null,
    nationality: providerRecord.player?.nationality?.trim() || null,
    position: matchingStats?.games?.position?.trim() || null,
    photo: providerRecord.player?.photo?.trim() || null,
    heightCm: height ? Number(height) : null,
  };
}

const PROVIDER_FIELDS: PlayerProfileField[] = ["dateOfBirth", "nationality", "position", "photo", "heightCm"];

export function missingProviderFields(fields: PlayerProfileFields): PlayerProfileField[] {
  return PROVIDER_FIELDS.filter((field) => fields[field] == null || fields[field] === "");
}

export function mergeMissingProfileFields(
  stored: PlayerProfileFields,
  provider: PlayerProfileFields,
): { fields: PlayerProfileFields; filled: PlayerProfileField[] } {
  const fields = { ...stored };
  const filled: PlayerProfileField[] = [];
  for (const field of PROVIDER_FIELDS) {
    if ((fields[field] == null || fields[field] === "") && provider[field] != null && provider[field] !== "") {
      fields[field] = provider[field];
      filled.push(field);
    }
  }
  return { fields, filled };
}

export async function loadVerifiedProfileFields(
  stored: PlayerProfileFields,
  identity: ApiFootballPlayerIdentity,
  fetchProviderRecord: (providerPlayerId: number) => Promise<ApiFootballPlayerRecord | null>,
) {
  const fieldsMissing = missingProviderFields(stored);
  if (!fieldsMissing.length || !asProviderId(identity.playerId) || (!asProviderId(identity.teamId) && !asProviderId(identity.leagueId))) {
    return { fields: stored, filled: [] as PlayerProfileField[], verified: false };
  }

  const providerRecord = await fetchProviderRecord(Number(identity.playerId));
  if (!providerRecord || !isVerifiedApiFootballPlayer(identity, providerRecord)) {
    return { fields: stored, filled: [] as PlayerProfileField[], verified: false };
  }
  const merged = mergeMissingProfileFields(stored, extractApiFootballPlayerFields(providerRecord, identity));
  return { ...merged, verified: true };
}

export function createPlayerProfileProviderCache<T>(
  fetcher: (providerPlayerId: number) => Promise<T | null>,
  options: { ttlMs?: number; negativeTtlMs?: number; now?: () => number } = {},
) {
  const ttlMs = options.ttlMs ?? 12 * 60 * 60_000;
  const negativeTtlMs = options.negativeTtlMs ?? 5 * 60_000;
  const now = options.now ?? Date.now;
  const cached = new Map<number, { value: T | null; expiresAt: number }>();
  const inFlight = new Map<number, Promise<T | null>>();

  return async (providerPlayerId: number): Promise<T | null> => {
    const existing = cached.get(providerPlayerId);
    if (existing && existing.expiresAt > now()) return existing.value;
    const active = inFlight.get(providerPlayerId);
    if (active) return active;

    const request = fetcher(providerPlayerId).then((value) => {
      cached.set(providerPlayerId, { value, expiresAt: now() + (value == null ? negativeTtlMs : ttlMs) });
      return value;
    }).finally(() => inFlight.delete(providerPlayerId));
    inFlight.set(providerPlayerId, request);
    return request;
  };
}
