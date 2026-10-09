import { pool } from "../src/db";

interface PlayerSeed {
  name: string;
  pos: string;
  num: number;
  photo?: string;
  rating?: number;
}

interface TeamRoster {
  teamId: number;
  coachName: string;
  coachPhoto: string;
  formation: string;
  starters: PlayerSeed[];
  subs: PlayerSeed[];
}

interface MatchEventSeed {
  time: number;
  teamId: number;
  playerName: string;
  type: "Goal" | "Card" | "Substitution";
  detail?: string;
  assistName?: string;
}

interface HighVoltageMatchSeed {
  fixtureId: number;
  tournamentName: string;
  homeTeamId: number;
  awayTeamId: number;
  venueId: number;
  refereeId: number;
  minutesAgo: number; // For match date (e.g. 180 mins ago = 3 hours ago -> FT)
  homeRoster: TeamRoster;
  awayRoster: TeamRoster;
  events: MatchEventSeed[];
}

// ── Match 1: Real Madrid vs Barcelona (3 - 2) ──────────────────────────────────
const REAL_MADRID_ROSTER: TeamRoster = {
  teamId: 2,
  coachName: "Carlo Ancelotti",
  coachPhoto: "https://media.api-sports.io/football/coachs/102.png",
  formation: "4-3-3",
  starters: [
    { name: "Thibaut Courtois", pos: "G", num: 1, rating: 8.5 },
    { name: "Dani Carvajal", pos: "D", num: 2, rating: 7.8 },
    { name: "Eder Militao", pos: "D", num: 3, rating: 8.0 },
    { name: "Antonio Rudiger", pos: "D", num: 22, rating: 8.2 },
    { name: "Ferland Mendy", pos: "D", num: 23, rating: 7.6 },
    { name: "Federico Valverde", pos: "M", num: 8, rating: 8.8 },
    { name: "Aurelien Tchouameni", pos: "M", num: 14, rating: 7.7 },
    { name: "Jude Bellingham", pos: "M", num: 5, rating: 9.4 },
    { name: "Rodrygo", pos: "F", num: 11, rating: 8.4 },
    { name: "Kylian Mbappe", pos: "F", num: 9, rating: 9.1 },
    { name: "Vinicius Junior", pos: "F", num: 7, rating: 9.5 },
  ],
  subs: [
    { name: "Andriy Lunin", pos: "G", num: 13, rating: 7.2 },
    { name: "Lucas Vazquez", pos: "D", num: 17, rating: 7.0 },
    { name: "Luka Modric", pos: "M", num: 10, rating: 8.3 },
    { name: "Eduardo Camavinga", pos: "M", num: 6, rating: 7.9 },
    { name: "Brahim Diaz", pos: "F", num: 21, rating: 7.8 },
  ],
};

const BARCELONA_ROSTER: TeamRoster = {
  teamId: 10,
  coachName: "Hansi Flick",
  coachPhoto: "https://media.api-sports.io/football/coachs/107.png",
  formation: "4-2-3-1",
  starters: [
    { name: "Marc-Andre ter Stegen", pos: "G", num: 1, rating: 7.9 },
    { name: "Jules Kounde", pos: "D", num: 23, rating: 8.3 },
    { name: "Pau Cubarsi", pos: "D", num: 2, rating: 7.9 },
    { name: "Inigo Martinez", pos: "D", num: 5, rating: 7.6 },
    { name: "Alejandro Balde", pos: "D", num: 3, rating: 8.1 },
    { name: "Marc Casado", pos: "M", num: 17, rating: 7.7 },
    { name: "Pedri", pos: "M", num: 8, rating: 9.0 },
    { name: "Dani Olmo", pos: "M", num: 20, rating: 8.6 },
    { name: "Lamine Yamal", pos: "F", num: 19, rating: 9.3 },
    { name: "Robert Lewandowski", pos: "F", num: 9, rating: 8.9 },
    { name: "Raphinha", pos: "F", num: 11, rating: 9.2 },
  ],
  subs: [
    { name: "Inaki Pena", pos: "G", num: 13, rating: 6.8 },
    { name: "Andreas Christensen", pos: "D", num: 15, rating: 7.3 },
    { name: "Fermin Lopez", pos: "M", num: 16, rating: 7.5 },
    { name: "Gavi", pos: "M", num: 6, rating: 8.0 },
    { name: "Ferran Torres", pos: "F", num: 7, rating: 7.4 },
  ],
};

// ── Match 2: Manchester City vs Liverpool (2 - 2) ──────────────────────────────
const MAN_CITY_ROSTER: TeamRoster = {
  teamId: 6,
  coachName: "Pep Guardiola",
  coachPhoto: "https://media.api-sports.io/football/coachs/105.png",
  formation: "4-3-3",
  starters: [
    { name: "Ederson", pos: "G", num: 31, rating: 8.0 },
    { name: "Kyle Walker", pos: "D", num: 2, rating: 7.9 },
    { name: "Ruben Dias", pos: "D", num: 3, rating: 8.4 },
    { name: "Manuel Akanji", pos: "D", num: 25, rating: 8.0 },
    { name: "Josko Gvardiol", pos: "D", num: 24, rating: 8.5 },
    { name: "Rodri", pos: "M", num: 16, rating: 9.3 },
    { name: "Kevin De Bruyne", pos: "M", num: 17, rating: 9.2 },
    { name: "Bernardo Silva", pos: "M", num: 20, rating: 8.8 },
    { name: "Phil Foden", pos: "F", num: 47, rating: 9.0 },
    { name: "Erling Haaland", pos: "F", num: 9, rating: 9.4 },
    { name: "Jack Grealish", pos: "F", num: 10, rating: 8.1 },
  ],
  subs: [
    { name: "Stefan Ortega", pos: "G", num: 18, rating: 7.1 },
    { name: "John Stones", pos: "D", num: 5, rating: 8.1 },
    { name: "Mateo Kovacic", pos: "M", num: 8, rating: 7.8 },
    { name: "Ilkay Gundogan", pos: "M", num: 19, rating: 8.0 },
    { name: "Jeremy Doku", pos: "F", num: 11, rating: 8.2 },
  ],
};

