const FantasyDraftSquad = require('../models/FantasyDraftSquad');
const FantasySquad = require('../models/FantasySquad');
const Player = require('../models/Player');
const { isTransferChip, transferChipsAvailableForGameweek } = require('./fantasyChipsShared');
const { isMatchweekComplete } = require('./fantasyMatchweek');
const { upsertGameweekSnapshot } = require('./fantasyGameweekSnapshot');
const { resolvePriorLineupForSquad } = require('./fantasyLineupRestore');
const {
  buildMarketPricesMap,
  normalizePurchasePriceMap,
  resolveFinancialState,
} = require('./fantasySquadLedger');
const {
  countSquadSlots,
  squadIdsFromSlots,
  slotsFromGameweekSnapshot,
  slotsMatchPlayerSet,
} = require('./fantasySquadFromSnapshot');

const TRANSFER_CHIPS = ['WC', 'FH'];
const ALL_CHIPS = ['WC', 'FH', 'BB', 'TC', 'DC'];

function cloneSlots(slots) {
  if (!slots) return null;
  return JSON.parse(JSON.stringify(slots));
}

function clonePurchaseMap(map) {
  if (!map || typeof map !== 'object') return {};
  return normalizePurchasePriceMap(map);
}

async function loadMarketPricesForIds(playerIds) {
  const ids = [...new Set((playerIds || []).filter(Boolean).map(String))];
  if (!ids.length) return new Map();
  const players = await Player.find({ _id: { $in: ids } }).select('_id fantasyPrice').lean();
  return buildMarketPricesMap(players);
}

async function resolveDocFinancialState(doc, slots) {
  const playerIds = squadIdsFromSlots(slots || doc?.slots);
  const marketPricesById = await loadMarketPricesForIds(playerIds);
  return resolveFinancialState({
    bankBalance: doc?.bankBalance,
    playerPurchasePrices: doc?.playerPurchasePrices,
    playerIds,
    marketPricesById,
  });
}

function findFreeHitGameweekFromHistory(chipHistory, currentGameweek) {
  let latest = null;
  for (const [gw, chip] of Object.entries(chipHistory || {})) {
    const n = Number(gw);
    if (chip === 'FH' && n < Number(currentGameweek)) {
      if (latest === null || n > latest) latest = n;
    }
  }
  return latest;
}

function buildFreeHitFinancialRestoreFromBaseline(doc) {
  const updates = {};
  if (doc?.freeHitBaselineBankBalance != null) {
    updates.bankBalance = doc.freeHitBaselineBankBalance;
  }
  if (doc?.freeHitBaselinePurchasePrices) {
    updates.playerPurchasePrices = clonePurchaseMap(doc.freeHitBaselinePurchasePrices);
  }
  return updates;
}

async function loadSnapshotForGameweek(fantasyUserId, matchweek) {
  return FantasySquad.findOne({ fantasyUser: fantasyUserId, matchweek: Number(matchweek) })
    .select('squadSlots lineup chipUsed matchweek')
    .lean();
}

/** Squad to restore after Free Hit — GW before FH first (lineup or squadSlots), then baseline. */
async function resolveFreeHitRevertPayload(fantasyUserId, doc, fhGw) {
  const currentSlots = doc?.slots;

  const prevGwSnap = await loadSnapshotForGameweek(fantasyUserId, fhGw - 1);
  const prevSlots = await slotsFromGameweekSnapshot(prevGwSnap);
  if (prevSlots && countSquadSlots(prevSlots) === 13) {
    return { slots: cloneSlots(prevSlots), transferInOrder: null, source: `gw${fhGw - 1}` };
  }

  const priorSnaps = await FantasySquad.find({
    fantasyUser: fantasyUserId,
    matchweek: { $lt: fhGw },
    chipUsed: { $ne: 'FH' },
  })
    .sort({ matchweek: -1 })
    .select('squadSlots lineup chipUsed matchweek')
    .lean();

  for (const snap of priorSnaps) {
    const slots = await slotsFromGameweekSnapshot(snap);
    if (slots && countSquadSlots(slots) === 13) {
      if (!currentSlots || !slotsMatchPlayerSet(currentSlots, squadIdsFromSlots(slots))) {
        return { slots: cloneSlots(slots), transferInOrder: null, source: `gw${snap.matchweek}` };
      }
    }
  }

  const baseline = doc?.freeHitBaselineSlots;
  if (
    baseline &&
    countSquadSlots(baseline) === 13 &&
    (!currentSlots || !slotsMatchPlayerSet(currentSlots, squadIdsFromSlots(baseline)))
  ) {
    return {
      slots: cloneSlots(baseline),
      transferInOrder: doc.freeHitBaselineTransferInOrder?.length
        ? [...doc.freeHitBaselineTransferInOrder]
        : null,
      source: 'baseline',
    };
  }

  return { slots: null, transferInOrder: null, source: null };
}

