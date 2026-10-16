import { createHash } from "crypto";
import { pool } from "../db";
import { canonicalTeamName, selectVerifiedProviderFixture } from "./matchDetailsMerge";

const API_BASE = "https://sportapi.ai/api";
const RAPIDAPI_BASE = "https://sportapi7.p.rapidapi.com";
const RAPIDAPI_LOCK_ID = 7_004_231;
const RAPIDAPI_MONTHLY_HARD_LIMIT = 50;
const RAPIDAPI_INTERNAL_MONTHLY_BUDGET = 35;
const RAPIDAPI_MONTHLY_RESERVE = RAPIDAPI_MONTHLY_HARD_LIMIT - RAPIDAPI_INTERNAL_MONTHLY_BUDGET;
const RAPIDAPI_HOURLY_HARD_LIMIT = 1_000;
const RAPIDAPI_INTERNAL_HOURLY_BUDGET = 100;
const RAPIDAPI_BANDWIDTH_HARD_BYTES = 10_240 * 1024 * 1024;
const RAPIDAPI_INTERNAL_BANDWIDTH_BYTES = 8_192 * 1024 * 1024;
const RAPIDAPI_NEGATIVE_CACHE_TTL_MS = 365 * 24 * 60 * 60_000;
const DETAIL_CACHE_TTL_MS = 12 * 60 * 60_000;
const EMPTY_DETAIL_CACHE_TTL_MS = 5 * 60_000;
const LIVE_DETAIL_CACHE_TTL_MS = 60_000;

type SportApiFixture = {
	id: number; home_id: number; away_id: number; date: string; kickoff_utc?: string;
	home_score: number | null; away_score: number | null; status: string;
	league_id: number; league_name: string; league_geo: string; league_zone: string;
	home_team: string; away_team: string; home_logo?: string; away_logo?: string;
};
type SportApiEvent = {
	id?: number; event_type: string; team_side: string; player_name?: string | null;
	minute?: string | null; extra_info?: string | null;
};
type SportApiDetails = SportApiFixture & {
	ht_home?: number | null; ht_away?: number | null;
	home_stadium?: string | null; home_city?: string | null; home_coach?: string | null;
	away_stadium?: string | null; away_city?: string | null; away_coach?: string | null;
	events?: SportApiEvent[];
};

const inFlight = new Map<string, Promise<unknown>>();

type RapidApiQuotaState = {
	keyFingerprint?: string;
	remaining?: number | null;
	limit?: number | null;
	dailyQuota?: { remaining: number; limit: number } | null;
	minuteQuota?: { remaining: number; limit: number } | null;
	monthlyUsed?: number | null;
	monthlyBandwidthBytes?: number | null;
	monthlyVerifiedAt?: string | null;
	auditSequence?: number;
	resetAt?: string | null;
	observedAt?: string | null;
	paused?: boolean;
	pauseReason?: string | null;
	retryAt?: string | null;
	failures?: number;
	lastStatus?: number | null;
	lastStatusAt?: string | null;
	pauseOriginStatus?: number | null;
	pauseOriginAt?: string | null;
	lastSuccessAt?: string | null;
	lastAttemptAt?: string | null;
	lastRequest?: { endpoint: string; status: number | null; requestedAt: string; headers: Record<string, string>; responseBytes?: number | null; responseExcerpt?: string | null } | null;
	lastDiagnostic?: { endpoint: string; status: number | null; requestedAt: string; responseBytes?: number | null; responseExcerpt?: string | null } | null;
};

function rapidApiKeyFingerprint(key: string) {
	return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

function rapidApiCacheEndpoint(path: string) {
	return `s7-${createHash("sha1").update(path).digest("hex").slice(0, 12)}`;
}

function rapidApiAuditEndpoint(sequence: number) {
	return `s7-log-${String(sequence).padStart(13, "0")}`;
}

function isDocumentedRapidApiPath(path: string) {
	return /^\/api\/v1\/sport\/football\/scheduled-events\/\d{4}-\d{2}-\d{2}$/.test(path) ||
		/^\/api\/v1\/event\/\d+(?:\/(?:incidents|lineups|statistics))?$/.test(path) ||
		/^\/api\/v1\/event\/[A-Za-z0-9_-]+\/h2h\/events$/.test(path);
}

function rapidApiResponseHeaders(headers: Headers) {
	const result: Record<string, string> = {};
	for (const [name, value] of headers.entries()) {
		const lower = name.toLowerCase();
		if (lower.startsWith("x-ratelimit-") || lower.startsWith("x-rapidapi-requests-")) result[lower] = value.slice(0, 256);
	}
	return result;
}

function redactApiKey(value: string, key: string) {
	return value.replaceAll(key, "[REDACTED]").slice(0, 2_048);
}

async function writeRapidApiAudit(sequence: number, payload: RapidApiQuotaState["lastRequest"], client: import("pg").PoolClient) {
	await client.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
		VALUES (0, $1, $2::jsonb, CURRENT_TIMESTAMP)
		ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
		[rapidApiAuditEndpoint(sequence), JSON.stringify(payload)]);
}

export function readSofaScoreRapidApiQuotaHeaders(headers: Headers) {
	const read = (...names: string[]) => {
		for (const name of names) {
			const raw = headers.get(name);
			if (raw != null && /^\d+$/.test(raw.trim())) return Number(raw.trim());
		}
		return null;
	};
	return {
		remaining: read("x-ratelimit-requests-remaining", "x-rapidapi-requests-remaining"),
		limit: read("x-ratelimit-requests-limit", "x-rapidapi-requests-limit"),
		resetSeconds: read("x-ratelimit-requests-reset", "x-rapidapi-requests-reset"),
	};
}

async function readRapidApiQuota(client: import("pg").PoolClient | typeof pool = pool): Promise<RapidApiQuotaState> {
	const result = await client.query("SELECT Payload FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = 's7-quota-state'");
	return result.rows[0]?.payload ?? {};
}

async function writeRapidApiQuota(state: RapidApiQuotaState, client: import("pg").PoolClient | typeof pool = pool) {
	await client.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
		VALUES (0, 's7-quota-state', $1::jsonb, CURRENT_TIMESTAMP)
		ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
		[JSON.stringify(state)]);
}

type RapidApiDiagnosticAuthorization = {
	authorized: boolean; accountActive: boolean; dashboardVerified: boolean; verifiedAt: string;
	monthlyUsed: number; monthlyBandwidthMB: number; remaining: number;
};

