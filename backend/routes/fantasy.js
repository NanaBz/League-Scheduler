const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Player = require('../models/Player');
const Match = require('../models/Match');
const Team = require('../models/Team');
const FantasyDraftSquad = require('../models/FantasyDraftSquad');
const FantasySquad = require('../models/FantasySquad');
const FantasyUser = require('../models/FantasyUser');
const { authenticateFantasyUser } = require('../middleware/fantasyAuth');
const { getPrimaryActiveSeasonNumber } = require('../utils/seasonContext');
const { FANTASY_MATCH_COMPETITION } = require('../utils/fantasyLeagueScope');
const {
  deriveCurrentGameweekFromMatches,
  deriveGameweekInfoFromMatches,
  leagueHasFinishedMatches,
} = require('../utils/fantasyGameweek');
const FantasyMatchweek = require('../models/FantasyMatchweek');
const { buildOverallLeagueEntries } = require('../utils/fantasyOverallLeague');
const { buildCupResponse } = require('../utils/fantasyAcityCup');
const { buildDashboardSummary } = require('../utils/fantasyDashboardSummary');
const { buildManagerProfilePayload } = require('../utils/fantasyManagerProfile');
const { nextFixturesForTeam } = require('../utils/fantasyPlayerFixtures');
const { loadPlayerStatsMaps, attachPlayerStats, statsForPlayer } = require('../utils/fantasyPlayerStats');
const { validateMaxPlayersPerClubFromPlayers } = require('../utils/fantasySquadValidation');
const { validateLineupPayload, resolveDefaultCaptainRoles } = require('../utils/fantasyLineup');
const { lineupWithResolvedCaptains } = require('../utils/fantasyCaptainRoles');
const {
  getFantasyChipState,
  setActiveChip,
  syncChipFromLineupSave,
  loadChipHistory,
} = require('../utils/fantasyChipState');
const {
  getTransferStateForUser,
  getTransferCostForGameweek,
} = require('../utils/fantasyFreeTransfers');
const { recordGameweekTransfers, mergeTransferInOrder } = require('../utils/fantasyTransferTracking');
const { latestCompletedMatchweek, isMatchweekComplete } = require('../utils/fantasyMatchweek');
const { upsertGameweekSnapshot } = require('../utils/fantasyGameweekSnapshot');
const {
  playerPointsByMatchweek,
  scoreLineupFromSnapshot,
  hydrateLineupPlayers,
} = require('../utils/fantasyScoring');

const EMPTY_SLOTS = {
  GK: [null, null],
  DF: [null, null, null, null],
  MF: [null, null, null, null],
  ATT: [null, null, null],
};

const SLOT_LENGTHS = { GK: 2, DF: 4, MF: 4, ATT: 3 };

function normalizeSlotIds(raw) {
  const out = {};
  for (const pos of Object.keys(SLOT_LENGTHS)) {
    const src = Array.isArray(raw?.[pos]) ? raw[pos] : [];
    out[pos] = Array.from({ length: SLOT_LENGTHS[pos] }, (_, i) => {
      const v = src[i];
      if (v == null || v === '') return null;
      if (typeof v === 'object') {
        const id = v._id || v.id;
        if (id) return String(id);
        return null;
      }
      const s = String(v).trim();
      if (!s || s === '[object Object]') return null;
      return s;
    });
  }
  return out;
}

function slotsEqual(a, b) {
  return JSON.stringify(normalizeSlotIds(a)) === JSON.stringify(normalizeSlotIds(b));
}

