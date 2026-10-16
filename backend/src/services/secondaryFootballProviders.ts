import { syncFootballDataRange, syncFootballDataToday } from "./footballDataClient";
import { syncSportsDbToday, syncSportsDbRange } from "./sportsDbClient";

function reportProviderFailure(provider: string, error: unknown) {
  const message = (error as Error).message;
  if (/\bpaused\b|cooldown active|dashboard reconciliation is required/i.test(message)) return;
  console.warn(`[Provider] ${provider} unavailable: ${message}`);
}

export async function syncSecondaryFootballProvidersToday(): Promise<void> {
  let count = 0;
  if (process.env.FOOTBALL_DATA_TOKEN) {
    try {
      count = await syncFootballDataToday();
    } catch (error) {
      reportProviderFailure("football-data.org", error);
    }
  }
  if (count === 0 && process.env.SPORTSDB_API_KEY) {
    try {
      await syncSportsDbToday();
    } catch (error) {
      reportProviderFailure("TheSportsDB", error);
    }
  }
}

export async function syncSecondaryFootballProvidersRange(from: string, through: string): Promise<number> {
  let count = 0;
  if (process.env.FOOTBALL_DATA_TOKEN) {
    try {
      // football-data.org caps each request at ten days and treats dateTo as exclusive.
      const rangeEnd = new Date(`${through}T00:00:00.000Z`);
      rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);
      let rangeStart = new Date(`${from}T00:00:00.000Z`);
      while (rangeStart < rangeEnd) {
        const chunkEnd = new Date(rangeStart);
        chunkEnd.setUTCDate(chunkEnd.getUTCDate() + 10);
        if (chunkEnd > rangeEnd) chunkEnd.setTime(rangeEnd.getTime());
        try {
          count += await syncFootballDataRange(
            rangeStart.toISOString().slice(0, 10),
            chunkEnd.toISOString().slice(0, 10),
          );
        } catch (error) {
          reportProviderFailure("football-data.org range", error);
        }
        rangeStart = chunkEnd;
      }
    } catch (error) {
      reportProviderFailure("football-data.org", error);
    }
  }
  if (process.env.SPORTSDB_API_KEY) {
    try {
      count += await syncSportsDbRange(from, through);
    } catch (error) {
      reportProviderFailure("Secondary football providers", error);
    }
  }
  return count;
}
