import { pool } from "../src/db";
import { isNationalLeague } from "../src/services/footballService";

const CANONICAL_CLUBS = [
  { id: 1, name: "Arsenal", logo: "https://media.api-sports.io/football/teams/42.png", type: "club" },
  { id: 2, name: "Real Madrid", logo: "https://media.api-sports.io/football/teams/541.png", type: "club" },
  { id: 3, name: "Bayern Munich", logo: "https://media.api-sports.io/football/teams/157.png", type: "club" },
  { id: 4, name: "PSG", logo: "https://media.api-sports.io/football/teams/85.png", type: "club" },
  { id: 5, name: "AC Milan", logo: "https://media.api-sports.io/football/teams/489.png", type: "club" },
  { id: 6, name: "Manchester City", logo: "https://media.api-sports.io/football/teams/50.png", type: "club" },
  { id: 7, name: "Liverpool", logo: "https://media.api-sports.io/football/teams/40.png", type: "club" },
  { id: 8, name: "Chelsea", logo: "https://media.api-sports.io/football/teams/49.png", type: "club" },
  { id: 9, name: "Manchester United", logo: "https://media.api-sports.io/football/teams/33.png", type: "club" },
  { id: 10, name: "Barcelona", logo: "https://media.api-sports.io/football/teams/529.png", type: "club" },
  { id: 11, name: "Inter Milan", logo: "https://media.api-sports.io/football/teams/505.png", type: "club" },
  { id: 12, name: "Borussia Dortmund", logo: "https://media.api-sports.io/football/teams/165.png", type: "club" },
  { id: 13, name: "Atletico Madrid", logo: "https://media.api-sports.io/football/teams/530.png", type: "club" },
  { id: 14, name: "Juventus", logo: "https://media.api-sports.io/football/teams/496.png", type: "club" },
  { id: 15, name: "Bayer Leverkusen", logo: "https://media.api-sports.io/football/teams/168.png", type: "club" },
];

const NATIONAL_NAMES = new Set([
  "argentina", "france", "england", "germany", "spain", "portugal", "brazil",
  "netherlands", "italy", "uruguay", "colombia", "japan", "serbia", "mexico",
  "south korea", "korea", "denmark", "iran", "tunisia", "costa rica", "morocco",
  "croatia", "belgium", "switzerland", "usa", "canada", "australia", "saudi arabia",
  "turkey", "poland", "austria", "ukraine", "sweden", "norway", "chile", "peru",
  "nigeria", "senegal", "ghana", "algeria", "egypt", "cameroon", "ivory coast",
  "ecuador", "venezuela", "paraguay", "bolivia", "wales", "scotland", "republic of ireland",
  "northern ireland", "czech republic", "slovakia", "hungary", "romania", "bulgaria",
  "greece", "finland", "iceland", "bosnia and herzegovina", "albania", "slovenia",
  "north macedonia", "montenegro", "georgia", "armenia", "azerbaijan", "kazakhstan",
  "uzbekistan", "iraq", "qatar", "uae", "united arab emirates", "oman", "china",
  "india", "thailand", "vietnam", "indonesia", "malaysia", "singapore", "philippines",
  "laos", "myanmar", "cambodia", "brunei", "timor-leste", "hong kong", "bangladesh",
  "new zealand", "south africa", "zambia", "namibia", "mozambique", "libya"
]);

export function isNationalTeamName(name: string): boolean {
  const norm = name.toLowerCase().trim();
  if (NATIONAL_NAMES.has(norm)) return true;
  if (norm.endsWith(" u20") || norm.endsWith(" u21") || norm.endsWith(" u19") || norm.endsWith(" u23")) return true;
  if (norm.endsWith(" u20 w") || norm.endsWith(" u21 w") || norm.endsWith(" u19 w")) return true;
  if (norm.endsWith(" w") && NATIONAL_NAMES.has(norm.replace(/ w$/, ""))) return true;
  return false;
}

