/**
 * Full fantasy reset — deletes all fantasy accounts and live gameplay state.
 * Does NOT touch ACPL teams, players, matches, playerstats, seasons, or admins.
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." node scripts/reset-fantasy-full.js --confirm=RESET_ALL_FANTASY
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { resetFantasyFull } = require('../utils/resetFantasyFull');

const CONFIRM_TOKEN = 'RESET_ALL_FANTASY';

async function main() {
  const confirmArg = process.argv.find((a) => a.startsWith('--confirm='));
  const confirm = confirmArg ? confirmArg.split('=')[1] : process.argv[2];

  if (confirm !== CONFIRM_TOKEN) {
    console.error(`Refusing to run without confirmation token: ${CONFIRM_TOKEN}`);
    console.error('Example: node scripts/reset-fantasy-full.js --confirm=RESET_ALL_FANTASY');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB:', mongoose.connection.name);

  const beforeUsers = await mongoose.connection.db.collection('fantasyusers').countDocuments();
  console.log('Fantasy users before reset:', beforeUsers);

  const result = await resetFantasyFull({ deleteUsers: true });
  console.log('\nFantasy full reset complete:');
  console.log(JSON.stringify(result, null, 2));

  const afterUsers = await mongoose.connection.db.collection('fantasyusers').countDocuments();
  console.log('\nFantasy users after reset:', afterUsers);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