/** Persistent, budgeted SportAPI requests. A diagnostic may make exactly one explicitly authorized event-detail request without clearing pause state. */
export async function callSofaScoreRapidApi(path: string, options: {
	ttlMs?: number; negativeTtlMs?: number; forceRefresh?: boolean; diagnostic?: RapidApiDiagnosticAuthorization;
} = {}): Promise<any> {
	const key = process.env.SOFASCORE_RAPIDAPI_KEY?.trim();
	const host = process.env.SOFASCORE_RAPIDAPI_HOST?.trim();
	if (!key || !host) throw new Error("SofaScore RapidAPI credentials are not configured");
	if (host !== "sportapi7.p.rapidapi.com") throw new Error("Configured RapidAPI host does not match the documented SportAPI listing");
	if (!isDocumentedRapidApiPath(path)) throw new Error("SportAPI path is not in the documented endpoint allowlist");
	const diagnostic = options.diagnostic;
	if (diagnostic && (!diagnostic.authorized || !diagnostic.accountActive || !diagnostic.dashboardVerified ||
		!/^\/api\/v1\/event\/\d+$/.test(path))) {
		throw new Error("A diagnostic requires explicit authorization, active-account and dashboard verification, and one documented event-details endpoint");
	}
	const cacheEndpoint = rapidApiCacheEndpoint(path);
	if (!options.forceRefresh) {
		const cached = await pool.query("SELECT Payload, FetchedAt FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = $1", [cacheEndpoint]);
		if (cached.rows[0]) {
			const ttl = Number(cached.rows[0].payload?.cacheTtlMs ?? options.ttlMs ?? 24 * 60 * 60_000);
			if (Date.now() - new Date(cached.rows[0].fetchedat).getTime() < ttl) return cached.rows[0].payload?.body;
		}
	}
	const flightKey = `rapidapi:${path}`;
	const existing = inFlight.get(flightKey);
	if (existing) return existing;
	const request = (async () => {
		let client = await pool.connect();
		let locked = false;
		let clientReleased = false;
		let quota = await readRapidApiQuota(client);
		const fingerprint = rapidApiKeyFingerprint(key);
		let auditEndpoint: string | null = null;
		let attemptAt: string | null = null;
		try {
			await client.query("SELECT pg_advisory_lock($1)", [RAPIDAPI_LOCK_ID]);
			locked = true;
			quota = await readRapidApiQuota(client);
			if (!diagnostic && !options.forceRefresh) {
				const inDbCache = await client.query("SELECT Payload, FetchedAt FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = $1", [cacheEndpoint]);
				if (inDbCache.rows[0]) {
					const ttl = Number(inDbCache.rows[0].payload?.cacheTtlMs ?? options.ttlMs ?? 24 * 60 * 60_000);
					if (Date.now() - new Date(inDbCache.rows[0].fetchedat).getTime() < ttl) return inDbCache.rows[0].payload?.body;
				}
			}
			if (quota.keyFingerprint && quota.keyFingerprint !== fingerprint) {
				await writeRapidApiQuota({ ...quota, paused: true, pauseReason: "RapidAPI key changed; dashboard quota reconciliation is required" }, client);
				throw new Error("SofaScore RapidAPI is paused: key changed and quota reconciliation is required");
			}
			if (quota.paused && !diagnostic) throw new Error(`SofaScore RapidAPI is paused: ${quota.pauseReason ?? "manual quota reconciliation is required"}`);
			if (diagnostic && quota.lastStatus !== 404) throw new Error("The one-request diagnostic is available only for an unresolved stored HTTP 404");
			if (quota.retryAt && Date.parse(quota.retryAt) > Date.now()) throw new Error(`SofaScore RapidAPI cooldown active until ${quota.retryAt}`);
			if ((!Number.isInteger(quota.monthlyUsed) || !Number.isFinite(quota.monthlyBandwidthBytes)) && !diagnostic) {
				await writeRapidApiQuota({ ...quota, paused: true, pauseReason: "Monthly usage baseline is unknown; verify RapidAPI dashboard and reconcile usage" }, client);
				throw new Error("SofaScore RapidAPI monthly request or bandwidth usage is unknown; dashboard reconciliation is required");
			}
			let used = Number(quota.monthlyUsed ?? diagnostic?.monthlyUsed);
			let bandwidthUsed = Number(quota.monthlyBandwidthBytes ?? Math.ceil((diagnostic?.monthlyBandwidthMB ?? 0) * 1024 * 1024));
			let remaining = quota.remaining ?? null;
			if (diagnostic) {
				if (!Number.isInteger(diagnostic.monthlyUsed) || diagnostic.monthlyUsed < used || diagnostic.monthlyUsed >= RAPIDAPI_INTERNAL_MONTHLY_BUDGET ||
					!Number.isFinite(diagnostic.monthlyBandwidthMB) || diagnostic.monthlyBandwidthMB < 0 || diagnostic.monthlyBandwidthMB >= 8_192 ||
					!Number.isInteger(diagnostic.remaining) || diagnostic.remaining <= RAPIDAPI_MONTHLY_RESERVE || diagnostic.remaining > RAPIDAPI_MONTHLY_HARD_LIMIT) {
					throw new Error("Diagnostic requires dashboard-confirmed request and bandwidth usage below internal budgets and more than the reserved quota");
				}
				used = diagnostic.monthlyUsed;
				bandwidthUsed = Math.ceil(diagnostic.monthlyBandwidthMB * 1024 * 1024);
				remaining = diagnostic.remaining;
				const verifiedAt = Date.parse(diagnostic.verifiedAt);
				if (!Number.isFinite(verifiedAt) || Date.now() - verifiedAt > 5 * 60_000 || verifiedAt > Date.now() + 30_000) {
					throw new Error("A recent dashboard verification timestamp is required for the diagnostic");
				}
			}
			const hourly = await client.query(`SELECT COUNT(*)::int AS count FROM MatchApiCache
				WHERE MatchID = 0 AND Endpoint LIKE 's7-log-%'
				AND (Payload->>'requestedAt')::timestamptz > CURRENT_TIMESTAMP - INTERVAL '1 hour'`);
			if (used >= RAPIDAPI_INTERNAL_MONTHLY_BUDGET || bandwidthUsed >= RAPIDAPI_INTERNAL_BANDWIDTH_BYTES ||
				Number(hourly.rows[0]?.count ?? 0) >= RAPIDAPI_INTERNAL_HOURLY_BUDGET) {
				await writeRapidApiQuota({ ...quota, monthlyUsed: used, paused: true,
					monthlyBandwidthBytes: bandwidthUsed,
					pauseReason: used >= RAPIDAPI_INTERNAL_MONTHLY_BUDGET ? "KickOff internal monthly request budget reached; verify monthly quota in dashboard"
						: bandwidthUsed >= RAPIDAPI_INTERNAL_BANDWIDTH_BYTES ? "KickOff internal monthly bandwidth budget reached; verify bandwidth usage in dashboard"
						: "KickOff internal hourly request budget reached; requests are paused for this hour" }, client);
				throw new Error("SofaScore RapidAPI internal request budget reached");
			}
			if (remaining == null || remaining <= RAPIDAPI_MONTHLY_RESERVE) {
				await writeRapidApiQuota({ ...quota, monthlyUsed: used, paused: true,
					pauseReason: "Provider quota is unknown or at the reserved monthly safety margin; dashboard reconciliation is required" }, client);
				throw new Error("SofaScore RapidAPI quota is unknown or at its safety reserve");
			}
			if (quota.limit != null && quota.limit !== RAPIDAPI_MONTHLY_HARD_LIMIT) {
				await writeRapidApiQuota({ ...quota, paused: true, pauseReason: "Provider quota limit does not match the confirmed 50-request BASIC plan; verify the dashboard" }, client);
				throw new Error("SofaScore RapidAPI plan limit does not match the verified BASIC plan");
			}
			attemptAt = new Date().toISOString();
			const auditSequence = Number(quota.auditSequence ?? 0) + 1;
			auditEndpoint = rapidApiAuditEndpoint(auditSequence);
			const pendingAudit = { endpoint: path, status: null, requestedAt: attemptAt, headers: {}, responseBytes: null, responseExcerpt: null };
			await writeRapidApiAudit(auditSequence, pendingAudit, client);
			quota = { ...quota, keyFingerprint: fingerprint, auditSequence, monthlyUsed: used + 1, monthlyBandwidthBytes: bandwidthUsed,
				remaining: remaining - 1, lastAttemptAt: attemptAt, lastRequest: pendingAudit };
			await writeRapidApiQuota(quota, client);
			await client.query("SELECT pg_advisory_unlock($1)", [RAPIDAPI_LOCK_ID]);
			locked = false;
			client.release();
			clientReleased = true;
			let response: Response;
			let responseText: string;
			try {
				response = await fetch(`${RAPIDAPI_BASE}${path}`, {
					headers: { "x-rapidapi-host": host, "x-rapidapi-key": key },
					cache: "no-store", signal: AbortSignal.timeout(10_000),
				});
				responseText = await response.text();
			} catch {
				client = await pool.connect();
				clientReleased = false;
				await client.query("SELECT pg_advisory_lock($1)", [RAPIDAPI_LOCK_ID]);
				locked = true;
				quota = await readRapidApiQuota(client);
				const failedAudit = { ...pendingAudit, responseExcerpt: "Network error or timeout; response status unavailable" };
				await writeRapidApiAudit(auditSequence, failedAudit, client);
				await writeRapidApiQuota({ ...quota, monthlyUsed: Math.max(Number(quota.monthlyUsed ?? 0), used + 1),
					paused: true, pauseReason: "Request outcome is uncertain; verify dashboard quota before resuming", lastRequest: failedAudit }, client);
				throw new Error("SofaScore RapidAPI request failed; quota state preserved for reconciliation");
			}
			client = await pool.connect();
			clientReleased = false;
			await client.query("SELECT pg_advisory_lock($1)", [RAPIDAPI_LOCK_ID]);
			locked = true;
			quota = await readRapidApiQuota(client);
			const quotaHeaders = readSofaScoreRapidApiQuotaHeaders(response.headers);
			const headers = rapidApiResponseHeaders(response.headers);
			const responseBytes = Buffer.byteLength(responseText, "utf8");
			let body: any = null;
			try { body = responseText ? JSON.parse(responseText) : null; } catch { body = responseText || null; }
			const responseExcerpt = response.status >= 400 ? redactApiKey(responseText, key) : null;
			const now = new Date();
			const observedQuota = quotaHeaders.remaining;
			const resetAt = quotaHeaders.resetSeconds == null ? quota.resetAt
				: new Date(now.getTime() + quotaHeaders.resetSeconds * 1000).toISOString();
			const audit = { endpoint: path, status: response.status, requestedAt: attemptAt, headers, responseBytes, responseExcerpt };
			await writeRapidApiAudit(auditSequence, audit, client);
			const latestMonthlyUsed = Number(quota.monthlyUsed ?? used + 1);
			const latestRemaining = Number(quota.remaining ?? remaining - 1);
			const monthlyUsed = observedQuota == null ? Math.max(used + 1, latestMonthlyUsed)
				: Math.max(latestMonthlyUsed, RAPIDAPI_MONTHLY_HARD_LIMIT - observedQuota);
			const monthlyBandwidthBytes = Number(quota.monthlyBandwidthBytes ?? bandwidthUsed) + responseBytes;
			const remainingAfter = observedQuota == null ? latestRemaining : Math.min(observedQuota, latestRemaining);
			const diagnosticData = diagnostic ? { endpoint: path, status: response.status, requestedAt: attemptAt, responseBytes, responseExcerpt } : quota.lastDiagnostic;
			if (response.status === 401 || response.status === 403 || response.status === 429) {
				const reason = response.status === 429 || observedQuota === 0
					? "RapidAPI quota or rate limit exhausted; verify dashboard before resuming"
					: `RapidAPI access restricted (HTTP ${response.status}); verify subscription and access`;
				await writeRapidApiQuota({ ...quota, monthlyUsed, monthlyBandwidthBytes, remaining: remainingAfter, limit: quotaHeaders.limit ?? quota.limit,
					resetAt, observedAt: observedQuota == null ? quota.observedAt : now.toISOString(), paused: true,
					pauseReason: diagnostic ? quota.pauseReason : reason, lastStatus: response.status, lastStatusAt: attemptAt,
			pauseOriginStatus: quota.pauseOriginStatus ?? (diagnostic ? quota.lastStatus : response.status),
			pauseOriginAt: quota.pauseOriginAt ?? (diagnostic ? quota.lastStatusAt : attemptAt),
					lastRequest: audit, lastDiagnostic: diagnosticData, retryAt: null }, client);
				throw new Error(`SofaScore RapidAPI ${response.status}; provider paused for manual verification`);
			}
			if (response.status === 404) {
				const missingTtl = RAPIDAPI_NEGATIVE_CACHE_TTL_MS;
				const pauseReason = diagnostic ? quota.pauseReason : observedQuota == null
					? "RapidAPI response omitted quota headers; HTTP 404 cause remains unverified"
					: observedQuota <= RAPIDAPI_MONTHLY_RESERVE ? "Monthly quota is at the reserved safety margin; dashboard verification is required" : quota.pauseReason;
				await writeRapidApiQuota({ ...quota, monthlyUsed, monthlyBandwidthBytes, remaining: remainingAfter,
					limit: quotaHeaders.limit ?? quota.limit, resetAt,
					observedAt: observedQuota == null ? quota.observedAt : now.toISOString(),
					paused: diagnostic ? true : observedQuota == null || observedQuota <= RAPIDAPI_MONTHLY_RESERVE || Boolean(quota.paused),
					pauseReason: monthlyBandwidthBytes >= RAPIDAPI_INTERNAL_BANDWIDTH_BYTES ? "KickOff internal monthly bandwidth budget reached; verify dashboard usage before resuming" : pauseReason, lastStatus: response.status, lastStatusAt: attemptAt, lastRequest: audit,
					pauseOriginStatus: (diagnostic || (observedQuota != null && observedQuota > RAPIDAPI_MONTHLY_RESERVE && !quota.paused))
						? quota.pauseOriginStatus : 404,
					pauseOriginAt: quota.pauseOriginAt ?? (diagnostic ? quota.lastStatusAt : attemptAt),
					lastDiagnostic: diagnosticData, retryAt: null, failures: 0 }, client);
				await client.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
					VALUES (0, $1, $2::jsonb, CURRENT_TIMESTAMP)
					ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
					[cacheEndpoint, JSON.stringify({ body: null, cacheTtlMs: missingTtl })]);
				return null;
			}
			if (!response.ok) {
				const failures = Number(quota.failures ?? 0) + 1;
				await writeRapidApiQuota({ ...quota, monthlyUsed, monthlyBandwidthBytes, remaining: remainingAfter,
					limit: quotaHeaders.limit ?? quota.limit, resetAt, observedAt: observedQuota == null ? quota.observedAt : now.toISOString(),
					failures, lastStatus: response.status, lastStatusAt: attemptAt,
					pauseOriginStatus: diagnostic ? quota.pauseOriginStatus ?? quota.lastStatus : response.status,
					pauseOriginAt: quota.pauseOriginAt ?? (diagnostic ? quota.lastStatusAt : attemptAt),
					lastRequest: audit, lastDiagnostic: diagnosticData,
					retryAt: null, paused: true, pauseReason: `HTTP ${response.status}; verify endpoint and account before any further request` }, client);
				throw new Error(`SofaScore RapidAPI returned HTTP ${response.status}; no automatic retry was attempted`);
			}
			const quotaMismatch = quotaHeaders.limit != null && quotaHeaders.limit !== RAPIDAPI_MONTHLY_HARD_LIMIT;
			const bandwidthBudgetReached = monthlyBandwidthBytes >= RAPIDAPI_INTERNAL_BANDWIDTH_BYTES;
			const paused = diagnostic ? true : quotaMismatch || observedQuota == null || observedQuota <= RAPIDAPI_MONTHLY_RESERVE ||
				bandwidthBudgetReached || Boolean(quota.paused);
			const nextQuota: RapidApiQuotaState = {
				...quota, monthlyUsed, monthlyBandwidthBytes, remaining: remainingAfter, limit: quotaHeaders.limit ?? quota.limit, resetAt,
				observedAt: observedQuota == null ? quota.observedAt : now.toISOString(),
				paused, pauseReason: diagnostic ? quota.pauseReason : quotaMismatch
					? "Provider quota limit does not match the confirmed 50-request BASIC plan; verify the dashboard"
					: observedQuota == null ? "RapidAPI response omitted quota headers; verify the dashboard before resuming"
					: observedQuota <= RAPIDAPI_MONTHLY_RESERVE ? "Monthly quota is at the reserved safety margin; dashboard reconciliation is required"
					: bandwidthBudgetReached ? "KickOff internal monthly bandwidth budget reached; dashboard reconciliation is required" : quota.pauseReason,
				retryAt: null, failures: 0, lastStatus: response.status, lastStatusAt: attemptAt,
				pauseOriginStatus: diagnostic ? quota.pauseOriginStatus ?? quota.lastStatus : quota.pauseOriginStatus,
				pauseOriginAt: quota.pauseOriginAt ?? (diagnostic ? quota.lastStatusAt : undefined),
				lastSuccessAt: now.toISOString(), lastRequest: audit, lastDiagnostic: diagnosticData,
			};
			await writeRapidApiQuota(nextQuota, client);
			const ttlMs = options.ttlMs ?? 24 * 60 * 60_000;
			await client.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
				VALUES (0, $1, $2::jsonb, CURRENT_TIMESTAMP)
				ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
				[cacheEndpoint, JSON.stringify({ body, cacheTtlMs: ttlMs })]);
			return body;
		} finally {
			if (locked) await client.query("SELECT pg_advisory_unlock($1)", [RAPIDAPI_LOCK_ID]);
			if (!clientReleased) client.release();
		}
	})();
	inFlight.set(flightKey, request);
	try { return await request; } finally { inFlight.delete(flightKey); }
}