const SEED_MATCHES = [
  // Premier League (TournamentID: 2)
  { id: 1, tId: 2, home: 1, away: 6, hg: 1, ag: 0, date: new Date(Date.now() - 38 * 60000).toISOString() },
  { id: 2, tId: 2, home: 7, away: 8, hg: 2, ag: 1, date: new Date(Date.now() - 72 * 60000).toISOString() },
  { id: 3, tId: 2, home: 9, away: 1, hg: 0, ag: 0, date: new Date(Date.now() + 3 * 3600000).toISOString() },
  { id: 4, tId: 2, home: 6, away: 7, hg: 3, ag: 1, date: new Date(Date.now() - 86400000).toISOString() },
  { id: 5, tId: 2, home: 8, away: 9, hg: 0, ag: 0, date: new Date(Date.now() + 86400000).toISOString() },
  // UEFA Champions League (TournamentID: 1)
  { id: 6, tId: 1, home: 1, away: 2, hg: 1, ag: 1, date: new Date(Date.now() - 55 * 60000).toISOString() },
  { id: 7, tId: 1, home: 3, away: 4, hg: 0, ag: 0, date: new Date(Date.now() + 40 * 60000).toISOString() },
  { id: 8, tId: 1, home: 10, away: 11, hg: 2, ag: 0, date: new Date(Date.now() - 4 * 3600000).toISOString() },
  { id: 9, tId: 1, home: 12, away: 5, hg: 0, ag: 0, date: new Date(Date.now() + 4 * 3600000).toISOString() },
  { id: 10, tId: 1, home: 2, away: 3, hg: 2, ag: 2, date: new Date(Date.now() - 2 * 86400000).toISOString() },
  // La Liga (TournamentID: 3)
  { id: 11, tId: 3, home: 2, away: 10, hg: 0, ag: 0, date: new Date(Date.now() + 86400000).toISOString() },
  { id: 12, tId: 3, home: 13, away: 2, hg: 1, ag: 2, date: new Date(Date.now() - 5 * 3600000).toISOString() },
  { id: 13, tId: 3, home: 10, away: 13, hg: 3, ag: 1, date: new Date(Date.now() - 2 * 86400000).toISOString() },
  // Serie A (TournamentID: 4)
  { id: 14, tId: 4, home: 5, away: 11, hg: 0, ag: 0, date: new Date(Date.now() - 22 * 60000).toISOString() },
  { id: 15, tId: 4, home: 14, away: 5, hg: 0, ag: 0, date: new Date(Date.now() + 5 * 3600000).toISOString() },
  { id: 16, tId: 4, home: 11, away: 14, hg: 2, ag: 1, date: new Date(Date.now() - 86400000).toISOString() },
  // Bundesliga (TournamentID: 5)
  { id: 17, tId: 5, home: 3, away: 12, hg: 3, ag: 2, date: new Date(Date.now() - 80 * 60000).toISOString() },
  { id: 18, tId: 5, home: 15, away: 3, hg: 0, ag: 0, date: new Date(Date.now() + 6 * 3600000).toISOString() },
  // Mock Matches (991..994)
  { id: 991, tId: 1, home: 1, away: 2, hg: 2, ag: 1, date: new Date(Date.now() - 68 * 60000).toISOString() },
  { id: 992, tId: 1, home: 3, away: 4, hg: 0, ag: 0, date: new Date(Date.now() + 3600000).toISOString() },
  { id: 993, tId: 2, home: 6, away: 7, hg: 3, ag: 2, date: new Date(Date.now() - 7200000).toISOString() },
  { id: 994, tId: 3, home: 10, away: 13, hg: 1, ag: 1, date: new Date(Date.now() - 14400000).toISOString() },
];

