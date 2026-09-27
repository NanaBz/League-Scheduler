const FantasySquad = require('../models/FantasySquad');
const FantasyUser = require('../models/FantasyUser');
const {
  getFirstLineupGameweek,
  looksLikeMisclassifiedInitialSetup,
} = require('./fantasySquadEstablishment');
const { runGameweekRescore } = require('./fantasyRescoreGameweek');

/**
 * Managers whose first lineup GW was charged a transfer hit for initial squad construction.
 */
async function findInitialSetupTransferAnomalies() {
  const squads = await FantasySquad.find({
    matchweek: { $gte: 2 },
    transferHitPoints: { $gt: 0 },
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
    const firstLineupGw = await getFirstLineupGameweek(fantasyUserId);
    if (firstLineupGw == null || firstLineupGw <= 1) continue;

    const debutRow = rows.find((r) => Number(r.matchweek) === firstLineupGw);
    if (!debutRow) continue;
    if (!looksLikeMisclassifiedInitialSetup(debutRow, firstLineupGw)) continue;
    if ((debutRow.transferHitPoints || 0) <= 0) continue;

    anomalies.push({
      fantasyUserId,
      matchweek: firstLineupGw,
      transferHitPoints: debutRow.transferHitPoints,
      points: debutRow.points,
      transfersInCount: debutRow.transfersIn?.length || 0,
      transfersOutCount: debutRow.transfersOut?.length || 0,
      squadId: String(debutRow._id),
    });
  }

  return anomalies;
}

async function repairInitialSetupTransferAnomalies(dryRun = true) {
  const anomalies = await findInitialSetupTransferAnomalies();
  const actions = [];
  const gameweeksToRescore = new Set();

  for (const row of anomalies) {
    actions.push({
      ...row,
      action: dryRun ? 'would_clear_transfers_and_rescore' : 'clear_transfers_and_rescore',
    });
    gameweeksToRescore.add(row.matchweek);

    if (!dryRun) {
      await FantasySquad.updateOne(
        { _id: row.squadId },
        { $set: { transfersIn: [], transfersOut: [] } }
      );
    }
  }

  const rescoreResults = [];
  if (!dryRun) {
    for (const mw of [...gameweeksToRescore].sort((a, b) => a - b)) {
      rescoreResults.push(await runGameweekRescore(mw, { forceAutosubRecalc: true }));
    }
  }

  const userLabels = {};
  if (anomalies.length) {
    const users = await FantasyUser.find({
      _id: { $in: anomalies.map((a) => a.fantasyUserId) },
    })
      .select('email displayName teamName')
      .lean();
    for (const u of users) {
      userLabels[String(u._id)] = u.displayName || u.teamName || u.email;
    }
  }

  return {
    dryRun,
    anomalyCount: anomalies.length,
    anomalies: anomalies.map((a) => ({
      ...a,
      managerLabel: userLabels[a.fantasyUserId] || a.fantasyUserId,
    })),
    rescoreResults,
  };
}

module.exports = {
  findInitialSetupTransferAnomalies,
  repairInitialSetupTransferAnomalies,
};