async function captureFreeHitBaseline(fantasyUserId, doc, currentGameweek) {
  const prevGwSnap = await loadSnapshotForGameweek(fantasyUserId, currentGameweek - 1);
  const fromPrevGw = await slotsFromGameweekSnapshot(prevGwSnap);

  const slots =
    fromPrevGw && countSquadSlots(fromPrevGw) === 13
      ? cloneSlots(fromPrevGw)
      : cloneSlots(doc?.slots);

  const financial = await resolveDocFinancialState(doc, slots);

  return {
    freeHitBaselineSlots: slots,
    freeHitGameweek: currentGameweek,
    freeHitBaselineTransferInOrder: doc?.transferInOrder?.length
      ? [...doc.transferInOrder]
      : null,
    freeHitBaselineBankBalance: financial.bankBalance,
    freeHitBaselinePurchasePrices: clonePurchaseMap(financial.playerPurchasePrices),
  };
}

function freeHitGameweekHasPassed(fhGw, currentGameweek, matches) {
  if (!fhGw) return false;
  if (currentGameweek > fhGw) return true;
  if (matches?.length && isMatchweekComplete(matches, fhGw)) return true;
  return false;
}

/** Revert Free Hit squad after that gameweek has finished (FH only — WC is permanent). */
async function reconcileFreeHitState(doc, currentGameweek, fantasyUserId, matches = null) {
  if (!doc) return doc;

  const chipHistory = await loadChipHistory(fantasyUserId || doc.fantasyUser);
  const uid = fantasyUserId || doc.fantasyUser;
  const fhGw =
    doc.freeHitGameweek ||
    (doc.activeChip === 'FH' ? doc.activeChipGameweek : null) ||
    findFreeHitGameweekFromHistory(chipHistory, currentGameweek);

  if (!fhGw) return doc;
  if (!freeHitGameweekHasPassed(fhGw, currentGameweek, matches)) return doc;

  let revert = await resolveFreeHitRevertPayload(uid, doc, fhGw);
  if (!revert.slots) {
    revert = await resolveFreeHitRevertPayload(
      uid,
      { ...doc, slots: null, freeHitBaselineSlots: null },
      fhGw
    );
  }

  if (revert.slots) {
    const fhSnap = await loadSnapshotForGameweek(uid, fhGw);
    const fhSlots = fhSnap?.chipUsed === 'FH' ? await slotsFromGameweekSnapshot(fhSnap) : null;
    if (fhSlots && slotsMatchPlayerSet(revert.slots, squadIdsFromSlots(fhSlots))) {
      const retry = await resolveFreeHitRevertPayload(
        uid,
        { ...doc, slots: null, freeHitBaselineSlots: null },
        fhGw
      );
      if (retry.slots) revert = retry;
    }
  }

  const updates = {
    freeHitGameweek: null,
    freeHitBaselineSlots: null,
    freeHitBaselineTransferInOrder: null,
    freeHitBaselineBankBalance: null,
    freeHitBaselinePurchasePrices: null,
    lineup: null,
    freeHitRevertedFrom: revert.source || null,
  };

  if (revert.slots) {
    updates.slots = revert.slots;
    if (revert.transferInOrder?.length) {
      updates.transferInOrder = revert.transferInOrder;
    }

    const restoredLineup = await resolvePriorLineupForSquad(uid, fhGw, revert.slots);
    if (restoredLineup) {
      updates.lineup = restoredLineup;
    }
  } else {
    console.warn(
      `[fantasy] Free Hit revert found no squad for user ${uid} (FH GW${fhGw}, current GW${currentGameweek})`
    );
  }

  if (doc.freeHitBaselineBankBalance != null || doc.freeHitBaselinePurchasePrices) {
    Object.assign(updates, buildFreeHitFinancialRestoreFromBaseline(doc));
  }

  if (doc.activeChip === 'FH' && doc.activeChipGameweek === fhGw) {
    updates.activeChip = null;
    updates.activeChipGameweek = null;
  }

  const updated = await FantasyDraftSquad.findOneAndUpdate(
    { _id: doc._id },
    { $set: updates },
    { new: true }
  ).lean();

  if (revert.slots) {
    const existingGw = await FantasySquad.findOne({
      fantasyUser: uid,
      matchweek: Number(currentGameweek),
    })
      .select('lineup isLocked')
      .lean();

    if (!existingGw?.isLocked && !existingGw?.lineup) {
      await upsertGameweekSnapshot(uid, currentGameweek, {
        slots: revert.slots,
        lineupPayload: updates.lineup || null,
        chipUsed: null,
      });
    }
  }

  return updated;
}

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