export async function diagnoseSofaScoreRapidApiEvent(eventId: number, authorization: RapidApiDiagnosticAuthorization) {
	if (!Number.isSafeInteger(eventId) || eventId <= 0) throw new Error("A documented numeric SportAPI event ID is required");
	return callSofaScoreRapidApi(`/api/v1/event/${eventId}`, { forceRefresh: true, diagnostic: authorization, ttlMs: 24 * 60 * 60_000 });
}

export async function getSofaScoreRapidApiQuotaReport() {
	const state = await readRapidApiQuota();
	const hourly = await pool.query(`SELECT COUNT(*)::int AS count FROM MatchApiCache
		WHERE MatchID = 0 AND Endpoint LIKE 's7-log-%'
		AND (Payload->>'requestedAt')::timestamptz > CURRENT_TIMESTAMP - INTERVAL '1 hour'`);
	return {
		configured: Boolean(process.env.SOFASCORE_RAPIDAPI_KEY?.trim() && process.env.SOFASCORE_RAPIDAPI_HOST?.trim()),
		plan: { name: "BASIC", monthlyRequestLimit: RAPIDAPI_MONTHLY_HARD_LIMIT, hourlyRequestLimit: RAPIDAPI_HOURLY_HARD_LIMIT, monthlyBandwidthMB: 10_240 },
		paused: Boolean(state.paused), pauseReason: state.pauseReason ?? null,
		monthlyBudget: { hardLimit: RAPIDAPI_MONTHLY_HARD_LIMIT, internalLimit: RAPIDAPI_INTERNAL_MONTHLY_BUDGET,
			reserved: RAPIDAPI_MONTHLY_RESERVE, used: state.monthlyUsed ?? null,
			remainingInternal: state.monthlyUsed == null ? null : Math.max(0, RAPIDAPI_INTERNAL_MONTHLY_BUDGET - state.monthlyUsed),
			verifiedAt: state.monthlyVerifiedAt ?? null, resetsAutomatically: false },
		monthlyBandwidth: { hardLimitMB: RAPIDAPI_BANDWIDTH_HARD_BYTES / (1024 * 1024),
			internalLimitMB: RAPIDAPI_INTERNAL_BANDWIDTH_BYTES / (1024 * 1024),
			usedMB: state.monthlyBandwidthBytes == null ? null : state.monthlyBandwidthBytes / (1024 * 1024),
			basis: "UTF-8 response-body bytes; no automatic reset" },
		hourlyBudget: { hardLimit: RAPIDAPI_HOURLY_HARD_LIMIT, internalLimit: RAPIDAPI_INTERNAL_HOURLY_BUDGET,
			usedInLastHour: Number(hourly.rows[0]?.count ?? 0) },
		quota: {
			providerReportedRemaining: state.remaining ?? null,
			providerReportedLimit: state.limit ?? null,
			providerReportedResetAt: state.resetAt ?? null,
			providerReportedWindow: "Unknown unless the RapidAPI dashboard identifies it",
			daily: state.dailyQuota ?? null, minute: state.minuteQuota ?? null,
			observedAt: state.observedAt ?? null,
		},
		lastStatus: state.lastStatus ?? null,
		lastRequest: state.lastRequest ?? null,
		lastDiagnostic: state.lastDiagnostic ?? null,
		lastSuccessAt: state.lastStatus != null && state.lastStatus >= 200 && state.lastStatus < 300 ? state.lastSuccessAt ?? null : null,
		lastSuccessAtUnavailableReason: state.lastStatus === 404
			? "The stored last response was HTTP 404; the prior state did not retain an independently verifiable 2xx timestamp"
			: null,
		verificationSteps: [
			"Open the SportAPI listing in RapidAPI and confirm the subscription is active and the account has API access.",
			"Check the listing dashboard for current daily/monthly quota, minute rate limit, and reset time; do not infer a reset from elapsed time or missing response headers.",
			"Confirm the configured RapidAPI host matches sportapi7.p.rapidapi.com and the key belongs to the active subscribed account.",
			"Only after verifying those values, run the guarded reconcile command with the dashboard's current request quota and a recent verification timestamp.",
		],
	};
}

