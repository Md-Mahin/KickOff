import { pool } from "../db";

/**
 * Fallback / Mock Data Repository
 * Used only when API-Football calls fail (network failure, rate limit, invalid key, etc.)
 */

export interface BasicMatchItem {
  id: number;
  leagueId?: number;
  league: string;
  country: string;
  homeTeam: string;
  homeTeamId: number;
  homeLogo?: string | null;
  awayTeam: string;
  awayTeamId: number;
  awayLogo?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  status: "LIVE" | "FT" | "UPCOMING";
  minute?: number | null;
  date: string;
}

export interface DetailedMockMatch {
  fixture: {
    id: number;
    date: string;
    venue: { name: string; city: string; country: string } | null;
    referee?: string | null;
    status: { short: "LIVE" | "FT" | "UPCOMING"; elapsed: number | null };
  };
  league: { id: number; name: string; country: string; season: number };
  teams: {
    home: { id: number; name: string; logo: string | null };
    away: { id: number; name: string; logo: string | null };
  };
  goals: { home: number | null; away: number | null };
  lineups: Array<{
    team: { id: number; name: string; logo: string | null };
    coach: { id: number; name: string; photo: string | null };
    formation: string;
    startXI: Array<{ player: { id: number; name: string; number: number; pos: string; photo?: string | null } }>;
    substitutes: Array<{ player: { id: number; name: string; number: number; pos: string; photo?: string | null } }>;
  }>;
  events: Array<{
    time: { elapsed: number };
    team: { id: number; name: string };
    player: { id: number; name: string };
    assist?: { id: number; name: string } | null;
    type: "Goal" | "Card" | "Substitution";
    detail: string;
  }>;
}

export const MOCK_BASIC_MATCHES: BasicMatchItem[] = [
  {
    id: 991,
    leagueId: 4,
    league: "UEFA Champions League",
    country: "International",
    homeTeam: "Arsenal",
    homeTeamId: 1,
    homeLogo: "https://media.api-sports.io/football/teams/42.png",
    awayTeam: "Real Madrid",
    awayTeamId: 2,
    awayLogo: "https://media.api-sports.io/football/teams/541.png",
    homeScore: 2,
    awayScore: 1,
    status: "LIVE",
    minute: 68,
    date: new Date(Date.now() - 68 * 60000).toISOString(),
  },
  {
    id: 992,
    leagueId: 4,
    league: "UEFA Champions League",
    country: "International",
    homeTeam: "Bayern Munich",
    homeTeamId: 3,
    homeLogo: "https://media.api-sports.io/football/teams/157.png",
    awayTeam: "Paris Saint Germain",
    awayTeamId: 4,
    awayLogo: "https://media.api-sports.io/football/teams/85.png",
    homeScore: null,
    awayScore: null,
    status: "UPCOMING",
    minute: null,
    date: new Date(Date.now() + 3600000).toISOString(),
  },
  {
    id: 993,
    leagueId: 7,
    league: "Premier League",
    country: "England",
    homeTeam: "Manchester City",
    homeTeamId: 5,
    homeLogo: "https://media.api-sports.io/football/teams/50.png",
    awayTeam: "Liverpool",
    awayTeamId: 6,
    awayLogo: "https://media.api-sports.io/football/teams/40.png",
    homeScore: 3,
    awayScore: 2,
    status: "FT",
    minute: 90,
    date: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 994,
    leagueId: 3,
    league: "La Liga",
    country: "Spain",
    homeTeam: "Barcelona",
    homeTeamId: 7,
    homeLogo: "https://media.api-sports.io/football/teams/529.png",
    awayTeam: "Atletico Madrid",
    awayTeamId: 8,
    awayLogo: "https://media.api-sports.io/football/teams/530.png",
    homeScore: 1,
    awayScore: 1,
    status: "FT",
    minute: 90,
    date: new Date(Date.now() - 14400000).toISOString(),
  },
];