const LIVERPOOL_ROSTER: TeamRoster = {
  teamId: 7,
  coachName: "Arne Slot",
  coachPhoto: "https://media.api-sports.io/football/coachs/106.png",
  formation: "4-3-3",
  starters: [
    { name: "Alisson Becker", pos: "G", num: 1, rating: 8.4 },
    { name: "Trent Alexander-Arnold", pos: "D", num: 66, rating: 8.9 },
    { name: "Ibrahima Konate", pos: "D", num: 5, rating: 8.3 },
    { name: "Virgil van Dijk", pos: "D", num: 4, rating: 8.9 },
    { name: "Andy Robertson", pos: "D", num: 26, rating: 8.0 },
    { name: "Ryan Gravenberch", pos: "M", num: 38, rating: 8.6 },
    { name: "Alexis Mac Allister", pos: "M", num: 10, rating: 8.7 },
    { name: "Dominik Szoboszlai", pos: "M", num: 8, rating: 8.4 },
    { name: "Mohamed Salah", pos: "F", num: 11, rating: 9.5 },
    { name: "Darwin Nunez", pos: "F", num: 9, rating: 8.0 },
    { name: "Luis Diaz", pos: "F", num: 7, rating: 8.9 },
  ],
  subs: [
    { name: "Caoimhin Kelleher", pos: "G", num: 62, rating: 7.4 },
    { name: "Joe Gomez", pos: "D", num: 2, rating: 7.2 },
    { name: "Curtis Jones", pos: "M", num: 17, rating: 7.9 },
    { name: "Cody Gakpo", pos: "F", num: 18, rating: 8.2 },
    { name: "Diogo Jota", pos: "F", num: 20, rating: 8.4 },
  ],
};

// ── Match 3: Bayern Munich vs Borussia Dortmund (4 - 2) ────────────────────────
const BAYERN_ROSTER: TeamRoster = {
  teamId: 3,
  coachName: "Vincent Kompany",
  coachPhoto: "https://media.api-sports.io/football/coachs/103.png",
  formation: "4-2-3-1",
  starters: [
    { name: "Manuel Neuer", pos: "G", num: 1, rating: 8.2 },
    { name: "Joshua Kimmich", pos: "D", num: 6, rating: 8.8 },
    { name: "Dayot Upamecano", pos: "D", num: 2, rating: 8.0 },
    { name: "Kim Min-jae", pos: "D", num: 3, rating: 8.1 },
    { name: "Alphonso Davies", pos: "D", num: 19, rating: 8.6 },
    { name: "Aleksandar Pavlovic", pos: "M", num: 45, rating: 8.2 },
    { name: "Leon Goretzka", pos: "M", num: 8, rating: 8.1 },
    { name: "Michael Olise", pos: "F", num: 17, rating: 9.0 },
    { name: "Jamal Musiala", pos: "M", num: 42, rating: 9.5 },
    { name: "Serge Gnabry", pos: "F", num: 7, rating: 8.2 },
    { name: "Harry Kane", pos: "F", num: 9, rating: 9.6 },
  ],
  subs: [
    { name: "Sven Ulreich", pos: "G", num: 26, rating: 6.9 },
    { name: "Eric Dier", pos: "D", num: 15, rating: 7.3 },
    { name: "Konrad Laimer", pos: "M", num: 27, rating: 7.7 },
    { name: "Leroy Sane", pos: "F", num: 10, rating: 8.3 },
    { name: "Thomas Muller", pos: "F", num: 25, rating: 8.2 },
  ],
};

const DORTMUND_ROSTER: TeamRoster = {
  teamId: 12,
  coachName: "Nuri Sahin",
  coachPhoto: "https://media.api-sports.io/football/coachs/109.png",
  formation: "4-2-3-1",
  starters: [
    { name: "Gregor Kobel", pos: "G", num: 1, rating: 7.8 },
    { name: "Julian Ryerson", pos: "D", num: 26, rating: 7.7 },
    { name: "Waldemar Anton", pos: "D", num: 3, rating: 7.6 },
    { name: "Nico Schlotterbeck", pos: "D", num: 4, rating: 8.0 },
    { name: "Ramy Bensebaini", pos: "D", num: 5, rating: 7.5 },
    { name: "Emre Can", pos: "M", num: 23, rating: 7.7 },
    { name: "Marcel Sabitzer", pos: "M", num: 20, rating: 8.2 },
    { name: "Karim Adeyemi", pos: "F", num: 27, rating: 8.4 },
    { name: "Julian Brandt", pos: "M", num: 10, rating: 8.7 },
    { name: "Jamie Gittens", pos: "F", num: 43, rating: 8.0 },
    { name: "Serhou Guirassy", pos: "F", num: 9, rating: 8.9 },
  ],
  subs: [
    { name: "Alexander Meyer", pos: "G", num: 33, rating: 6.8 },
    { name: "Niklas Sule", pos: "D", num: 25, rating: 7.4 },
    { name: "Pascal Gross", pos: "M", num: 13, rating: 7.9 },
    { name: "Felix Nmecha", pos: "M", num: 8, rating: 7.5 },
    { name: "Donyell Malen", pos: "F", num: 21, rating: 8.0 },
  ],
};