async function hydrateSquadSlots(slots) {
  const ids = Object.values(slots)
    .flat()
    .filter(Boolean)
    .map((id) => {
      try {
        return new mongoose.Types.ObjectId(id);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const players = ids.length
    ? await Player.find({ _id: { $in: ids } })
        .populate('team', 'name logo competition category')
        .lean()
    : [];

  const leagueMatches = await Match.find({
    competition: FANTASY_MATCH_COMPETITION,
    isPublished: true,
    isVoided: { $ne: true },
  })
    .populate('homeTeam', 'name')
    .populate('awayTeam', 'name')
    .lean();

  const currentGameweek = deriveCurrentGameweekFromMatches(leagueMatches);

  const byId = new Map(players.map((p) => [p._id.toString(), p]));
  const statsMaps = await loadPlayerStatsMaps();
  const hydrated = {};
  for (const [pos, arr] of Object.entries(slots)) {
    hydrated[pos] = arr.map((id) => {
      if (!id) return null;
      const player = byId.get(String(id));
      if (!player) return null;
      const teamId = player.team?._id || player.team;
      return attachPlayerStats(
        {
          ...player,
          nextThree: nextFixturesForTeam(leagueMatches, teamId, {
            fromMatchweek: currentGameweek,
            limit: 3,
          }),
        },
        statsMaps
      );
    });
  }
  return hydrated;
}

async function validateSlotPlayers(slots) {
  const ids = [...new Set(Object.values(slots).flat().filter(Boolean))];
  if (ids.length === 0) return { ok: true };

  const objectIds = [];
  for (const id of ids) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { ok: false, message: `Invalid player id: ${id}` };
    }
    objectIds.push(new mongoose.Types.ObjectId(id));
  }

  const players = await Player.find({ _id: { $in: objectIds } })
    .select('_id position team')
    .populate('team', 'name')
    .lean();
  const byId = new Map(players.map((p) => [p._id.toString(), p]));

  for (const [pos, arr] of Object.entries(slots)) {
    for (const id of arr) {
      if (!id) continue;
      const player = byId.get(String(id));
      if (!player) {
        return { ok: false, message: 'One or more players were not found.' };
      }
      if (player.position !== pos) {
        return { ok: false, message: `${player.position} player cannot be placed in ${pos} slot.` };
      }
    }
  }

  const clubCheck = validateMaxPlayersPerClubFromPlayers(byId, ids);
  if (!clubCheck.ok) {
    return clubCheck;
  }

  return { ok: true };
}

async function loadLeagueMatchesForFantasy() {
  return Match.find({
    competition: FANTASY_MATCH_COMPETITION,
    isPublished: true,
  })
    .select('matchweek isPlayed matchState isVoided date time competition isPublished')
    .lean();
}

async function deadlineGuard(res) {
  const matches = await loadLeagueMatchesForFantasy();
  const currentGameweek = deriveCurrentGameweekFromMatches(matches);
  try {
    const seasonNumber = await getActiveSeasonNumber();
    const mwDoc = await FantasyMatchweek.findOne({ seasonNumber, matchweek: currentGameweek }).lean();
    if (mwDoc?.deadline) {
      const deadline = new Date(mwDoc.deadline);
      if (deadline && new Date() >= deadline) {
        res.status(403).json({
          success: false,
          message: 'The gameweek deadline has passed. Transfers and team changes are locked until the next gameweek.',
          deadlinePassed: true,
          deadline,
        });
        return false;
      }
      return true;
    }
  } catch (e) {
    console.error('Error loading fantasy matchweek deadline:', e.message || e);
  }

  // Fallback: derive deadline from fixtures (legacy behaviour)
  const { deadline } = deriveGameweekInfoFromMatches(matches);
  if (deadline && new Date() > new Date(deadline)) {
    res.status(403).json({
      success: false,
      message: 'The gameweek deadline has passed. Transfers and team changes are locked until the next gameweek.',
      deadlinePassed: true,
      deadline,
    });
    return false;
  }
  return true;
}

async function getActiveSeasonNumber() {
  return getPrimaryActiveSeasonNumber();
}

// GET /fantasy/season — current gameweek derived from published league fixtures
router.get('/season', async (req, res) => {
  try {
    const matches = await Match.find({
      competition: FANTASY_MATCH_COMPETITION,
      isPublished: true,
    })
      .select('matchweek isPlayed matchState isVoided date time competition')
      .lean();

    const currentGameweek = deriveCurrentGameweekFromMatches(matches);
    const preseason = !leagueHasFinishedMatches(matches);

    // Try to return admin-configured deadline/status for the current MW
    let deadline = null;
    let status = null;
    try {
      const seasonNumber = await getActiveSeasonNumber();
      const mwDoc = await FantasyMatchweek.findOne({ seasonNumber, matchweek: currentGameweek }).lean();
      if (mwDoc) {
        deadline = mwDoc.deadline || null;
        status = mwDoc.status || null;
      } else {
        const info = deriveGameweekInfoFromMatches(matches);
        deadline = info.deadline || null;
      }
    } catch (e) {
      const info = deriveGameweekInfoFromMatches(matches);
      deadline = info.deadline || null;
    }

    return res.json({
      success: true,
      currentGameweek,
      deadline,
      status,
      preseason,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /fantasy/cup — Acity Cup bracket (auto-init after MW5, resolves ties as GWs complete)
router.get('/cup', async (req, res) => {
  try {
    const seasonNumber = (await getActiveSeasonNumber()) ?? 1;
    const matches = await loadLeagueMatchesForFantasy();
    const cup = await buildCupResponse(seasonNumber, matches);
    return res.json({ success: true, seasonNumber, ...cup });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /fantasy/overall-league — registered managers only (no mock teams)
router.get('/overall-league', async (req, res) => {
  try {
    const result = await buildOverallLeagueEntries();
    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /fantasy/dashboard-summary — Average / Points / Highest for latest completed GW
router.get('/dashboard-summary', authenticateFantasyUser, async (req, res) => {
  try {
    const summary = await buildDashboardSummary(req.fantasyUser._id);
    return res.json({ success: true, ...summary });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /fantasy/manager-profile — current season summary + archived FPL season history
router.get('/manager-profile', authenticateFantasyUser, async (req, res) => {
  try {
    const profile = await buildManagerProfilePayload(req.fantasyUser._id);
    return res.json({ success: true, ...profile });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Players listing with filters and next three matches
// GET /fantasy/players?position=DF&minPrice=4.0&maxPrice=5.0&teams=ID1,ID2&search=name
router.get('/players', async (req, res) => {
  try {
    const { position, minPrice, maxPrice, teams, search } = req.query;
    const filter = {};
    if (position) filter.position = position;
    if (minPrice || maxPrice) filter.fantasyPrice = {};
    if (minPrice) filter.fantasyPrice.$gte = parseFloat(minPrice);
    if (maxPrice) filter.fantasyPrice.$lte = parseFloat(maxPrice);

    const leagueTeamIds = await Team.find({
      competition: FANTASY_MATCH_COMPETITION,
      category: 'boys',
    }).distinct('_id');
    const allowed = new Set(leagueTeamIds.map((id) => id.toString()));

    if (teams) {
      const teamIds = (teams.split(',') || []).filter(Boolean).map(id => {
        try { return new mongoose.Types.ObjectId(id); } catch { return null; }
      }).filter(Boolean).filter((id) => allowed.has(id.toString()));
      if (teamIds.length > 0) filter.team = { $in: teamIds };
      else filter.team = { $in: [] };
    } else {
      filter.team = { $in: leagueTeamIds };
    }

    if (search) filter.name = { $regex: new RegExp(search, 'i') };

    const [players, leagueMatches, statsMaps] = await Promise.all([
      Player.find(filter).populate('team', 'name logo competition category').lean(),
      Match.find({
        competition: FANTASY_MATCH_COMPETITION,
        isPublished: true,
        isVoided: { $ne: true },
      })
        .populate('homeTeam', 'name')
        .populate('awayTeam', 'name')
        .lean(),
      loadPlayerStatsMaps(),
    ]);

    const currentGameweek = deriveCurrentGameweekFromMatches(leagueMatches);

    const result = [];
    for (const p of players) {
      if (!p.team || !p.team._id) continue;

      const upcoming = nextFixturesForTeam(leagueMatches, p.team._id, {
        fromMatchweek: currentGameweek,
        limit: 3,
      });

      if (upcoming.length === 0) continue;

      const { totalPoints, selectionPercentage } = statsForPlayer(p._id, statsMaps);

      result.push({
        _id: p._id,
        name: p.name,
        number: p.number,
        position: p.position,
        team: p.team,
        fantasyPrice: p.fantasyPrice,
        selectionPercentage,
        totalPoints,
        nextThree: upcoming,
      });
    }

    res.json({ players: result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

function hydrateLineupFromSquad(lineupRaw, squad) {
  if (!lineupRaw) return null;
  const byId = new Map();
  for (const arr of Object.values(squad || {})) {
    for (const p of arr || []) {
      if (p?._id) byId.set(String(p._id), p);
    }
  }
  const mapId = (id) => (id ? byId.get(String(id)) || null : null);
  const starters = lineupRaw.starters || {};
  return {
    formation: lineupRaw.formation,
    starters: {
      gk: (starters.gk || []).map(mapId),
      df: (starters.df || []).map(mapId),
      mf: (starters.mf || []).map(mapId),
      att: (starters.att || []).map(mapId),
    },
    bench: (lineupRaw.bench || []).map(mapId),
    captainId: lineupRaw.captainId ? String(lineupRaw.captainId) : null,
    viceCaptainId: lineupRaw.viceCaptainId ? String(lineupRaw.viceCaptainId) : null,
    chipUsed: lineupRaw.chipUsed || null,
  };
}

function squadIdsFromSlots(slots) {
  return Object.values(slots || {})
    .flat()
    .filter(Boolean)
    .map(String);
}

async function resolveDraftSlots(fantasyUserId, doc, currentGameweek) {
  let slots = normalizeSlotIds(doc?.slots || EMPTY_SLOTS);
  let squadPlayerCount = squadIdsFromSlots(slots).length;

  if (squadPlayerCount >= 13) {
    return { slots, squadPlayerCount };
  }

  const { slotsFromGameweekSnapshot } = require('../utils/fantasySquadFromSnapshot');
  const priorSnaps = await FantasySquad.find({
    fantasyUser: fantasyUserId,
    matchweek: { $lte: Number(currentGameweek) || 99 },
    chipUsed: { $ne: 'FH' },
  })
    .sort({ matchweek: -1 })
    .select('squadSlots lineup matchweek')
    .lean();

  for (const snap of priorSnaps) {
    const fromSnap = await slotsFromGameweekSnapshot(snap);
    if (fromSnap && squadIdsFromSlots(fromSnap).length === 13) {
      slots = normalizeSlotIds(fromSnap);
      squadPlayerCount = 13;
      if (doc?._id) {
        await FantasyDraftSquad.findOneAndUpdate({ _id: doc._id }, { $set: { slots } });
      }
      break;
    }
  }

  return { slots, squadPlayerCount };
}

// GET /fantasy/my-squad — authenticated user's draft squad (13 slots)
router.get('/my-squad', authenticateFantasyUser, async (req, res) => {
  try {
    const matches = await loadLeagueMatchesForFantasy();
    const currentGameweek = deriveCurrentGameweekFromMatches(matches);

    const chipState = await getFantasyChipState(req.fantasyUser._id, currentGameweek, matches);
    const doc = await FantasyDraftSquad.findOne({ fantasyUser: req.fantasyUser._id }).lean();
    const { slots, squadPlayerCount } = await resolveDraftSlots(
      req.fantasyUser._id,
      doc,
      currentGameweek
    );
    const squad = await hydrateSquadSlots(slots);
    const lineup = hydrateLineupFromSquad(doc?.lineup, squad);
    const transferInOrder = (doc?.transferInOrder || []).map(String);
    const transferState = await getTransferStateForUser(
      req.fantasyUser._id,
      currentGameweek,
      chipState
    );

    return res.json({
      success: true,
      squad,
      lineup,
      transferInOrder,
      chipState,
      squadPlayerCount,
      transferState,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /fantasy/my-squad — save draft squad for authenticated user
router.put('/my-squad', authenticateFantasyUser, async (req, res) => {
  try {
    if (!(await deadlineGuard(res))) return;

    const slots = normalizeSlotIds(req.body?.squad || req.body?.slots);
    const validation = await validateSlotPlayers(slots);
    if (!validation.ok) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    const existing = await FantasyDraftSquad.findOne({ fantasyUser: req.fantasyUser._id }).lean();
    const incomingCount = squadIdsFromSlots(slots).length;
    const existingCount = squadIdsFromSlots(normalizeSlotIds(existing?.slots || EMPTY_SLOTS)).length;
    const matches = await loadLeagueMatchesForFantasy();
    const currentGameweek = deriveCurrentGameweekFromMatches(matches);

    if (incomingCount === 0 && existingCount >= 13) {
      return res.status(400).json({
        success: false,
        message: 'Cannot save an empty squad over your existing 13-player squad.',
      });
    }
    if (currentGameweek > 1 && incomingCount > 0 && incomingCount < 13) {
      return res.status(400).json({
        success: false,
        message: 'Save all 13 players before updating your squad.',
      });
    }

    const squadChanged = !existing?.slots || !slotsEqual(existing.slots, slots);

    const oldIds = new Set(squadIdsFromSlots(normalizeSlotIds(existing?.slots || EMPTY_SLOTS)));
    const newIds = squadIdsFromSlots(slots);
    const newIdSet = new Set(newIds);
    const transfersIn = newIds.filter((id) => !oldIds.has(id));
    const transfersOut = [...oldIds].filter((id) => !newIdSet.has(id));
    const transferInOrder = mergeTransferInOrder(existing?.transferInOrder, transfersIn);

    const update = { fantasyUser: req.fantasyUser._id, slots, transferInOrder };
    if (squadChanged) {
      update.lineup = null;
    }

    const doc = await FantasyDraftSquad.findOneAndUpdate(
      { fantasyUser: req.fantasyUser._id },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    if (squadChanged && currentGameweek > 1) {
      await recordGameweekTransfers(req.fantasyUser._id, currentGameweek, transfersIn, transfersOut);
    }

    const squad = await hydrateSquadSlots(normalizeSlotIds(doc.slots));
    const lineup = squadChanged ? null : hydrateLineupFromSquad(doc.lineup, squad);
    const chipState = await getFantasyChipState(req.fantasyUser._id, currentGameweek, matches);
    const squadPlayerCount = squadIdsFromSlots(normalizeSlotIds(doc.slots)).length;
    const transferState = await getTransferStateForUser(
      req.fantasyUser._id,
      currentGameweek,
      chipState
    );
    return res.json({
      success: true,
      squad,
      lineup,
      transferInOrder: (doc.transferInOrder || []).map(String),
      chipState,
      squadPlayerCount,
      transferState,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /fantasy/my-lineup — save pick team (9 starters + 4 bench)
router.put('/my-lineup', authenticateFantasyUser, async (req, res) => {
  try {
    if (!(await deadlineGuard(res))) return;

    const doc = await FantasyDraftSquad.findOne({ fantasyUser: req.fantasyUser._id }).lean();
    if (!doc?.slots) {
      return res.status(400).json({ success: false, message: 'Complete your 13-player squad in Transfers first.' });
    }
    const slots = normalizeSlotIds(doc.slots);
    const squadIds = squadIdsFromSlots(slots);
    if (squadIds.length !== 13) {
      return res.status(400).json({ success: false, message: 'You need 13 players in Transfers before picking a team.' });
    }

    const transferInOrder = doc.transferInOrder?.length
      ? doc.transferInOrder
      : squadIds;

    const validation = validateLineupPayload(req.body?.lineup || req.body, squadIds);
    if (!validation.ok) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    const defaults = resolveDefaultCaptainRoles(validation.normalized, transferInOrder);
    const normalizedLineup = {
      ...validation.normalized,
      captainId: validation.normalized.captainId || defaults.captainId,
      viceCaptainId: validation.normalized.viceCaptainId || defaults.viceCaptainId,
    };

    const matches = await loadLeagueMatchesForFantasy();
    const currentGameweek = deriveCurrentGameweekFromMatches(matches);
    let chipUsed = req.body?.lineup?.chipUsed ?? req.body?.chipUsed ?? null;
    if (!chipUsed && doc?.activeChip && doc.activeChipGameweek === currentGameweek) {
      chipUsed = doc.activeChip;
    }

    const lineupWithChip = { ...normalizedLineup, chipUsed: chipUsed || null };

    const updated = await FantasyDraftSquad.findOneAndUpdate(
      { fantasyUser: req.fantasyUser._id },
      {
        lineup: lineupWithChip,
        ...(!doc.transferInOrder?.length ? { transferInOrder: squadIds } : {}),
      },
      { new: true }
    ).lean();

    if (chipUsed) {
      await syncChipFromLineupSave(req.fantasyUser._id, currentGameweek, chipUsed, updated);
    }

    const snapshot = await upsertGameweekSnapshot(req.fantasyUser._id, currentGameweek, {
      slots,
      lineupPayload: lineupWithChip,
      chipUsed,
    });
    if (!snapshot.ok) {
      return res.status(400).json({ success: false, message: snapshot.message });
    }

    const squad = await hydrateSquadSlots(slots);
    const lineup = hydrateLineupFromSquad(updated.lineup, squad);
    const chipState = await getFantasyChipState(req.fantasyUser._id, currentGameweek, matches);
    return res.json({ success: true, lineup, gameweek: currentGameweek, chipState });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /fantasy/my-chip — activate or cancel a chip for the current gameweek
router.put('/my-chip', authenticateFantasyUser, async (req, res) => {
  try {
    if (!(await deadlineGuard(res))) return;

    const chip = req.body?.chip ?? req.body?.chipId ?? null;
    const matches = await loadLeagueMatchesForFantasy();
    const currentGameweek = deriveCurrentGameweekFromMatches(matches);

    const result = await setActiveChip(req.fantasyUser._id, chip, currentGameweek, matches);
    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.message });
    }

    return res.json({ success: true, chipState: result.chipState });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /fantasy/my-chips — authenticated user's chip usage history across all gameweeks
router.get('/my-chips', authenticateFantasyUser, async (req, res) => {
  try {
    const matches = await loadLeagueMatchesForFantasy();
    const currentGameweek = deriveCurrentGameweekFromMatches(matches);
    const chipHistory = await loadChipHistory(req.fantasyUser._id);
    const chipState = await getFantasyChipState(req.fantasyUser._id, currentGameweek, matches);

    return res.json({
      success: true,
      chipHistory,
      chipState,
      usedChips: Object.values(chipHistory).reduce((acc, chip) => {
        if (!acc.includes(chip)) acc.push(chip);
        return acc;
      }, []),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /fantasy/managers/:fantasyUserId/team-view — GW-gated view of another manager's team
router.get('/managers/:fantasyUserId/team-view', authenticateFantasyUser, async (req, res) => {
  try {
    const targetId = req.params.fantasyUserId;
    const requestedGw = req.query.gameweek ? Number(req.query.gameweek) : null;

    const targetUser = await FantasyUser.findById(targetId).select('teamName managerName').lean();
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Manager not found.' });
    }

    const matches = await loadLeagueMatchesForFantasy();
    const currentGameweek = deriveCurrentGameweekFromMatches(matches);
    const latestCompleted = latestCompletedMatchweek(matches);
    const isSelf = String(req.fantasyUser._id) === String(targetId);

    let viewGameweek = requestedGw || latestCompleted || null;
    if (!viewGameweek) {
      return res.json({
        success: true,
        viewable: false,
        message: 'No completed gameweeks yet — teams become visible after a gameweek finishes.',
        currentGameweek,
        latestCompletedGameweek: latestCompleted,
        team: { team: targetUser.teamName, user: targetUser.managerName, fantasyUserId: String(targetId) },
      });
    }

    if (!isSelf && viewGameweek > latestCompleted) {
      return res.json({
        success: true,
        viewable: false,
        message: `Gameweek ${viewGameweek} is not complete yet. You can view teams after all fixtures in a gameweek finish.`,
        currentGameweek,
        latestCompletedGameweek: latestCompleted,
        requestedGameweek: viewGameweek,
        team: { team: targetUser.teamName, user: targetUser.managerName, fantasyUserId: String(targetId) },
      });
    }

    const gwDoc = await FantasySquad.findOne({ fantasyUser: targetId, matchweek: viewGameweek }).lean();
    if (!gwDoc?.lineup) {
      return res.json({
        success: true,
        viewable: false,
        message: `No saved team found for Gameweek ${viewGameweek}.`,
        currentGameweek,
        latestCompletedGameweek: latestCompleted,
        gameweek: viewGameweek,
        team: { team: targetUser.teamName, user: targetUser.managerName, fantasyUserId: String(targetId) },
      });
    }

    const hydrated = await hydrateLineupPlayers(gwDoc.lineup);
    const resolvedRaw = await lineupWithResolvedCaptains(gwDoc.lineup, targetId);
    const playerPoints = await playerPointsByMatchweek(viewGameweek);
    const scored = scoreLineupFromSnapshot(hydrated, playerPoints, {
      captainId: resolvedRaw.captainId,
      viceCaptainId: resolvedRaw.viceCaptainId,
      chipUsed: gwDoc.chipUsed,
    });

    const transferHitPoints =
      gwDoc.transferHitPoints ?? (await getTransferCostForGameweek(targetId, viewGameweek));
    const rawPoints = scored.total;
    const netPoints = Math.max(0, rawPoints - transferHitPoints);

    const benchPoints = (scored.display.bench || []).reduce((s, p) => s + (p.points || 0), 0);
    const starterPoints = rawPoints - benchPoints;

    return res.json({
      success: true,
      viewable: true,
      gameweek: viewGameweek,
      currentGameweek,
      latestCompletedGameweek: latestCompleted,
      points: netPoints,
      rawPoints,
      transferHitPoints,
      starterPoints,
      benchPoints,
      chipUsed: gwDoc.chipUsed || null,
      team: {
        team: targetUser.teamName,
        user: targetUser.managerName,
        fantasyUserId: String(targetId),
      },
      lineup: scored.display,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;