export const MOCK_DETAILED_MATCHES: Record<number, DetailedMockMatch> = {
  // 991: Arsenal vs Real Madrid (2 - 1, LIVE 68')
  991: {
    fixture: {
      id: 991,
      date: new Date(Date.now() - 68 * 60000).toISOString(),
      venue: { name: "Emirates Stadium", city: "London", country: "England" },
      referee: "Szymon Marciniak, Poland",
      status: { short: "LIVE", elapsed: 68 },
    },
    league: { id: 4, name: "UEFA Champions League", country: "International", season: 2026 },
    teams: {
      home: { id: 1, name: "Arsenal", logo: "https://media.api-sports.io/football/teams/42.png" },
      away: { id: 2, name: "Real Madrid", logo: "https://media.api-sports.io/football/teams/541.png" },
    },
    goals: { home: 2, away: 1 },
    lineups: [
      {
        team: { id: 1, name: "Arsenal", logo: "https://media.api-sports.io/football/teams/42.png" },
        coach: { id: 101, name: "Mikel Arteta", photo: "https://media.api-sports.io/football/coachs/101.png" },
        formation: "4-3-3",
        startXI: [
          { player: { id: 1001, name: "David Raya", number: 22, pos: "G" } },
          { player: { id: 1002, name: "Ben White", number: 4, pos: "D" } },
          { player: { id: 1003, name: "William Saliba", number: 2, pos: "D" } },
          { player: { id: 1004, name: "Gabriel Magalhaes", number: 6, pos: "D" } },
          { player: { id: 1005, name: "Jurrien Timber", number: 12, pos: "D" } },
          { player: { id: 1006, name: "Thomas Partey", number: 5, pos: "M" } },
          { player: { id: 1007, name: "Declan Rice", number: 41, pos: "M" } },
          { player: { id: 1008, name: "Martin Odegaard", number: 8, pos: "M" } },
          { player: { id: 1009, name: "Bukayo Saka", number: 7, pos: "F" } },
          { player: { id: 1010, name: "Kai Havertz", number: 29, pos: "F" } },
          { player: { id: 1011, name: "Gabriel Martinelli", number: 11, pos: "F" } },
        ],
        substitutes: [
          { player: { id: 1012, name: "Neto", number: 32, pos: "G" } },
          { player: { id: 1013, name: "Jakub Kiwior", number: 15, pos: "D" } },
          { player: { id: 1014, name: "Mikel Merino", number: 23, pos: "M" } },
          { player: { id: 1015, name: "Leandro Trossard", number: 19, pos: "F" } },
        ],
      },
      {
        team: { id: 2, name: "Real Madrid", logo: "https://media.api-sports.io/football/teams/541.png" },
        coach: { id: 102, name: "Carlo Ancelotti", photo: "https://media.api-sports.io/football/coachs/102.png" },
        formation: "4-3-3",
        startXI: [
          { player: { id: 2001, name: "Thibaut Courtois", number: 1, pos: "G" } },
          { player: { id: 2002, name: "Dani Carvajal", number: 2, pos: "D" } },
          { player: { id: 2003, name: "Antonio Rudiger", number: 22, pos: "D" } },
          { player: { id: 2004, name: "Eder Militao", number: 3, pos: "D" } },
          { player: { id: 2005, name: "Ferland Mendy", number: 23, pos: "D" } },
          { player: { id: 2006, name: "Federico Valverde", number: 8, pos: "M" } },
          { player: { id: 2007, name: "Aurelien Tchouameni", number: 14, pos: "M" } },
          { player: { id: 2008, name: "Jude Bellingham", number: 5, pos: "M" } },
          { player: { id: 2009, name: "Rodrygo", number: 11, pos: "F" } },
          { player: { id: 2010, name: "Kylian Mbappe", number: 9, pos: "F" } },
          { player: { id: 2011, name: "Vinicius Junior", number: 7, pos: "F" } },
        ],
        substitutes: [
          { player: { id: 2012, name: "Andriy Lunin", number: 13, pos: "G" } },
          { player: { id: 2013, name: "Lucas Vazquez", number: 17, pos: "D" } },
          { player: { id: 2014, name: "Luka Modric", number: 10, pos: "M" } },
          { player: { id: 2015, name: "Brahim Diaz", number: 21, pos: "F" } },
        ],
      },
    ],
    events: [
      {
        time: { elapsed: 24 },
        team: { id: 1, name: "Arsenal" },
        player: { id: 1009, name: "Bukayo Saka" },
        assist: { id: 1008, name: "Martin Odegaard" },
        type: "Goal",
        detail: "Normal Goal",
      },
      {
        time: { elapsed: 38 },
        team: { id: 2, name: "Real Madrid" },
        player: { id: 2011, name: "Vinicius Junior" },
        assist: { id: 2008, name: "Jude Bellingham" },
        type: "Goal",
        detail: "Normal Goal",
      },
      {
        time: { elapsed: 53 },
        team: { id: 1, name: "Arsenal" },
        player: { id: 1010, name: "Kai Havertz" },
        assist: { id: 1007, name: "Declan Rice" },
        type: "Goal",
        detail: "Header",
      },
      {
        time: { elapsed: 61 },
        team: { id: 2, name: "Real Madrid" },
        player: { id: 2007, name: "Aurelien Tchouameni" },
        type: "Card",
        detail: "Yellow Card",
      },
      {
        time: { elapsed: 65 },
        team: { id: 1, name: "Arsenal" },
        player: { id: 1011, name: "Gabriel Martinelli" },
        assist: { id: 1015, name: "Leandro Trossard" },
        type: "Substitution",
        detail: "Substitution",
      },
    ],
  },

  // 992: Bayern Munich vs Paris Saint Germain (UPCOMING)
  992: {
    fixture: {
      id: 992,
      date: new Date(Date.now() + 3600000).toISOString(),
      venue: { name: "Allianz Arena", city: "Munich", country: "Germany" },
      referee: "Clement Turpin, France",
      status: { short: "UPCOMING", elapsed: null },
    },
    league: { id: 4, name: "UEFA Champions League", country: "International", season: 2026 },
    teams: {
      home: { id: 3, name: "Bayern Munich", logo: "https://media.api-sports.io/football/teams/157.png" },
      away: { id: 4, name: "Paris Saint Germain", logo: "https://media.api-sports.io/football/teams/85.png" },
    },
    goals: { home: null, away: null },
    lineups: [
      {
        team: { id: 3, name: "Bayern Munich", logo: "https://media.api-sports.io/football/teams/157.png" },
        coach: { id: 103, name: "Vincent Kompany", photo: "https://media.api-sports.io/football/coachs/103.png" },
        formation: "4-2-3-1",
        startXI: [
          { player: { id: 3001, name: "Manuel Neuer", number: 1, pos: "G" } },
          { player: { id: 3002, name: "Joshua Kimmich", number: 6, pos: "D" } },
          { player: { id: 3003, name: "Dayot Upamecano", number: 2, pos: "D" } },
          { player: { id: 3004, name: "Kim Min-jae", number: 3, pos: "D" } },
          { player: { id: 3005, name: "Alphonso Davies", number: 19, pos: "D" } },
          { player: { id: 3006, name: "Aleksandar Pavlovic", number: 45, pos: "M" } },
          { player: { id: 3007, name: "Leon Goretzka", number: 8, pos: "M" } },
          { player: { id: 3008, name: "Leroy Sane", number: 10, pos: "M" } },
          { player: { id: 3009, name: "Jamal Musiala", number: 42, pos: "M" } },
          { player: { id: 3010, name: "Kingsley Coman", number: 11, pos: "F" } },
          { player: { id: 3011, name: "Harry Kane", number: 9, pos: "F" } },
        ],
        substitutes: [
          { player: { id: 3012, name: "Sven Ulreich", number: 26, pos: "G" } },
          { player: { id: 3013, name: "Eric Dier", number: 15, pos: "D" } },
          { player: { id: 3014, name: "Konrad Laimer", number: 27, pos: "M" } },
          { player: { id: 3015, name: "Mathys Tel", number: 39, pos: "F" } },
        ],
      },
      {
        team: { id: 4, name: "Paris Saint Germain", logo: "https://media.api-sports.io/football/teams/85.png" },
        coach: { id: 104, name: "Luis Enrique", photo: "https://media.api-sports.io/football/coachs/104.png" },
        formation: "4-3-3",
        startXI: [
          { player: { id: 4001, name: "Gianluigi Donnarumma", number: 1, pos: "G" } },
          { player: { id: 4002, name: "Achraf Hakimi", number: 2, pos: "D" } },
          { player: { id: 4003, name: "Marquinhos", number: 5, pos: "D" } },
          { player: { id: 4004, name: "Willian Pacho", number: 51, pos: "D" } },
          { player: { id: 4005, name: "Nuno Mendes", number: 25, pos: "D" } },
          { player: { id: 4006, name: "Warren Zaire-Emery", number: 33, pos: "M" } },
          { player: { id: 4007, name: "Vitinha", number: 17, pos: "M" } },
          { player: { id: 4008, name: "Fabian Ruiz", number: 8, pos: "M" } },
          { player: { id: 4009, name: "Ousmane Dembele", number: 10, pos: "F" } },
          { player: { id: 4010, name: "Goncalo Ramos", number: 9, pos: "F" } },
          { player: { id: 4011, name: "Bradley Barcola", number: 29, pos: "F" } },
        ],
        substitutes: [
          { player: { id: 4012, name: "Matvey Safonov", number: 39, pos: "G" } },
          { player: { id: 4013, name: "Lucas Beraldo", number: 35, pos: "D" } },
          { player: { id: 4014, name: "Lee Kang-in", number: 19, pos: "M" } },
          { player: { id: 4015, name: "Randal Kolo Muani", number: 23, pos: "F" } },
        ],
      },
    ],
    events: [],
  },

  // 993: Manchester City vs Liverpool (3 - 2, FT 90')
  993: {
    fixture: {
      id: 993,
      date: new Date(Date.now() - 7200000).toISOString(),
      venue: { name: "Etihad Stadium", city: "Manchester", country: "England" },
      referee: "Michael Oliver, England",
      status: { short: "FT", elapsed: 90 },
    },
    league: { id: 7, name: "Premier League", country: "England", season: 2026 },
    teams: {
      home: { id: 5, name: "Manchester City", logo: "https://media.api-sports.io/football/teams/50.png" },
      away: { id: 6, name: "Liverpool", logo: "https://media.api-sports.io/football/teams/40.png" },
    },
    goals: { home: 3, away: 2 },
    lineups: [
      {
        team: { id: 5, name: "Manchester City", logo: "https://media.api-sports.io/football/teams/50.png" },
        coach: { id: 105, name: "Pep Guardiola", photo: "https://media.api-sports.io/football/coachs/105.png" },
        formation: "4-3-3",
        startXI: [
          { player: { id: 5001, name: "Ederson", number: 31, pos: "G" } },
          { player: { id: 5002, name: "Kyle Walker", number: 2, pos: "D" } },
          { player: { id: 5003, name: "Ruben Dias", number: 3, pos: "D" } },
          { player: { id: 5004, name: "Manuel Akanji", number: 25, pos: "D" } },
          { player: { id: 5005, name: "Josko Gvardiol", number: 24, pos: "D" } },
          { player: { id: 5006, name: "Rodri", number: 16, pos: "M" } },
          { player: { id: 5007, name: "Kevin De Bruyne", number: 17, pos: "M" } },
          { player: { id: 5008, name: "Bernardo Silva", number: 20, pos: "M" } },
          { player: { id: 5009, name: "Phil Foden", number: 47, pos: "F" } },
          { player: { id: 5010, name: "Erling Haaland", number: 9, pos: "F" } },
          { player: { id: 5011, name: "Jeremy Doku", number: 11, pos: "F" } },
        ],
        substitutes: [
          { player: { id: 5012, name: "Stefan Ortega", number: 18, pos: "G" } },
          { player: { id: 5013, name: "John Stones", number: 5, pos: "D" } },
          { player: { id: 5014, name: "Mateo Kovacic", number: 8, pos: "M" } },
          { player: { id: 5015, name: "Julian Alvarez", number: 19, pos: "F" } },
        ],
      },
      {
        team: { id: 6, name: "Liverpool", logo: "https://media.api-sports.io/football/teams/40.png" },
        coach: { id: 106, name: "Arne Slot", photo: "https://media.api-sports.io/football/coachs/106.png" },
        formation: "4-3-3",
        startXI: [
          { player: { id: 6001, name: "Alisson Becker", number: 1, pos: "G" } },
          { player: { id: 6002, name: "Trent Alexander-Arnold", number: 66, pos: "D" } },
          { player: { id: 6003, name: "Ibrahima Konate", number: 5, pos: "D" } },
          { player: { id: 6004, name: "Virgil van Dijk", number: 4, pos: "D" } },
          { player: { id: 6005, name: "Andrew Robertson", number: 26, pos: "D" } },
          { player: { id: 6006, name: "Ryan Gravenberch", number: 38, pos: "M" } },
          { player: { id: 6007, name: "Alexis Mac Allister", number: 10, pos: "M" } },
          { player: { id: 6008, name: "Dominik Szoboszlai", number: 8, pos: "M" } },
          { player: { id: 6009, name: "Mohamed Salah", number: 11, pos: "F" } },
          { player: { id: 6010, name: "Darwin Nunez", number: 9, pos: "F" } },
          { player: { id: 6011, name: "Luis Diaz", number: 7, pos: "F" } },
        ],
        substitutes: [
          { player: { id: 6012, name: "Caoimhin Kelleher", number: 62, pos: "G" } },
          { player: { id: 6013, name: "Joe Gomez", number: 2, pos: "D" } },
          { player: { id: 6014, name: "Curtis Jones", number: 17, pos: "M" } },
          { player: { id: 6015, name: "Cody Gakpo", number: 18, pos: "F" } },
        ],
      },
    ],
    events: [
      {
        time: { elapsed: 14 },
        team: { id: 5, name: "Manchester City" },
        player: { id: 5010, name: "Erling Haaland" },
        assist: { id: 5007, name: "Kevin De Bruyne" },
        type: "Goal",
        detail: "Normal Goal",
      },
      {
        time: { elapsed: 29 },
        team: { id: 6, name: "Liverpool" },
        player: { id: 6009, name: "Mohamed Salah" },
        assist: { id: 6002, name: "Trent Alexander-Arnold" },
        type: "Goal",
        detail: "Curler",
      },
      {
        time: { elapsed: 42 },
        team: { id: 5, name: "Manchester City" },
        player: { id: 5007, name: "Kevin De Bruyne" },
        assist: { id: 5008, name: "Bernardo Silva" },
        type: "Goal",
        detail: "Long Range",
      },
      {
        time: { elapsed: 51 },
        team: { id: 5, name: "Manchester City" },
        player: { id: 5006, name: "Rodri" },
        type: "Card",
        detail: "Yellow Card",
      },
      {
        time: { elapsed: 64 },
        team: { id: 6, name: "Liverpool" },
        player: { id: 6011, name: "Luis Diaz" },
        assist: { id: 6007, name: "Alexis Mac Allister" },
        type: "Goal",
        detail: "Header",
      },
      {
        time: { elapsed: 73 },
        team: { id: 5, name: "Manchester City" },
        player: { id: 5009, name: "Phil Foden" },
        assist: { id: 5011, name: "Jeremy Doku" },
        type: "Goal",
        detail: "Normal Goal",
      },
      {
        time: { elapsed: 78 },
        team: { id: 6, name: "Liverpool" },
        player: { id: 6007, name: "Alexis Mac Allister" },
        type: "Card",
        detail: "Yellow Card",
      },
      {
        time: { elapsed: 82 },
        team: { id: 5, name: "Manchester City" },
        player: { id: 5010, name: "Erling Haaland" },
        assist: { id: 5015, name: "Julian Alvarez" },
        type: "Substitution",
        detail: "Substitution",
      },
      {
        time: { elapsed: 85 },
        team: { id: 6, name: "Liverpool" },
        player: { id: 6011, name: "Luis Diaz" },
        assist: { id: 6015, name: "Cody Gakpo" },
        type: "Substitution",
        detail: "Substitution",
      },
    ],
  },

  // 994: Barcelona vs Atletico Madrid (1 - 1, FT 90')
  994: {
    fixture: {
      id: 994,
      date: new Date(Date.now() - 14400000).toISOString(),
      venue: { name: "Camp Nou", city: "Barcelona", country: "Spain" },
      referee: "Jesus Gil Manzano, Spain",
      status: { short: "FT", elapsed: 90 },
    },
    league: { id: 3, name: "La Liga", country: "Spain", season: 2026 },
    teams: {
      home: { id: 7, name: "Barcelona", logo: "https://media.api-sports.io/football/teams/529.png" },
      away: { id: 8, name: "Atletico Madrid", logo: "https://media.api-sports.io/football/teams/530.png" },
    },
    goals: { home: 1, away: 1 },
    lineups: [
      {
        team: { id: 7, name: "Barcelona", logo: "https://media.api-sports.io/football/teams/529.png" },
        coach: { id: 107, name: "Hansi Flick", photo: "https://media.api-sports.io/football/coachs/107.png" },
        formation: "4-2-3-1",
        startXI: [
          { player: { id: 7001, name: "Marc-Andre ter Stegen", number: 1, pos: "G" } },
          { player: { id: 7002, name: "Jules Kounde", number: 23, pos: "D" } },
          { player: { id: 7003, name: "Pau Cubarsi", number: 2, pos: "D" } },
          { player: { id: 7004, name: "Inigo Martinez", number: 5, pos: "D" } },
          { player: { id: 7005, name: "Alejandro Balde", number: 3, pos: "D" } },
          { player: { id: 7006, name: "Marc Casado", number: 17, pos: "M" } },
          { player: { id: 7007, name: "Pedri", number: 8, pos: "M" } },
          { player: { id: 7008, name: "Lamine Yamal", number: 19, pos: "F" } },
          { player: { id: 7009, name: "Dani Olmo", number: 20, pos: "M" } },
          { player: { id: 7010, name: "Raphinha", number: 11, pos: "F" } },
          { player: { id: 7011, name: "Robert Lewandowski", number: 9, pos: "F" } },
        ],
        substitutes: [
          { player: { id: 7012, name: "Inaki Pena", number: 13, pos: "G" } },
          { player: { id: 7013, name: "Andreas Christensen", number: 15, pos: "D" } },
          { player: { id: 7014, name: "Fermin Lopez", number: 16, pos: "M" } },
          { player: { id: 7015, name: "Ferran Torres", number: 7, pos: "F" } },
        ],
      },
      {
        team: { id: 8, name: "Atletico Madrid", logo: "https://media.api-sports.io/football/teams/530.png" },
        coach: { id: 108, name: "Diego Simeone", photo: "https://media.api-sports.io/football/coachs/108.png" },
        formation: "4-4-2",
        startXI: [
          { player: { id: 8001, name: "Jan Oblak", number: 13, pos: "G" } },
          { player: { id: 8002, name: "Nahuel Molina", number: 16, pos: "D" } },
          { player: { id: 8003, name: "Jose Maria Gimenez", number: 2, pos: "D" } },
          { player: { id: 8004, name: "Robin Le Normand", number: 24, pos: "D" } },
          { player: { id: 8005, name: "Reinildo Mandava", number: 23, pos: "D" } },
          { player: { id: 8006, name: "Rodrigo De Paul", number: 5, pos: "M" } },
          { player: { id: 8007, name: "Koke", number: 6, pos: "M" } },
          { player: { id: 8008, name: "Conor Gallagher", number: 4, pos: "M" } },
          { player: { id: 8009, name: "Samuel Lino", number: 12, pos: "M" } },
          { player: { id: 8010, name: "Antoine Griezmann", number: 7, pos: "F" } },
          { player: { id: 8011, name: "Julian Alvarez", number: 19, pos: "F" } },
        ],
        substitutes: [
          { player: { id: 8012, name: "Juan Musso", number: 1, pos: "G" } },
          { player: { id: 8013, name: "Axel Witsel", number: 20, pos: "D" } },
          { player: { id: 8014, name: "Rodrigo Riquelme", number: 17, pos: "M" } },
          { player: { id: 8015, name: "Alexander Sorloth", number: 9, pos: "F" } },
        ],
      },
    ],
    events: [
      {
        time: { elapsed: 35 },
        team: { id: 7, name: "Barcelona" },
        player: { id: 7011, name: "Robert Lewandowski" },
        assist: { id: 7008, name: "Lamine Yamal" },
        type: "Goal",
        detail: "Normal Goal",
      },
      {
        time: { elapsed: 44 },
        team: { id: 7, name: "Barcelona" },
        player: { id: 7007, name: "Pedri" },
        type: "Card",
        detail: "Yellow Card",
      },
      {
        time: { elapsed: 58 },
        team: { id: 8, name: "Atletico Madrid" },
        player: { id: 8010, name: "Antoine Griezmann" },
        assist: { id: 8006, name: "Rodrigo De Paul" },
        type: "Goal",
        detail: "Volley",
      },
      {
        time: { elapsed: 67 },
        team: { id: 8, name: "Atletico Madrid" },
        player: { id: 8006, name: "Rodrigo De Paul" },
        type: "Card",
        detail: "Red Card",
      },
      {
        time: { elapsed: 72 },
        team: { id: 7, name: "Barcelona" },
        player: { id: 7009, name: "Dani Olmo" },
        assist: { id: 7015, name: "Ferran Torres" },
        type: "Substitution",
        detail: "Substitution",
      },
      {
        time: { elapsed: 76 },
        team: { id: 8, name: "Atletico Madrid" },
        player: { id: 8011, name: "Julian Alvarez" },
        assist: { id: 8015, name: "Alexander Sorloth" },
        type: "Substitution",
        detail: "Substitution",
      },
    ],
  },
};

