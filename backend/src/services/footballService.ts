const API_URL = "https://v3.football.api-sports.io";

export async function getFixtures() {
  const today = new Date().toISOString().split("T")[0];

  const response = await fetch(
    `${API_URL}/fixtures?date=${today}`,
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

export async function getMatchById(id: number) {
  const response = await fetch(
    `${API_URL}/fixtures?id=${id}`,
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

  const data = await response.json();

  return data.response?.[0] ?? null;
}