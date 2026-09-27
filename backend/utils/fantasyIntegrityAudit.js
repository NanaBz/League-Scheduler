const FantasyMatchPerformance = require('../models/FantasyMatchPerformance');
const FantasySquad = require('../models/FantasySquad');
const FantasyUser = require('../models/FantasyUser');
const { runGameweekRescore } = require('./fantasyRescoreGameweek');

async function findDuplicatePerformances() {
  return FantasyMatchPerformance.aggregate([
    {
      $group: {
        _id: { match: '$match', player: '$player' },
        count: { $sum: 1 },
        ids: { $push: '$_id' },
        totalPoints: { $push: '$totalPoints' },
        matchweek: { $first: '$matchweek' },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
  ]);
}

async function findDuplicateSquads() {
  return FantasySquad.aggregate([
    {
      $group: {
        _id: { fantasyUser: '$fantasyUser', matchweek: '$matchweek' },
        count: { $sum: 1 },
        ids: { $push: '$_id' },
        points: { $push: '$points' },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
  ]);
}

async function summarizeManagerTotals(fantasyUserId) {
  const squads = await FantasySquad.find({ fantasyUser: fantasyUserId })
    .select('matchweek points transferHitPoints updatedAt')
    .sort({ matchweek: 1 })
    .lean();
  const storedTotal = squads.reduce((sum, row) => sum + (row.points || 0), 0);
  return { squads, storedTotal };
}

/**
 * Keep the newest squad snapshot per (user, matchweek); delete older duplicates.
 */
async function repairDuplicateSquads(dryRun = true) {
  const duplicates = await findDuplicateSquads();
  const actions = [];

  for (const row of duplicates) {
    const ids = row.ids.map(String);
    const docs = await FantasySquad.find({ _id: { $in: ids } })
      .select('_id updatedAt points matchweek fantasyUser')
      .sort({ updatedAt: -1 })
      .lean();
    if (docs.length < 2) continue;
    const [canonical, ...toRemove] = docs;
    actions.push({
      fantasyUser: String(row._id.fantasyUser),
      matchweek: row._id.matchweek,
      keepId: String(canonical._id),
      removeIds: toRemove.map((d) => String(d._id)),
    });
    if (!dryRun) {
      await FantasySquad.deleteMany({ _id: { $in: toRemove.map((d) => d._id) } });
    }
  }

  return { duplicateGroups: duplicates.length, actions, dryRun };
}

async function buildIntegrityAuditReport() {
  const [duplicatePerformances, duplicateSquads, userCount] = await Promise.all([
    findDuplicatePerformances(),
    findDuplicateSquads(),
    FantasyUser.countDocuments({}),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    fantasyUserCount: userCount,
    duplicatePerformanceGroups: duplicatePerformances.length,
    duplicatePerformanceRows: duplicatePerformances,
    duplicateSquadGroups: duplicateSquads.length,
    duplicateSquadRows: duplicateSquads,
  };
}

async function recalculateGameweeks(matchweeks) {
  const results = [];
  for (const mw of matchweeks) {
    results.push(await runGameweekRescore(mw, { forceAutosubRecalc: true }));
  }
  return results;
}

module.exports = {
  findDuplicatePerformances,
  findDuplicateSquads,
  summarizeManagerTotals,
  repairDuplicateSquads,
  buildIntegrityAuditReport,
  recalculateGameweeks,
};
