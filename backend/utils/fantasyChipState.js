const FantasyDraftSquad = require('../models/FantasyDraftSquad');
const FantasySquad = require('../models/FantasySquad');
const { isTransferChip, transferChipsAvailableForGameweek } = require('./fantasyChipsShared');

const TRANSFER_CHIPS = ['WC', 'FH'];
const ALL_CHIPS = ['WC', 'FH', 'BB', 'TC', 'DC'];

async function loadChipHistory(fantasyUserId) {
  const squads = await FantasySquad.find({ fantasyUser: fantasyUserId })
    .select('matchweek chipUsed')
    .lean()
    .sort({ matchweek: 1 });

  const chipHistory = {};
  for (const row of squads) {
    if (row.matchweek && row.chipUsed) {
      chipHistory[row.matchweek] = row.chipUsed;
    }
  }
  return chipHistory;
}

function chipUsedInSeason(chipHistory, chipId) {
  return Object.values(chipHistory || {}).includes(chipId);
}

/** Revert Free Hit squad after that gameweek has passed. */
async function reconcileFreeHitState(doc, currentGameweek) {
  if (!doc) return doc;

  const fhGw = doc.freeHitGameweek;
  if (!fhGw || fhGw >= currentGameweek) return doc;

  const updates = {
    freeHitGameweek: null,
    freeHitBaselineSlots: null,
  };

  if (doc.freeHitBaselineSlots) {
    updates.slots = doc.freeHitBaselineSlots;
    updates.lineup = null;
  }

  if (doc.activeChip === 'FH' && doc.activeChipGameweek === fhGw) {
    updates.activeChip = null;
    updates.activeChipGameweek = null;
  }

  return FantasyDraftSquad.findOneAndUpdate(
    { _id: doc._id },
    { $set: updates },
    { new: true }
  ).lean();
}

function resolveActiveChipForGameweek(doc, currentGameweek, chipHistory) {
  if (doc?.activeChip && doc.activeChipGameweek === currentGameweek) {
    return doc.activeChip;
  }
  if (doc?.lineup?.chipUsed && chipHistory[currentGameweek] === doc.lineup.chipUsed) {
    return doc.lineup.chipUsed;
  }
  if (chipHistory[currentGameweek]) {
    return chipHistory[currentGameweek];
  }
  if (doc?.lineup?.chipUsed && !chipHistory[currentGameweek]) {
    return doc.lineup.chipUsed;
  }
  return null;
}

function buildChipState(doc, currentGameweek, chipHistory) {
  const activeChip = resolveActiveChipForGameweek(doc, currentGameweek, chipHistory);
  const unlimitedTransfers =
    transferChipsAvailableForGameweek(currentGameweek) &&
    isTransferChip(activeChip) &&
    (doc?.activeChipGameweek === currentGameweek ||
      chipHistory[currentGameweek] === activeChip ||
      doc?.lineup?.chipUsed === activeChip);

  const used = {
    WC: chipUsedInSeason(chipHistory, 'WC'),
    FH: chipUsedInSeason(chipHistory, 'FH'),
    BB: chipUsedInSeason(chipHistory, 'BB'),
    TC: chipUsedInSeason(chipHistory, 'TC'),
    DC: chipUsedInSeason(chipHistory, 'DC'),
  };

  return {
    currentGameweek,
    activeChip,
    activeChipGameweek: doc?.activeChipGameweek ?? null,
    unlimitedTransfers,
    chipHistory,
    used,
    freeHitActive: activeChip === 'FH' && unlimitedTransfers,
    wildcardActive: activeChip === 'WC' && unlimitedTransfers,
  };
}

async function getFantasyChipState(fantasyUserId, currentGameweek) {
  let doc = await FantasyDraftSquad.findOne({ fantasyUser: fantasyUserId }).lean();
  doc = await reconcileFreeHitState(doc, currentGameweek);
  const chipHistory = await loadChipHistory(fantasyUserId);
  return buildChipState(doc, currentGameweek, chipHistory);
}