/**
 * Resolves detailed mock match data.
 * 1. Checks hardcoded MOCK_DETAILED_MATCHES.
 * 2. If not found, checks the PostgreSQL database for existing Match & Team records to maintain
 *    relational integrity (team participant check, goal counts, lineup triggers).
 * 3. Falls back to generating a realistic match with guaranteed events matching any goals.
 */
export async function resolveMockDetailedMatch(matchId: number): Promise<DetailedMockMatch> {
  // 1. Direct hit on hardcoded detailed mocks
  if (MOCK_DETAILED_MATCHES[matchId]) {
    return MOCK_DETAILED_MATCHES[matchId];
  }

  // 2. Check if the match already exists in PostgreSQL
  try {
    const matchRes = await pool.query(
      `SELECT
         m.MatchID,
         m.MatchDate,
         m.HomeGoals,
         m.AwayGoals,
         m.TournamentID,
         t.Name AS TournamentName,
         m.HomeTeamID,
         ht.Name AS HomeTeamName,
         ht.Logo AS HomeTeamLogo,
         m.AwayTeamID,
         at.Name AS AwayTeamName,
         at.Logo AS AwayTeamLogo,
         v.Name AS VenueName,
         v.City AS VenueCity,
         c.Name AS VenueCountry
       FROM Match m
       JOIN Team ht ON m.HomeTeamID = ht.TeamID
       JOIN Team at ON m.AwayTeamID = at.TeamID
       LEFT JOIN Tournament t ON m.TournamentID = t.TournamentID
       LEFT JOIN Venue v ON m.VenueID = v.VenueID
       LEFT JOIN Country c ON v.CountryID = c.CountryID
       WHERE m.MatchID = $1
       LIMIT 1`,
      [matchId]
    );

    if (matchRes.rows.length > 0) {
      const row = matchRes.rows[0];
      const homeTeamId = Number(row.hometeamid);
      const awayTeamId = Number(row.awayteamid);
      const homeTeamName = row.hometeamname ?? "Home Team";
      const awayTeamName = row.awayteamname ?? "Away Team";
      const date = row.matchdate ? new Date(row.matchdate) : new Date();
      const isUpcoming = date.getTime() > Date.now() && row.homegoals === null && row.awaygoals === null;
      const minsSinceStart = Math.floor((Date.now() - date.getTime()) / 60000);
      const isLive = !isUpcoming && minsSinceStart >= 0 && minsSinceStart < 120 && (row.homegoals === null || row.homegoals === undefined);
      const liveMinute = isLive ? Math.min(Math.max(1, minsSinceStart), 90) : 90;
      const matchStatus: "LIVE" | "FT" | "UPCOMING" = isUpcoming ? "UPCOMING" : isLive ? "LIVE" : "FT";

      const homeScore = isUpcoming ? null : (row.homegoals !== null ? Number(row.homegoals) : 1);
      const awayScore = isUpcoming ? null : (row.awaygoals !== null ? Number(row.awaygoals) : 0);

      // Check existing lineups in DB
      const lineupRes = await pool.query(
        `SELECT l.TeamID, l.PlayerID, l.Status, l.Formation, l.Position, l.JerseyNumber, p.Name AS PlayerName
         FROM Lineup l
         JOIN Player p ON l.PlayerID = p.PlayerID
         WHERE l.MatchID = $1
         ORDER BY l.TeamID, l.Status DESC,
           CASE
             WHEN UPPER(COALESCE(l.Position, p.Position, '')) LIKE 'G%' THEN 1
             WHEN UPPER(COALESCE(l.Position, p.Position, '')) LIKE 'D%' THEN 2
             WHEN UPPER(COALESCE(l.Position, p.Position, '')) LIKE 'M%' THEN 3
             WHEN UPPER(COALESCE(l.Position, p.Position, '')) LIKE 'F%' OR UPPER(COALESCE(l.Position, p.Position, '')) LIKE 'A%' THEN 4
             ELSE 5
           END ASC,
           l.JerseyNumber ASC`,
        [matchId]
      );

      const makeSquad = (teamId: number, teamName: string, prefix: string) => {
        const teamRows = lineupRes.rows.filter((r) => Number(r.teamid) === teamId);
        const starters = teamRows.filter((r) => r.status === "Starter");
        const subs = teamRows.filter((r) => r.status === "Sub");

        const startXI = starters.length >= 11
          ? starters.map((s) => ({
              player: {
                id: Number(s.playerid),
                name: s.playername,
                number: s.jerseynumber ? Number(s.jerseynumber) : 10,
                pos: s.position ?? "M",
              },
            }))
          : [
              { player: { id: teamId * 1000 + 1, name: `${teamName} GK`, number: 1, pos: "G" } },
              { player: { id: teamId * 1000 + 2, name: `${teamName} RB`, number: 2, pos: "D" } },
              { player: { id: teamId * 1000 + 3, name: `${teamName} CB1`, number: 4, pos: "D" } },
              { player: { id: teamId * 1000 + 4, name: `${teamName} CB2`, number: 5, pos: "D" } },
              { player: { id: teamId * 1000 + 5, name: `${teamName} LB`, number: 3, pos: "D" } },
              { player: { id: teamId * 1000 + 6, name: `${teamName} DM`, number: 6, pos: "M" } },
              { player: { id: teamId * 1000 + 7, name: `${teamName} CM`, number: 8, pos: "M" } },
              { player: { id: teamId * 1000 + 8, name: `${teamName} AM`, number: 10, pos: "M" } },
              { player: { id: teamId * 1000 + 9, name: `${teamName} RW`, number: 7, pos: "F" } },
              { player: { id: teamId * 1000 + 10, name: `${teamName} ST`, number: 9, pos: "F" } },
              { player: { id: teamId * 1000 + 11, name: `${teamName} LW`, number: 11, pos: "F" } },
            ];

        const substitutes = subs.length > 0
          ? subs.map((s) => ({
              player: {
                id: Number(s.playerid),
                name: s.playername,
                number: s.jerseynumber ? Number(s.jerseynumber) : 12,
                pos: s.position ?? "M",
              },
            }))
          : [
              { player: { id: teamId * 1000 + 12, name: `${teamName} Sub GK`, number: 12, pos: "G" } },
              { player: { id: teamId * 1000 + 13, name: `${teamName} Sub Def`, number: 14, pos: "D" } },
              { player: { id: teamId * 1000 + 14, name: `${teamName} Sub Mid`, number: 16, pos: "M" } },
              { player: { id: teamId * 1000 + 15, name: `${teamName} Sub Fwd`, number: 18, pos: "F" } },
            ];

        return { startXI, substitutes };
      };

      const homeSquad = makeSquad(homeTeamId, homeTeamName, "H");
      const awaySquad = makeSquad(awayTeamId, awayTeamName, "A");

      // Check existing events in DB
      let events: DetailedMockMatch["events"] = [];

      // Rule 4: No upcoming match can have any events
      if (isUpcoming) {
        events = [];
      } else {
        const dbEventsRes = await pool.query(
          `SELECT e.EventID, e.EventTime, e.EventType, e.TeamID, e.PlayerID, p.Name AS PlayerName,
                  t.Name AS TeamName, g.GoalType, ap.PlayerID AS AssistPlayerID, ap.Name AS AssistPlayerName,
                  c.CardType, sub.InPlayerID, subp.Name AS InPlayerName
           FROM Event e
           LEFT JOIN Team t ON e.TeamID = t.TeamID
           LEFT JOIN Player p ON e.PlayerID = p.PlayerID
           LEFT JOIN Goal g ON e.EventID = g.EventID
           LEFT JOIN Player ap ON g.AssistPlayerID = ap.PlayerID
           LEFT JOIN Card c ON e.EventID = c.EventID
           LEFT JOIN Substitution sub ON e.EventID = sub.EventID
           LEFT JOIN Player subp ON sub.InPlayerID = subp.PlayerID
           WHERE e.MatchID = $1
           ORDER BY e.EventTime ASC`,
          [matchId]
        );

        if (dbEventsRes.rows.length > 0) {
          events = dbEventsRes.rows.map((ev) => {
            const typeStr = (ev.eventtype || "").toLowerCase();
            let evType: "Goal" | "Card" | "Substitution" = "Goal";
            if (typeStr.includes("card")) evType = "Card";
            else if (typeStr.includes("sub")) evType = "Substitution";

            return {
              time: { elapsed: ev.eventtime ? Number(ev.eventtime) : 45 },
              team: { id: Number(ev.teamid ?? homeTeamId), name: ev.teamname ?? homeTeamName },
              player: { id: Number(ev.playerid ?? homeTeamId * 1000 + 10), name: ev.playername ?? "Player" },
              assist: ev.inplayerid
                ? { id: Number(ev.inplayerid), name: ev.inplayername ?? "Player" }
                : ev.assistplayerid
                  ? { id: Number(ev.assistplayerid), name: ev.assistplayername ?? "Player" }
                  : null,
              type: evType,
              detail: ev.goaltype || (ev.cardtype ? `${ev.cardtype} Card` : "Match Event"),
            };
          });
        }

        // Rule 3: No event timestamp of a live match can cross the actual time of the match
        if (isLive) {
          events = events.filter((ev) => ev.time.elapsed <= liveMinute);
        }

        // If no events exist in DB, synthesize events corresponding to HomeGoals & AwayGoals
        if (events.length === 0 && ((homeScore ?? 0) > 0 || (awayScore ?? 0) > 0)) {
          const maxEventTime = isLive ? liveMinute : 89;
          const homeTimes = [Math.min(21, maxEventTime), Math.min(44, maxEventTime), Math.min(67, maxEventTime), Math.min(83, maxEventTime)];
          for (let i = 0; i < (homeScore ?? 0); i++) {
            const scorer = homeSquad.startXI[Math.min(9 - i, homeSquad.startXI.length - 1)].player;
            const assist = homeSquad.startXI[Math.min(7 - i, homeSquad.startXI.length - 1)].player;
            const t = Math.min(homeTimes[i % homeTimes.length], maxEventTime);
            events.push({
              time: { elapsed: t },
              team: { id: homeTeamId, name: homeTeamName },
              player: { id: scorer.id, name: scorer.name },
              assist: { id: assist.id, name: assist.name },
              type: "Goal",
              detail: "Normal Goal",
            });
          }

          const awayTimes = [Math.min(32, maxEventTime), Math.min(58, maxEventTime), Math.min(76, maxEventTime), Math.min(89, maxEventTime)];
          for (let i = 0; i < (awayScore ?? 0); i++) {
            const scorer = awaySquad.startXI[Math.min(9 - i, awaySquad.startXI.length - 1)].player;
            const assist = awaySquad.startXI[Math.min(7 - i, awaySquad.startXI.length - 1)].player;
            const t = Math.min(awayTimes[i % awayTimes.length], maxEventTime);
            events.push({
              time: { elapsed: t },
              team: { id: awayTeamId, name: awayTeamName },
              player: { id: scorer.id, name: scorer.name },
              assist: { id: assist.id, name: assist.name },
              type: "Goal",
              detail: "Normal Goal",
            });
          }

          // Rule 3: Cards & Subs only within liveMinute
          if (maxEventTime >= 54) {
            events.push({
              time: { elapsed: 54 },
              team: { id: homeTeamId, name: homeTeamName },
              player: { id: homeSquad.startXI[2].player.id, name: homeSquad.startXI[2].player.name },
              type: "Card",
              detail: "Yellow Card",
            });
          }

          // Rule 5: Only goalkeepers sub with goalkeepers, and outfield with outfield
          if (maxEventTime >= 70) {
            const outOutfield = awaySquad.startXI.find(p => p.player.pos !== 'G') || awaySquad.startXI[8];
            const inOutfield = awaySquad.substitutes.find(p => p.player.pos !== 'G') || awaySquad.substitutes[1];
            events.push({
              time: { elapsed: 70 },
              team: { id: awayTeamId, name: awayTeamName },
              player: { id: outOutfield.player.id, name: outOutfield.player.name },
              assist: { id: inOutfield.player.id, name: inOutfield.player.name },
              type: "Substitution",
              detail: "Substitution",
            });
          }

          events.sort((a, b) => a.time.elapsed - b.time.elapsed);
        }
      }

      return {
        fixture: {
          id: matchId,
          date: date.toISOString(),
          venue: {
            name: row.venuename ?? "Home Stadium",
            city: row.venuecity ?? "City",
            country: row.venuecountry ?? "International",
          },
          referee: "Match Official",
          status: { short: matchStatus, elapsed: isUpcoming ? null : (isLive ? liveMinute : 90) },
        },
        league: {
          id: Number(row.tournamentid ?? 1),
          name: row.tournamentname ?? "Tournament",
          country: row.venuecountry ?? "International",
          season: date.getFullYear(),
        },
        teams: {
          home: { id: homeTeamId, name: homeTeamName, logo: row.hometeamlogo ?? null },
          away: { id: awayTeamId, name: awayTeamName, logo: row.awayteamlogo ?? null },
        },
        goals: { home: homeScore, away: awayScore },
        lineups: [
          {
            team: { id: homeTeamId, name: homeTeamName, logo: row.hometeamlogo ?? null },
            coach: { id: homeTeamId * 100, name: `${homeTeamName} Coach`, photo: null },
            formation: "4-3-3",
            startXI: homeSquad.startXI,
            substitutes: homeSquad.substitutes,
          },
          {
            team: { id: awayTeamId, name: awayTeamName, logo: row.awayteamlogo ?? null },
            coach: { id: awayTeamId * 100, name: `${awayTeamName} Coach`, photo: null },
            formation: "4-3-3",
            startXI: awaySquad.startXI,
            substitutes: awaySquad.substitutes,
          },
        ],
        events,
      };
    }
  } catch (err) {
    console.warn(`[resolveMockDetailedMatch] Database lookup warning: ${(err as Error).message}`);
  }

  // 3. Fall back to synchronous generator
  return generateMockDetailedMatch(matchId);
}

