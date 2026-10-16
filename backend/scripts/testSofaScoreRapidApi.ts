import assert from "node:assert/strict";
import { createHash, randomUUID } from "crypto";
import dotenv from "dotenv";
import path from "path";
import { initializeDatabase, pool } from "../src/db";
import {
	callSofaScoreRapidApi,
	diagnoseSofaScoreRapidApiEvent,
	getSofaScoreRapidApiQuotaReport,
	loadSofaScoreRapidApiMatchDetails,
	reconcileSofaScoreRapidApiQuota,
	readSofaScoreRapidApiQuotaHeaders,
} from "../src/services/sportApiClient";
import { pullMatchDetailsFromDatabase } from "../src/services/matchPipelineService";
import { mergeVerifiedProviderFallback } from "../src/services/matchDetailsMerge";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const cacheEndpoint = (path: string) => `s7-${createHash("sha1").update(path).digest("hex").slice(0, 12)}`;
const eventPath = () => `/api/v1/event/${10_000_000 + Math.floor(Math.random() * 80_000_000)}`;

async function main() {
	await initializeDatabase();
	const originalKey = process.env.SOFASCORE_RAPIDAPI_KEY;
	const originalHost = process.env.SOFASCORE_RAPIDAPI_HOST;
	const originalFetch = globalThis.fetch;
	const originalQuota = await pool.query("SELECT Payload FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = 's7-quota-state'");
	const testKey = `rapidapi-test-${randomUUID()}`;
	const paths: string[] = [];
	let calls = 0;
	let mockRemaining = 50;
	let nextStatus = 200;
	let omitQuotaHeaders = false;
	let omit404Headers = false;
	let emptySchedule = false;
	let sampleId: number | null = null;
	let originalEventMapping: any = null;
	let originalScheduleCache: any = null;
	let scheduleCacheEndpoint: string | null = null;

	process.env.SOFASCORE_RAPIDAPI_KEY = testKey;
	process.env.SOFASCORE_RAPIDAPI_HOST = "sportapi7.p.rapidapi.com";
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		calls++;
		const url = String(input);
		const pathName = new URL(url).pathname;
		paths.push(pathName);
		const omitHeaders = omitQuotaHeaders || (nextStatus === 404 && omit404Headers);
		const headers = omitHeaders ? {} : {
			"x-ratelimit-requests-remaining": String(mockRemaining),
			"x-ratelimit-requests-limit": "50",
			"x-ratelimit-requests-reset": "3600",
		};
		if (!omitQuotaHeaders) mockRemaining = Math.max(0, mockRemaining - 1);
		if (pathName.includes("/scheduled-events/")) return new Response(JSON.stringify({ events: emptySchedule ? [] : [sampleEvent] }), { status: nextStatus, headers });
		if (pathName.endsWith(`/event/${sampleEvent.id}`)) return new Response(JSON.stringify({ event: sampleEvent }), { status: nextStatus, headers });
		if (pathName.endsWith("/incidents")) return new Response(JSON.stringify({ incidents: [
			{ id: 9, incidentType: "goal", time: 31, isHome: true, team: sampleEvent.homeTeam, player: { id: 91, name: "Test Striker" } },
		] }), { status: nextStatus, headers });
		if (pathName.endsWith("/lineups")) return new Response(JSON.stringify({ home: {
			formation: "4-3-3", manager: { id: 11, name: "Home Coach" },
			players: [{ player: { id: 101, name: "Test Striker" }, shirtNumber: 9, position: "F" }],
		}, away: { formation: "4-4-2", manager: { id: 12, name: "Away Coach" }, players: [
			{ player: { id: 102, name: "Away Forward" }, shirtNumber: 10, position: "F" },
		] } }), { status: nextStatus, headers });
		if (pathName.endsWith("/statistics")) return new Response(JSON.stringify({ statistics: [{ period: "ALL", groups: [{ statistics: [
			{ name: "Ball possession", home: "55%", away: "45%" },
		] }] }] }), { status: nextStatus, headers });
		if (pathName.endsWith("/h2h/events")) return new Response(JSON.stringify({ events: [
			{ id: 92, startTimestamp: Math.floor(Date.parse(sampleEvent.startDate) / 1000) - 86_400,
				homeTeam: sampleEvent.homeTeam, awayTeam: sampleEvent.awayTeam,
				homeScore: { current: 1 }, awayScore: { current: 0 } },
		] }), { status: nextStatus, headers });
		return new Response(JSON.stringify({}), { status: nextStatus, headers });
	}) as typeof fetch;

	let sampleEvent: any = {
		id: Number(Date.now().toString().slice(-8)), startTimestamp: 0, startDate: "", customId: `test-${randomUUID()}`,
		homeTeam: { id: 98101, name: "Home FC" }, awayTeam: { id: 98102, name: "Away FC" },
		tournament: { id: 98103, name: "Test League", category: { name: "Test Country" } },
		season: { id: 98104 }, status: { type: "finished" }, homeScore: { current: 2 }, awayScore: { current: 1 },
		venue: { name: "Test Ground", city: { name: "Test City" } }, referee: { name: "Test Referee" },
	};

	try {
		const parsedHeaders = readSofaScoreRapidApiQuotaHeaders(new Headers({
			"x-ratelimit-requests-remaining": "24", "x-ratelimit-requests-limit": "100", "x-ratelimit-requests-reset": "120",
		}));
		assert.deepEqual(parsedHeaders, { remaining: 24, limit: 100, resetSeconds: 120 });
		assert.equal(readSofaScoreRapidApiQuotaHeaders(new Headers()).remaining, null);

		await pool.query("DELETE FROM MatchApiCache WHERE MatchID = 0 AND Endpoint = 's7-quota-state'");
		await reconcileSofaScoreRapidApiQuota({ monthlyUsed: 0, remaining: 50, monthlyBandwidthMB: 0, dashboardVerified: true, accountActive: true, verifiedAt: new Date().toISOString() });
		const bootstrapPath = eventPath();
		paths.push(bootstrapPath);
		const bootstrapResult = await callSofaScoreRapidApi(bootstrapPath);
		assert.deepEqual(bootstrapResult, {});
		const afterBootstrap = calls;
		await callSofaScoreRapidApi(bootstrapPath);
		assert.equal(calls, afterBootstrap, "persisted successful responses must be cached");

		const samePath = eventPath();
		paths.push(samePath);
		await Promise.all(Array.from({ length: 8 }, () => callSofaScoreRapidApi(samePath)));
		assert.equal(calls, afterBootstrap + 1, "identical in-flight requests must be deduplicated");

		const candidate = await pool.query(`SELECT m.MatchID FROM Match m
			JOIN Tournament t ON t.TournamentID = m.TournamentID
			JOIN Team h ON h.TeamID = m.HomeTeamID JOIN Team a ON a.TeamID = m.AwayTeamID
			WHERE m.MatchDate IS NOT NULL ORDER BY m.MatchDate DESC LIMIT 1`);
		assert.ok(candidate.rows[0], "test requires an existing PostgreSQL match record");
		sampleId = Number(candidate.rows[0].matchid);
		const primary = await pullMatchDetailsFromDatabase(sampleId);
		assert.ok(primary, "existing database match should hydrate");
		primary._databaseMatchId = sampleId;
		// Exercise completed-match statistics using the stored fixture identity and mocked payloads.
		primary.fixture.status.short = "FT";
		sampleEvent = {
			...sampleEvent,
			startDate: primary.fixture.date,
			startTimestamp: Math.floor(Date.parse(primary.fixture.date) / 1000),
			homeTeam: { ...sampleEvent.homeTeam, name: primary.teams.home.name }, awayTeam: { ...sampleEvent.awayTeam, name: primary.teams.away.name },
			tournament: { ...sampleEvent.tournament, name: primary.league.name, category: { name: primary.league.country } },
			homeScore: { current: Number(primary.goals.home ?? 0) }, awayScore: { current: Number(primary.goals.away ?? 0) },
		};
		const schedulePath = `/api/v1/sport/football/scheduled-events/${new Date(primary.fixture.date).toISOString().slice(0, 10)}`;
		scheduleCacheEndpoint = cacheEndpoint(schedulePath);
		originalScheduleCache = await pool.query("SELECT Payload, FetchedAt FROM MatchApiCache WHERE MatchID=0 AND Endpoint=$1", [scheduleCacheEndpoint]);
		await pool.query("DELETE FROM MatchApiCache WHERE MatchID=0 AND Endpoint=$1", [scheduleCacheEndpoint]);
		originalEventMapping = await pool.query("SELECT Payload, FetchedAt FROM MatchApiCache WHERE MatchID=$1 AND Endpoint='s7-event-map'", [sampleId]);
		await pool.query("DELETE FROM MatchApiCache WHERE MatchID=$1 AND Endpoint='s7-event-map'", [sampleId]);
		const details = await loadSofaScoreRapidApiMatchDetails(primary, ["venue", "referee", "events", "lineups", "statistics", "headToHead"]);
		assert.ok(details, "strictly verified fixture should receive mocked provider data");
		assert.equal(details._providerFixture.id, sampleEvent.id);
		assert.equal(details.events[0].source, "sportapi7");
		assert.equal(details.lineups[0].formation, "4-3-3");
		assert.equal(details.teamStatistics.home.values["Ball possession"], "55%");
		assert.deepEqual(details.headToHead, [], "nonessential H2H must not be fetched automatically");
		assert.ok(details._fieldProvenance.events === "sportapi7");
		const dbPreferred = mergeVerifiedProviderFallback({ ...primary, fixture: { ...primary.fixture, venue: { name: "PostgreSQL Ground" } } }, details);
		assert.equal(dbPreferred.fixture.venue.name, "PostgreSQL Ground", "database values must remain preferred over fallback data");
		assert.equal(dbPreferred._fieldProvenance.events, "sportapi7", "fallback provenance must be retained for filled fields");
		assert.equal(mergeVerifiedProviderFallback(primary, { ...details, teams: { home: { name: "Unrelated FC" }, away: details.teams.away } }), primary,
			"fallback records with mismatched team identity must be rejected");

		await assert.rejects(reconcileSofaScoreRapidApiQuota({ monthlyUsed: 1, remaining: 49, monthlyBandwidthMB: 0, dashboardVerified: false, accountActive: false,
			verifiedAt: new Date().toISOString() }), /Verify the active account/);
		let report = await getSofaScoreRapidApiQuotaReport();
		assert.match(report.lastRequest.endpoint, new RegExp(`^/api/v1/event/${sampleEvent.id}/(incidents|lineups|statistics)$`));
		assert.equal(report.lastRequest.status, 200);
		assert.equal(report.lastRequest.headers["x-ratelimit-requests-limit"], "50");

		// A 404 with quota headers is negatively cached but does not establish quota exhaustion.
		await reconcileSofaScoreRapidApiQuota({ monthlyUsed: 10, remaining: 40, monthlyBandwidthMB: 0, dashboardVerified: true, accountActive: true, verifiedAt: new Date().toISOString() });
		nextStatus = 404;
		mockRemaining = 40;
		const missingPath = eventPath();
		paths.push(missingPath);
		const before404 = calls;
		assert.equal(await callSofaScoreRapidApi(missingPath), null);
		assert.equal(await callSofaScoreRapidApi(missingPath), null);
		assert.equal(calls, before404 + 1, "404 responses must be negatively cached");
		report = await getSofaScoreRapidApiQuotaReport();
		assert.equal(report.paused, false, "404 alone with valid quota headers must not pause the account");
		assert.equal(report.lastSuccessAt, null, "404 responses are not successful response timestamps");
		assert.match(report.lastRequest.responseExcerpt, /\{\}/);

		// A verified missing fixture is persisted so later views do not repeat the schedule request.
		await pool.query("DELETE FROM MatchApiCache WHERE MatchID=$1 AND Endpoint='s7-event-map'", [sampleId]);
		await pool.query("DELETE FROM MatchApiCache WHERE MatchID=0 AND Endpoint=$1", [scheduleCacheEndpoint]);
		emptySchedule = true;
		nextStatus = 200;
		const beforeNoMatch = calls;
		assert.equal(await loadSofaScoreRapidApiMatchDetails(primary, ["events"]), null);
		assert.equal(await loadSofaScoreRapidApiMatchDetails(primary, ["events"]), null);
		assert.equal(calls, beforeNoMatch + 1, "negative fixture identity mapping must prevent repeat schedule spending");
		emptySchedule = false;

		// The internal monthly cap leaves 15 of the confirmed 50 BASIC requests untouched.
		await reconcileSofaScoreRapidApiQuota({ monthlyUsed: 34, remaining: 16, monthlyBandwidthMB: 0, dashboardVerified: true, accountActive: true, verifiedAt: new Date().toISOString() });
		mockRemaining = 16;
		const finalBudgetPath = eventPath();
		paths.push(finalBudgetPath);
		await callSofaScoreRapidApi(finalBudgetPath);
		const callsAtBudget = calls;
		await assert.rejects(callSofaScoreRapidApi(eventPath()), /budget reached/);
		assert.equal(calls, callsAtBudget, "monthly internal budget must prevent additional provider calls");

		await reconcileSofaScoreRapidApiQuota({ monthlyUsed: 34, remaining: 16, monthlyBandwidthMB: 0, dashboardVerified: true, accountActive: true, verifiedAt: new Date().toISOString() });
		mockRemaining = 0;
		const exhaustedPath = eventPath();
		paths.push(exhaustedPath);
		const beforeExhaust = calls;
		await callSofaScoreRapidApi(exhaustedPath);
		const paused = await getSofaScoreRapidApiQuotaReport();
		assert.equal(paused.paused, true, "zero quota header must pause subsequent provider requests");
		await assert.rejects(callSofaScoreRapidApi(eventPath()), /paused/);
		assert.equal(calls, beforeExhaust + 1, "quota exhaustion must not reach fetch again");

		await reconcileSofaScoreRapidApiQuota({ monthlyUsed: 1, remaining: 49, monthlyBandwidthMB: 0, dashboardVerified: true, accountActive: true, verifiedAt: new Date().toISOString() });
		nextStatus = 403;
		mockRemaining = 49;
		const forbiddenPath = eventPath();
		paths.push(forbiddenPath);
		await assert.rejects(callSofaScoreRapidApi(forbiddenPath), /403/);
		const callsAfter403 = calls;
		await assert.rejects(callSofaScoreRapidApi(eventPath()), /paused/);
		assert.equal(calls, callsAfter403, "403 must stop subsequent uncached calls");

		await reconcileSofaScoreRapidApiQuota({ monthlyUsed: 1, remaining: 49, monthlyBandwidthMB: 0, dashboardVerified: true, accountActive: true, verifiedAt: new Date().toISOString() });
		nextStatus = 401;
		mockRemaining = 49;
		const invalidKeyPath = eventPath();
		paths.push(invalidKeyPath);
		await assert.rejects(callSofaScoreRapidApi(invalidKeyPath), /401/);
		const callsAfter401 = calls;
		await assert.rejects(callSofaScoreRapidApi(eventPath()), /paused/);
		assert.equal(calls, callsAfter401, "401 must pause uncached requests until dashboard reconciliation");

		await reconcileSofaScoreRapidApiQuota({ monthlyUsed: 1, remaining: 49, monthlyBandwidthMB: 0, dashboardVerified: true, accountActive: true, verifiedAt: new Date().toISOString() });
		nextStatus = 404;
		omit404Headers = true;
		mockRemaining = 49;
		const unresolvedPath = eventPath();
		paths.push(unresolvedPath);
		assert.equal(await callSofaScoreRapidApi(unresolvedPath), null);
		const callsAfterUnknown404 = calls;
		await assert.rejects(reconcileSofaScoreRapidApiQuota({ monthlyUsed: 2, remaining: 48, monthlyBandwidthMB: 0, dashboardVerified: true, accountActive: true, verifiedAt: new Date().toISOString() }), /explicit one-endpoint diagnostic/);
		nextStatus = 200;
		const diagnosticEventId = 81_718_181;
		await diagnoseSofaScoreRapidApiEvent(diagnosticEventId, {
			authorized: true, accountActive: true, dashboardVerified: true,
			monthlyUsed: 2, remaining: 48, monthlyBandwidthMB: 0, verifiedAt: new Date().toISOString(),
		});
		assert.equal(calls, callsAfterUnknown404 + 1, "authorized diagnostic must make exactly one request");
		report = await getSofaScoreRapidApiQuotaReport();
		assert.equal(report.paused, true, "diagnostic success must not clear the existing pause");
		assert.equal(report.lastDiagnostic.endpoint, `/api/v1/event/${diagnosticEventId}`);
		await reconcileSofaScoreRapidApiQuota({ monthlyUsed: 3, remaining: 47, monthlyBandwidthMB: 0, dashboardVerified: true, accountActive: true, verifiedAt: new Date().toISOString() });
		assert.equal((await getSofaScoreRapidApiQuotaReport()).paused, false, "dashboard reconciliation after a successful diagnostic can resume within budget");

		await reconcileSofaScoreRapidApiQuota({ monthlyUsed: 3, remaining: 47, monthlyBandwidthMB: 0, dashboardVerified: true, accountActive: true, verifiedAt: new Date().toISOString() });
		nextStatus = 200;
		omitQuotaHeaders = true;
		const noHeaderPath = eventPath();
		paths.push(noHeaderPath);
		await callSofaScoreRapidApi(noHeaderPath);
		assert.equal((await getSofaScoreRapidApiQuotaReport()).paused, true, "missing quota headers must fail closed");

		console.log("SportAPI RapidAPI mock tests passed: monthly cap/reserve, persistent cache, process-level deduplication, request audit, fixture negative caching, missing-data mapping, 404/401/403/429 pause behavior, authorized single-endpoint diagnosis, and guarded recovery.");
	} finally {
		globalThis.fetch = originalFetch;
		if (paths.length) await pool.query("DELETE FROM MatchApiCache WHERE MatchID=0 AND Endpoint LIKE 's7-log-%' AND Payload->>'endpoint'=ANY($1::text[])", [paths]);
		const cacheKeys = paths.map(cacheEndpoint);
		if (cacheKeys.length) await pool.query("DELETE FROM MatchApiCache WHERE MatchID=0 AND Endpoint=ANY($1::varchar[])", [cacheKeys]);
		if (sampleId != null) {
			await pool.query("DELETE FROM MatchApiCache WHERE MatchID=$1 AND Endpoint='s7-event-map'", [sampleId]);
			if (originalEventMapping?.rows?.length) await pool.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
				VALUES ($1, 's7-event-map', $2::jsonb, $3) ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload=EXCLUDED.Payload, FetchedAt=EXCLUDED.FetchedAt`,
				[sampleId, JSON.stringify(originalEventMapping.rows[0].payload), originalEventMapping.rows[0].fetchedat]);
		}
		if (scheduleCacheEndpoint) {
			await pool.query("DELETE FROM MatchApiCache WHERE MatchID=0 AND Endpoint=$1", [scheduleCacheEndpoint]);
			if (originalScheduleCache?.rows?.length) await pool.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
				VALUES (0, $1, $2::jsonb, $3) ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload=EXCLUDED.Payload, FetchedAt=EXCLUDED.FetchedAt`,
				[scheduleCacheEndpoint, JSON.stringify(originalScheduleCache.rows[0].payload), originalScheduleCache.rows[0].fetchedat]);
		}
		if (originalQuota.rows.length) await pool.query(`INSERT INTO MatchApiCache (MatchID, Endpoint, Payload, FetchedAt)
			VALUES (0, 's7-quota-state', $1::jsonb, CURRENT_TIMESTAMP)
			ON CONFLICT (MatchID, Endpoint) DO UPDATE SET Payload=EXCLUDED.Payload, FetchedAt=EXCLUDED.FetchedAt`, [JSON.stringify(originalQuota.rows[0].payload)]);
		else await pool.query("DELETE FROM MatchApiCache WHERE MatchID=0 AND Endpoint='s7-quota-state'");
		if (originalKey == null) delete process.env.SOFASCORE_RAPIDAPI_KEY; else process.env.SOFASCORE_RAPIDAPI_KEY = originalKey;
		if (originalHost == null) delete process.env.SOFASCORE_RAPIDAPI_HOST; else process.env.SOFASCORE_RAPIDAPI_HOST = originalHost;
		await pool.end();
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