async function setActiveChip(fantasyUserId, chipId, currentGameweek) {
  if (!transferChipsAvailableForGameweek(currentGameweek) && isTransferChip(chipId)) {
    return { ok: false, message: 'Wildcard and Free Hit unlock from Gameweek 2.' };
  }

  const chipHistory = await loadChipHistory(fantasyUserId);
  let doc = await FantasyDraftSquad.findOne({ fantasyUser: fantasyUserId }).lean();

  if (!chipId) {
    if (!doc) return { ok: true, chipState: buildChipState(null, currentGameweek, chipHistory) };
    const update = { activeChip: null, activeChipGameweek: null };
    if (doc.activeChip === 'FH') {
      update.freeHitBaselineSlots = null;
      update.freeHitGameweek = null;
    }
    if (doc.lineup) {
      update.lineup = { ...doc.lineup, chipUsed: null };
    }
    doc = await FantasyDraftSquad.findOneAndUpdate(
      { fantasyUser: fantasyUserId },
      { $set: update },
      { new: true }
    ).lean();
    return { ok: true, chipState: buildChipState(doc, currentGameweek, chipHistory) };
  }

  if (!ALL_CHIPS.includes(chipId)) {
    return { ok: false, message: 'Unknown chip.' };
  }

  if (chipUsedInSeason(chipHistory, chipId)) {
    const alreadyThisGw =
      chipHistory[currentGameweek] === chipId ||
      (doc?.activeChip === chipId && doc?.activeChipGameweek === currentGameweek);
    if (!alreadyThisGw) {
      return { ok: false, message: 'This chip has already been used this season.' };
    }
  }

  const otherActive = doc?.activeChip && doc.activeChipGameweek === currentGameweek && doc.activeChip !== chipId;
  if (otherActive) {
    return { ok: false, message: 'Cancel your active chip before playing another.' };
  }

  const update = {
    activeChip: chipId,
    activeChipGameweek: currentGameweek,
  };

  if (chipId === 'FH') {
    if (!doc?.freeHitBaselineSlots || doc.freeHitGameweek !== currentGameweek) {
      update.freeHitBaselineSlots = doc?.slots || null;
      update.freeHitGameweek = currentGameweek;
    }
  } else if (doc?.activeChip === 'FH' && chipId !== 'FH') {
    update.freeHitBaselineSlots = null;
    update.freeHitGameweek = null;
  }

  if (doc?.lineup) {
    update.lineup = { ...doc.lineup, chipUsed: chipId };
  }

  doc = await FantasyDraftSquad.findOneAndUpdate(
    { fantasyUser: fantasyUserId },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return { ok: true, chipState: buildChipState(doc, currentGameweek, chipHistory) };
}

/** Sync draft active chip when pick-team is saved with a chip. */
async function syncChipFromLineupSave(fantasyUserId, currentGameweek, chipUsed, existingDoc) {
  if (!chipUsed) return existingDoc;

  const chipHistory = await loadChipHistory(fantasyUserId);
  if (chipUsedInSeason(chipHistory, chipUsed) && chipHistory[currentGameweek] !== chipUsed) {
    return existingDoc;
  }

  const update = {
    activeChip: chipUsed,
    activeChipGameweek: currentGameweek,
  };

  if (chipUsed === 'FH') {
    const doc = existingDoc || (await FantasyDraftSquad.findOne({ fantasyUser: fantasyUserId }).lean());
    if (!doc?.freeHitBaselineSlots || doc.freeHitGameweek !== currentGameweek) {
      update.freeHitBaselineSlots = doc?.slots || null;
      update.freeHitGameweek = currentGameweek;
    }
  }

  return FantasyDraftSquad.findOneAndUpdate(
    { fantasyUser: fantasyUserId },
    { $set: update },
    { new: true }
  ).lean();
}

module.exports = {
  loadChipHistory,
  reconcileFreeHitState,
  getFantasyChipState,
  setActiveChip,
  syncChipFromLineupSave,
  buildChipState,
  chipUsedInSeason,
};
