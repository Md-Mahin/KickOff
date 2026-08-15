const API_URL = "https://v3.football.api-sports.io";

export async function getFixtures() {
  const response = await fetch(
    `${API_URL}/fixtures?date=2026-08-16`,
    {
      headers: {
        "x-apisports-key": process.env.API_FOOTBALL_KEY || "",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `API-Football request failed: ${response.status}`
    );
  }

  return response.json();
}