const API_URL = "https://v3.football.api-sports.io";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;

async function fetchFootballApi(path: string) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_URL}${path}`, {
        headers: {
          "x-apisports-key": process.env.API_FOOTBALL_KEY || "",
        },
        signal: controller.signal,
      });

      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      lastError = new Error(`API-Football request failed: ${response.status}`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 300));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("API-Football request failed");
}

export async function getFixtures() {
  const today = new Date().toISOString().split("T")[0];

  const response = await fetchFootballApi(`/fixtures?date=${today}`);

  if (!response.ok) {
    throw new Error(
      `API-Football request failed: ${response.status}`
    );
  }

  return response.json();
}

export async function getMatchById(id: number) {
  const response = await fetchFootballApi(`/fixtures?id=${id}`);

  if (!response.ok) {
    throw new Error(
      `API-Football request failed: ${response.status}`
    );
  }

  const data = await response.json();

  return data.response?.[0] ?? null;
}