async function main() {
  console.log("=== 1. Restoring Canonical European Club Teams (IDs 1..15) ===");
  for (const club of CANONICAL_CLUBS) {
    await pool.query(
      `INSERT INTO Team (TeamID, Name, Logo, Type)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (TeamID) DO UPDATE SET
         Name = EXCLUDED.Name,
         Logo = EXCLUDED.Logo,
         Type = EXCLUDED.Type`,
      [club.id, club.name, club.logo, club.type]
    );
  }
  console.log("Canonical European club teams restored successfully.");

  console.log("=== 2. Classifying all other teams into 'club' or 'national' ===");
  const allTeams = await pool.query(`SELECT TeamID, Name FROM Team WHERE TeamID > 15`);
  let natCount = 0;
  let clubCount = 0;
  for (const t of allTeams.rows) {
    const isNat = isNationalTeamName(t.name);
    const type = isNat ? "national" : "club";
    if (isNat) natCount++; else clubCount++;
    await pool.query(`UPDATE Team SET Type = $1 WHERE TeamID = $2`, [type, t.teamid]);
  }
  console.log(`Classified ${natCount} national teams and ${clubCount} club teams.`);

  console.log("=== 2b. Classifying Tournaments into 'Club' or 'National' ===");
  const allTours = await pool.query(`SELECT TournamentID, Name FROM Tournament`);
  let natTours = 0;
  for (const tour of allTours.rows) {
    const isNat = isNationalLeague(tour.name);
    const tourType = isNat ? "National" : "Club";
    if (isNat) natTours++;
    await pool.query(`UPDATE Tournament SET Type = $1 WHERE TournamentID = $2`, [tourType, tour.tournamentid]);
  }
  console.log(`Classified ${natTours} national tournaments and ${allTours.rows.length - natTours} club tournaments.`);

  console.log("=== 3. Restoring Canonical Seed & Mock Matches (Club vs Club) ===");
  for (const m of SEED_MATCHES) {
    await pool.query(
      `INSERT INTO Match (MatchID, TournamentID, HomeTeamID, AwayTeamID, HomeGoals, AwayGoals, MatchDate)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (MatchID) DO UPDATE SET
         TournamentID = EXCLUDED.TournamentID,
         HomeTeamID = EXCLUDED.HomeTeamID,
         AwayTeamID = EXCLUDED.AwayTeamID,
         HomeGoals = EXCLUDED.HomeGoals,
         AwayGoals = EXCLUDED.AwayGoals,
         MatchDate = EXCLUDED.MatchDate`,
      [m.id, m.tId, m.home, m.away, m.hg, m.ag, m.date]
    );
  }
  console.log("Seed & Mock matches (1..18, 991..994) restored.");

  console.log("=== 4. Removing any remaining matches where HomeTeam.Type != AwayTeam.Type ===");
  const invalidMatches = await pool.query(
    `SELECT m.MatchID, ht.Name as home, ht.Type as ht_type, at.Name as away, at.Type as at_type
     FROM Match m
     JOIN Team ht ON m.HomeTeamID = ht.TeamID
     JOIN Team at ON m.AwayTeamID = at.TeamID
     WHERE COALESCE(ht.Type, 'club') != COALESCE(at.Type, 'club')`
  );

  if (invalidMatches.rows.length > 0) {
    console.log(`Found ${invalidMatches.rows.length} invalid matches (club playing national). Deleting...`);
    const ids = invalidMatches.rows.map((r: any) => r.matchid);
    await pool.query(`DELETE FROM Event WHERE MatchID = ANY($1)`, [ids]);
    await pool.query(`DELETE FROM Lineup WHERE MatchID = ANY($1)`, [ids]);
    await pool.query(`DELETE FROM MatchOfficiating WHERE MatchID = ANY($1)`, [ids]);
    await pool.query(`DELETE FROM TeamMatchCoach WHERE MatchID = ANY($1)`, [ids]);
    await pool.query(`DELETE FROM Match WHERE MatchID = ANY($1)`, [ids]);
    console.log("Deleted all invalid matches!");
  } else {
    console.log("No mismatched matches found!");
  }

  console.log("=== 5. Installing Trigger trg_match_club_country_check on Match Table ===");
  await pool.query(`
    CREATE OR REPLACE FUNCTION fn_check_match_team_types()
    RETURNS TRIGGER AS $$
    DECLARE
      v_home_type VARCHAR(20);
      v_away_type VARCHAR(20);
    BEGIN
      SELECT COALESCE(Type, 'club') INTO v_home_type FROM Team WHERE TeamID = NEW.HomeTeamID;
      SELECT COALESCE(Type, 'club') INTO v_away_type FROM Team WHERE TeamID = NEW.AwayTeamID;

      IF v_home_type IS NOT NULL AND v_away_type IS NOT NULL AND v_home_type != v_away_type THEN
        RAISE EXCEPTION 'Forbidden: Club teams cannot play national teams (Home %: %, Away %: %)',
          NEW.HomeTeamID, v_home_type, NEW.AwayTeamID, v_away_type;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_match_club_country_check ON Match;
    CREATE TRIGGER trg_match_club_country_check
    BEFORE INSERT OR UPDATE ON Match
    FOR EACH ROW EXECUTE FUNCTION fn_check_match_team_types();
  `);
  console.log("Database trigger trg_match_club_country_check installed successfully!");

  console.log("\n=== ALL DATABASE FIXES COMPLETE ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error in fixTeamTypesAndMatches:", err);
  process.exit(1);
});
