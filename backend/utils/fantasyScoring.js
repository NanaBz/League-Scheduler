const FantasyMatchPerformance = require('../models/FantasyMatchPerformance');
const FantasySquad = require('../models/FantasySquad');
const Player = require('../models/Player');
const { isMatchweekComplete } = require('./fantasyMatchweek');
const { lineupWithResolvedCaptains } = require('./fantasyCaptainRoles');
const { getTransferCostForGameweek } = require('./fantasyFreeTransfers');
const { resolveScoringCaptainId } = require('./fantasyCaptainScoring');
const {
  applyAutoSubstitutions,
  collectLineupPlayerIds,
} = require('./fantasyAutoSubstitutions');

/** Goal points by registered position (ATT 4, MF 5, DF 6, GK 10). */
function goalPointsPerGoal(position) {
  const p = String(position || '').toUpperCase();
  if (p === 'GK') return 10;
  if (p === 'DF') return 6;
  if (p === 'MF') return 5;
  if (p === 'ATT') return 4;
  return 4;
}

function goalPointsFromCount(goals, position) {
  return (goals || 0) * goalPointsPerGoal(position);
}

/** Appearance: 1–44 min = 1 pt, 45+ min = 2 pts. */
function calculateMinutesPoints(minutes) {
  const min = Number(minutes) || 0;
  if (min <= 0) return 0;
  if (min < 45) return 1;
  return 2;
}

function recalcPerformanceTotal(p, position) {
  const goals = p.goals || 0;
  const assists = p.assists || 0;
  const minutes = Number(p.minutesPlayed) || 0;
  const cs = minutes >= 45 ? (p.cleansheetPoints || 0) : 0;
  const ownGoals = p.ownGoals || 0;
  return (
    (p.minutesPoints || 0) +
    (p.bonusPoints || 0) +
    (p.specialPoints || 0) +
    cs +
    goalPointsFromCount(goals, position) +
    assists * 3 -
    ownGoals * 2 -
    (p.yellowCards || 0) -
    (p.redCards || 0) * 3
  );
}

async function recalcPerformanceTotalsForMatch(matchId) {
  const rows = await FantasyMatchPerformance.find({ match: matchId });
  if (!rows.length) return;

  const playerIds = rows.map((row) => row.player);
  const players = await Player.find({ _id: { $in: playerIds } }).select('position').lean();
  const positionByPlayer = new Map(players.map((pl) => [String(pl._id), pl.position]));

  for (const row of rows) {
    const position = positionByPlayer.get(String(row.player));
    row.totalPoints = recalcPerformanceTotal(row, position);
    await row.save();
  }
}

async function gameweekPlayerStats(matchweek) {
  const agg = await FantasyMatchPerformance.aggregate([
    { $match: { matchweek: Number(matchweek) } },
    {
      $group: {
        _id: '$player',
        totalPoints: { $sum: '$totalPoints' },
        totalMinutes: { $sum: '$minutesPlayed' },
      },
    },
  ]);

  const points = new Map();
  const minutes = new Map();
  for (const row of agg) {
    const id = String(row._id);
    points.set(id, row.totalPoints || 0);
    minutes.set(id, row.totalMinutes || 0);
  }
  return { points, minutes };
}

async function playerPointsByMatchweek(matchweek) {
  const { points } = await gameweekPlayerStats(matchweek);
  return points;
}

async function playerMinutesByMatchweek(matchweek) {
  const { minutes } = await gameweekPlayerStats(matchweek);
  return minutes;
}

async function loadPlayerPositionsForLineup(lineup) {
  const ids = collectLineupPlayerIds(lineup);
  if (!ids.size) return new Map();
  const players = await Player.find({ _id: { $in: [...ids] } }).select('position').lean();
  return new Map(players.map((p) => [String(p._id), p.position]));
}

