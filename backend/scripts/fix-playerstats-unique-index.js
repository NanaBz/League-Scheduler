/**
 * Drops the legacy unique index on (player, seasonNumber, competition) and ensures
 * the index includes team so transferred players can have one stats doc per club.
 *
 * Run once per database (local + production), from the backend folder:
 *   node scripts/fix-playerstats-unique-index.js
 *
 * Uses MONGODB_URI from backend/.env or defaults to local league-scheduler.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/league-scheduler';

const LEGACY_INDEX = 'player_1_seasonNumber_1_competition_1';
const NEW_KEYS = { player: 1, seasonNumber: 1, competition: 1, team: 1 };

async function main() {
  await mongoose.connect(URI);
  const coll = mongoose.connection.collection('playerstats');

  const before = await coll.indexes();
  console.log('Indexes before:', before.map((i) => i.name).join(', '));

  try {
    await coll.dropIndex(LEGACY_INDEX);
    console.log(`Dropped legacy index: ${LEGACY_INDEX}`);
  } catch (e) {
    if (e.code === 27 || e.codeName === 'IndexNotFound') {
      console.log(`Legacy index "${LEGACY_INDEX}" not found (already migrated or different name).`);
    } else {
      throw e;
    }
  }

  await coll.createIndex(NEW_KEYS, { unique: true });
  console.log('Ensured unique index:', JSON.stringify(NEW_KEYS));

  const after = await coll.indexes();
  console.log('Indexes after:', after.map((i) => i.name).join(', '));

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
