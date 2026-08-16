const Match = require('../models/Match');
const FantasySquad = require('../models/FantasySquad');
const FantasyUser = require('../models/FantasyUser');
const { FANTASY_MATCH_COMPETITION } = require('./fantasyLeagueScope');
const { deriveCurrentGameweekFromMatches } = require('./fantasyGameweek');
const { latestCompletedMatchweek } = require('./fantasyMatchweek');
const { rescoreGameweek } = require('./fantasyScoring');
const { backfillMissingSnapshotsForGameweek } = require('./fantasyGameweekSnapshot');
const { syncFantasyPerformanceForGameweek } = require('./fantasyMatchEventsSync');

async function loadFantasyLeagueMatches() {
  return Match.find({
    competition: FANTASY_MATCH_COMPETITION,
    isPublished: true,
  })
    .select('matchweek isPlayed matchState isVoided competition isPublished')
    .lean();
}

/** Dashboard metrics for the latest completed gameweek (Average / Points / Highest). */
async function buildDashboardSummary(fantasyUserId) {
  const matches = await loadFantasyLeagueMatches();
  const currentGameweek = deriveCurrentGameweekFromMatches(matches);
  const latestCompletedGameweek = latestCompletedMatchweek(matches);
  const displayGameweek = latestCompletedGameweek || null;

  if (!displayGameweek) {
    return {
      currentGameweek,
      latestCompletedGameweek: 0,
      displayGameweek: null,
      userPoints: 0,
      averagePoints: 0,
      highestPoints: 0,
      highestEntry: null,
      hasUserTeam: false,
    };
  }

  await backfillMissingSnapshotsForGameweek(displayGameweek);
  await syncFantasyPerformanceForGameweek(displayGameweek);
  await rescoreGameweek(displayGameweek, matches);

  const squads = await FantasySquad.find({ matchweek: displayGameweek })
    .select('fantasyUser points lineup')
    .lean();

  const userSquad = squads.find((s) => String(s.fantasyUser) === String(fantasyUserId));
  const scoredSquads = squads.filter((s) => s.lineup);
  const pointsList = scoredSquads.map((s) => s.points || 0);

  const userPoints = userSquad?.points ?? 0;
  const averagePoints = pointsList.length
    ? pointsList.reduce((sum, p) => sum + p, 0) / pointsList.length
    : 0;
  const highestPoints = pointsList.length ? Math.max(...pointsList) : 0;

  let highestEntry = null;
  if (highestPoints > 0) {
    const top = scoredSquads.find((s) => (s.points || 0) === highestPoints);
    if (top) {
      const topUser = await FantasyUser.findById(top.fantasyUser)
        .select('teamName managerName')
        .lean();
      if (topUser) {
        highestEntry = {
          fantasyUserId: String(top.fantasyUser),
          team: topUser.teamName,
          user: topUser.managerName,
          points: highestPoints,
        };
      }
    }
  }

  return {
    currentGameweek,
    latestCompletedGameweek,
    displayGameweek,
    userPoints,
    averagePoints,
    highestPoints,
    highestEntry,
    hasUserTeam: Boolean(userSquad?.lineup),
  };
}

module.exports = { buildDashboardSummary };