export async function reconcileSofaScoreRapidApiQuota(input: {
	monthlyUsed: number; monthlyBandwidthMB: number; remaining: number; dashboardVerified: boolean; accountActive: boolean; verifiedAt?: string;
	dailyQuota?: { remaining: number; limit: number } | null; minuteQuota?: { remaining: number; limit: number } | null;
}) {
	if (!input.dashboardVerified || !input.accountActive) throw new Error("Verify the active account and current quota in the RapidAPI dashboard before reconciliation");
	if (!Number.isInteger(input.remaining) || input.remaining < 0 || input.remaining > RAPIDAPI_MONTHLY_HARD_LIMIT ||
		!Number.isInteger(input.monthlyUsed) || input.monthlyUsed < 0 || input.monthlyUsed > RAPIDAPI_MONTHLY_HARD_LIMIT || input.monthlyUsed + input.remaining !== RAPIDAPI_MONTHLY_HARD_LIMIT ||
		!Number.isFinite(input.monthlyBandwidthMB) || input.monthlyBandwidthMB < 0 || input.monthlyBandwidthMB > 10_240) {
		throw new Error("RapidAPI monthly used/remaining requests and bandwidth must fit the confirmed BASIC plan limits");
	}
	for (const [name, quota] of [["daily", input.dailyQuota], ["minute", input.minuteQuota]] as const) {
		if (quota && (!Number.isInteger(quota.remaining) || quota.remaining < 0 || !Number.isInteger(quota.limit) || quota.limit <= 0 || quota.remaining > quota.limit)) {
			throw new Error(`RapidAPI ${name} quota must contain valid remaining and limit integers`);
		}
	}
	const verifiedAt = Date.parse(input.verifiedAt ?? "");
	if (!Number.isFinite(verifiedAt) || verifiedAt > Date.now() + 30_000 || Date.now() - verifiedAt > 5 * 60_000) {
		throw new Error("A recent RapidAPI dashboard verification timestamp is required");
	}
	const key = process.env.SOFASCORE_RAPIDAPI_KEY?.trim();
	if (!key) throw new Error("SOFASCORE_RAPIDAPI_KEY is not configured");
	const client = await pool.connect();
	let locked = false;
	try {
		await client.query("SELECT pg_advisory_lock($1)", [RAPIDAPI_LOCK_ID]);
		locked = true;
		const previous = await readRapidApiQuota(client);
		const unresolved404 = previous.pauseOriginStatus === 404 ||
			(previous.lastStatus === 404 && previous.paused && String(previous.pauseReason ?? "").includes("omitted quota headers"));
		if (unresolved404 && (previous.lastDiagnostic?.status !== 200 ||
			Date.parse(previous.lastDiagnostic.requestedAt) <= Date.parse(previous.pauseOriginAt ?? previous.lastStatusAt ?? ""))) {
			throw new Error("The unresolved HTTP 404 still requires the explicit one-endpoint diagnostic before reconciliation");
		}
		const bandwidthBytes = Math.ceil(input.monthlyBandwidthMB * 1024 * 1024);
		const overInternalBudget = input.monthlyUsed >= RAPIDAPI_INTERNAL_MONTHLY_BUDGET || input.remaining <= RAPIDAPI_MONTHLY_RESERVE ||
			bandwidthBytes >= RAPIDAPI_INTERNAL_BANDWIDTH_BYTES;
		await writeRapidApiQuota({ ...previous, keyFingerprint: rapidApiKeyFingerprint(key), remaining: input.remaining,
			limit: RAPIDAPI_MONTHLY_HARD_LIMIT, monthlyUsed: input.monthlyUsed, monthlyBandwidthBytes: bandwidthBytes,
			monthlyVerifiedAt: new Date(verifiedAt).toISOString(),
			dailyQuota: input.dailyQuota ?? previous.dailyQuota ?? null, minuteQuota: input.minuteQuota ?? previous.minuteQuota ?? null,
			observedAt: new Date(verifiedAt).toISOString(), paused: overInternalBudget,
			pauseReason: input.monthlyUsed >= RAPIDAPI_INTERNAL_MONTHLY_BUDGET
				? "KickOff internal monthly request budget reached; preserve the remaining quota reserve"
				: input.remaining <= RAPIDAPI_MONTHLY_RESERVE ? "Monthly quota is at the reserved safety margin"
				: bandwidthBytes >= RAPIDAPI_INTERNAL_BANDWIDTH_BYTES ? "KickOff internal monthly bandwidth budget reached" : null,
			pauseOriginStatus: null, pauseOriginAt: null, retryAt: null, failures: 0 }, client);
	} finally {
		if (locked) await client.query("SELECT pg_advisory_unlock($1)", [RAPIDAPI_LOCK_ID]);
		client.release();
	}
}

