const FantasyMatchPerformance = require('../models/FantasyMatchPerformance');
const FantasyDraftSquad = require('../models/FantasyDraftSquad');
const FantasyUser = require('../models/FantasyUser');

const SLOT_KEYS = ['GK', 'DF', 'MF', 'ATT', 'gk', 'df', 'mf', 'att'];

/** Sum stored fantasy performance points per player (authoritative scored totals). */
async function getPlayerTotalPointsMap() {
  const rows = await FantasyMatchPerformance.aggregate([
    { $group: { _id: '$player', total: { $sum: '$totalPoints' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), Number(r.total) || 0]));
}

function playerIdsFromDraftSlots(slots) {
  const ids = new Set();
  if (!slots || typeof slots !== 'object') return ids;
  for (const key of SLOT_KEYS) {
    const arr = slots[key];
    if (!Array.isArray(arr)) continue;
    for (const id of arr) {
      if (id) ids.add(String(id));
    }
  }
  return ids;
}

/** % of registered FPL managers who currently own the player in their draft squad. */
async function getPlayerSelectionPercentageMap() {
  const [drafts, totalManagers] = await Promise.all([
    FantasyDraftSquad.find({ slots: { $ne: null } }).select('slots').lean(),
    FantasyUser.countDocuments({}),
  ]);

  const ownerCounts = new Map();
  for (const draft of drafts) {
    for (const playerId of playerIdsFromDraftSlots(draft.slots)) {
      ownerCounts.set(playerId, (ownerCounts.get(playerId) || 0) + 1);
    }
  }

  const percentages = new Map();
  if (!totalManagers) {
    return percentages;
  }

  for (const [playerId, count] of ownerCounts.entries()) {
    const pct = (count / totalManagers) * 100;
    percentages.set(playerId, Math.round(pct * 10) / 10);
  }

  return percentages;
}

async function loadPlayerStatsMaps() {
  const [totalPointsMap, selectionPercentageMap] = await Promise.all([
    getPlayerTotalPointsMap(),
    getPlayerSelectionPercentageMap(),
  ]);
  return { totalPointsMap, selectionPercentageMap };
}

function statsForPlayer(playerId, maps) {
  const id = String(playerId);
  const totalPoints = maps.totalPointsMap.get(id) ?? 0;
  const selectionPercentage = maps.selectionPercentageMap.get(id) ?? 0;
  return { totalPoints, selectionPercentage };
}

function attachPlayerStats(player, maps) {
  if (!player || !player._id) return player;
  const { totalPoints, selectionPercentage } = statsForPlayer(player._id, maps);
  return {
    ...player,
    totalPoints,
    selectionPercentage,
  };
}

module.exports = {
  getPlayerTotalPointsMap,
  getPlayerSelectionPercentageMap,
  loadPlayerStatsMaps,
  statsForPlayer,
  attachPlayerStats,
};
