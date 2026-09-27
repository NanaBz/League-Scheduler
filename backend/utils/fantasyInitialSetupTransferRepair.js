const FantasySquad = require('../models/FantasySquad');
const FantasyUser = require('../models/FantasyUser');
const {
  getManagerDebutGameweekForTransfers,
  looksLikeMisclassifiedInitialSetup,
  findPhantomGw1SquadRows,
} = require('./fantasySquadEstablishment');
const { runGameweekRescore } = require('./fantasyRescoreGameweek');

async function findInitialSetupTransferAnomalies() {
  const squads = await FantasySquad.find({
    matchweek: { $gte: 2 },
  })
    .select('fantasyUser matchweek transferHitPoints transfersIn transfersOut lineup points')
    .lean();

  const byUser = new Map();
  for (const row of squads) {
    const uid = String(row.fantasyUser);
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid).push(row);
  }

  const anomalies = [];
  for (const [fantasyUserId, rows] of byUser) {
    const debutGw = await getManagerDebutGameweekForTransfers(fantasyUserId);
    if (debutGw == null || debutGw <= 1) continue;

    const debutRow = rows.find((r) => Number(r.matchweek) === debutGw);
    if (!debutRow) continue;
    if (!looksLikeMisclassifiedInitialSetup(debutRow, debutGw)) continue;

    const hit = debutRow.transferHitPoints || 0;
    const ins = debutRow.transfersIn?.length || 0;
    if (hit <= 0 && ins < 13) continue;

    anomalies.push({
      fantasyUserId,
      matchweek: debutGw,
      transferHitPoints: hit,
      points: debutRow.points,
      transfersInCount: ins,
      transfersOutCount: debutRow.transfersOut?.length || 0,
      squadId: String(debutRow._id),
    });
  }

  return anomalies;
}

async function repairInitialSetupTransferAnomalies(dryRun = true) {
  const [anomalies, phantomGw1Rows] = await Promise.all([
    findInitialSetupTransferAnomalies(),
    findPhantomGw1SquadRows(),
  ]);
  const gameweeksToRescore = new Set();

  for (const row of anomalies) {
    gameweeksToRescore.add(row.matchweek);
    if (!dryRun) {
      await FantasySquad.updateOne(
        { _id: row.squadId },
        { $set: { transfersIn: [], transfersOut: [] } }
      );
    }
  }

  for (const phantom of phantomGw1Rows) {
    gameweeksToRescore.add(2);
    if (!dryRun) {
      await FantasySquad.deleteOne({ _id: phantom.squadId });
    }
  }

  const rescoreResults = [];
  if (!dryRun) {
    for (const mw of [...gameweeksToRescore].sort((a, b) => a - b)) {
      rescoreResults.push(
        await runGameweekRescore(mw, { forceAutosubRecalc: true, skipEventSync: true })
      );
    }
  }

  const userLabels = {};
  const userIds = [
    ...new Set([
      ...anomalies.map((a) => a.fantasyUserId),
      ...phantomGw1Rows.map((p) => p.fantasyUserId),
    ]),
  ];
  if (userIds.length) {
    const users = await FantasyUser.find({ _id: { $in: userIds } })
      .select('email displayName teamName managerName')
      .lean();
    for (const u of users) {
      userLabels[String(u._id)] = u.managerName || u.displayName || u.teamName || u.email;
    }
  }

  return {
    dryRun,
    anomalyCount: anomalies.length,
    phantomGw1Count: phantomGw1Rows.length,
    anomalies: anomalies.map((a) => ({
      ...a,
      managerLabel: userLabels[a.fantasyUserId] || a.fantasyUserId,
    })),
    phantomGw1Rows: phantomGw1Rows.map((p) => ({
      ...p,
      managerLabel: userLabels[p.fantasyUserId] || p.fantasyUserId,
    })),
    rescoreResults,
  };
}

module.exports = {
  findInitialSetupTransferAnomalies,
  repairInitialSetupTransferAnomalies,
};
