const FantasyUser = require('../models/FantasyUser');
const FantasySquad = require('../models/FantasySquad');
const Match = require('../models/Match');
const { FANTASY_MATCH_COMPETITION } = require('./fantasyLeagueScope');
const { deriveCurrentGameweekFromMatches, leagueHasFinishedMatches } = require('./fantasyGameweek');
const { latestCompletedMatchweek } = require('./fantasyMatchweek');

/** Overall Acity League — one row per registered fantasy manager (no placeholders). */
async function buildOverallLeagueEntries() {
  const matches = await Match.find({
    competition: FANTASY_MATCH_COMPETITION,
    isPublished: true,
  })
    .select('matchweek isPlayed matchState isVoided competition')
    .lean();

  const currentGameweek = deriveCurrentGameweekFromMatches(matches);
  const latestCompleted = latestCompletedMatchweek(matches);
  const gwForColumn = latestCompleted || currentGameweek;
  const preseason = !leagueHasFinishedMatches(matches);

  // Every fantasy account (verified or pending) — registration adds them to the league
  const users = await FantasyUser.find({})
    .select('teamName managerName email isVerified')
    .sort({ teamName: 1, managerName: 1 })
    .lean();

  if (!users.length) {
    return { currentGameweek, preseason, entries: [] };
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

  return { currentGameweek, preseason, entries };
}

module.exports = { buildOverallLeagueEntries };
