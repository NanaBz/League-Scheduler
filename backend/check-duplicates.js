const mongoose = require('mongoose');
const Player = require('./models/Player');

mongoose.connect('mongodb://localhost:27017/league-manager')
  .then(async () => {
    console.log('Connected to DB');
    
    const total = await Player.countDocuments({});
    console.log('Total players:', total);
    
    // Find duplicates by name and team
    const duplicates = await Player.aggregate([
      {
        $group: {
          _id: { name: '$name', team: '$team' },
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]);
    
    console.log('\nDuplicate players (same name + team):');
    console.log(JSON.stringify(duplicates, null, 2));
    
    // Sample first 20 players
    const sample = await Player.find({}).populate('team', 'name').limit(20).lean();
    console.log('\nSample of first 20 players:');
    sample.forEach(p => {
      console.log(`- ${p.name} (${p.position}) | Team: ${p.team?.name || 'No team'} | Price: ${p.fantasyPrice || 'N/A'}m`);
    });
    
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
