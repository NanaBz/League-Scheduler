const mongoose = require('mongoose');
const Player = require('../models/Player');

const SLOT_LENGTHS = { GK: 2, DF: 4, MF: 4, ATT: 3 };

function squadIdsFromSlots(slots) {
  if (!slots) return [];
  return Object.values(slots).flat().filter(Boolean).map(String);
}

function countSquadSlots(slots) {
  return squadIdsFromSlots(slots).length;
}

function playerIdsFromLineup(lineup) {
  if (!lineup) return [];
  const s = lineup.starters || {};
  const ids = [
    ...(s.gk || []),
    ...(s.df || s.def || []),
    ...(s.mf || s.mid || []),
    ...(s.att || s.fwd || []),
    ...(Array.isArray(lineup.bench) ? lineup.bench : []),
  ]
    .filter(Boolean)
    .map((id) => String(typeof id === 'object' ? id._id || id.id : id));

  return [...new Set(ids)];
}

function slotsMatchPlayerSet(slots, playerIds) {
  const a = squadIdsFromSlots(slots).sort().join(',');
  const b = [...playerIds].sort().join(',');
  return a === b;
}

/** Build { GK, DF, MF, ATT } slot ids from a saved pick-team lineup payload. */
async function slotsFromLineup(lineup) {
  const ids = playerIdsFromLineup(lineup);
  if (ids.length < 13) return null;

  const objectIds = ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const players = await Player.find({ _id: { $in: objectIds } })
    .select('_id position')
    .lean();

  const byPos = { GK: [], DF: [], MF: [], ATT: [] };
  for (const p of players) {
    const pos = p.position;
    if (byPos[pos]) byPos[pos].push(String(p._id));
  }

  for (const [pos, need] of Object.entries(SLOT_LENGTHS)) {
    if (byPos[pos].length < need) return null;
  }

  const out = {};
  for (const [pos, need] of Object.entries(SLOT_LENGTHS)) {
    out[pos] = byPos[pos].slice(0, need);
  }
  return out;
}

async function slotsFromGameweekSnapshot(snapshot) {
  if (!snapshot) return null;

  if (snapshot.squadSlots && countSquadSlots(snapshot.squadSlots) === 13) {
    return JSON.parse(JSON.stringify(snapshot.squadSlots));
  }

  return slotsFromLineup(snapshot.lineup);
}

module.exports = {
  SLOT_LENGTHS,
  squadIdsFromSlots,
  countSquadSlots,
  playerIdsFromLineup,
  slotsMatchPlayerSet,
  slotsFromLineup,
  slotsFromGameweekSnapshot,
};