async function resolveEffectiveLineupForScoring(savedLineup, playerPoints, playerMinutes, options = {}) {
  const { gameweekComplete = false, chipUsed = null } = options;
  if (!savedLineup) {
    return { lineupForScoring: null, effectiveLineup: null, substitutions: [] };
  }
  if (!gameweekComplete || chipUsed === 'BB') {
    return { lineupForScoring: savedLineup, effectiveLineup: null, substitutions: [] };
  }

  const playerPositions = await loadPlayerPositionsForLineup(savedLineup);
  const result = applyAutoSubstitutions(savedLineup, playerPoints, playerMinutes, playerPositions, {
    gameweekComplete: true,
    chipUsed,
  });

  for (const sub of result.substitutions) {
    console.log(`[fantasy-autosub] Starter ${sub.out} -> SUB${sub.benchIndex + 1} ${sub.in}`);
  }

  return {
    lineupForScoring: result.effectiveLineup,
    effectiveLineup: result.changed ? result.effectiveLineup : null,
    substitutions: result.substitutions,
  };
}

function scoreLineupFromSnapshot(lineup, playerPoints, options = {}) {
  const {
    captainId,
    viceCaptainId,
    chipUsed,
    playerMinutes = new Map(),
    autoSubInIds = null,
    autoSubOutIds = null,
  } = options;
  const benchBoost = chipUsed === 'BB';
  const tripleCap = chipUsed === 'TC';
  const duoCap = chipUsed === 'DC';

  const { scoringCaptainId, captainBlanked, vicePromoted } = resolveScoringCaptainId(
    captainId,
    viceCaptainId,
    playerPoints,
    playerMinutes,
  );

  const pid = (p) => String(typeof p === 'object' ? p._id || p.id : p);

  const pointsFor = (id, isStarter) => {
    const base = playerPoints.get(String(id)) || 0;
    if (!isStarter && !benchBoost) return 0;
    if (isStarter) {
      if (duoCap && (String(captainId) === String(id) || String(viceCaptainId) === String(id))) {
        return base * 2;
      }
      if (scoringCaptainId && String(scoringCaptainId) === String(id)) {
        const multiplier = tripleCap && !captainBlanked ? 3 : 2;
        return base * multiplier;
      }
    }
    return base;
  };

  const mapRow = (p, isStarter) => {
    const id = pid(p);
    const base = playerPoints.get(String(id)) || 0;
    const points = pointsFor(id, isStarter);
    const extra = {
      rawPoints: base,
      isBench: !isStarter,
      pointsCountTowardTotal: isStarter || benchBoost,
    };
    const roleFlags = {
      isCaptain: String(captainId) === id,
      isViceCaptain: String(viceCaptainId) === id,
      actingCaptain: vicePromoted && String(scoringCaptainId) === id,
      captainDidNotPlay: vicePromoted && String(captainId) === id,
      autoSubIn: autoSubInIds ? autoSubInIds.has(id) : false,
      autoSubOut: autoSubOutIds ? autoSubOutIds.has(id) : false,
    };
    if (typeof p === 'object' && p.name) {
      return {
        ...p,
        points,
        ...extra,
        ...roleFlags,
      };
    }
    return {
      _id: id,
      points,
      ...extra,
      ...roleFlags,
    };
  };

  const starters = lineup?.starters || {};
  const gk = (starters.gk || []).filter(Boolean).map((p) => mapRow(p, true));
  const def = (starters.df || starters.def || []).filter(Boolean).map((p) => mapRow(p, true));
  const mid = (starters.mf || starters.mid || []).filter(Boolean).map((p) => mapRow(p, true));
  const fwd = (starters.att || starters.fwd || []).filter(Boolean).map((p) => mapRow(p, true));
  const bench = (lineup.bench || []).filter(Boolean).map((p) => mapRow(p, false));

  const total = [...gk, ...def, ...mid, ...fwd, ...bench].reduce((s, p) => s + (p.points || 0), 0);

  return {
    total,
    display: {
      gk,
      def,
      mid,
      fwd,
      bench,
      formation: lineup.formation,
      gameweek: lineup.matchweek,
      chipUsed: chipUsed || null,
      benchBoostActive: benchBoost,
      captainBlanked: vicePromoted,
      actingCaptainId: vicePromoted ? scoringCaptainId : captainId || null,
    },
  };
}

/** Whether locked gameweek autosub snapshots should be preserved during rescore. */
function shouldPreserveLockedAutosubs({ gameweekComplete, isLocked, forceAutosubRecalc }) {
  return Boolean(gameweekComplete && isLocked && !forceAutosubRecalc);
}

