const FantasyDraftSquad = require('../models/FantasyDraftSquad');
const { resolveDefaultCaptainRoles } = require('./fantasyLineup');

function squadIdsFromSlots(slots) {
  if (!slots) return [];
  return Object.values(slots).flat().filter(Boolean).map(String);
}

async function getTransferInOrderForUser(fantasyUserId) {
  const draft = await FantasyDraftSquad.findOne({ fantasyUser: fantasyUserId })
    .select('transferInOrder slots')
    .lean();
  if (draft?.transferInOrder?.length) {
    return draft.transferInOrder.map(String);
  }
  return squadIdsFromSlots(draft?.slots);
}

/** Fill missing captain / vice-captain from transfer-in order (first two in starting XI). */
async function lineupWithResolvedCaptains(lineup, fantasyUserId) {
  if (!lineup) return lineup;
  if (lineup.captainId && lineup.viceCaptainId) return lineup;

  const order = await getTransferInOrderForUser(fantasyUserId);
  const roles = resolveDefaultCaptainRoles(lineup, order);
  return {
    ...lineup,
    captainId: lineup.captainId || roles.captainId,
    viceCaptainId: lineup.viceCaptainId || roles.viceCaptainId,
  };
}

module.exports = {
  getTransferInOrderForUser,
  lineupWithResolvedCaptains,
};
