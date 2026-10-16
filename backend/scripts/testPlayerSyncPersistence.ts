import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { initializeDatabase, pool } from "../src/db";
import { upsertApiPlayer } from "../src/services/footballService";

async function main() {
  const providerId = 1_000_000_000 + randomInt(1_000_000);
  const name = `KickOff sync persistence check ${providerId}`;
  try {
    await initializeDatabase();
    const collision = await pool.query("SELECT 1 FROM Player WHERE ApiPlayerID = $1", [providerId]);
    assert.equal(collision.rowCount, 0, "the test provider ID is unused");

    const firstId = await upsertApiPlayer({ id: providerId, name, pos: "Midfielder", photo: null,
      apiTeamId: 91_001, apiLeagueId: 91_002 });
    const [secondId, concurrentId] = await Promise.all([
      upsertApiPlayer({ id: providerId, name: `${name} Updated`, pos: null, photo: null }),
      upsertApiPlayer({ id: providerId, name, pos: null, photo: null }),
    ]);
    assert.equal(secondId, firstId, "repeated provider sync reuses the same internal PlayerID");
    assert.equal(concurrentId, firstId, "concurrent syncs with one provider ID share the same internal PlayerID");

    const stored = await pool.query(`SELECT PlayerID, Name, Position, Photo, ApiPlayerID, ApiPlayerTeamID, ApiPlayerLeagueID
      FROM Player WHERE ApiPlayerID = $1`, [providerId]);
    assert.equal(stored.rowCount, 1, "repeated sync does not create duplicate player rows");
    assert.equal(Number(stored.rows[0].playerid), firstId);
    assert.equal(stored.rows[0].name, name, "a repeated sparse response does not overwrite the stored name");
    assert.equal(stored.rows[0].position, "Midfielder", "missing optional position does not erase stored data");
    assert.equal(stored.rows[0].photo, null, "no image is invented when the provider omits a photo");
    assert.equal(Number(stored.rows[0].apiplayerid), providerId);
    assert.equal(Number(stored.rows[0].apiplayerteamid), 91_001, "provider team context is persisted and sparse sync preserves it");
    assert.equal(Number(stored.rows[0].apiplayerleagueid), 91_002, "provider league context is persisted and sparse sync preserves it");
    console.log("Player sync persistence tests passed: provider ID/context mapping, idempotency, field preservation, and no fabricated photo.");
  } finally {
    await pool.query("DELETE FROM Player WHERE ApiPlayerID = $1", [providerId]);
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
