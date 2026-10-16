require("dotenv").config({ path: require("path").resolve(__dirname, "../.env"), quiet: true });
const { Pool } = require("pg");
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Name-only additions from Wikidata's CC0 structured data. Do not infer
// biographies, clubs, positions, statistics, or photos for these catalog rows.
const popularPlayerNames = [
  "Lionel Messi", "Cristiano Ronaldo", "Neymar", "Karim Benzema", "Luka Modric",
  "Antoine Griezmann", "Son Heung-min", "Sadio Mane", "Luis Suarez", "Sergio Ramos",
  "Zlatan Ibrahimovic", "Wayne Rooney", "Ronaldinho", "Zinedine Zidane", "Diego Maradona",
  "Pele", "Thierry Henry", "Andres Iniesta", "Xavi", "Iker Casillas", "Paolo Maldini",
  "David Beckham", "Didier Drogba", "Samuel Eto'o", "Kaka", "Andrea Pirlo", "Francesco Totti",
  "Johan Cruyff", "George Best", "Eusebio", "David Villa", "Robin van Persie", "Eden Hazard",
  "Gareth Bale", "Sergio Aguero", "Gerd Muller", "Rivaldo",
];

(async () => {
  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(4824, 1066)");
    for (const name of popularPlayerNames) {
      const result = await client.query(
        `INSERT INTO Player (Name)
         SELECT $1::varchar
         WHERE NOT EXISTS (
           SELECT 1 FROM Player WHERE LOWER(BTRIM(Name)) = LOWER(BTRIM($1::varchar))
         )
         RETURNING PlayerID`,
        [name],
      );
      inserted += result.rowCount || 0;
    }
    await client.query("COMMIT");
    console.log(`Player catalog additions committed: ${inserted} new, ${popularPlayerNames.length - inserted} already present.`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Player catalog seed failed:", error.code || error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
