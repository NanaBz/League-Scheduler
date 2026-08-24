const FantasyMatchPerformance = require('../models/FantasyMatchPerformance');
const FantasySquad = require('../models/FantasySquad');
const Player = require('../models/Player');
const { isMatchweekComplete } = require('./fantasyMatchweek');
const { lineupWithResolvedCaptains } = require('./fantasyCaptainRoles');
const { getTransferCostForGameweek } = require('./fantasyFreeTransfers');

function recalcPerformanceTotal(p) {
  const goals = p.goals || 0;
  const assists = p.assists || 0;
  const cs = p.cleansheetPoints || 0;
  return (
    (p.minutesPoints || 0) +
    (p.bonusPoints || 0) +
    (p.specialPoints || 0) +
    cs +
    goals * 4 +
    assists * 3 -
    (p.yellowCards || 0) -
    (p.redCards || 0) * 3
  );
}

async function recalcPerformanceTotalsForMatch(matchId) {
  const rows = await FantasyMatchPerformance.find({ match: matchId });
  for (const row of rows) {
    row.totalPoints = recalcPerformanceTotal(row);
    await row.save();
  }
}

async function playerPointsByMatchweek(matchweek) {
  const agg = await FantasyMatchPerformance.aggregate([
    { $match: { matchweek: Number(matchweek) } },
    { $group: { _id: '$player', total: { $sum: '$totalPoints' } } },
  ]);
  return new Map(agg.map((r) => [String(r._id), r.total || 0]));
}

function scoreLineupFromSnapshot(lineup, playerPoints, options = {}) {
  const { captainId, viceCaptainId, chipUsed } = options;
  const benchBoost = chipUsed === 'BB';
  const tripleCap = chipUsed === 'TC';
  const duoCap = chipUsed === 'DC';

  const pid = (p) => String(typeof p === 'object' ? p._id || p.id : p);

  const pointsFor = (id, isStarter) => {
    const base = playerPoints.get(String(id)) || 0;
    if (!isStarter && !benchBoost) return 0;
    if (isStarter) {
      if (duoCap && (String(captainId) === String(id) || String(viceCaptainId) === String(id))) {
        return base * 2;
      }
      if (String(captainId) === String(id)) return base * (tripleCap ? 3 : 2);
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
    if (typeof p === 'object' && p.name) {
      return {
        ...p,
        points,
        ...extra,
        isCaptain: String(captainId) === id,
        isViceCaptain: String(viceCaptainId) === id,
      };
    }
    return {
      _id: id,
      points,
      ...extra,
      isCaptain: String(captainId) === id,
      isViceCaptain: String(viceCaptainId) === id,
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
    },
  };
}

async function rescoreGameweek(matchweek, matches) {
  const mw = Number(matchweek);
  const squads = await FantasySquad.find({ matchweek: mw });
  const playerPoints = await playerPointsByMatchweek(mw);
  const complete = matches ? isMatchweekComplete(matches, mw) : false;

  for (const doc of squads) {
    if (!doc.lineup) continue;
    const resolvedLineup = await lineupWithResolvedCaptains(doc.lineup, doc.fantasyUser);
    const { total } = scoreLineupFromSnapshot(resolvedLineup, playerPoints, {
      captainId: resolvedLineup.captainId,
      viceCaptainId: resolvedLineup.viceCaptainId,
      chipUsed: doc.chipUsed,
    });
    const transferHitPoints = await getTransferCostForGameweek(doc.fantasyUser, mw);
    doc.lineup = resolvedLineup;
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
  recalcPerformanceTotal,
  recalcPerformanceTotalsForMatch,
  playerPointsByMatchweek,
  scoreLineupFromSnapshot,
  rescoreGameweek,
  hydrateLineupPlayers,
};
