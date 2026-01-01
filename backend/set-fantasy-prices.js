const mongoose = require('mongoose');
require('dotenv').config();
const Player = require('./models/Player');

const effectiveMongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/league-scheduler';

async function setFantasyPrices() {
  try {
    await mongoose.connect(effectiveMongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    const result = await Player.updateMany({}, { $set: { fantasyPrice: 4.5 } });
    console.log(`Updated ${result.modifiedCount} players out of ${result.matchedCount} matched`);

    // Verify
    const count = await Player.countDocuments({ fantasyPrice: 4.5 });
    console.log(`Total players with fantasyPrice 4.5: ${count}`);

    await mongoose.disconnect();
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

setFantasyPrices();
