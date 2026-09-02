const FantasyUser = require('../models/FantasyUser');
const FantasyDraftSquad = require('../models/FantasyDraftSquad');
const FantasySquad = require('../models/FantasySquad');
const FantasyCup = require('../models/FantasyCup');
const FantasyCupTie = require('../models/FantasyCupTie');

/**
 * Delete a fantasy account while preserving historical season/archive integrity.
 *
 * Removes: FantasyUser, draft squad, gameweek snapshots, active cup participation.
 * Preserves: FantasyManagerSeasonResult, FantasyManagerAchievement, FantasyCupSeasonArchive,
 *            completed cup ties (resolved), match/player/fixture data.
 */
async function deleteFantasyAccount(fantasyUserId) {
  const userId = String(fantasyUserId);

  await Promise.all([
    FantasyDraftSquad.deleteOne({ fantasyUser: fantasyUserId }),
    FantasySquad.deleteMany({ fantasyUser: fantasyUserId }),
    FantasyCupTie.deleteMany({
      $or: [{ homeFantasyUser: fantasyUserId }, { awayFantasyUser: fantasyUserId }],
      resolved: { $ne: true },
    }),
  ]);

  const cups = await FantasyCup.find({
    $or: [
      { 'qualifiedTeams.fantasyUserId': fantasyUserId },
      { 'excludedTeams.fantasyUserId': fantasyUserId },
      { winnerFantasyUser: fantasyUserId },
    ],
  });

  for (const cup of cups) {
    cup.qualifiedTeams = (cup.qualifiedTeams || []).filter(
      (t) => String(t.fantasyUserId) !== userId
    );
    cup.excludedTeams = (cup.excludedTeams || []).filter(
      (t) => String(t.fantasyUserId) !== userId
    );
    if (cup.winnerFantasyUser && String(cup.winnerFantasyUser) === userId) {
      cup.winnerFantasyUser = null;
    }
    await cup.save();
  }

  await FantasyUser.deleteOne({ _id: fantasyUserId });

  return { deleted: true };
}

module.exports = { deleteFantasyAccount };