function responseCacheTTL(path: string, body: any, defaultTTL: number) {
	if (path.endsWith("/lineups") || path.endsWith("/stats")) {
		return body?.available === false ? EMPTY_DETAIL_CACHE_TTL_MS : defaultTTL;
	}
	if (/\/fixtures\/\d+$/.test(path)) {
		const fixture = body?.fixture;
		const status = String(fixture?.status ?? "").toUpperCase();
		if (status === "LIVE") return LIVE_DETAIL_CACHE_TTL_MS;
		if (["FT", "AET", "PENS"].includes(status) && fixture?.events?.length) return defaultTTL;
		return EMPTY_DETAIL_CACHE_TTL_MS;
	}
	if (path.includes("/h2h/") && !body?.data?.length) return 30 * 60_000;
	return defaultTTL;
}

function cacheEndpoint(path: string) {
	return `sapi-${createHash("sha1").update(path).digest("hex").slice(0, 12)}`;
}

async function cachedRequest<T>(path: string, ttlMs = DETAIL_CACHE_TTL_MS): Promise<T> {
	const key = process.env.SPORTAPI_AI_KEY ?? process.env.SPORTAPI_API_KEY;
	if (!key) throw new Error("SPORTAPI_AI_KEY is not configured");
	const existing = inFlight.get(path);
	if (existing) return existing as Promise<T>;
	const request = (async () => {
		const endpoint = cacheEndpoint(path);
		const cached = await pool.query("SELECT Payload, FetchedAt FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = $1", [endpoint]);
		if (cached.rows[0]) {
			const age = Date.now() - new Date(cached.rows[0].fetchedat).getTime();
			if (age < responseCacheTTL(path, cached.rows[0].payload, ttlMs)) return cached.rows[0].payload as T;
		}
		const response = await fetch(`${API_BASE}${path}`, {
			headers: { "X-Api-Key": key }, cache: "no-store", signal: AbortSignal.timeout(10_000),
		});
		if (!response.ok) {
			const detail = (await response.text()).slice(0, 200);
			throw new Error(`SportAPI.ai returned ${response.status}${detail ? `: ${detail}` : ""}`);
		}
		const body = await response.json() as T;
		await pool.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
			VALUES (0, $1, $2::jsonb, CURRENT_TIMESTAMP)
			ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
			[endpoint, JSON.stringify(body)]);
		return body;
	})();
	inFlight.set(path, request);
	try { return await request as T; } finally { inFlight.delete(path); }
}

