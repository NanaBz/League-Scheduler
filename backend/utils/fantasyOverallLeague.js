const FantasyUser = require('../models/FantasyUser');
const FantasySquad = require('../models/FantasySquad');
const Match = require('../models/Match');
const { FANTASY_MATCH_COMPETITION, FANTASY_MAX_MATCHWEEK } = require('./fantasyLeagueScope');
const { deriveCurrentGameweekFromMatches, leagueHasFinishedMatches } = require('./fantasyGameweek');
const { latestCompletedMatchweek } = require('./fantasyMatchweek');

function formatSeasonResult(entry) {
  if (!entry) return null;
  return {
    fantasyUserId: entry.fantasyUserId,
    teamName: entry.team,
    managerName: entry.user,
    totalPoints: entry.total,
    rank: entry.pos,
  };
}

function deriveSeasonResults(entries, seasonComplete) {
  if (!seasonComplete || !entries.length) {
    return { champion: null, runnerUp: null };
  }
  const champion = entries.find((e) => e.pos === 1) || null;
  const runnerUp = entries.find((e) => e.pos === 2) || null;
  return {
    champion: formatSeasonResult(champion),
    runnerUp: formatSeasonResult(runnerUp),
  };
}

/** Overall Acity League — one row per registered fantasy manager (no placeholders). */
async function buildOverallLeagueEntries() {
  const matches = await Match.find({
    competition: FANTASY_MATCH_COMPETITION,
    isPublished: true,
  })
    .select('matchweek isPlayed matchState isVoided competition isPublished')
    .lean();

  const currentGameweek = deriveCurrentGameweekFromMatches(matches);
  const latestCompletedGameweek = latestCompletedMatchweek(matches);
  const gwForColumn = latestCompletedGameweek || currentGameweek;
  const preseason = !leagueHasFinishedMatches(matches);
  const seasonComplete =
    !preseason && latestCompletedGameweek >= FANTASY_MAX_MATCHWEEK;

  // Every fantasy account (verified or pending) — registration adds them to the league
  const users = await FantasyUser.find({})
    .select('teamName managerName email isVerified')
    .sort({ teamName: 1, managerName: 1 })
    .lean();

  if (!users.length) {
    return {
      currentGameweek,
      latestCompletedGameweek,
      preseason,
      seasonComplete: false,
      maxMatchweek: FANTASY_MAX_MATCHWEEK,
      champion: null,
      runnerUp: null,
      entries: [],
    };
  }

  const userIds = users.map((u) => u._id);

  const [totalAgg, gwSquads] = await Promise.all([
    FantasySquad.aggregate([
      { $match: { fantasyUser: { $in: userIds } } },
      { $group: { _id: '$fantasyUser', total: { $sum: '$points' } } },
    ]),
    FantasySquad.find({ fantasyUser: { $in: userIds }, matchweek: gwForColumn })
      .select('fantasyUser points')
      .lean(),
  ]);

  const totalByUser = new Map(totalAgg.map((r) => [String(r._id), r.total || 0]));
  const gwByUser = new Map(gwSquads.map((s) => [String(s.fantasyUser), s.points || 0]));

  let entries = users.map((u) => {
    const id = String(u._id);
    const total = preseason ? 0 : totalByUser.get(id) || 0;
    const gw = preseason ? 0 : gwByUser.get(id) || 0;
    return {
      fantasyUserId: id,
      team: u.teamName,
      user: u.managerName,
      gw,
      total,
      pos: null,
      delta: 'same',
    };
  });

  if (!preseason) {
    entries.sort((a, b) => b.total - a.total || b.gw - a.gw || a.team.localeCompare(b.team));
    entries = entries.map((row, i) => ({
      ...row,
      pos: i + 1,
    }));
  }

  const { champion, runnerUp } = deriveSeasonResults(entries, seasonComplete);

  return {
    currentGameweek,
    latestCompletedGameweek,
    preseason,
    seasonComplete,
    maxMatchweek: FANTASY_MAX_MATCHWEEK,
    champion,
    runnerUp,
    entries,
  };
}

module.exports = { buildOverallLeagueEntries };
