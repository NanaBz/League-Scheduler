const mongoose = require('mongoose');
const FantasyDraftSquad = require('../models/FantasyDraftSquad');
const FantasySquad = require('../models/FantasySquad');
const { squadIdsFromSlots } = require('./fantasySquadFromSnapshot');
const { playerIdsFromLineup } = require('./fantasySquadFromSnapshot');

const SLOT_OR_FIELDS = ['GK', 'DF', 'MF', 'ATT'].flatMap((pos) => [
  `slots.${pos}`,
  `squadSlots.${pos}`,
]);

function toObjectId(playerId) {
  try {
    return new mongoose.Types.ObjectId(String(playerId));
  } catch {
    return null;
  }
}

async function playerReferencedInFantasySquads(playerId) {
  const oid = toObjectId(playerId);
  if (!oid) return false;

  const slotClauses = SLOT_OR_FIELDS.map((field) => ({ [field]: oid }));

  const [draftSlot, draftOrder, snapSlot, snapTransfers] = await Promise.all([
    FantasyDraftSquad.findOne({ $or: slotClauses }).select('_id').lean(),
    FantasyDraftSquad.findOne({ transferInOrder: oid }).select('_id').lean(),
    FantasySquad.findOne({ $or: slotClauses }).select('_id').lean(),
    FantasySquad.findOne({
      $or: [{ transfersIn: oid }, { transfersOut: oid }],
    })
      .select('_id')
      .lean(),
  ]);

  if (draftSlot || draftOrder || snapSlot || snapTransfers) {
    return true;
  }

  const lineupSquads = await FantasySquad.find({ lineup: { $ne: null } })
    .select('lineup squadSlots')
    .lean();

  const pid = String(playerId);
  for (const row of lineupSquads) {
    if (playerIdsFromLineup(row.lineup).includes(pid)) return true;
    if (row.squadSlots && squadIdsFromSlots(row.squadSlots).includes(pid)) return true;
  }

  return false;
}

module.exports = {
  playerReferencedInFantasySquads,
};
