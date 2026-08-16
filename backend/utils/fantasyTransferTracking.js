const FantasySquad = require('../models/FantasySquad');
const mongoose = require('mongoose');

function toObjectIds(ids) {
  return (ids || [])
    .map((id) => {
      try {
        return new mongoose.Types.ObjectId(String(id));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/** Record transfers on the gameweek snapshot (GW2+ only — GW1 is initial squad build). */
async function recordGameweekTransfers(fantasyUserId, matchweek, transfersIn, transfersOut) {
  const mw = Number(matchweek);
  if (mw < 2) return;

  const inIds = toObjectIds(transfersIn);
  const outIds = toObjectIds(transfersOut);
  if (!inIds.length && !outIds.length) return;

  const update = {
    $setOnInsert: { fantasyUser: fantasyUserId, matchweek: mw },
  };
  if (inIds.length || outIds.length) {
    update.$addToSet = {};
    if (inIds.length) update.$addToSet.transfersIn = { $each: inIds };
    if (outIds.length) update.$addToSet.transfersOut = { $each: outIds };
  }

  await FantasySquad.findOneAndUpdate(
    { fantasyUser: fantasyUserId, matchweek: mw },
    update,
    { upsert: true, new: true }
  );
}

function mergeTransferInOrder(existingOrder, addedIds) {
  const order = [...(existingOrder || [])].map(String);
  for (const id of addedIds || []) {
    const sid = String(id);
    if (!order.includes(sid)) order.push(sid);
  }
  return order;
}

module.exports = {
  recordGameweekTransfers,
  mergeTransferInOrder,
};
