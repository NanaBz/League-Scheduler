const FantasyUser = require('../models/FantasyUser');
const FantasySquad = require('../models/FantasySquad');
const FantasyCup = require('../models/FantasyCup');
const FantasyCupTie = require('../models/FantasyCupTie');
const { isMatchweekComplete } = require('./fantasyMatchweek');
const { pickCupTiebreakWinner } = require('./fantasyCupTiebreak');

const QUALIFICATION_GW = 5;
const QUALIFIER_COUNT = 32;

const ROUND_ORDER = ['R32', 'R16', 'QF', 'SF', 'F'];
const NEXT_ROUND = { R32: 'R16', R16: 'QF', QF: 'SF', SF: 'F' };
const ROUND_GW = { R32: 6, R16: 7, QF: 8, SF: 9, F: 10 };
const ROUND_TIE_COUNT = { R32: 16, R16: 8, QF: 4, SF: 2, F: 1 };

const ROUND_LABELS = {
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF: 'Quarter-finals',
  SF: 'Semi-finals',
  F: 'Final',
};

const CUP_SCHEDULE = ROUND_ORDER.map((round) => ({
  round,
  label: ROUND_LABELS[round],
  gameweek: ROUND_GW[round],
}));

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function buildQualificationStandings(maxGameweek = QUALIFICATION_GW) {
  const users = await FantasyUser.find({})
    .select('teamName managerName')
    .sort({ teamName: 1 })
    .lean();

  if (!users.length) {
    return { qualified: [], excluded: [] };
  }

  const userIds = users.map((u) => u._id);
  const agg = await FantasySquad.aggregate([
    { $match: { fantasyUser: { $in: userIds }, matchweek: { $lte: maxGameweek } } },
    { $group: { _id: '$fantasyUser', total: { $sum: '$points' } } },
  ]);

  const totalByUser = new Map(agg.map((r) => [String(r._id), r.total || 0]));

  let entries = users.map((u) => ({
    fantasyUserId: u._id,
    teamName: u.teamName,
    managerName: u.managerName,
    qualificationPoints: totalByUser.get(String(u._id)) || 0,
  }));

  entries.sort(
    (a, b) =>
      b.qualificationPoints - a.qualificationPoints ||
      a.teamName.localeCompare(b.teamName)
  );

  const qualified = entries.slice(0, QUALIFIER_COUNT).map((row, index) => ({
    ...row,
    seed: index + 1,
  }));

  const excluded = entries.slice(QUALIFIER_COUNT).map((row, index) => ({
    ...row,
    seed: QUALIFIER_COUNT + index + 1,
  }));

  return { qualified, excluded };
}

async function createRound32Ties(seasonNumber, qualified) {
  const shuffled = shuffleInPlace([...qualified]);
  const docs = [];

  for (let slot = 0; slot < shuffled.length / 2; slot += 1) {
    const home = shuffled[slot * 2];
    const away = shuffled[slot * 2 + 1];
    if (!home || !away) continue;

    docs.push({
      seasonNumber,
      round: 'R32',
      gameweek: ROUND_GW.R32,
      bracketSlot: slot,
      homeFantasyUser: home.fantasyUserId,
      awayFantasyUser: away.fantasyUserId,
      homeTeamName: home.teamName,
      awayTeamName: away.teamName,
      resolved: false,
    });
  }

  if (docs.length) {
    await FantasyCupTie.insertMany(docs, { ordered: true });
  }
}

