const mongoose = require('mongoose');
const Player = require('./models/Player');
const Team = require('./models/Team');

mongoose.connect('mongodb://localhost:27017/league-manager')
  .then(async () => {
    console.log('Connected to DB\n');
    
    // Find all players with duplicate name+team combinations
    const duplicates = await Player.aggregate([
      {
        $group: {
          _id: { name: '$name', team: '$team' },
          count: { $sum: 1 },
          ids: { $push: '$_id' },
          docs: { $push: '$$ROOT' }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]);
    
    if (duplicates.length === 0) {
      console.log('✓ No duplicate players found!');
      mongoose.connection.close();
      return;
    }
    
    console.log(`Found ${duplicates.length} sets of duplicate players:\n`);
    
    let totalRemoved = 0;
    
    for (const dup of duplicates) {
      const teamDoc = await Team.findById(dup._id.team);
      console.log(`\nPlayer: ${dup._id.name} (Team: ${teamDoc?.name || 'Unknown'})`);
      console.log(`  Found ${dup.count} copies`);
      
      // Keep the first one (or the one with more data), remove the rest
      const toKeep = dup.docs[0];
      const toRemove = dup.ids.slice(1);
      
      console.log(`  Keeping ID: ${toKeep._id}`);
      console.log(`  Removing ${toRemove.length} duplicate(s): ${toRemove.join(', ')}`);
      
      // Remove duplicates
      const result = await Player.deleteMany({ _id: { $in: toRemove } });
      totalRemoved += result.deletedCount;
    }
    
    console.log(`\n✓ Cleanup complete! Removed ${totalRemoved} duplicate players.`);
    
    const finalCount = await Player.countDocuments({});
    console.log(`Total players remaining: ${finalCount}`);
    
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
