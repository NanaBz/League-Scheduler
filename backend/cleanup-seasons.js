const mongoose = require('mongoose');
const Season = require('./models/Season');

async function clearDuplicates() {
  try {
    await mongoose.connect('mongodb://localhost:27017/leaguedb');
    console.log('✅ Connected to MongoDB');
    
    // Get current seasons
    const seasons = await Season.find();
    console.log(`📊 Found ${seasons.length} seasons in database`);
    
    if (seasons.length > 0) {
      console.log('Season numbers:', seasons.map(s => s.seasonNumber));
      
      // Delete ALL seasons to start fresh and avoid duplicates
      const result = await Season.deleteMany({});
      console.log(`🗑️  Deleted ${result.deletedCount} seasons`);
    }
    
    console.log('✨ Database cleared. You can now reset seasons without duplicate errors.');
    
    await mongoose.disconnect();
    console.log('📴 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
  }
}

clearDuplicates();
