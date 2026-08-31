const Match = require('../models/Match');
const Player = require('../models/Player');
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

/** Derive team clean-sheet flags from the match score (no schema changes). */
function teamCleanSheetFlags(homeScore, awayScore) {
  if (homeScore == null || awayScore == null) {
    return { homeKeptCleanSheet: false, awayKeptCleanSheet: false };
  }
  const home = Number(homeScore);
  const away = Number(awayScore);
  const valid =
    Number.isFinite(home) &&
    Number.isFinite(away) &&
    home >= 0 &&
    away >= 0;
  if (!valid) {
    return { homeKeptCleanSheet: false, awayKeptCleanSheet: false };
  }
  return {
    homeKeptCleanSheet: away === 0,
    awayKeptCleanSheet: home === 0,
  };
}

/**
 * Fantasy clean-sheet points for one player — team CS + minutes + registered position.
 * Fixture CLEAN_SHEET events are not used here.
 */
function fantasyCleanSheetForPlayer({ minutesPlayed, position, teamKeptCleanSheet }) {
  const minutes = Number(minutesPlayed) || 0;
  if (!teamKeptCleanSheet || minutes < 45) {
    return { cleansheet: false, cleansheetPoints: 0 };
  }
  const cleansheetPoints = cleansheetPointsForPosition(position);
  return {
    cleansheet: cleansheetPoints > 0,
    cleansheetPoints,
  };
}

function teamKeptCleanSheetForPlayerTeam(playerTeamId, homeTeamId, awayTeamId, flags) {
  const teamId = String(playerTeamId);
  if (teamId === String(homeTeamId)) return flags.homeKeptCleanSheet;
  if (teamId === String(awayTeamId)) return flags.awayKeptCleanSheet;
  return false;
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
    }
    // CLEAN_SHEET events are for Fixture Management / PlayerStats only — not Fantasy CS.

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
    (stats.redCards || 0) > 0
  );
}

/** Recompute Fantasy clean-sheet fields for every performance row in a match. */
async function applyFantasyCleanSheetPoints(matchId, match) {
  const rows = await FantasyMatchPerformance.find({ match: matchId });
  if (!rows.length) return 0;

  const flags = teamCleanSheetFlags(match.homeScore, match.awayScore);
  const homeTeamId = match.homeTeam?._id || match.homeTeam;
  const awayTeamId = match.awayTeam?._id || match.awayTeam;

  const playerIds = rows.map((row) => row.player);
  const players = await Player.find({ _id: { $in: playerIds } }).select('position team').lean();
  const playerById = new Map(players.map((p) => [String(p._id), p]));

  let updated = 0;
  for (const row of rows) {
    const player = playerById.get(String(row.player));
    const teamKeptCleanSheet = player
      ? teamKeptCleanSheetForPlayerTeam(player.team, homeTeamId, awayTeamId, flags)
      : false;
    const cs = fantasyCleanSheetForPlayer({
      minutesPlayed: row.minutesPlayed,
      position: player?.position,
      teamKeptCleanSheet,
    });
    row.cleansheet = cs.cleansheet;
    row.cleansheetPoints = cs.cleansheetPoints;
    await row.save();
    updated += 1;
  }
  return updated;
}

/**
 * Pull goals, assists, cards, and clean sheets from match events into FantasyMatchPerformance.
 * Minutes, bonus, and special points already on a row are preserved.
 */
async function syncFantasyPerformanceFromMatchEvents(matchId) {
  const match = await Match.findById(matchId)
    .populate('events.player', 'position')
    .populate('events.assistPlayer', 'position')
    .populate('homeTeam awayTeam')
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
        cleansheet: false,
        cleansheetPoints: 0,
        ...payload,
      });
      await doc.save();
      updated += 1;
    }
  }

  await applyFantasyCleanSheetPoints(matchId, match);
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
  teamCleanSheetFlags,
  fantasyCleanSheetForPlayer,
  teamKeptCleanSheetForPlayerTeam,
  buildEventStatsByPlayer,
  applyFantasyCleanSheetPoints,
  syncFantasyPerformanceFromMatchEvents,
  syncFantasyPerformanceForGameweek,
  finalizeFantasyMatchScoring,
};