function sameTeamName(left: string, right: string) {
	const a = canonicalTeamName(left); const b = canonicalTeamName(right);
	return a.length > 0 && a === b;
}

function mapEvent(event: SportApiEvent, index: number, match: any) {
	const kind = event.event_type.toLowerCase();
	const type = kind.includes("goal") ? "Goal" : kind.includes("card") ? "Card" : kind.includes("sub") ? "Substitution" : null;
	const clock = event.minute?.match(/^(\d+)(?:\+(\d+))?/);
	if (!type || !clock) return null;
	const home = event.team_side.toLowerCase() === "home";
	const detail = event.extra_info ?? (kind.includes("red") ? "Red Card" : kind.includes("yellow") ? "Yellow Card" : type);
	return {
		eventid: event.id ?? index + 1, eventtime: Number(clock[1]), eventextratime: clock[2] ? Number(clock[2]) : null,
		eventdetail: detail, eventtype: type, teamid: home ? match.teams.home.id : match.teams.away.id,
		teamname: home ? match.teams.home.name : match.teams.away.name, playerid: null,
		playername: event.player_name ?? null, substitutionplayerid: null, assistplayername: null,
		goaltype: type === "Goal" ? detail : null,
		cardtype: type === "Card" ? (kind.includes("red") ? "Red" : "Yellow") : null,
	};
}

function mapLineup(source: any, team: any, coachName?: string | null) {
	const players = (entries: any[] = []) => entries.map((player) => ({
		id: 0, name: player.name, photo: null, number: player.shirt ?? null, position: player.position ?? null,
		grid: null, rating: null, minutes: player.mins_played ?? null,
		goals: 0, assists: 0, yellowCards: 0, redCards: 0,
	}));
	return {
		team, formation: null, coach: { name: coachName ?? null, photo: null },
		starters: players(source?.starters), substitutes: players(source?.subs), unavailable: [],
	};
}

export async function loadSportApiMatchDetails(match: any, missing: string[]) {
	if (!process.env.SPORTAPI_AI_KEY && !process.env.SPORTAPI_API_KEY) return null;
	const date = new Date(match.fixture.date).toISOString().slice(0, 10);
	const fixtures = await cachedRequest<{ data?: SportApiFixture[] }>(`/fixtures/date/${date}`, 10 * 60_000);
	const fixture = selectVerifiedProviderFixture(fixtures.data ?? [], match.teams.home.name, match.teams.away.name, match.fixture.date) as SportApiFixture | null;
	if (!fixture) return null;

	const providerFixtureId = Number(fixture.id);
	const detailsCacheId = 9_000_000_000_000 + providerFixtureId;
	if (!Number.isSafeInteger(detailsCacheId)) throw new Error("SportAPI.ai returned an invalid fixture ID");
	const [detailResult, lineupResult, statsResult, h2hResult, standingsResult] = await Promise.allSettled([
		missing.some((category) => ["venue", "referee", "events"].includes(category))
			? cachedRequest<{ fixture?: SportApiDetails }>(`/fixtures/${providerFixtureId}`)
			: Promise.resolve({ fixture: {} as SportApiDetails }),
		missing.some((category) => ["lineups", "coaches", "substitutes"].includes(category))
			? cachedRequest<{ data?: any }>(`/fixtures/${providerFixtureId}/lineups`) : Promise.resolve(null),
		missing.includes("statistics") && !["UPCOMING", "LIVE"].includes(match.fixture.status.short)
			? cachedRequest<{ data?: any }>(`/fixtures/${providerFixtureId}/stats`) : Promise.resolve(null),
		missing.includes("headToHead") && Number.isSafeInteger(fixture.home_id) && Number.isSafeInteger(fixture.away_id)
			? cachedRequest<{ data?: any[] }>(`/fixtures/h2h/${fixture.home_id}/${fixture.away_id}`) : Promise.resolve(null),
		missing.includes("standings") && Number.isSafeInteger(fixture.league_id)
			? cachedRequest<{ data?: any[] }>(`/standings/${fixture.league_id}`) : Promise.resolve(null),
	]);
	if (detailResult.status === "rejected") throw detailResult.reason;
	const details: SportApiDetails = detailResult.value.fixture ?? {} as SportApiDetails;
	const lineupData = lineupResult.status === "fulfilled" ? lineupResult.value?.data : null;
	const statsData = statsResult.status === "fulfilled" ? statsResult.value?.data : null;
	const h2hData = h2hResult.status === "fulfilled" ? h2hResult.value?.data : null;
	const standingsData = standingsResult.status === "fulfilled" ? standingsResult.value?.data : null;
	const homeTeam = { id: match.teams.home.id, name: match.teams.home.name, logo: match.teams.home.logo ?? null };
	const awayTeam = { id: match.teams.away.id, name: match.teams.away.name, logo: match.teams.away.logo ?? null };
	const events = (Array.isArray(details.events) ? details.events : []).map((event, index) => mapEvent(event, index, match)).filter(Boolean);
	const lineups = lineupData ? [
		mapLineup(lineupData.home, homeTeam, details.home_coach), mapLineup(lineupData.away, awayTeam, details.away_coach),
	] : [];
	const teamStatistics = statsData?.available !== false && statsData?.home && statsData?.away && Object.keys(statsData.home).length && Object.keys(statsData.away).length ? {
		home: { teamId: homeTeam.id, teamName: homeTeam.name, values: statsData.home },
		away: { teamId: awayTeam.id, teamName: awayTeam.name, values: statsData.away },
	} : null;
	const headToHead = Array.isArray(h2hData) ? h2hData.map((prior) => ({
		id: Number(prior.id), date: prior.date, homeTeam: prior.home_team, awayTeam: prior.away_team,
		homeScore: prior.home_score == null ? null : Number(prior.home_score),
		awayScore: prior.away_score == null ? null : Number(prior.away_score),
	})).filter((prior) => prior.id && prior.homeTeam && prior.awayTeam) : [];
	const standings = (Array.isArray(standingsData) ? standingsData : []).flatMap((row: any) => {
		const name = row?.team?.name;
		if (sameTeamName(name ?? "", match.teams.home.name)) return [{
			teamId: homeTeam.id, teamName: homeTeam.name, rank: Number(row.position ?? row.rank) || null,
			wins: Number(row.won ?? row.wins ?? 0), draws: Number(row.drawn ?? row.draws ?? 0), losses: Number(row.lost ?? row.losses ?? 0),
			goalsFor: Number(row.goals_for ?? 0), goalsAgainst: Number(row.goals_against ?? 0), points: Number(row.points) || null,
		}];
		if (sameTeamName(name ?? "", match.teams.away.name)) return [{
			teamId: awayTeam.id, teamName: awayTeam.name, rank: Number(row.position ?? row.rank) || null,
			wins: Number(row.won ?? row.wins ?? 0), draws: Number(row.drawn ?? row.draws ?? 0), losses: Number(row.lost ?? row.losses ?? 0),
			goalsFor: Number(row.goals_for ?? 0), goalsAgainst: Number(row.goals_against ?? 0), points: Number(row.points) || null,
		}];
		return [];
	});
	const providerFixture = { id: providerFixtureId, date: fixture.kickoff_utc ?? fixture.date };
	const availability = {
		hasLineups: Boolean(lineupData?.home?.starters?.length && lineupData?.away?.starters?.length),
		hasSubstitutes: Boolean(lineupData?.home?.subs?.length || lineupData?.away?.subs?.length),
		hasCoaches: Boolean(details.home_coach || details.away_coach), eventCount: events.length,
		hasVenue: Boolean(details.home_stadium || details.away_stadium), hasStatistics: Boolean(teamStatistics),
		headToHeadCount: headToHead.length, hasPlayerStats: false,
		hasStandings: standings.length > 0,
	};
	if (!availability.hasLineups && !availability.hasCoaches && !availability.eventCount && !availability.hasVenue
		&& !availability.hasStatistics && !availability.headToHeadCount && !availability.hasStandings) return null;
	const result = {
		_apiFixtureId: match._apiFixtureId,
		_providerFixture: providerFixture,
		_fallbackProviderIds: [detailsCacheId],
		fixture: {
			...match.fixture,
			venue: match.fixture.venue ?? (details.home_stadium || details.away_stadium ? {
				name: details.home_stadium || details.away_stadium,
				city: details.home_city || details.away_city || "", country: details.league_zone || "",
			} : null),
			referees: match.fixture.referees ?? [],
		},
		teams: { home: homeTeam, away: awayTeam },
		goals: {
			home: match.goals.home ?? details.home_score, away: match.goals.away ?? details.away_score,
			halftime: match.goals.halftime ?? { home: details.ht_home ?? null, away: details.ht_away ?? null },
		},
		league: { ...match.league, country: match.league.country === "International" ? details.league_zone : match.league.country },
		events, lineups, playerStatistics: [], teamStatistics, headToHead, standings,
	};
	await pool.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
		VALUES ($1, 'sapi-detail', $2::jsonb, CURRENT_TIMESTAMP)
		ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
		[detailsCacheId, JSON.stringify(availability)]);
	return result;
}