// ── Match 4: Arsenal vs Chelsea (3 - 1) ────────────────────────────────────────
const ARSENAL_ROSTER: TeamRoster = {
  teamId: 1,
  coachName: "Mikel Arteta",
  coachPhoto: "https://media.api-sports.io/football/coachs/101.png",
  formation: "4-3-3",
  starters: [
    { name: "David Raya", pos: "G", num: 22, rating: 8.3 },
    { name: "Ben White", pos: "D", num: 4, rating: 8.1 },
    { name: "William Saliba", pos: "D", num: 2, rating: 8.8 },
    { name: "Gabriel Magalhaes", pos: "D", num: 6, rating: 8.6 },
    { name: "Jurrien Timber", pos: "D", num: 12, rating: 8.2 },
    { name: "Thomas Partey", pos: "M", num: 5, rating: 8.0 },
    { name: "Declan Rice", pos: "M", num: 41, rating: 9.1 },
    { name: "Martin Odegaard", pos: "M", num: 8, rating: 9.3 },
    { name: "Bukayo Saka", pos: "F", num: 7, rating: 9.5 },
    { name: "Kai Havertz", pos: "F", num: 29, rating: 8.8 },
    { name: "Gabriel Martinelli", pos: "F", num: 11, rating: 8.6 },
  ],
  subs: [
    { name: "Neto", pos: "G", num: 32, rating: 6.9 },
    { name: "Oleksandr Zinchenko", pos: "D", num: 35, rating: 7.4 },
    { name: "Mikel Merino", pos: "M", num: 23, rating: 7.8 },
    { name: "Leandro Trossard", pos: "F", num: 19, rating: 8.2 },
    { name: "Gabriel Jesus", pos: "F", num: 9, rating: 7.9 },
  ],
};

const CHELSEA_ROSTER: TeamRoster = {
  teamId: 8,
  coachName: "Enzo Maresca",
  coachPhoto: "https://media.api-sports.io/football/coachs/110.png",
  formation: "4-2-3-1",
  starters: [
    { name: "Robert Sanchez", pos: "G", num: 1, rating: 7.4 },
    { name: "Malo Gusto", pos: "D", num: 27, rating: 7.8 },
    { name: "Wesley Fofana", pos: "D", num: 29, rating: 7.6 },
    { name: "Levi Colwill", pos: "D", num: 6, rating: 8.0 },
    { name: "Marc Cucurella", pos: "D", num: 3, rating: 7.7 },
    { name: "Moises Caicedo", pos: "M", num: 25, rating: 8.7 },
    { name: "Enzo Fernandez", pos: "M", num: 8, rating: 8.3 },
    { name: "Noni Madueke", pos: "F", num: 11, rating: 8.0 },
    { name: "Cole Palmer", pos: "M", num: 20, rating: 9.4 },
    { name: "Jadon Sancho", pos: "F", num: 19, rating: 7.9 },
    { name: "Nicolas Jackson", pos: "F", num: 15, rating: 8.2 },
  ],
  subs: [
    { name: "Filip Jorgensen", pos: "G", num: 12, rating: 6.9 },
    { name: "Tosin Adarabioyo", pos: "D", num: 4, rating: 7.3 },
    { name: "Romeo Lavia", pos: "M", num: 45, rating: 7.8 },
    { name: "Pedro Neto", pos: "F", num: 7, rating: 8.1 },
    { name: "Christopher Nkunku", pos: "F", num: 18, rating: 8.3 },
  ],
};

// ── Match 5: Paris Saint-Germain vs Real Madrid (2 - 3) ────────────────────────
const PSG_ROSTER: TeamRoster = {
  teamId: 4,
  coachName: "Luis Enrique",
  coachPhoto: "https://media.api-sports.io/football/coachs/104.png",
  formation: "4-3-3",
  starters: [
    { name: "Gianluigi Donnarumma", pos: "G", num: 1, rating: 7.8 },
    { name: "Achraf Hakimi", pos: "D", num: 2, rating: 8.8 },
    { name: "Marquinhos", pos: "D", num: 5, rating: 8.2 },
    { name: "Willian Pacho", pos: "D", num: 51, rating: 7.9 },
    { name: "Nuno Mendes", pos: "D", num: 25, rating: 8.4 },
    { name: "Warren Zaire-Emery", pos: "M", num: 33, rating: 8.3 },
    { name: "Vitinha", pos: "M", num: 17, rating: 8.9 },
    { name: "Fabian Ruiz", pos: "M", num: 8, rating: 8.1 },
    { name: "Ousmane Dembele", pos: "F", num: 10, rating: 8.9 },
    { name: "Goncalo Ramos", pos: "F", num: 9, rating: 7.8 },
    { name: "Bradley Barcola", pos: "F", num: 29, rating: 9.1 },
  ],
  subs: [
    { name: "Matvey Safonov", pos: "G", num: 39, rating: 7.0 },
    { name: "Lucas Beraldo", pos: "D", num: 35, rating: 7.3 },
    { name: "Joao Neves", pos: "M", num: 87, rating: 8.4 },
    { name: "Lee Kang-in", pos: "M", num: 19, rating: 8.0 },
    { name: "Randal Kolo Muani", pos: "F", num: 23, rating: 7.7 },
  ],
};