async function initializeCupIfNeeded(seasonNumber, matches) {
  if (!isMatchweekComplete(matches, QUALIFICATION_GW)) {
    return null;
  }

  const existingTieCount = await FantasyCupTie.countDocuments({ seasonNumber, round: 'R32' });
  if (existingTieCount > 0) {
    return FantasyCup.findOne({ seasonNumber }).lean();
  }

  const { qualified, excluded } = await buildQualificationStandings(QUALIFICATION_GW);
  if (qualified.length < 2) {
    return null;
  }

  const cup = await FantasyCup.findOneAndUpdate(
    { seasonNumber },
    {
      $setOnInsert: {
        seasonNumber,
        qualificationGameweek: QUALIFICATION_GW,
      },
      $set: {
        qualifiedTeams: qualified.map((q) => ({
          fantasyUserId: q.fantasyUserId,
          teamName: q.teamName,
          managerName: q.managerName,
          seed: q.seed,
          qualificationPoints: q.qualificationPoints,
        })),
        excludedTeams: excluded.map((q) => ({
          fantasyUserId: q.fantasyUserId,
          teamName: q.teamName,
          managerName: q.managerName,
          seed: q.seed,
          qualificationPoints: q.qualificationPoints,
        })),
        bracketGeneratedAt: new Date(),
        status: 'active',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  await createRound32Ties(seasonNumber, qualified);
  return cup;
}

async function resolveTiesForCompletedGameweeks(seasonNumber, matches) {
  const unresolved = await FantasyCupTie.find({ seasonNumber, resolved: false }).lean();
  if (!unresolved.length) return;

  for (const tie of unresolved) {
    if (!isMatchweekComplete(matches, tie.gameweek)) continue;

    const [homeSquad, awaySquad] = await Promise.all([
      FantasySquad.findOne({ fantasyUser: tie.homeFantasyUser, matchweek: tie.gameweek })
        .select('points')
        .lean(),
      FantasySquad.findOne({ fantasyUser: tie.awayFantasyUser, matchweek: tie.gameweek })
        .select('points')
        .lean(),
    ]);

    const homePoints = homeSquad?.points ?? 0;
    const awayPoints = awaySquad?.points ?? 0;

    let winnerId;
    let tiebreakFields = {};

    if (homePoints > awayPoints) winnerId = tie.homeFantasyUser;
    else if (awayPoints > homePoints) winnerId = tie.awayFantasyUser;
    else {
      const tiebreak = await pickCupTiebreakWinner(tie, tie.homeFantasyUser, tie.awayFantasyUser);
      winnerId = tiebreak.winnerId;
      tiebreakFields = {
        tiebreakMethod: tiebreak.tiebreakMethod,
        homeGoalsScored: tiebreak.homeGoalsScored,
        awayGoalsScored: tiebreak.awayGoalsScored,
        homeGoalsConceded: tiebreak.homeGoalsConceded,
        awayGoalsConceded: tiebreak.awayGoalsConceded,
      };
    }

    await FantasyCupTie.updateOne(
      { _id: tie._id },
      {
        $set: {
          homePoints,
          awayPoints,
          winnerFantasyUser: winnerId,
          resolved: true,
          resolvedAt: new Date(),
          ...tiebreakFields,
        },
      }
    );
  }
}

async function loadTeamNamesForWinners(winnerIds) {
  const users = await FantasyUser.find({ _id: { $in: winnerIds } })
    .select('teamName managerName')
    .lean();
  return new Map(users.map((u) => [String(u._id), u]));
}

async function advanceRoundIfReady(seasonNumber) {
  for (let i = 0; i < ROUND_ORDER.length - 1; i += 1) {
    const round = ROUND_ORDER[i];
    const nextRound = NEXT_ROUND[round];

    const ties = await FantasyCupTie.find({ seasonNumber, round }).sort({ bracketSlot: 1 }).lean();
    if (!ties.length || !ties.every((t) => t.resolved && t.winnerFantasyUser)) {
      break;
    }

    const nextExists = await FantasyCupTie.countDocuments({ seasonNumber, round: nextRound });
    if (nextExists > 0) continue;

    const winnerIds = [];
    for (let slot = 0; slot < ROUND_TIE_COUNT[nextRound]; slot += 1) {
      const left = ties[slot * 2];
      const right = ties[slot * 2 + 1];
      if (left?.winnerFantasyUser) winnerIds.push(left.winnerFantasyUser);
      if (right?.winnerFantasyUser) winnerIds.push(right.winnerFantasyUser);
    }

    const nameById = await loadTeamNamesForWinners(winnerIds);
    const docs = [];

    for (let slot = 0; slot < ROUND_TIE_COUNT[nextRound]; slot += 1) {
      const left = ties[slot * 2];
      const right = ties[slot * 2 + 1];
      if (!left?.winnerFantasyUser || !right?.winnerFantasyUser) continue;

      const homeMeta = nameById.get(String(left.winnerFantasyUser));
      const awayMeta = nameById.get(String(right.winnerFantasyUser));

      docs.push({
        seasonNumber,
        round: nextRound,
        gameweek: ROUND_GW[nextRound],
        bracketSlot: slot,
        homeFantasyUser: left.winnerFantasyUser,
        awayFantasyUser: right.winnerFantasyUser,
        homeTeamName: homeMeta?.teamName || left.homeTeamName,
        awayTeamName: awayMeta?.teamName || right.awayTeamName,
        resolved: false,
      });
    }

    if (docs.length) {
      await FantasyCupTie.insertMany(docs, { ordered: true });
    }
  }

  const finalTie = await FantasyCupTie.findOne({ seasonNumber, round: 'F', resolved: true }).lean();
  if (finalTie?.winnerFantasyUser) {
    const winner = await FantasyUser.findById(finalTie.winnerFantasyUser)
      .select('teamName managerName')
      .lean();
    await FantasyCup.updateOne(
      { seasonNumber },
      {
        $set: {
          status: 'completed',
          winnerFantasyUser: finalTie.winnerFantasyUser,
          winnerTeamName: winner?.teamName || finalTie.homeTeamName,
          winnerManagerName: winner?.managerName || '',
        },
      }
    );
  }
}

async function enrichUnresolvedTieScores(ties) {
  const unresolved = ties.filter((t) => !t.resolved);
  if (!unresolved.length) return ties;

  const lookups = unresolved.flatMap((t) => [
    { fantasyUser: t.homeFantasyUser, matchweek: t.gameweek, side: 'home', tieId: String(t._id) },
    { fantasyUser: t.awayFantasyUser, matchweek: t.gameweek, side: 'away', tieId: String(t._id) },
  ]);

  const squads = await FantasySquad.find({
    $or: lookups.map((l) => ({ fantasyUser: l.fantasyUser, matchweek: l.matchweek })),
  })
    .select('fantasyUser matchweek points')
    .lean();

  const scoreKey = (userId, gw) => `${String(userId)}:${gw}`;
  const scoreByKey = new Map(
    squads.map((s) => [scoreKey(s.fantasyUser, s.matchweek), s.points ?? 0])
  );

  return ties.map((tie) => {
    if (tie.resolved) return tie;
    return {
      ...tie,
      homePoints: scoreByKey.get(scoreKey(tie.homeFantasyUser, tie.gameweek)) ?? null,
      awayPoints: scoreByKey.get(scoreKey(tie.awayFantasyUser, tie.gameweek)) ?? null,
    };
  });
}

function formatTie(tie) {
  const homeWinner =
    tie.resolved && tie.winnerFantasyUser && String(tie.winnerFantasyUser) === String(tie.homeFantasyUser);
  const awayWinner =
    tie.resolved && tie.winnerFantasyUser && String(tie.winnerFantasyUser) === String(tie.awayFantasyUser);

  return {
    id: String(tie._id),
    bracketSlot: tie.bracketSlot,
    gameweek: tie.gameweek,
    resolved: tie.resolved,
    tiebreak: tie.tiebreakMethod
      ? {
          method: tie.tiebreakMethod,
          homeGoalsScored: tie.homeGoalsScored,
          awayGoalsScored: tie.awayGoalsScored,
          homeGoalsConceded: tie.homeGoalsConceded,
          awayGoalsConceded: tie.awayGoalsConceded,
        }
      : null,
    home: {
      fantasyUserId: String(tie.homeFantasyUser),
      teamName: tie.homeTeamName,
      points: tie.homePoints,
      isWinner: homeWinner,
    },
    away: {
      fantasyUserId: String(tie.awayFantasyUser),
      teamName: tie.awayTeamName,
      points: tie.awayPoints,
      isWinner: awayWinner,
    },
  };
}

async function buildCupResponse(seasonNumber, matches) {
  const mw5Complete = isMatchweekComplete(matches, QUALIFICATION_GW);
  const { qualified, excluded } = await buildQualificationStandings(QUALIFICATION_GW);

  let cupDoc = await initializeCupIfNeeded(seasonNumber, matches);

  if (cupDoc) {
    await resolveTiesForCompletedGameweeks(seasonNumber, matches);
    await advanceRoundIfReady(seasonNumber);
    cupDoc = await FantasyCup.findOne({ seasonNumber }).lean();
  }

  const allTiesRaw = cupDoc
    ? await FantasyCupTie.find({ seasonNumber }).sort({ gameweek: 1, bracketSlot: 1 }).lean()
    : [];
  const allTies = await enrichUnresolvedTieScores(allTiesRaw);

  const rounds = ROUND_ORDER.map((round) => {
    const roundTies = allTies.filter((t) => t.round === round).map(formatTie);
    return {
      round,
      label: ROUND_LABELS[round],
      gameweek: ROUND_GW[round],
      ties: roundTies,
    };
  }).filter((r) => r.ties.length > 0 || (cupDoc && ROUND_GW[r.round] >= 6));

  let currentRound = null;
  for (const round of ROUND_ORDER) {
    const roundTies = allTies.filter((t) => t.round === round);
    if (!roundTies.length) continue;
    if (roundTies.some((t) => !t.resolved)) {
      currentRound = round;
      break;
    }
  }

  const winner =
    cupDoc?.status === 'completed' && cupDoc.winnerFantasyUser
      ? {
          fantasyUserId: String(cupDoc.winnerFantasyUser),
          teamName: cupDoc.winnerTeamName,
          managerName: cupDoc.winnerManagerName || '',
        }
      : null;

  let status = 'pending';
  if (cupDoc?.status === 'completed') status = 'completed';
  else if (cupDoc?.bracketGeneratedAt) status = 'active';
  else if (mw5Complete) status = 'qualifying';
  else status = 'pending';

  return {
    status,
    qualificationGameweek: QUALIFICATION_GW,
    mw5Complete,
    qualifierCount: QUALIFIER_COUNT,
    currentRound: currentRound ? { round: currentRound, label: ROUND_LABELS[currentRound] } : null,
    winner,
    qualifiedTeams: cupDoc?.qualifiedTeams?.length
      ? cupDoc.qualifiedTeams.map((q) => ({
          fantasyUserId: String(q.fantasyUserId),
          teamName: q.teamName,
          managerName: q.managerName,
          seed: q.seed,
          qualificationPoints: q.qualificationPoints,
        }))
      : qualified.map((q) => ({
          fantasyUserId: String(q.fantasyUserId),
          teamName: q.teamName,
          managerName: q.managerName,
          seed: q.seed,
          qualificationPoints: q.qualificationPoints,
        })),
    excludedTeams: cupDoc?.excludedTeams?.length
      ? cupDoc.excludedTeams.map((q) => ({
          fantasyUserId: String(q.fantasyUserId),
          teamName: q.teamName,
          managerName: q.managerName,
          seed: q.seed,
          qualificationPoints: q.qualificationPoints,
        }))
      : excluded.map((q) => ({
          fantasyUserId: String(q.fantasyUserId),
          teamName: q.teamName,
          managerName: q.managerName,
          seed: q.seed,
          qualificationPoints: q.qualificationPoints,
        })),
    rounds: cupDoc ? rounds.filter((r) => r.ties.length > 0) : [],
    schedule: CUP_SCHEDULE,
    bracketGenerated: Boolean(cupDoc?.bracketGeneratedAt),
  };
}

module.exports = {
  QUALIFICATION_GW,
  QUALIFIER_COUNT,
  buildCupResponse,
  buildQualificationStandings,
};