async function rescoreGameweek(matchweek, matches, options = {}) {
  const { forceAutosubRecalc = false } = options;
  const mw = Number(matchweek);
  const squads = await FantasySquad.find({ matchweek: mw });
  const { points: playerPoints, minutes: playerMinutes } = await gameweekPlayerStats(mw);
  const complete = matches ? isMatchweekComplete(matches, mw) : false;

  for (const doc of squads) {
    if (!doc.lineup) continue;
    const resolvedLineup = await lineupWithResolvedCaptains(doc.lineup, doc.fantasyUser);

    const preserveLockedAutosubs = complete && doc.isLocked && !forceAutosubRecalc;
    let lineupForScoring;
    let effectiveLineup;
    let substitutions;

    if (preserveLockedAutosubs) {
      lineupForScoring = doc.effectiveLineup || resolvedLineup;
      effectiveLineup = doc.effectiveLineup;
      substitutions = Array.isArray(doc.autoSubstitutions) ? doc.autoSubstitutions : [];
    } else {
      const resolved = await resolveEffectiveLineupForScoring(
        resolvedLineup,
        playerPoints,
        playerMinutes,
        { gameweekComplete: complete, chipUsed: doc.chipUsed }
      );
      lineupForScoring = resolved.lineupForScoring;
      effectiveLineup = resolved.effectiveLineup;
      substitutions = resolved.substitutions;
    }

    const autoSubInIds = new Set(substitutions.map((sub) => String(sub.in)));
    const autoSubOutIds = new Set(substitutions.map((sub) => String(sub.out)));

    const { total } = scoreLineupFromSnapshot(lineupForScoring, playerPoints, {
      captainId: resolvedLineup.captainId,
      viceCaptainId: resolvedLineup.viceCaptainId,
      chipUsed: doc.chipUsed,
      playerMinutes,
      autoSubInIds,
      autoSubOutIds,
    });
    const transferHitPoints = await getTransferCostForGameweek(doc.fantasyUser, mw);
    doc.lineup = resolvedLineup;
    if (!preserveLockedAutosubs) {
      doc.effectiveLineup = effectiveLineup;
      doc.autoSubstitutions = substitutions.length ? substitutions : null;
    }
    doc.transferHitPoints = transferHitPoints;
    doc.points = Math.max(0, total - transferHitPoints);
    if (complete) doc.isLocked = true;
    await doc.save();
  }
}

async function hydrateLineupPlayers(lineupRaw) {
  if (!lineupRaw) return null;
  const ids = new Set();
  const collect = (arr) => (arr || []).filter(Boolean).forEach((id) => ids.add(String(id)));
  const s = lineupRaw.starters || {};
  collect(s.gk);
  collect(s.df);
  collect(s.mf);
  collect(s.att);
  collect(lineupRaw.bench);

  const players = await Player.find({ _id: { $in: [...ids] } })
    .populate('team', 'name')
    .lean();
  const byId = new Map(players.map((p) => [String(p._id), p]));

  const mapId = (id) => byId.get(String(id)) || null;
  return {
    formation: lineupRaw.formation,
    matchweek: lineupRaw.matchweek,
    captainId: lineupRaw.captainId,
    viceCaptainId: lineupRaw.viceCaptainId,
    starters: {
      gk: (s.gk || []).map(mapId).filter(Boolean),
      df: (s.df || []).map(mapId).filter(Boolean),
      mf: (s.mf || []).map(mapId).filter(Boolean),
      att: (s.att || []).map(mapId).filter(Boolean),
    },
    bench: (lineupRaw.bench || []).map(mapId).filter(Boolean),
  };
}

module.exports = {
  goalPointsPerGoal,
  goalPointsFromCount,
  calculateMinutesPoints,
  recalcPerformanceTotal,
  recalcPerformanceTotalsForMatch,
  gameweekPlayerStats,
  playerPointsByMatchweek,
  playerMinutesByMatchweek,
  scoreLineupFromSnapshot,
  rescoreGameweek,
  hydrateLineupPlayers,
  loadPlayerPositionsForLineup,
  resolveEffectiveLineupForScoring,
  shouldPreserveLockedAutosubs,
};