// ── Match 6: Inter Milan vs AC Milan (2 - 1) ───────────────────────────────────
const INTER_ROSTER: TeamRoster = {
  teamId: 11,
  coachName: "Simone Inzaghi",
  coachPhoto: "https://media.api-sports.io/football/coachs/111.png",
  formation: "3-5-2",
  starters: [
    { name: "Yann Sommer", pos: "G", num: 1, rating: 8.2 },
    { name: "Benjamin Pavard", pos: "D", num: 28, rating: 8.1 },
    { name: "Francesco Acerbi", pos: "D", num: 15, rating: 8.0 },
    { name: "Alessandro Bastoni", pos: "D", num: 95, rating: 8.8 },
    { name: "Denzel Dumfries", pos: "D", num: 2, rating: 8.2 },
    { name: "Nicolo Barella", pos: "M", num: 23, rating: 9.1 },
    { name: "Hakan Calhanoglu", pos: "M", num: 20, rating: 8.9 },
    { name: "Henrikh Mkhitaryan", pos: "M", num: 22, rating: 8.0 },
    { name: "Federico Dimarco", pos: "D", num: 32, rating: 8.8 },
    { name: "Marcus Thuram", pos: "F", num: 9, rating: 9.2 },
    { name: "Lautaro Martinez", pos: "F", num: 10, rating: 9.3 },
  ],
  subs: [
    { name: "Josep Martinez", pos: "G", num: 13, rating: 7.0 },
    { name: "Stefan de Vrij", pos: "D", num: 6, rating: 7.5 },
    { name: "Matteo Darmian", pos: "D", num: 36, rating: 7.4 },
    { name: "Davide Frattesi", pos: "M", num: 16, rating: 8.1 },
    { name: "Mehdi Taremi", pos: "F", num: 99, rating: 7.6 },
  ],
};

const AC_MILAN_ROSTER: TeamRoster = {
  teamId: 5,
  coachName: "Paulo Fonseca",
  coachPhoto: "https://media.api-sports.io/football/coachs/112.png",
  formation: "4-2-3-1",
  starters: [
    { name: "Mike Maignan", pos: "G", num: 16, rating: 8.4 },
    { name: "Emerson Royal", pos: "D", num: 22, rating: 7.4 },
    { name: "Fikayo Tomori", pos: "D", num: 23, rating: 8.1 },
    { name: "Strahinja Pavlovic", pos: "D", num: 31, rating: 7.8 },
    { name: "Theo Hernandez", pos: "D", num: 19, rating: 8.7 },
    { name: "Youssouf Fofana", pos: "M", num: 29, rating: 8.2 },
    { name: "Tijjani Reijnders", pos: "M", num: 14, rating: 8.5 },
    { name: "Christian Pulisic", pos: "M", num: 11, rating: 9.1 },
    { name: "Ruben Loftus-Cheek", pos: "M", num: 8, rating: 7.7 },
    { name: "Rafael Leao", pos: "F", num: 10, rating: 8.8 },
    { name: "Alvaro Morata", pos: "F", num: 7, rating: 8.2 },
  ],
  subs: [
    { name: "Marco Sportiello", pos: "G", num: 57, rating: 6.9 },
    { name: "Davide Calabria", pos: "D", num: 2, rating: 7.4 },
    { name: "Yunus Musah", pos: "M", num: 80, rating: 7.6 },
    { name: "Samuel Chukwueze", pos: "F", num: 21, rating: 7.9 },
    { name: "Tammy Abraham", pos: "F", num: 90, rating: 7.7 },
  ],
};