/**
 * Synchronous generator for mock detailed match
 */
export function generateMockDetailedMatch(matchId: number): DetailedMockMatch {
  if (MOCK_DETAILED_MATCHES[matchId]) {
    return MOCK_DETAILED_MATCHES[matchId];
  }

  const basic = MOCK_BASIC_MATCHES.find((m) => m.id === matchId) || {
    id: matchId,
    leagueId: 1,
    league: "European Championship",
    country: "International",
    homeTeam: "Home Team FC",
    homeTeamId: matchId * 10 + 1,
    awayTeam: "Away Team FC",
    awayTeamId: matchId * 10 + 2,
    homeScore: 1,
    awayScore: 0,
    status: "FT" as const,
    minute: 90,
    date: new Date().toISOString(),
  };

  const isUpcoming = basic.status === "UPCOMING";
  const homeScore = isUpcoming ? null : (basic.homeScore ?? 1);
  const awayScore = isUpcoming ? null : (basic.awayScore ?? 0);

  const events: DetailedMockMatch["events"] = [];
  if (!isUpcoming) {
    if ((homeScore ?? 0) > 0) {
      events.push({
        time: { elapsed: 32 },
        team: { id: basic.homeTeamId, name: basic.homeTeam },
        player: { id: matchId * 100 + 10, name: `${basic.homeTeam} ST` },
        assist: { id: matchId * 100 + 8, name: `${basic.homeTeam} AM` },
        type: "Goal",
        detail: "Normal Goal",
      });
    }
    if ((awayScore ?? 0) > 0) {
      events.push({
        time: { elapsed: 71 },
        team: { id: basic.awayTeamId, name: basic.awayTeam },
        player: { id: matchId * 200 + 10, name: `${basic.awayTeam} ST` },
        assist: { id: matchId * 200 + 8, name: `${basic.awayTeam} AM` },
        type: "Goal",
        detail: "Normal Goal",
      });
    }
    events.push({
      time: { elapsed: 65 },
      team: { id: basic.awayTeamId, name: basic.awayTeam },
      player: { id: matchId * 200 + 6, name: `${basic.awayTeam} DM1` },
      type: "Card",
      detail: "Yellow Card",
    });
  }

  return {
    fixture: {
      id: matchId,
      date: basic.date || new Date().toISOString(),
      venue: { name: "National Arena", city: "Capital City", country: basic.country },
      referee: "Michael Oliver, England",
      status: { short: basic.status, elapsed: basic.minute ?? (isUpcoming ? null : 90) },
    },
    league: { id: basic.leagueId ?? 1, name: basic.league, country: basic.country, season: 2026 },
    teams: {
      home: { id: basic.homeTeamId, name: basic.homeTeam, logo: basic.homeLogo ?? null },
      away: { id: basic.awayTeamId, name: basic.awayTeam, logo: basic.awayLogo ?? null },
    },
    goals: { home: homeScore, away: awayScore },
    lineups: [
      {
        team: { id: basic.homeTeamId, name: basic.homeTeam, logo: basic.homeLogo ?? null },
        coach: { id: basic.homeTeamId * 10, name: `${basic.homeTeam} Manager`, photo: null },
        formation: "4-3-3",
        startXI: [
          { player: { id: matchId * 100 + 1, name: `${basic.homeTeam} GK`, number: 1, pos: "G" } },
          { player: { id: matchId * 100 + 2, name: `${basic.homeTeam} RB`, number: 2, pos: "D" } },
          { player: { id: matchId * 100 + 3, name: `${basic.homeTeam} CB1`, number: 4, pos: "D" } },
          { player: { id: matchId * 100 + 4, name: `${basic.homeTeam} CB2`, number: 5, pos: "D" } },
          { player: { id: matchId * 100 + 5, name: `${basic.homeTeam} LB`, number: 3, pos: "D" } },
          { player: { id: matchId * 100 + 6, name: `${basic.homeTeam} DM`, number: 6, pos: "M" } },
          { player: { id: matchId * 100 + 7, name: `${basic.homeTeam} CM`, number: 8, pos: "M" } },
          { player: { id: matchId * 100 + 8, name: `${basic.homeTeam} AM`, number: 10, pos: "M" } },
          { player: { id: matchId * 100 + 9, name: `${basic.homeTeam} RW`, number: 7, pos: "F" } },
          { player: { id: matchId * 100 + 10, name: `${basic.homeTeam} ST`, number: 9, pos: "F" } },
          { player: { id: matchId * 100 + 11, name: `${basic.homeTeam} LW`, number: 11, pos: "F" } },
        ],
        substitutes: [
          { player: { id: matchId * 100 + 12, name: `${basic.homeTeam} Sub GK`, number: 12, pos: "G" } },
          { player: { id: matchId * 100 + 13, name: `${basic.homeTeam} Sub Def`, number: 14, pos: "D" } },
          { player: { id: matchId * 100 + 14, name: `${basic.homeTeam} Sub Mid`, number: 16, pos: "M" } },
          { player: { id: matchId * 100 + 15, name: `${basic.homeTeam} Sub Fwd`, number: 18, pos: "F" } },
        ],
      },
      {
        team: { id: basic.awayTeamId, name: basic.awayTeam, logo: basic.awayLogo ?? null },
        coach: { id: basic.awayTeamId * 10, name: `${basic.awayTeam} Manager`, photo: null },
        formation: "4-3-3",
        startXI: [
          { player: { id: matchId * 200 + 1, name: `${basic.awayTeam} GK`, number: 1, pos: "G" } },
          { player: { id: matchId * 200 + 2, name: `${basic.awayTeam} RB`, number: 2, pos: "D" } },
          { player: { id: matchId * 200 + 3, name: `${basic.awayTeam} CB1`, number: 4, pos: "D" } },
          { player: { id: matchId * 200 + 4, name: `${basic.awayTeam} CB2`, number: 5, pos: "D" } },
          { player: { id: matchId * 200 + 5, name: `${basic.awayTeam} LB`, number: 3, pos: "D" } },
          { player: { id: matchId * 200 + 6, name: `${basic.awayTeam} DM1`, number: 6, pos: "M" } },
          { player: { id: matchId * 200 + 7, name: `${basic.awayTeam} DM2`, number: 8, pos: "M" } },
          { player: { id: matchId * 200 + 8, name: `${basic.awayTeam} AM`, number: 10, pos: "M" } },
          { player: { id: matchId * 200 + 9, name: `${basic.awayTeam} RW`, number: 7, pos: "F" } },
          { player: { id: matchId * 200 + 10, name: `${basic.awayTeam} ST`, number: 9, pos: "F" } },
          { player: { id: matchId * 200 + 11, name: `${basic.awayTeam} LW`, number: 11, pos: "F" } },
        ],
        substitutes: [
          { player: { id: matchId * 200 + 12, name: `${basic.awayTeam} Sub GK`, number: 12, pos: "G" } },
          { player: { id: matchId * 200 + 13, name: `${basic.awayTeam} Sub Def`, number: 15, pos: "D" } },
          { player: { id: matchId * 200 + 14, name: `${basic.awayTeam} Sub Mid`, number: 17, pos: "M" } },
          { player: { id: matchId * 200 + 15, name: `${basic.awayTeam} Sub Fwd`, number: 19, pos: "F" } },
        ],
      },
    ],
    events,
  };
}