function sofaName(value: unknown) {
	return canonicalTeamName(value);
}

function sofaTimestamp(event: any) {
	const value = Number(event?.startTimestamp);
	if (Number.isFinite(value) && value > 0) return value * 1000;
	const parsed = Date.parse(String(event?.startDate ?? event?.date ?? ""));
	return Number.isFinite(parsed) ? parsed : null;
}

function sofaCountry(event: any) {
	return event?.tournament?.category?.name ?? event?.tournament?.category?.country?.name ?? event?.category?.name ?? null;
}

function verifiedSofaFixture(primary: any, candidate: any) {
	const when = sofaTimestamp(candidate);
	const primaryWhen = Date.parse(String(primary?.fixture?.date ?? ""));
	const home = candidate?.homeTeam;
	const away = candidate?.awayTeam;
	const competition = candidate?.tournament;
	if (!Number.isSafeInteger(Number(candidate?.id)) || Number(candidate.id) <= 0 ||
		!Number.isSafeInteger(Number(home?.id)) || !Number.isSafeInteger(Number(away?.id)) ||
		!Number.isSafeInteger(Number(competition?.id)) || !Number.isSafeInteger(Number(candidate?.season?.id)) ||
		when === null || !Number.isFinite(primaryWhen)) return false;
	if (sofaName(home.name) !== sofaName(primary?.teams?.home?.name) ||
		sofaName(away.name) !== sofaName(primary?.teams?.away?.name)) return false;
	if (!sofaName(primary?.league?.name) || sofaName(competition.name) !== sofaName(primary.league.name)) return false;
	const targetCountry = sofaName(primary?.league?.country);
	const candidateCountry = sofaName(sofaCountry(candidate));
	if (targetCountry && targetCountry !== "international" && candidateCountry && targetCountry !== candidateCountry) return false;
	if (Math.abs(when - primaryWhen) > 6 * 60 * 60_000) return false;
	if (primary?.fixture?.status?.short === "FT" && primary?.goals?.home != null && primary?.goals?.away != null) {
		if (Number(candidate?.homeScore?.current) !== Number(primary.goals.home) ||
			Number(candidate?.awayScore?.current) !== Number(primary.goals.away)) return false;
	}
	return true;
}

function rapidApiEventArray(body: any, ...keys: string[]): any[] {
	for (const key of keys) {
		const value = body?.[key] ?? body?.data?.[key];
		if (Array.isArray(value)) return value;
	}
	return [];
}