// ── The 6 High-Voltage Matches Definition ─────────────────────────────────────
const HIGH_VOLTAGE_MATCHES: HighVoltageMatchSeed[] = [
  // 1. Real Madrid vs Barcelona (3 - 2) — El Clásico
  {
    fixtureId: 88001,
    tournamentName: "UEFA Champions League",
    homeTeamId: 2,   // Real Madrid
    awayTeamId: 10,  // Barcelona
    venueId: 2,      // Santiago Bernabeu
    refereeId: 4,    // Szymon Marciniak
    minutesAgo: 180, // 3 hours ago -> FT
    homeRoster: REAL_MADRID_ROSTER,
    awayRoster: BARCELONA_ROSTER,
    events: [
      { time: 14, teamId: 2, playerName: "Vinicius Junior", type: "Goal", detail: "Normal Goal", assistName: "Jude Bellingham" },
      { time: 28, teamId: 10, playerName: "Robert Lewandowski", type: "Goal", detail: "Normal Goal", assistName: "Lamine Yamal" },
      { time: 34, teamId: 2, playerName: "Dani Carvajal", type: "Card", detail: "Yellow Card" },
      { time: 42, teamId: 10, playerName: "Marc Casado", type: "Card", detail: "Yellow Card" },
      { time: 55, teamId: 10, playerName: "Raphinha", type: "Goal", detail: "Curler", assistName: "Pedri" },
      { time: 66, teamId: 2, playerName: "Aurelien Tchouameni", type: "Substitution", assistName: "Luka Modric" },
      { time: 70, teamId: 10, playerName: "Marc Casado", type: "Substitution", assistName: "Dani Olmo" },
      { time: 73, teamId: 2, playerName: "Kylian Mbappe", type: "Goal", detail: "Counter", assistName: "Rodrygo" },
      { time: 76, teamId: 10, playerName: "Inigo Martinez", type: "Card", detail: "Yellow Card" },
      { time: 83, teamId: 2, playerName: "Rodrygo", type: "Substitution", assistName: "Brahim Diaz" },
      { time: 88, teamId: 2, playerName: "Vinicius Junior", type: "Card", detail: "Yellow Card" },
      { time: 89, teamId: 2, playerName: "Jude Bellingham", type: "Goal", detail: "Header", assistName: "Federico Valverde" },
    ],
  },

  // 2. Manchester City vs Liverpool (2 - 2) — Title Showdown
  {
    fixtureId: 88002,
    tournamentName: "Premier League",
    homeTeamId: 6,   // Manchester City
    awayTeamId: 7,   // Liverpool
    venueId: 6,      // Etihad Stadium
    refereeId: 1,    // Michael Oliver
    minutesAgo: 220, // ~3.5 hours ago -> FT
    homeRoster: MAN_CITY_ROSTER,
    awayRoster: LIVERPOOL_ROSTER,
    events: [
      { time: 21, teamId: 6, playerName: "Erling Haaland", type: "Goal", detail: "Normal Goal", assistName: "Kevin De Bruyne" },
      { time: 28, teamId: 6, playerName: "Rodri", type: "Card", detail: "Yellow Card" },
      { time: 36, teamId: 7, playerName: "Mohamed Salah", type: "Goal", detail: "Curler", assistName: "Trent Alexander-Arnold" },
      { time: 59, teamId: 7, playerName: "Virgil van Dijk", type: "Card", detail: "Yellow Card" },
      { time: 62, teamId: 6, playerName: "Phil Foden", type: "Goal", detail: "Normal Goal", assistName: "Bernardo Silva" },
      { time: 65, teamId: 6, playerName: "Jack Grealish", type: "Substitution", assistName: "Jeremy Doku" },
      { time: 72, teamId: 7, playerName: "Darwin Nunez", type: "Substitution", assistName: "Cody Gakpo" },
      { time: 79, teamId: 7, playerName: "Alexis Mac Allister", type: "Card", detail: "Yellow Card" },
      { time: 84, teamId: 7, playerName: "Luis Diaz", type: "Goal", detail: "Header", assistName: "Alexis Mac Allister" },
    ],
  },

  // 3. Bayern Munich vs Borussia Dortmund (4 - 2) — Der Klassiker
  {
    fixtureId: 88003,
    tournamentName: "Bundesliga",
    homeTeamId: 3,   // Bayern Munich
    awayTeamId: 12,  // Borussia Dortmund
    venueId: 3,      // Allianz Arena
    refereeId: 7,    // Felix Zwayer
    minutesAgo: 260, // ~4.3 hours ago -> FT
    homeRoster: BAYERN_ROSTER,
    awayRoster: DORTMUND_ROSTER,
    events: [
      { time: 11, teamId: 3, playerName: "Harry Kane", type: "Goal", detail: "Normal Goal", assistName: "Jamal Musiala" },
      { time: 26, teamId: 12, playerName: "Julian Brandt", type: "Goal", detail: "Normal Goal", assistName: "Karim Adeyemi" },
      { time: 33, teamId: 3, playerName: "Dayot Upamecano", type: "Card", detail: "Yellow Card" },
      { time: 41, teamId: 3, playerName: "Harry Kane", type: "Goal", detail: "Header", assistName: "Joshua Kimmich" },
      { time: 59, teamId: 3, playerName: "Michael Olise", type: "Goal", detail: "Curler", assistName: "Harry Kane" },
      { time: 62, teamId: 12, playerName: "Emre Can", type: "Card", detail: "Yellow Card" },
      { time: 68, teamId: 3, playerName: "Michael Olise", type: "Substitution", assistName: "Serge Gnabry" },
      { time: 74, teamId: 12, playerName: "Serhou Guirassy", type: "Goal", detail: "Normal Goal", assistName: "Julian Brandt" },
      { time: 78, teamId: 12, playerName: "Karim Adeyemi", type: "Substitution", assistName: "Donyell Malen" },
      { time: 87, teamId: 3, playerName: "Jamal Musiala", type: "Goal", detail: "Individual", assistName: undefined },
    ],
  },

  // 4. Arsenal vs Chelsea (3 - 1) — London Derby
  {
    fixtureId: 88004,
    tournamentName: "Premier League",
    homeTeamId: 1,   // Arsenal
    awayTeamId: 8,   // Chelsea
    venueId: 1,      // Emirates Stadium
    refereeId: 3,    // Anthony Taylor
    minutesAgo: 300, // 5 hours ago -> FT
    homeRoster: ARSENAL_ROSTER,
    awayRoster: CHELSEA_ROSTER,
    events: [
      { time: 18, teamId: 1, playerName: "Bukayo Saka", type: "Goal", detail: "Curler", assistName: "Martin Odegaard" },
      { time: 27, teamId: 8, playerName: "Moises Caicedo", type: "Card", detail: "Yellow Card" },
      { time: 39, teamId: 8, playerName: "Cole Palmer", type: "Goal", detail: "Free Kick", assistName: "Enzo Fernandez" },
      { time: 44, teamId: 1, playerName: "William Saliba", type: "Card", detail: "Yellow Card" },
      { time: 58, teamId: 1, playerName: "Kai Havertz", type: "Goal", detail: "Header", assistName: "Declan Rice" },
      { time: 64, teamId: 8, playerName: "Noni Madueke", type: "Substitution", assistName: "Pedro Neto" },
      { time: 71, teamId: 8, playerName: "Marc Cucurella", type: "Card", detail: "Yellow Card" },
      { time: 74, teamId: 1, playerName: "Kai Havertz", type: "Substitution", assistName: "Gabriel Jesus" },
      { time: 82, teamId: 1, playerName: "Gabriel Martinelli", type: "Goal", detail: "Counter", assistName: "Bukayo Saka" },
    ],
  },

  // 5. Paris Saint-Germain vs Real Madrid (2 - 3) — UCL Super Clash
  {
    fixtureId: 88005,
    tournamentName: "UEFA Champions League",
    homeTeamId: 4,   // PSG
    awayTeamId: 2,   // Real Madrid
    venueId: 4,      // Parc des Princes
    refereeId: 5,    // Clement Turpin
    minutesAgo: 340, // ~5.6 hours ago -> FT
    homeRoster: PSG_ROSTER,
    awayRoster: REAL_MADRID_ROSTER,
    events: [
      { time: 12, teamId: 4, playerName: "Bradley Barcola", type: "Goal", detail: "Normal Goal", assistName: "Ousmane Dembele" },
      { time: 24, teamId: 2, playerName: "Kylian Mbappe", type: "Goal", detail: "Normal Goal", assistName: "Vinicius Junior" },
      { time: 29, teamId: 4, playerName: "Nuno Mendes", type: "Card", detail: "Yellow Card" },
      { time: 48, teamId: 4, playerName: "Ousmane Dembele", type: "Goal", detail: "Curler", assistName: "Vitinha" },
      { time: 54, teamId: 2, playerName: "Antonio Rudiger", type: "Card", detail: "Yellow Card" },
      { time: 62, teamId: 2, playerName: "Federico Valverde", type: "Substitution", assistName: "Luka Modric" },
      { time: 69, teamId: 2, playerName: "Vinicius Junior", type: "Goal", detail: "Normal Goal", assistName: "Jude Bellingham" },
      { time: 71, teamId: 4, playerName: "Bradley Barcola", type: "Substitution", assistName: "Randal Kolo Muani" },
      { time: 85, teamId: 2, playerName: "Rodrygo", type: "Goal", detail: "Volley", assistName: "Luka Modric" },
    ],
  },

  // 6. Inter Milan vs AC Milan (2 - 1) — Derby della Madonnina
  {
    fixtureId: 88006,
    tournamentName: "Serie A",
    homeTeamId: 11,  // Inter Milan
    awayTeamId: 5,   // AC Milan
    venueId: 5,      // San Siro
    refereeId: 6,    // Daniele Orsato
    minutesAgo: 380, // ~6.3 hours ago -> FT
    homeRoster: INTER_ROSTER,
    awayRoster: AC_MILAN_ROSTER,
    events: [
      { time: 22, teamId: 11, playerName: "Lautaro Martinez", type: "Goal", detail: "Normal Goal", assistName: "Marcus Thuram" },
      { time: 30, teamId: 5, playerName: "Theo Hernandez", type: "Card", detail: "Yellow Card" },
      { time: 45, teamId: 11, playerName: "Alessandro Bastoni", type: "Card", detail: "Yellow Card" },
      { time: 54, teamId: 5, playerName: "Christian Pulisic", type: "Goal", detail: "Curler", assistName: "Rafael Leao" },
      { time: 67, teamId: 5, playerName: "Alvaro Morata", type: "Substitution", assistName: "Tammy Abraham" },
      { time: 74, teamId: 11, playerName: "Henrikh Mkhitaryan", type: "Substitution", assistName: "Davide Frattesi" },
      { time: 77, teamId: 11, playerName: "Marcus Thuram", type: "Goal", detail: "Header", assistName: "Nicolo Barella" },
      { time: 88, teamId: 11, playerName: "Hakan Calhanoglu", type: "Card", detail: "Yellow Card" },
    ],
  },
];

