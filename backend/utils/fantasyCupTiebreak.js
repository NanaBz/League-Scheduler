const crypto = require('crypto');
const mongoose = require('mongoose');
const Match = require('../models/Match');
const Player = require('../models/Player');
const FantasySquad = require('../models/FantasySquad');
const FantasyMatchPerformance = require('../models/FantasyMatchPerformance');
const { lineupWithResolvedCaptains } = require('./fantasyCaptainRoles');
const { FANTASY_MATCH_COMPETITION } = require('./fantasyLeagueScope');

function starterIdsFromLineup(lineup) {
  const s = lineup?.starters || {};
  const pick = (key) => (Array.isArray(s[key]) ? s[key] : []).filter(Boolean).map(String);
  return [...pick('gk'), ...pick('df'), ...pick('mf'), ...pick('att')];
}

function defenseStarterIdsFromLineup(lineup) {
  const s = lineup?.starters || {};
  const pick = (key) => (Array.isArray(s[key]) ? s[key] : []).filter(Boolean).map(String);
  return [...pick('gk'), ...pick('df')];
}

async function sumGoalsScoredForPlayers(playerIds, gameweek) {
  if (!playerIds.length) return 0;

  const objectIds = playerIds
    .map((id) => {
      try {
        return new mongoose.Types.ObjectId(id);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (!objectIds.length) return 0;

  const rows = await FantasyMatchPerformance.aggregate([
    { $match: { matchweek: Number(gameweek), player: { $in: objectIds } } },
    { $group: { _id: null, goals: { $sum: '$goals' } } },
  ]);

  return rows[0]?.goals || 0;
}

async function sumGoalsConcededForDefense(playerIds, gameweek) {
  if (!playerIds.length) return 0;

  const objectIds = playerIds
    .map((id) => {
      try {
        return new mongoose.Types.ObjectId(id);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (!objectIds.length) return 0;

  const players = await Player.find({ _id: { $in: objectIds } })
    .select('_id team position')
    .lean();

  const defensePlayers = players.filter((p) => p.position === 'GK' || p.position === 'DF');
  if (!defensePlayers.length) return 0;

  const teamIds = [...new Set(defensePlayers.map((p) => String(p.team)).filter(Boolean))];
  if (!teamIds.length) return 0;

  const teamObjectIds = teamIds.map((id) => new mongoose.Types.ObjectId(id));
  const matches = await Match.find({
    competition: FANTASY_MATCH_COMPETITION,
    matchweek: Number(gameweek),
    isPublished: true,
    isVoided: { $ne: true },
    $or: [{ homeTeam: { $in: teamObjectIds } }, { awayTeam: { $in: teamObjectIds } }],
  })
    .select('homeTeam awayTeam homeScore awayScore')
    .lean();

  const concededByTeam = new Map();
  for (const match of matches) {
    if (match.homeScore == null || match.awayScore == null) continue;
    concededByTeam.set(String(match.homeTeam), match.awayScore);
    concededByTeam.set(String(match.awayTeam), match.homeScore);
  }

  let total = 0;
  for (const player of defensePlayers) {
    const teamId = String(player.team);
    if (concededByTeam.has(teamId)) {
      total += concededByTeam.get(teamId);
    }
  }

  return total;
}

/** FPL-style cup stats for one manager in a gameweek (starting XI). */
async function getCupTiebreakStats(fantasyUserId, gameweek) {
  const squad = await FantasySquad.findOne({ fantasyUser: fantasyUserId, matchweek: Number(gameweek) })
    .select('lineup')
    .lean();

  if (!squad?.lineup) {
    return { goalsScored: 0, goalsConceded: 0 };
  }

  const lineup = await lineupWithResolvedCaptains(squad.lineup, fantasyUserId);
  const starterIds = starterIdsFromLineup(lineup);
  const defenseIds = defenseStarterIdsFromLineup(lineup);

  const [goalsScored, goalsConceded] = await Promise.all([
    sumGoalsScoredForPlayers(starterIds, gameweek),
    sumGoalsConcededForDefense(defenseIds, gameweek),
  ]);

  return { goalsScored, goalsConceded };
}

/** Deterministic virtual coin toss — same tie always gets the same result. */
function virtualCoinToss(tieId, homeId, awayId) {
  const digest = crypto
    .createHash('sha256')
    .update(`acity-cup-coin:${String(tieId)}:${String(homeId)}:${String(awayId)}`)
    .digest('hex');
  return parseInt(digest.slice(0, 8), 16) % 2 === 0 ? homeId : awayId;
}

/**
 * FPL Cup tie-breakers when gameweek points are equal:
 * 1. Most goals scored (starting XI)
 * 2. Fewest goals conceded (starting GK + DEF)
 * 3. Virtual coin toss
 */
async function pickCupTiebreakWinner(tie, homeId, awayId) {
  const gameweek = tie.gameweek;
  const [homeStats, awayStats] = await Promise.all([
    getCupTiebreakStats(homeId, gameweek),
    getCupTiebreakStats(awayId, gameweek),
  ]);

  let winnerId;
  let tiebreakMethod;

  if (homeStats.goalsScored !== awayStats.goalsScored) {
    winnerId = homeStats.goalsScored > awayStats.goalsScored ? homeId : awayId;
    tiebreakMethod = 'goals_scored';
  } else if (homeStats.goalsConceded !== awayStats.goalsConceded) {
    winnerId = homeStats.goalsConceded < awayStats.goalsConceded ? homeId : awayId;
    tiebreakMethod = 'goals_conceded';
  } else {
    winnerId = virtualCoinToss(tie._id, homeId, awayId);
    tiebreakMethod = 'coin_toss';
  }

  return {
    winnerId,
    tiebreakMethod,
    homeGoalsScored: homeStats.goalsScored,
    awayGoalsScored: awayStats.goalsScored,
    homeGoalsConceded: homeStats.goalsConceded,
    awayGoalsConceded: awayStats.goalsConceded,
  };
}

module.exports = {
  getCupTiebreakStats,
  pickCupTiebreakWinner,
  virtualCoinToss,
};