function buildUsedGameweek(chipHistory) {
  const usedGameweek = {};
  for (const [gw, chip] of Object.entries(chipHistory || {})) {
    if (!chip) continue;
    const n = Number(gw);
    if (!usedGameweek[chip] || n < usedGameweek[chip]) {
      usedGameweek[chip] = n;
    }
  }
  return usedGameweek;
}

/** Finalize chips whose gameweek has passed — persist to GW snapshot and clear draft active chip. */
async function reconcileExpiredChipState(doc, currentGameweek, fantasyUserId, matches = null) {
  if (!doc?.activeChip || doc.activeChipGameweek == null) return doc;

  const chipGw = Number(doc.activeChipGameweek);
  const chipId = doc.activeChip;
  const gwPassed =
    Number(currentGameweek) > chipGw ||
    (matches?.length && isMatchweekComplete(matches, chipGw));

  if (!gwPassed) return doc;

  const uid = fantasyUserId || doc.fantasyUser;
  const existing = await FantasySquad.findOne({ fantasyUser: uid, matchweek: chipGw })
    .select('chipUsed isLocked')
    .lean();

  if (!existing?.chipUsed) {
    if (doc.slots) {
      await upsertGameweekSnapshot(uid, chipGw, {
        slots: doc.slots,
        lineupPayload: doc.lineup,
        chipUsed: chipId,
      });
    } else if (!existing) {
      await FantasySquad.findOneAndUpdate(
        { fantasyUser: uid, matchweek: chipGw },
        {
          $setOnInsert: { fantasyUser: uid, matchweek: chipGw },
          $set: { chipUsed: chipId },
        },
        { upsert: true }
      );
    } else if (!existing.isLocked) {
      await FantasySquad.updateOne(
        { fantasyUser: uid, matchweek: chipGw },
        { $set: { chipUsed: chipId } }
      );
    }
  }

  const updates = {
    activeChip: null,
    activeChipGameweek: null,
  };
  if (doc.lineup?.chipUsed === chipId) {
    updates.lineup = { ...doc.lineup, chipUsed: null };
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
  if (chipHistory[currentGameweek]) {
    return chipHistory[currentGameweek];
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
    usedGameweek: buildUsedGameweek(chipHistory),
    freeHitActive: activeChip === 'FH' && unlimitedTransfers,
    wildcardActive: activeChip === 'WC' && unlimitedTransfers,
    /** FH was played earlier this season but is not active now — trust server squad over cache. */
    freeHitExpired: chipUsedInSeason(chipHistory, 'FH') && !(activeChip === 'FH' && unlimitedTransfers),
  };
}

async function getFantasyChipState(fantasyUserId, currentGameweek, matches = null) {
  let doc = await FantasyDraftSquad.findOne({ fantasyUser: fantasyUserId }).lean();
  doc = await reconcileFreeHitState(doc, currentGameweek, fantasyUserId, matches);
  doc = await reconcileExpiredChipState(doc, currentGameweek, fantasyUserId, matches);
  const chipHistory = await loadChipHistory(fantasyUserId);
  return buildChipState(doc, currentGameweek, chipHistory);
}

async function setActiveChip(fantasyUserId, chipId, currentGameweek, matches = null) {
  if (!transferChipsAvailableForGameweek(currentGameweek) && isTransferChip(chipId)) {
    return { ok: false, message: 'Wildcard and Free Hit unlock from Gameweek 2.' };
  }

  const chipHistory = await loadChipHistory(fantasyUserId);
  let doc = await FantasyDraftSquad.findOne({ fantasyUser: fantasyUserId }).lean();
  doc = await reconcileFreeHitState(doc, currentGameweek, fantasyUserId, matches);
  doc = await reconcileExpiredChipState(doc, currentGameweek, fantasyUserId, matches);
  const refreshedHistory = await loadChipHistory(fantasyUserId);

  if (!chipId) {
    if (!doc) return { ok: true, chipState: buildChipState(null, currentGameweek, refreshedHistory) };
    const update = { activeChip: null, activeChipGameweek: null };
    if (doc.activeChip === 'FH') {
      if (doc.freeHitBaselineSlots) {
        update.slots = cloneSlots(doc.freeHitBaselineSlots);
      }
      if (doc.freeHitBaselineTransferInOrder?.length) {
        update.transferInOrder = [...doc.freeHitBaselineTransferInOrder];
      }
      if (doc.freeHitBaselineBankBalance != null || doc.freeHitBaselinePurchasePrices) {
        Object.assign(update, buildFreeHitFinancialRestoreFromBaseline(doc));
      }
      update.freeHitBaselineSlots = null;
      update.freeHitGameweek = null;
      update.freeHitBaselineTransferInOrder = null;
      update.freeHitBaselineBankBalance = null;
      update.freeHitBaselinePurchasePrices = null;
    }
    if (doc.lineup) {
      update.lineup = { ...doc.lineup, chipUsed: null };
    }
    doc = await FantasyDraftSquad.findOneAndUpdate(
      { fantasyUser: fantasyUserId },
      { $set: update },
      { new: true }
    ).lean();

    const gwSnap = await FantasySquad.findOne({
      fantasyUser: fantasyUserId,
      matchweek: currentGameweek,
      isLocked: { $ne: true },
    });
    if (gwSnap) {
      await FantasySquad.updateOne(
        { fantasyUser: fantasyUserId, matchweek: currentGameweek },
        { $set: { chipUsed: null } }
      );
    }

    const historyAfterCancel = await loadChipHistory(fantasyUserId);
    return { ok: true, chipState: buildChipState(doc, currentGameweek, historyAfterCancel) };
  }

  if (!ALL_CHIPS.includes(chipId)) {
    return { ok: false, message: 'Unknown chip.' };
  }

  if (chipUsedInSeason(refreshedHistory, chipId)) {
    const alreadyThisGw =
      refreshedHistory[currentGameweek] === chipId ||
      (doc?.activeChip === chipId && doc?.activeChipGameweek === currentGameweek);
    if (!alreadyThisGw) {
      return { ok: false, message: 'This chip has already been used this season.' };
    }
  }

  const otherActive = doc?.activeChip && doc.activeChipGameweek === currentGameweek && doc.activeChip !== chipId;
  if (otherActive) {
    return { ok: false, message: 'Cancel your active chip before playing another.' };
  }

  if (isTransferChip(chipId)) {
    if (!doc?.slots || countSquadSlots(doc.slots) < 13) {
      return {
        ok: false,
        message: 'Save your full 13-player squad in Transfers before playing Wildcard or Free Hit.',
      };
    }
  }

  const update = {
    activeChip: chipId,
    activeChipGameweek: currentGameweek,
  };

  if (chipId === 'FH') {
    if (!doc?.freeHitBaselineSlots || doc.freeHitGameweek !== currentGameweek) {
      Object.assign(update, await captureFreeHitBaseline(fantasyUserId, doc, currentGameweek));
    }
  } else if (doc?.activeChip === 'FH' && chipId !== 'FH') {
    update.freeHitBaselineSlots = null;
    update.freeHitGameweek = null;
    update.freeHitBaselineTransferInOrder = null;
    update.freeHitBaselineBankBalance = null;
    update.freeHitBaselinePurchasePrices = null;
  }

  if (doc?.lineup) {
    update.lineup = { ...doc.lineup, chipUsed: chipId };
  }

  if (!doc) {
    return { ok: false, message: 'Save your squad in Transfers before playing a chip.' };
  }

  doc = await FantasyDraftSquad.findOneAndUpdate(
    { fantasyUser: fantasyUserId },
    { $set: update },
    { new: true }
  ).lean();

  if (doc?.slots) {
    await upsertGameweekSnapshot(fantasyUserId, currentGameweek, {
      slots: doc.slots,
      lineupPayload: update.lineup || doc.lineup || null,
      chipUsed: chipId,
    });
  }

  const historyAfterActivate = await loadChipHistory(fantasyUserId);
  return { ok: true, chipState: buildChipState(doc, currentGameweek, historyAfterActivate) };
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
      Object.assign(update, await captureFreeHitBaseline(fantasyUserId, doc, currentGameweek));
    }
  }

  const doc = existingDoc || (await FantasyDraftSquad.findOne({ fantasyUser: fantasyUserId }).lean());
  if (doc?.lineup) {
    update.lineup = { ...doc.lineup, chipUsed };
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
  reconcileExpiredChipState,
  getFantasyChipState,
  setActiveChip,
  syncChipFromLineupSave,
  buildChipState,
  chipUsedInSeason,
  buildUsedGameweek,
  buildFreeHitFinancialRestoreFromBaseline,
  clonePurchaseMap,
};