// Helper: Upsert player and return PlayerID
async function getOrCreatePlayer(name: string, pos: string, photo?: string, rating?: number): Promise<number> {
  const existing = await pool.query(
    `SELECT PlayerID FROM Player WHERE LOWER(TRIM(Name)) = LOWER(TRIM($1)) ORDER BY PlayerID ASC LIMIT 1`,
    [name.trim()]
  );
  if (existing.rows.length > 0) {
    const pid = existing.rows[0].playerid;
    await pool.query(
      `UPDATE Player SET Position = COALESCE(Position, $2), Photo = COALESCE(Photo, $3), OverallRating = COALESCE($4, OverallRating) WHERE PlayerID = $1`,
      [pid, pos, photo ?? null, rating ?? null]
    );
    return pid;
  }
  const ins = await pool.query(
    `INSERT INTO Player (Name, Position, Photo, OverallRating) VALUES ($1, $2, $3, $4) RETURNING PlayerID`,
    [name.trim(), pos, photo ?? null, rating ?? 7.5]
  );
  return ins.rows[0].playerid;
}

async function getOrCreateTournament(name: string): Promise<number> {
  const existing = await pool.query(
    `SELECT TournamentID FROM Tournament WHERE LOWER(Name) = LOWER($1) AND Type = 'Club' ORDER BY TournamentID LIMIT 1`,
    [name]
  );
  if (existing.rows.length > 0) {
    return Number(existing.rows[0].tournamentid);
  }
  const ins = await pool.query(
    `INSERT INTO Tournament (Name, Type, Edition) VALUES ($1, 'Club', '2024/2025') RETURNING TournamentID`,
    [name]
  );
  return Number(ins.rows[0].tournamentid);
}

