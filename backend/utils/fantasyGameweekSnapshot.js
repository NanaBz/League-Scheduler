const FantasySquad = require('../models/FantasySquad');
const FantasyDraftSquad = require('../models/FantasyDraftSquad');
const { countSquadSlots } = require('./fantasySquadFromSnapshot');
const { resolvePriorLineupForSquad } = require('./fantasyLineupRestore');

/** Persist current pick-team selection for a gameweek (updated until GW is locked). */
async function upsertGameweekSnapshot(fantasyUserId, matchweek, { slots, lineupPayload, chipUsed }) {
  const mw = Number(matchweek);
  
  // Validate matchweek to prevent null/undefined records
  if (!Number.isFinite(mw) || mw < 1) {
    return { ok: false, message: `Invalid matchweek: ${matchweek}` };
  }
  
  const existing = await FantasySquad.findOne({ fantasyUser: fantasyUserId, matchweek: mw }).lean();

  if (existing?.isLocked) {
    return { ok: false, message: `Gameweek ${mw} is locked — team cannot be changed.` };
  }

  const doc = await FantasySquad.findOneAndUpdate(
    { fantasyUser: fantasyUserId, matchweek: mw },
    {
      fantasyUser: fantasyUserId,
      matchweek: mw,
      squadSlots: slots,
      lineup: lineupPayload,
      chipUsed: chipUsed || null,
      isLocked: false,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return { ok: true, doc };
}

/** Copy saved draft lineups into GW snapshots where missing (e.g. before snapshot feature existed). */
async function backfillMissingSnapshotsForGameweek(matchweek) {
  const mw = Number(matchweek);
  
  // Validate matchweek to prevent null/undefined operations
  if (!Number.isFinite(mw) || mw < 1) {
    console.warn(`backfillMissingSnapshotsForGameweek: Invalid matchweek ${matchweek}`);
    return 0;
  }
  
  const drafts = await FantasyDraftSquad.find({ slots: { $ne: null } }).lean();
  let created = 0;

  for (const draft of drafts) {
    const existing = await FantasySquad.findOne({ fantasyUser: draft.fantasyUser, matchweek: mw }).lean();
    if (existing?.isLocked || existing?.lineup) continue;

    let lineupPayload = draft.lineup;
    if (!lineupPayload && countSquadSlots(draft.slots) === 13) {
      lineupPayload = await resolvePriorLineupForSquad(draft.fantasyUser, mw, draft.slots);
    }
    if (!lineupPayload) continue;

    const result = await upsertGameweekSnapshot(draft.fantasyUser, mw, {
      slots: draft.slots,
      lineupPayload,
      chipUsed: lineupPayload?.chipUsed || null,
    });
    if (result.ok) created += 1;
  }

  return created;
}

module.exports = { upsertGameweekSnapshot, backfillMissingSnapshotsForGameweek };
