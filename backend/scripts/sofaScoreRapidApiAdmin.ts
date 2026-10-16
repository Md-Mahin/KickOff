import dotenv from "dotenv";
import path from "path";
import { pool } from "../src/db";
import { diagnoseSofaScoreRapidApiEvent, getSofaScoreRapidApiQuotaReport, reconcileSofaScoreRapidApiQuota } from "../src/services/sportApiClient";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

function option(args: string[], name: string) {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : undefined;
}
function numberOption(args: string[], name: string) {
	const value = option(args, name);
	return value == null ? NaN : Number(value);
}
function requireDashboardFlags(args: string[], diagnostic = false) {
	if ((diagnostic && !args.includes("--authorized")) || !args.includes("--dashboard-verified") || !args.includes("--account-active")) {
		throw new Error("Verify the active account and current quota in RapidAPI dashboard; include --account-active --dashboard-verified and, for a diagnostic, --authorized");
	}
}

async function main() {
	const [command, ...args] = process.argv.slice(2);
	if (command === "report") {
		console.log(JSON.stringify(await getSofaScoreRapidApiQuotaReport(), null, 2));
		return;
	}
	if (command === "reconcile") {
		requireDashboardFlags(args);
		await reconcileSofaScoreRapidApiQuota({
			monthlyUsed: Number(args[0]), remaining: Number(args[1]),
			monthlyBandwidthMB: numberOption(args, "--monthly-bandwidth-mb"),
			dashboardVerified: true, accountActive: true, verifiedAt: option(args, "--verified-at"),
		});
		console.log("RapidAPI quota reconciled from dashboard verification; no automatic reset was applied.");
		return;
	}
	if (command === "probe-event") {
		requireDashboardFlags(args, true);
		await diagnoseSofaScoreRapidApiEvent(Number(args[0]), {
			authorized: true, accountActive: true, dashboardVerified: true,
			verifiedAt: option(args, "--verified-at") ?? "",
			monthlyUsed: numberOption(args, "--monthly-used"), remaining: numberOption(args, "--remaining"),
			monthlyBandwidthMB: numberOption(args, "--monthly-bandwidth-mb"),
		});
		const report = await getSofaScoreRapidApiQuotaReport();
		console.log(JSON.stringify({ paused: report.paused, diagnostic: report.lastDiagnostic }, null, 2));
		return;
	}
	throw new Error("Usage: npm run sportapi7:admin -- report | reconcile <monthly-used> <remaining> --account-active --dashboard-verified --monthly-bandwidth-mb MB --verified-at <ISO timestamp> | probe-event <event-id> --authorized --account-active --dashboard-verified --monthly-used N --remaining N --monthly-bandwidth-mb MB --verified-at <ISO timestamp>");
}

main().catch((error) => {
	console.error((error as Error).message);
	process.exitCode = 1;
}).finally(() => pool.end());
