/*
  Seed initial player rosters per team (positions randomized for now).
  Usage:
    - Ensure MongoDB is running and backend/.env has MONGODB_URI
    - Run: node backend/scripts/seed-players.js
*/

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Team = require('../models/Team');
const Player = require('../models/Player');

dotenv.config({ path: require('path').join(__dirname, '..', '.env') });

const POSITIONS = ['GK', 'DF', 'MF', 'ATT'];
const randomPos = () => POSITIONS[Math.floor(Math.random() * POSITIONS.length)];

// Roster from your attachment (prices ignored, positions randomized)
const roster = {
  Warriors: [
    'Madiba Ray','Bamba','Nana Kofi','Project','Bryan','Em','Iramorl','Rayman','Kwesi','Kwei','Kuuichi','Rodney','JP','Nana Kwame','River','Vincent','Christian','Nana Breyna','Solid','Kodo','Aaron Gyan','Azar Gyan'
  ],
  Falcons: [
    'Ojo (the Activist)','Alex','Narh','Obeng','Alphonso','Chris','Remy','Leslie','Isaac','FJ','Marc-Oliver','Kofi','Fred','Wisdom','David Dare','Joshua','Nana Yaw','Aaron','Steven','Bediako','Pinto','Emmanuel'
  ],
  Lions: [
    'Keli','Kwaky e','Aaron','Akakpo','Danny','Obaka','Malcom','Kester','Jesse','Wumpini','Setornam','Mubarak','Nii Kpakpo Abrahams','Gerald Heymann','Jerome','Leroy','Benjamin Amechi','Gaisie','Barima','Serge','Joel','Benaiah'
  ],
  Elites: [
    'Nkansah','Cheicks','Henry','Joshua','Tonton','Billgate','Terence','Abiks','Yasin','Stanley Bambara','Deji','Durmas','Quist Osmond','Robbie G','Charles','Tanimu','Latif'
  ],
  Vikings: [
    'KBAM','Sodja','Asare','Olives','Brookman','Spinks','Twum','Makue','Papa Opoku','Yael','David Addy','Andy Hayibor','Issek','Manasseh','Ankama JNR','Alvin','Christopher','Terrance','Osman','Mancini'
  ],
  Dragons: [
    'Ariel','Sniffer','Philippe','Andrew','Ankama','Humphrey Chizoba','Jason Addo','Melvin','Joey','Nasser','Warren','Jamal','Santino','Nana Kwaku','Kumi','Theodore','Israel','Abeku','Rhyndolf','Thomas','PB','Shaun','Wunthya'
  ]
};

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/league-scheduler';
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to DB');

  const teamDocs = await Team.find({ name: { $in: Object.keys(roster) } }).lean();
  const teamMap = {};
  for (const t of teamDocs) teamMap[t.name] = t._id;

  // Create any missing teams? We skip to avoid conflicts.
  const missingTeams = Object.keys(roster).filter(name => !teamMap[name]);
  if (missingTeams.length) {
    console.warn('Missing teams (not creating now):', missingTeams);
  }

  const inserts = [];
  for (const [teamName, players] of Object.entries(roster)) {
    const teamId = teamMap[teamName];
    if (!teamId) continue;
    for (const name of players) {
      inserts.push({ name, number: null, position: randomPos(), team: teamId });
    }
  }

  // Remove existing players for these teams to avoid duplicates
  const teamIds = Object.values(teamMap);
  await Player.deleteMany({ team: { $in: teamIds } });
  console.log('Cleared existing players for teams:', Object.keys(teamMap));

  const created = await Player.insertMany(inserts);
  console.log(`Inserted ${created.length} players.`);

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
