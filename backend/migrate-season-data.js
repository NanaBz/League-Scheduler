const mongoose = require('mongoose');
const Season = require('./models/Season');
const Team = require('./models/Team');
const Match = require('./models/Match');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/league-scheduler');

const migrateSeasonData = async () => {
  try {
    console.log('🔄 Starting season data migration...');
    
    // Get all teams for reference
    const teams = await Team.find();
    const teamMap = {};
    teams.forEach(team => {
      teamMap[team._id.toString()] = {
        _id: team._id,
        name: team.name,
        logo: team.logo
      };
    });
    
    console.log(`📋 Found ${teams.length} teams:`, teams.map(t => t.name).join(', '));
    
    // Get all archived seasons
    const seasons = await Season.find();
    console.log(`📊 Found ${seasons.length} archived seasons`);
    
    for (const season of seasons) {
      console.log(`\n🔧 Migrating Season ${season.seasonNumber}...`);
      let updated = false;
      
      // Fix finalStandings if needed
      if (season.finalStandings && season.finalStandings.length > 0) {
        for (let i = 0; i < season.finalStandings.length; i++) {
          const standing = season.finalStandings[i];
          
          // Check if team is just an ObjectId string
          if (typeof standing.team === 'string' || standing.team instanceof mongoose.Types.ObjectId) {
            const teamId = standing.team.toString();
            if (teamMap[teamId]) {
              season.finalStandings[i].team = teamMap[teamId];
              updated = true;
              console.log(`  ✅ Fixed standing for ${teamMap[teamId].name}`);
            } else {
              // Fallback for missing team data
              const fallbackTeams = ['Warriors', 'Falcons', 'Lions', 'Vikings', 'Elites', 'Dragons'];
              season.finalStandings[i].team = {
                _id: standing.team,
                name: fallbackTeams[i] || `Team ${i + 1}`,
                logo: `/images/${(fallbackTeams[i] || 'default').toLowerCase()}-logo.png`
              };
              updated = true;
              console.log(`  🔧 Used fallback for position ${i + 1}: ${fallbackTeams[i] || `Team ${i + 1}`}`);
            }
          } else if (!standing.team.name) {
            // Team object exists but missing name/logo
            const teamId = standing.team._id?.toString();
            if (teamId && teamMap[teamId]) {
              season.finalStandings[i].team = teamMap[teamId];
              updated = true;
              console.log(`  🔄 Updated team data for ${teamMap[teamId].name}`);
            }
          }
        }
      }
      
      // Fix matches if needed
      if (season.matches && season.matches.length > 0) {
        for (let i = 0; i < season.matches.length; i++) {
          const match = season.matches[i];
          
          // Fix homeTeam
          if (typeof match.homeTeam === 'string' || match.homeTeam instanceof mongoose.Types.ObjectId) {
            const teamId = match.homeTeam.toString();
            if (teamMap[teamId]) {
              season.matches[i].homeTeam = teamMap[teamId];
              updated = true;
            }
          } else if (!match.homeTeam?.name) {
            const teamId = match.homeTeam?._id?.toString();
            if (teamId && teamMap[teamId]) {
              season.matches[i].homeTeam = teamMap[teamId];
              updated = true;
            }
          }
          
          // Fix awayTeam
          if (typeof match.awayTeam === 'string' || match.awayTeam instanceof mongoose.Types.ObjectId) {
            const teamId = match.awayTeam.toString();
            if (teamMap[teamId]) {
              season.matches[i].awayTeam = teamMap[teamId];
              updated = true;
            }
          } else if (!match.awayTeam?.name) {
            const teamId = match.awayTeam?._id?.toString();
            if (teamId && teamMap[teamId]) {
              season.matches[i].awayTeam = teamMap[teamId];
              updated = true;
            }
          }
        }
        console.log(`  📋 Processed ${season.matches.length} matches`);
      }
      
      // Fix winners if needed
      if (season.winners) {
        ['league', 'cup', 'superCup'].forEach(competition => {
          const winner = season.winners[competition];
          if (winner && (typeof winner === 'string' || winner instanceof mongoose.Types.ObjectId)) {
            const teamId = winner.toString();
            if (teamMap[teamId]) {
              season.winners[competition] = teamMap[teamId]._id; // Keep as ObjectId for populate to work
              updated = true;
              console.log(`  🏆 Fixed ${competition} winner: ${teamMap[teamId].name}`);
            }
          }
        });
      }
      
      // Save if updated
      if (updated) {
        await season.save();
        console.log(`  💾 Season ${season.seasonNumber} updated successfully!`);
      } else {
        console.log(`  ✅ Season ${season.seasonNumber} already has proper data format`);
      }
    }
    
    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run migration
migrateSeasonData();
