const FantasySquad = require('../models/FantasySquad');
const FantasyUser = require('../models/FantasyUser');

/**
 * Highest-scoring manager(s) for a completed gameweek.
 * Tied managers all count as MOTW for that week.
 */
async function computeManagerOfTheWeek(matchweek) {
  if (!matchweek || matchweek < 1) return null;

  const squads = await FantasySquad.find({ matchweek })
    .select('fantasyUser points lineup')
    .lean();
  const scored = squads.filter((s) => s.lineup);
  if (!scored.length) return null;

  const maxPoints = Math.max(...scored.map((s) => s.points || 0));
  if (maxPoints <= 0) return null;

  const winnerRows = scored.filter((s) => (s.points || 0) === maxPoints);
  const userIds = winnerRows.map((w) => w.fantasyUser);
  const users = await FantasyUser.find({ _id: { $in: userIds } })
    .select('managerName teamName')
    .lean();
  const userById = new Map(users.map((u) => [String(u._id), u]));

  const managers = winnerRows.map((row) => {
    const u = userById.get(String(row.fantasyUser));
    return {
      fantasyUserId: String(row.fantasyUser),
      manager: u?.managerName || 'Unknown',
      team: u?.teamName || 'Unknown',
      points: maxPoints,
    };
  });

  return {
    matchweek,
    points: maxPoints,
    managers,
    tieCount: managers.length,
  };
}

/** Season leader by cumulative FantasySquad points. */
async function computeTopManager() {
  const rows = await FantasySquad.aggregate([
    { $group: { _id: '$fantasyUser', totalPoints: { $sum: '$points' } } },
    { $sort: { totalPoints: -1 } },
    { $limit: 1 },
    {
      $lookup: {
        from: 'fantasyusers',
        localField: '_id',
        foreignField: '_id',
        as: 'userData',
      },
    },
    { $unwind: '$userData' },
  ]);

  if (!rows.length) return null;

  const row = rows[0];
  return {
    fantasyUserId: String(row._id),
    manager: row.userData.managerName,
    team: row.userData.teamName,
    points: row.totalPoints,
  };
}

function isUserManagerOfTheWeek(fantasyUserId, motw) {
  if (!fantasyUserId || !motw?.managers?.length) return false;
  const id = String(fantasyUserId);
  return motw.managers.some((m) => m.fantasyUserId === id);
}

module.exports = {
  computeManagerOfTheWeek,
  computeTopManager,
  isUserManagerOfTheWeek,
};
