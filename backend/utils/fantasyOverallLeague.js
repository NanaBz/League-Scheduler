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

async function gwPointsByUser(userIds, matchweek) {
  const mw = Number(matchweek);
  if (!mw || !userIds?.length) return new Map();
  const squads = await FantasySquad.find({
    fantasyUser: { $in: userIds },
    matchweek: mw,
  })
    .select('fantasyUser points')
    .lean();
  const map = new Map(userIds.map((id) => [String(id), 0]));
  for (const row of squads) {
    map.set(String(row.fantasyUser), row.points || 0);
  }
  return map;
}

async function cumulativePointsByUser(userIds, throughGameweek) {
  const through = Number(throughGameweek);
  const map = new Map(userIds.map((id) => [String(id), 0]));
  if (!through || through < 1 || !userIds?.length) return map;

  const rows = await FantasySquad.aggregate([
    {
      $match: {
        fantasyUser: { $in: userIds },
        matchweek: { $gte: 1, $lte: through },
      },
    },
    { $group: { _id: '$fantasyUser', total: { $sum: '$points' } } },
  ]);
  for (const row of rows) {
    map.set(String(row._id), row.total || 0);
  }
  return map;
}

function rankUsersByTotals(users, cumulativeMap, gwTiebreakMap) {
  const sorted = users
    .map((u) => {
      const id = String(u._id);
      return {
        id,
        total: cumulativeMap.get(id) || 0,
        gw: gwTiebreakMap.get(id) || 0,
        team: u.teamName || '',
      };
    })
    .sort((a, b) => b.total - a.total || b.gw - a.gw || a.team.localeCompare(b.team));

  const ranks = new Map();
  sorted.forEach((row, index) => ranks.set(row.id, index + 1));
  return ranks;
}

/** Rank movement after the latest completed gameweek vs the prior week. */
async function computeRankDeltaByUser(users, latestCompletedGameweek) {
  const deltaMap = new Map(users.map((u) => [String(u._id), 'same']));
  const L = Number(latestCompletedGameweek);
  if (!L || L < 2 || !users.length) return deltaMap;

  const userIds = users.map((u) => u._id);
  const [cumL, cumPrev, gwL, gwPrev] = await Promise.all([
    cumulativePointsByUser(userIds, L),
    cumulativePointsByUser(userIds, L - 1),
    gwPointsByUser(userIds, L),
    gwPointsByUser(userIds, L - 1),
  ]);

  const rankL = rankUsersByTotals(users, cumL, gwL);
  const rankPrev = rankUsersByTotals(users, cumPrev, gwPrev);

  for (const u of users) {
    const id = String(u._id);
    const now = rankL.get(id);
    const prev = rankPrev.get(id);
    if (now == null || prev == null || now === prev) {
      deltaMap.set(id, 'same');
    } else if (now < prev) {
      deltaMap.set(id, 'up');
    } else {
      deltaMap.set(id, 'down');
    }
  }
  return deltaMap;
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
  const preseason = !leagueHasFinishedMatches(matches);
  const gwForColumn = latestCompletedGameweek || (preseason ? 0 : currentGameweek);
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

  const [totalAgg, gwSquads, rankDeltaByUser] = await Promise.all([
    FantasySquad.aggregate([
      { $match: { fantasyUser: { $in: userIds } } },
      { $group: { _id: '$fantasyUser', total: { $sum: '$points' } } },
    ]),
    gwForColumn
      ? FantasySquad.find({ fantasyUser: { $in: userIds }, matchweek: gwForColumn })
          .select('fantasyUser points')
          .lean()
      : Promise.resolve([]),
    !preseason && latestCompletedGameweek
      ? computeRankDeltaByUser(users, latestCompletedGameweek)
      : Promise.resolve(new Map()),
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
      delta: rankDeltaByUser.get(id) || 'same',
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

module.exports = {
  buildOverallLeagueEntries,
  computeRankDeltaByUser,
  cumulativePointsByUser,
};