/** Loads only documented SportAPI endpoints after a strict fixture mapping against the database match. */
export async function loadSofaScoreRapidApiMatchDetails(match: any, missing: string[]) {
	if (!process.env.SOFASCORE_RAPIDAPI_KEY || !process.env.SOFASCORE_RAPIDAPI_HOST) return null;
	const matchId = Number(match?._databaseMatchId);
	if (!Number.isSafeInteger(matchId) || matchId <= 0) return null;
	const date = new Date(match.fixture.date).toISOString().slice(0, 10);
	const mapping = await pool.query("SELECT Payload, FetchedAt FROM MatchApiCache WHERE MatchID = $1 AND Endpoint = 's7-event-map'", [matchId]);
	let mapped: any = null;
	if (mapping.rows[0] && Date.now() - new Date(mapping.rows[0].fetchedat).getTime() < (mapping.rows[0].payload?.notFound ? 365 : 30) * 24 * 60 * 60_000) {
		mapped = mapping.rows[0].payload;
	}
	if (!mapped) {
		const schedule = await callSofaScoreRapidApi(`/api/v1/sport/football/scheduled-events/${date}`, { ttlMs: 10 * 60_000, negativeTtlMs: 5 * 60_000 });
		const events = rapidApiEventArray(schedule, "events");
		const matches = events.filter((event) => verifiedSofaFixture(match, event));
		if (matches.length !== 1) {
			mapped = { notFound: true, reason: matches.length ? "ambiguous-fixture" : "no-verified-fixture" };
			await pool.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
				VALUES ($1, 's7-event-map', $2::jsonb, CURRENT_TIMESTAMP)
				ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
				[matchId, JSON.stringify(mapped)]);
			return null;
		}
		const event = matches[0];
		mapped = {
			eventId: Number(event.id), homeTeamId: Number(event.homeTeam.id), awayTeamId: Number(event.awayTeam.id),
			tournamentId: Number(event.tournament.id), seasonId: Number(event.season.id),
			customId: event.customId ?? null, kickoff: new Date(sofaTimestamp(event)!).toISOString(),
		};
		await pool.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
			VALUES ($1, 's7-event-map', $2::jsonb, CURRENT_TIMESTAMP)
			ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload = EXCLUDED.Payload, FetchedAt = EXCLUDED.FetchedAt`,
			[matchId, JSON.stringify(mapped)]);
	}
	if (mapped?.notFound) return null;
	const eventId = Number(mapped.eventId);
	if (!Number.isSafeInteger(eventId) || eventId <= 0) return null;
	const detailBody = await callSofaScoreRapidApi(`/api/v1/event/${eventId}`, { ttlMs: 24 * 60 * 60_000 });
	const event = detailBody?.event ?? detailBody?.data?.event ?? detailBody?.data ?? detailBody;
	if (Number(event?.id) !== eventId || !verifiedSofaFixture(match, event) ||
		Number(event?.homeTeam?.id) !== Number(mapped.homeTeamId) ||
		Number(event?.awayTeam?.id) !== Number(mapped.awayTeamId) ||
		Number(event?.tournament?.id) !== Number(mapped.tournamentId) ||
		Number(event?.season?.id) !== Number(mapped.seasonId)) return null;

	const wantsEvents = missing.includes("events");
	const wantsLineups = missing.some((category) => ["lineups", "coaches", "substitutes"].includes(category));
	const wantsStats = missing.includes("statistics");
	const [incidentsBody, lineupsBody, statsBody] = await Promise.all([
		wantsEvents ? callSofaScoreRapidApi(`/api/v1/event/${eventId}/incidents`, { ttlMs: match.fixture.status.short === "LIVE" ? 30_000 : 24 * 60 * 60_000, negativeTtlMs: 5 * 60_000 }) : null,
		wantsLineups ? callSofaScoreRapidApi(`/api/v1/event/${eventId}/lineups`, { ttlMs: 24 * 60 * 60_000, negativeTtlMs: 15 * 60_000 }) : null,
		wantsStats && match.fixture.status.short !== "UPCOMING" ? callSofaScoreRapidApi(`/api/v1/event/${eventId}/statistics`, { ttlMs: match.fixture.status.short === "LIVE" ? 60_000 : 24 * 60 * 60_000, negativeTtlMs: 5 * 60_000 }) : null,
	]);

	const home = { id: match.teams.home.id, name: match.teams.home.name, logo: match.teams.home.logo ?? null };
	const away = { id: match.teams.away.id, name: match.teams.away.name, logo: match.teams.away.logo ?? null };
	const incidents = rapidApiEventArray(incidentsBody, "incidents");
	const events = incidents.flatMap((incident, index) => {
		const isHome = incident?.isHome === true || Number(incident?.team?.id) === Number(mapped.homeTeamId);
		const isAway = incident?.isHome === false || Number(incident?.team?.id) === Number(mapped.awayTeamId);
		if (!isHome && !isAway) return [];
		const kind = String(incident?.incidentType ?? incident?.type ?? "").toLowerCase();
		const type = kind.includes("goal") ? "Goal" : kind.includes("card") ? "Card"
			: kind.includes("sub") ? "Substitution" : kind.includes("var") ? "VAR" : null;
		const minute = Number(incident?.time ?? incident?.timeSeconds ?? incident?.minute);
		if (!type || !Number.isFinite(minute)) return [];
		const team = isHome ? home : away;
		const player = incident?.player?.name ?? incident?.playerName ?? null;
		return [{ id: Number(incident?.id) || null, eventtime: minute, eventextratime: Number(incident?.addedTime) || null,
			eventdetail: incident?.incidentClass ?? incident?.text ?? type, eventtype: type, teamid: team.id, teamname: team.name,
			playerid: null, playername: player, substitutionplayerid: null, assistplayername: null,
			_providerPlayerId: Number(incident?.player?.id) || null, source: "sportapi7" }];
	});

	const lineupData = lineupsBody?.lineups ?? lineupsBody?.data ?? lineupsBody;
	const mapTeamLineup = (source: any, team: any) => {
		const players = Array.isArray(source?.players) ? source.players : [];
		const convert = (row: any) => ({
			id: null, providerId: Number(row?.player?.id) || null,
			name: row?.player?.name ?? row?.name ?? "", photo: row?.player?.imageUrl ?? row?.player?.photo ?? null,
			number: Number(row?.shirtNumber ?? row?.jerseyNumber ?? row?.player?.shirtNumber) || null,
			position: row?.position ?? row?.player?.position ?? null, grid: row?.player?.grid ?? null,
			rating: Number.isFinite(Number(row?.rating)) ? Number(row.rating) : null, minutes: null,
			goals: null, assists: null, yellowCards: null, redCards: null, source: "sportapi7",
		});
		const coach = source?.manager ?? source?.coach ?? null;
		return {
			team, formation: source?.formation ?? null,
			coach: coach?.name ? { id: null, providerId: Number(coach?.id) || null, name: coach.name, photo: coach.pictureUrl ?? coach.photo ?? null, source: "sportapi7" } : null,
			starters: players.filter((player: any) => player?.substitute !== true && player?.isSubstitute !== true).map(convert).filter((player: any) => player.name),
			substitutes: players.filter((player: any) => player?.substitute === true || player?.isSubstitute === true).map(convert).filter((player: any) => player.name),
			source: "sportapi7",
		};
	};
	const lineupPair = lineupsBody ? [mapTeamLineup(lineupData?.home, home), mapTeamLineup(lineupData?.away, away)] : [];
	const lineups = lineupPair.length === 2 && lineupPair.every((lineup: any) => lineup.starters.length || lineup.substitutes.length)
		? lineupPair : [];

	const periods = rapidApiEventArray(statsBody, "statistics", "periods");
	const statsPeriod = periods.find((period) => String(period?.period ?? "").toUpperCase() === "ALL") ?? periods[0];
	const statRows = Array.isArray(statsPeriod?.groups) ? statsPeriod.groups.flatMap((group: any) => group?.statistics ?? [])
		: Array.isArray(statsBody?.statistics) ? statsBody.statistics : [];
	const statValues = Object.fromEntries(statRows.filter((item: any) => item?.name || item?.key)
		.map((item: any) => [String(item.name ?? item.key), { home: item.home ?? null, away: item.away ?? null }]));
	const teamStatistics = Object.keys(statValues).length ? {
		home: { teamId: home.id, teamName: home.name, values: Object.fromEntries(Object.entries(statValues).map(([key, value]: [string, any]) => [key, value.home])) },
		away: { teamId: away.id, teamName: away.name, values: Object.fromEntries(Object.entries(statValues).map(([key, value]: [string, any]) => [key, value.away])) },
	} : null;

	const h2h: any[] = [];

	const venue = event.venue?.name ? {
		name: event.venue.name, city: event.venue.city?.name ?? "", country: sofaCountry(event) ?? "",
	} : null;
	const referee = event.referee?.name ?? null;
	const result = {
		_apiFixtureId: match._apiFixtureId,
		_providerFixture: { id: eventId, date: new Date(sofaTimestamp(event)!).toISOString() },
		_fallbackProviderIds: [eventId],
		_fieldProvenance: {
			...(missing.includes("venue") && venue ? { "fixture.venue": "sportapi7" } : {}),
			...(missing.includes("referee") && referee ? { "fixture.referees": "sportapi7" } : {}),
			...(events.length ? { events: "sportapi7" } : {}), ...(lineups.length ? { lineups: "sportapi7" } : {}),
			...(teamStatistics ? { teamStatistics: "sportapi7" } : {}), ...(h2h.length ? { headToHead: "sportapi7" } : {}),
		},
		fixture: { ...match.fixture, venue: match.fixture.venue ?? venue,
			referees: match.fixture.referees?.length ? match.fixture.referees : referee ? [referee] : [] },
		league: match.league, teams: { home, away }, goals: match.goals,
		lineups, events, teamStatistics, headToHead: h2h, playerStatistics: [], standings: [],
	};
	return result;
}
