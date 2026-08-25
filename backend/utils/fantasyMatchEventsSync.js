const Match = require('../models/Match');
const FantasyMatchPerformance = require('../models/FantasyMatchPerformance');
const {
  recalcPerformanceTotalsForMatch,
  rescoreGameweek,
} = require('./fantasyScoring');
const { FANTASY_MATCH_COMPETITION } = require('./fantasyLeagueScope');

function playerRefId(ref) {
  if (!ref) return null;
  if (typeof ref === 'object' && ref._id) return String(ref._id);
  return String(ref);
}

/** Fantasy clean-sheet points by position (GK/DF +4, MF +1, ATT 0). */
function cleansheetPointsForPosition(position) {
  const p = String(position || '').toUpperCase();
  if (p === 'GK' || p === 'DF') return 4;
  if (p === 'MF') return 1;
  return 0;
}

function emptyEventStats() {
  return {
    goals: 0,
    ownGoals: 0,
    assists: 0,
    yellowCards: 0,
    redCards: 0,
    cleansheet: false,
    cleansheetPoints: 0,
  };
}

/** Aggregate goals, assists, cards, and clean sheets from Match.events. */
function buildEventStatsByPlayer(events) {
  const byPlayer = new Map();

  const ensure = (id, position) => {
    const key = String(id);
    if (!byPlayer.has(key)) {
      byPlayer.set(key, { ...emptyEventStats() });
    }
    const row = byPlayer.get(key);
    if (position && !row._position) row._position = position;
    return row;
  };

  for (const ev of events || []) {
    const pid = playerRefId(ev.player);
    if (!pid) continue;

    const pos = typeof ev.player === 'object' ? ev.player.position : null;
    const row = ensure(pid, pos);

    if (ev.type === 'GOAL') {
      if (ev.ownGoal) row.ownGoals += 1;
      else row.goals += 1;
    } else if (ev.type === 'YELLOW_CARD') {
      row.yellowCards += 1;
    } else if (ev.type === 'RED_CARD') {
      row.redCards += 1;
    } else if (ev.type === 'CLEAN_SHEET') {
      row.cleansheet = true;
      row.cleansheetPoints = cleansheetPointsForPosition(pos);
    }

    const aid = playerRefId(ev.assistPlayer);
    if (ev.type === 'GOAL' && !ev.ownGoal && aid) {
      const apos = typeof ev.assistPlayer === 'object' ? ev.assistPlayer.position : null;
      ensure(aid, apos).assists += 1;
    }
  }

  for (const row of byPlayer.values()) {
    delete row._position;
  }

  return byPlayer;
}

function hasEventActivity(stats) {
  return (
    (stats.goals || 0) > 0 ||
    (stats.ownGoals || 0) > 0 ||
    (stats.assists || 0) > 0 ||
    (stats.yellowCards || 0) > 0 ||
    (stats.redCards || 0) > 0 ||
    (stats.cleansheetPoints || 0) > 0
  );
}

/**
 * Pull goals, assists, cards, and clean sheets from match events into FantasyMatchPerformance.
 * Minutes, bonus, and special points already on a row are preserved.
 */
async function syncFantasyPerformanceFromMatchEvents(matchId) {
  const match = await Match.findById(matchId)
    .populate('events.player', 'position')
    .populate('events.assistPlayer', 'position')
    .lean();

  if (!match || match.competition !== FANTASY_MATCH_COMPETITION) {
    return { ok: false, message: 'Not a league match' };
  }

  const mw = Number(match.matchweek);
  const eventStats = buildEventStatsByPlayer(match.events || []);
  const existing = await FantasyMatchPerformance.find({ match: matchId });

  const playerIds = new Set([
    ...eventStats.keys(),
    ...existing.map((row) => String(row.player)),
  ]);

  let updated = 0;

  for (const playerId of playerIds) {
    const stats = eventStats.get(playerId) || emptyEventStats();
    const row = existing.find((r) => String(r.player) === playerId);

    const payload = {
      matchweek: mw,
      goals: stats.goals,
      ownGoals: stats.ownGoals,
      assists: stats.assists,
      yellowCards: stats.yellowCards,
      redCards: stats.redCards,
      cleansheet: stats.cleansheet,
      cleansheetPoints: stats.cleansheetPoints,
    };

    if (row) {
      Object.assign(row, payload);
      await row.save();
      updated += 1;
    } else if (hasEventActivity(stats)) {
      const doc = new FantasyMatchPerformance({
        match: matchId,
        player: playerId,
        minutesPlayed: 0,
        minutesPoints: 0,
        bonusPoints: 0,
        specialPoints: 0,
        specialPointsReason: '',
        ...payload,
      });
      await doc.save();
      updated += 1;
    }
  }

  await recalcPerformanceTotalsForMatch(matchId);

  return { ok: true, playersUpdated: updated };
}

async function loadFantasyLeagueMatchesForScoring() {
  return Match.find({
    competition: FANTASY_MATCH_COMPETITION,
    isPublished: true,
  })
    .select('matchweek isPlayed matchState isVoided competition isPublished')
    .lean();
}

/** Sync event stats, recalc match totals, and rescore the gameweek. */
async function finalizeFantasyMatchScoring(matchId) {
  await syncFantasyPerformanceFromMatchEvents(matchId);
  await recalcPerformanceTotalsForMatch(matchId);

  const match = await Match.findById(matchId).select('matchweek competition').lean();
  if (!match || match.competition !== FANTASY_MATCH_COMPETITION) return;

  const matches = await loadFantasyLeagueMatchesForScoring();
  await rescoreGameweek(match.matchweek, matches);
}

/** Sync all league fixtures in a gameweek from match events (used by admin rescore). */
async function syncFantasyPerformanceForGameweek(matchweek) {
  const mw = Number(matchweek);
  const fixtures = await Match.find({
    competition: FANTASY_MATCH_COMPETITION,
    matchweek: mw,
    isPublished: true,
  }).select('_id');

  let total = 0;
  for (const fixture of fixtures) {
    const result = await syncFantasyPerformanceFromMatchEvents(fixture._id);
    if (result.ok) total += result.playersUpdated || 0;
  }
  return total;
}

module.exports = {
  cleansheetPointsForPosition,
  buildEventStatsByPlayer,
  syncFantasyPerformanceFromMatchEvents,
  syncFantasyPerformanceForGameweek,
  finalizeFantasyMatchScoring,
};
