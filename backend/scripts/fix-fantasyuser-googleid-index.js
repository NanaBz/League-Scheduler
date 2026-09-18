/**
 * Fixes FantasyUser registration failing with E11000 when googleId is null/missing.
 *
 * Symptom: POST /register returns 409 "account exists" for brand-new emails, but
 * POST /login returns 404 for the same email (user was never saved).
 *
 * Cause: a non-sparse unique index on googleId only allows ONE document with null.
 *
 * Run against production (with care):
 *   node scripts/fix-fantasyuser-googleid-index.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const FantasyUser = require('../models/FantasyUser');

const GOOGLE_ID_INDEX = 'googleId_1';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const coll = FantasyUser.collection;

  const before = await coll.indexes();
  console.log('Indexes before:', JSON.stringify(before, null, 2));

  const total = await FantasyUser.countDocuments({});
  const withGoogleId = await FantasyUser.countDocuments({ googleId: { $type: 'string' } });
  const withNullGoogleId = await FantasyUser.countDocuments({ googleId: null });
  const withoutGoogleId = await FantasyUser.countDocuments({ googleId: { $exists: false } });

  console.log('\nFantasyUser counts:');
  console.log('  total:', total);
  console.log('  googleId string:', withGoogleId);
  console.log('  googleId null:', withNullGoogleId);
  console.log('  googleId missing:', withoutGoogleId);

  const unsetResult = await FantasyUser.updateMany(
    { $or: [{ googleId: null }, { googleId: '' }] },
    { $unset: { googleId: 1 } }
  );
  console.log('\nUnset null/empty googleId on documents:', unsetResult.modifiedCount);

  try {
    await coll.dropIndex(GOOGLE_ID_INDEX);
    console.log(`Dropped index: ${GOOGLE_ID_INDEX}`);
  } catch (err) {
    if (err.codeName === 'IndexNotFound') {
      console.log(`Index ${GOOGLE_ID_INDEX} not found (may use a different name).`);
    } else {
      throw err;
    }
  }

  await coll.createIndex({ googleId: 1 }, { unique: true, sparse: true, name: GOOGLE_ID_INDEX });
  console.log('Created sparse unique index on googleId');

  const after = await coll.indexes();
  console.log('\nIndexes after:', JSON.stringify(after, null, 2));

  await mongoose.disconnect();
  console.log('\nDone. Retry registration with a new email to confirm.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