export async function seedHighVoltageMatches() {
  console.log("=================================================");
  console.log("SEEDING HIGH VOLTAGE & FAMOUS MATCHES (FULL TIME)");
  console.log("=================================================\n");

  for (const m of HIGH_VOLTAGE_MATCHES) {
    console.log(`Processing Match Fixture ID ${m.fixtureId}: Team ${m.homeTeamId} vs Team ${m.awayTeamId}...`);

    // 0. Resolve Tournament ID
    const tournamentId = await getOrCreateTournament(m.tournamentName);

    // Count expected home and away goals
    const expectedHomeGoals = m.events.filter(e => e.type === "Goal" && e.teamId === m.homeTeamId).length;
    const expectedAwayGoals = m.events.filter(e => e.type === "Goal" && e.teamId === m.awayTeamId).length;

    // 1. Calculate match date today in the past (so it's guaranteed to be FT)
    const matchDate = new Date(Date.now() - m.minutesAgo * 60000);

    // 2. Upsert Match record
    const existing = await pool.query(`SELECT MatchID FROM Match WHERE ApiFixtureID = $1`, [m.fixtureId]);
    let dbMatchId: number;
    if (existing.rows.length > 0) {
      dbMatchId = Number(existing.rows[0].matchid);
      await pool.query(
        `UPDATE Match SET
           TournamentID = $2, HomeTeamID = $3, AwayTeamID = $4,
           VenueID = $5, MatchDate = $6, HomeGoals = $7, AwayGoals = $8
         WHERE MatchID = $1`,
        [dbMatchId, tournamentId, m.homeTeamId, m.awayTeamId, m.venueId, matchDate, expectedHomeGoals, expectedAwayGoals]
      );
    } else {
      const matchRes = await pool.query(
        `INSERT INTO Match (ApiFixtureID, TournamentID, HomeTeamID, AwayTeamID, VenueID, MatchDate, HomeGoals, AwayGoals)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING MatchID`,
        [m.fixtureId, tournamentId, m.homeTeamId, m.awayTeamId, m.venueId, matchDate, expectedHomeGoals, expectedAwayGoals]
      );
      dbMatchId = Number(matchRes.rows[0].matchid);
    }

    // 3. Link Referee
    await pool.query(
      `INSERT INTO MatchOfficiating (MatchID, RefereeID, Role, Status)
       VALUES ($1, $2, 'Main', 'Confirmed')
       ON CONFLICT (MatchID, RefereeID, Role) DO NOTHING`,
      [dbMatchId, m.refereeId]
    );

    // 4. Lineups & Coaches for both teams
    await pool.query(`DELETE FROM Lineup WHERE MatchID = $1`, [dbMatchId]);
    const rosters = [
      { r: m.homeRoster, teamId: m.homeTeamId },
      { r: m.awayRoster, teamId: m.awayTeamId },
    ];

    for (const { r, teamId } of rosters) {
      // Coach
      await pool.query(
        `INSERT INTO TeamMatchCoach (MatchID, TeamID, CoachName, CoachPhoto)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (MatchID, TeamID) DO UPDATE SET
           CoachName = EXCLUDED.CoachName,
           CoachPhoto = EXCLUDED.CoachPhoto`,
        [dbMatchId, teamId, r.coachName, r.coachPhoto]
      );

      // Starters
      for (const p of r.starters) {
        const pid = await getOrCreatePlayer(p.name, p.pos, p.photo, p.rating);
        await pool.query(
          `INSERT INTO Lineup (MatchID, TeamID, PlayerID, Status, Formation, Position, JerseyNumber)
           VALUES ($1, $2, $3, 'Starter', $4, $5, $6)
           ON CONFLICT (MatchID, TeamID, PlayerID) DO UPDATE SET
             Status = EXCLUDED.Status,
             Formation = EXCLUDED.Formation,
             Position = EXCLUDED.Position,
             JerseyNumber = EXCLUDED.JerseyNumber`,
          [dbMatchId, teamId, pid, r.formation, p.pos, p.num]
        );

        // Player Match Stat
        await pool.query(
          `INSERT INTO PlayerMatchStat (PlayerID, MatchID, MinutesPlayed, Rating)
           VALUES ($1, $2, 90, $3)
           ON CONFLICT (PlayerID, MatchID) DO UPDATE SET
             MinutesPlayed = EXCLUDED.MinutesPlayed,
             Rating = EXCLUDED.Rating`,
          [pid, dbMatchId, p.rating ?? 7.5]
        );
      }

      // Substitutes
      for (const p of r.subs) {
        const pid = await getOrCreatePlayer(p.name, p.pos, p.photo, p.rating);
        await pool.query(
          `INSERT INTO Lineup (MatchID, TeamID, PlayerID, Status, Formation, Position, JerseyNumber)
           VALUES ($1, $2, $3, 'Sub', $4, $5, $6)
           ON CONFLICT (MatchID, TeamID, PlayerID) DO UPDATE SET
             Status = EXCLUDED.Status,
             Formation = EXCLUDED.Formation,
             Position = EXCLUDED.Position,
             JerseyNumber = EXCLUDED.JerseyNumber`,
          [dbMatchId, teamId, pid, r.formation, p.pos, p.num]
        );
      }
    }

    // 5. Clean up old events for this match before re-inserting
    await pool.query(`DELETE FROM Goal WHERE EventID IN (SELECT EventID FROM Event WHERE MatchID = $1)`, [dbMatchId]);
    await pool.query(`DELETE FROM Card WHERE EventID IN (SELECT EventID FROM Event WHERE MatchID = $1)`, [dbMatchId]);
    await pool.query(`DELETE FROM Substitution WHERE EventID IN (SELECT EventID FROM Event WHERE MatchID = $1)`, [dbMatchId]);
    await pool.query(`DELETE FROM Event WHERE MatchID = $1`, [dbMatchId]);

    // 6. Insert Events, Goals, Cards, Substitutions
    for (const ev of m.events) {
      const pid = await getOrCreatePlayer(ev.playerName, "M");

      let assistPid: number | null = null;
      if (ev.assistName) {
        assistPid = await getOrCreatePlayer(ev.assistName, "M");
      }

      const evRes = await pool.query(
        `INSERT INTO Event (MatchID, PlayerID, TeamID, EventTime, EventType)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING EventID`,
        [dbMatchId, pid, ev.teamId, ev.time, ev.type]
      );
      const evId = Number(evRes.rows[0].eventid);

      if (ev.type === "Goal") {
        await pool.query(
          `INSERT INTO Goal (EventID, AssistPlayerID, GoalType)
           VALUES ($1, $2, $3)
           ON CONFLICT (EventID) DO UPDATE SET
             AssistPlayerID = EXCLUDED.AssistPlayerID,
             GoalType = EXCLUDED.GoalType`,
          [evId, assistPid, ev.detail ?? "Normal Goal"]
        );

        // Update player match stats for goals & assists
        await pool.query(
          `UPDATE PlayerMatchStat SET Goals = Goals + 1 WHERE PlayerID = $1 AND MatchID = $2`,
          [pid, dbMatchId]
        );
        if (assistPid) {
          await pool.query(
            `UPDATE PlayerMatchStat SET Assists = Assists + 1 WHERE PlayerID = $1 AND MatchID = $2`,
            [assistPid, dbMatchId]
          );
        }
      } else if (ev.type === "Card") {
        const cardType = (ev.detail ?? "").toLowerCase().includes("red") ? "Red" : "Yellow";
        await pool.query(
          `INSERT INTO Card (EventID, CardType)
           VALUES ($1, $2)
           ON CONFLICT (EventID) DO UPDATE SET CardType = EXCLUDED.CardType`,
          [evId, cardType]
        );
      } else if (ev.type === "Substitution" && assistPid) {
        await pool.query(
          `INSERT INTO Substitution (EventID, InPlayerID)
           VALUES ($1, $2)
           ON CONFLICT (EventID) DO UPDATE SET InPlayerID = EXCLUDED.InPlayerID`,
          [evId, assistPid]
        );
      }
    }

    // Double check scoreline matches expected
    await pool.query(
      `UPDATE Match SET HomeGoals = $1, AwayGoals = $2 WHERE MatchID = $3`,
      [expectedHomeGoals, expectedAwayGoals, dbMatchId]
    );

    console.log(`  -> Match ${m.fixtureId} seeded successfully: Score ${expectedHomeGoals} - ${expectedAwayGoals} (Full Time).`);
  }

  // Synchronize sequences
  await pool.query(`SELECT setval(pg_get_serial_sequence('Player', 'playerid'), COALESCE(MAX(PlayerID), 1)) FROM Player`);
  await pool.query(`SELECT setval(pg_get_serial_sequence('Match', 'matchid'), COALESCE(MAX(MatchID), 1)) FROM Match`);
  await pool.query(`SELECT setval(pg_get_serial_sequence('Event', 'eventid'), COALESCE(MAX(EventID), 1)) FROM Event`);

  console.log("\nAll 6 high-voltage matches seeded with full squads, coaches, events, and stats!");
}

if (require.main === module) {
  seedHighVoltageMatches()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("Error seeding high-voltage matches:", err);
      await pool.end();
      process.exit(1);
    });
}
