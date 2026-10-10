import { syncFootballDataToday } from "./footballDataClient";
import { syncSportsDbToday } from "./sportsDbClient";

export async function syncSecondaryFootballProvidersToday(): Promise<void> {
  let count = 0;
  if (process.env.FOOTBALL_DATA_TOKEN) {
    try {
      count = await syncFootballDataToday();
    } catch (error) {
      console.warn(`[Provider] football-data.org unavailable: ${(error as Error).message}`);
    }
  }
  if (count === 0 && process.env.SPORTSDB_API_KEY) {
    try {
      await syncSportsDbToday();
    } catch (error) {
      console.warn(`[Provider] TheSportsDB unavailable: ${(error as Error).message}`);
    }
  }
}
