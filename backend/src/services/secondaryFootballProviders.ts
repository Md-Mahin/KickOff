import { syncFootballDataRange, syncFootballDataToday } from "./footballDataClient";
import { syncSportsDbToday, syncSportsDbRange } from "./sportsDbClient";

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
          console.warn(`[Provider] football-data.org range unavailable: ${(error as Error).message}`);
        }
        rangeStart = chunkEnd;
      }
    } catch (error) {
      console.warn(`[Provider] football-data.org unavailable: ${(error as Error).message}`);
    }
  }
  if (process.env.SPORTSDB_API_KEY) {
    try {
      count += await syncSportsDbRange(from, through);
    } catch (error) {
      console.warn(`[Provider] Secondary football providers unavailable: ${(error as Error).message}`);
    }
  }
  return count;
}
