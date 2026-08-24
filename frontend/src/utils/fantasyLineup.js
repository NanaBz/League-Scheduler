/** Fantasy pick team — 9 starters (1 GK + dynamic outfield) + 4 bench = 13 */

export const STARTER_LIMITS = {
  GK: { min: 1, max: 1 },
  DF: { min: 2, max: 5 },
  MF: { min: 2, max: 5 },
  ATT: { min: 1, max: 4 },
};

export const OUTFIELD_STARTERS = 8;

export function playerId(p) {
  if (!p) return null;
  return String(p._id || p.id || '');
}

export function flattenSquad(squad) {
  if (!squad) return [];
  return ['GK', 'DF', 'MF', 'ATT'].flatMap((pos) => (squad[pos] || []).filter(Boolean));
}

export function countByPosition(players) {
  const out = { GK: 0, DF: 0, MF: 0, ATT: 0 };
  for (const p of players || []) {
    const pos = p?.position;
    if (pos && out[pos] !== undefined) out[pos] += 1;
  }
  return out;
}

export function formationFromCounts(df, mf, att) {
  const id = `${df}-${mf}-${att}`;
  return { id, label: id, def: df, mid: mf, att };
}

export function formationFromLineup(lineup) {
  const df = (lineup?.starters?.df || []).filter(Boolean).length;
  const mf = (lineup?.starters?.mf || []).filter(Boolean).length;
  const att = (lineup?.starters?.att || []).filter(Boolean).length;
  return formationFromCounts(df, mf, att);
}

export function starterCountsValid(counts) {
  const { GK, DF, MF, ATT } = counts;
  return (
    GK === STARTER_LIMITS.GK.min &&
    DF >= STARTER_LIMITS.DF.min &&
    DF <= STARTER_LIMITS.DF.max &&
    MF >= STARTER_LIMITS.MF.min &&
    MF <= STARTER_LIMITS.MF.max &&
    ATT >= STARTER_LIMITS.ATT.min &&
    ATT <= STARTER_LIMITS.ATT.max &&
    DF + MF + ATT === OUTFIELD_STARTERS
  );
}

export function describeStarterCountFailure(counts) {
  const { GK, DF, MF, ATT } = counts;
  if (GK !== 1) return 'Your starting XI must have exactly 1 goalkeeper.';
  if (DF < STARTER_LIMITS.DF.min) return 'You need at least 2 defenders in your starting XI.';
  if (MF < STARTER_LIMITS.MF.min) return 'You need at least 2 midfielders in your starting XI.';
  if (ATT < STARTER_LIMITS.ATT.min) return 'You need at least 1 attacker in your starting XI.';
  if (DF > STARTER_LIMITS.DF.max) return 'You can start at most 5 defenders.';
  if (MF > STARTER_LIMITS.MF.max) return 'You can start at most 5 midfielders.';
  if (ATT > STARTER_LIMITS.ATT.max) return 'You can start at most 4 attackers.';
  if (DF + MF + ATT !== OUTFIELD_STARTERS) return 'Your starting XI must have 9 players.';
  return 'That swap would break lineup rules.';
}

function padBench(arr, len = 4) {
  const copy = [...arr];
  while (copy.length < len) copy.push(null);
  return copy.slice(0, len);
}

function pickDefaultDistribution(players) {
  const c = countByPosition(players);
  const presets = [
    [3, 3, 2],
    [4, 2, 2],
    [3, 2, 3],
    [2, 3, 3],
    [4, 3, 1],
    [2, 4, 2],
    [2, 2, 4],
  ];

  for (const [df, mf, att] of presets) {
    if (df <= c.DF && mf <= c.MF && att <= c.ATT) {
      return formationFromCounts(df, mf, att);
    }
  }

  let df = STARTER_LIMITS.DF.min;
  let mf = STARTER_LIMITS.MF.min;
  let att = STARTER_LIMITS.ATT.min;
  let remaining = OUTFIELD_STARTERS - df - mf - att;

  const add = (pos, max, squadCount) => {
    const room = Math.min(max, squadCount) - (pos === 'DF' ? df : pos === 'MF' ? mf : att);
    const take = Math.min(remaining, room);
    if (pos === 'DF') df += take;
    else if (pos === 'MF') mf += take;
    else att += take;
    remaining -= take;
  };

  add('DF', STARTER_LIMITS.DF.max, c.DF);
  add('MF', STARTER_LIMITS.MF.max, c.MF);
  add('ATT', STARTER_LIMITS.ATT.max, c.ATT);

  return formationFromCounts(df, mf, att);
}

export function buildLineupFromGroups(starterPlayers, benchPlayers, options = {}) {
  const starters = (starterPlayers || []).filter(Boolean);
  const bench = (benchPlayers || []).filter(Boolean);
  const counts = countByPosition(starters);

  if (!starterCountsValid(counts)) return null;

  const byPos = { GK: [], DF: [], MF: [], ATT: [] };
  for (const p of starters) {
    if (p?.position && byPos[p.position]) byPos[p.position].push(p);
  }

  return sanitizeCaptainRoles({
    formation: `${counts.DF}-${counts.MF}-${counts.ATT}`,
    starters: {
      gk: byPos.GK.slice(0, 1),
      df: byPos.DF,
      mf: byPos.MF,
      att: byPos.ATT,
    },
    bench: padBench(bench),
    captainId: options.captainId || null,
    viceCaptainId: options.viceCaptainId || null,
  });
}

/** Build 9 starters + 4 bench from 13 squad players using default distribution. */
export function buildLineupFromSquad(players, options = {}) {
  const distribution = pickDefaultDistribution(players);
  const byPos = {
    GK: players.filter((p) => p.position === 'GK'),
    DF: players.filter((p) => p.position === 'DF'),
    MF: players.filter((p) => p.position === 'MF'),
    ATT: players.filter((p) => p.position === 'ATT'),
  };

  const gkStarters = byPos.GK.slice(0, 1);
  const dfStarters = byPos.DF.slice(0, distribution.def);
  const mfStarters = byPos.MF.slice(0, distribution.mid);
  const attStarters = byPos.ATT.slice(0, distribution.att);
  const starterSet = new Set(
    [...gkStarters, ...dfStarters, ...mfStarters, ...attStarters].map(playerId)
  );
  const bench = players.filter((p) => !starterSet.has(playerId(p))).slice(0, 4);

  return buildLineupFromGroups(
    [...gkStarters, ...dfStarters, ...mfStarters, ...attStarters],
    bench,
    options
  );
}

export function relayoutLineup(lineup) {
  if (!lineup) return null;
  return buildLineupFromGroups(allStarters(lineup), lineup.bench || [], {
    captainId: lineup.captainId,
    viceCaptainId: lineup.viceCaptainId,
  });
}

export function allStarters(lineup) {
  if (!lineup?.starters) return [];
  return [
    ...(lineup.starters.gk || []),
    ...(lineup.starters.df || []),
    ...(lineup.starters.mf || []),
    ...(lineup.starters.att || []),
  ].filter(Boolean);
}

function sanitizeCaptainRoles(lineup) {
  if (!lineup) return lineup;
  const starterIds = new Set(allStarters(lineup).map(playerId));
  let captainId = lineup.captainId || null;
  let viceCaptainId = lineup.viceCaptainId || null;
  if (captainId && !starterIds.has(String(captainId))) captainId = null;
  if (viceCaptainId && !starterIds.has(String(viceCaptainId))) viceCaptainId = null;
  if (captainId && viceCaptainId && captainId === viceCaptainId) viceCaptainId = null;
  return { ...lineup, captainId, viceCaptainId };
}

/** Default captain / vice-captain from transfer-in order when user has not set them. */
export function resolveDefaultCaptainRoles(lineup, transferInOrder = []) {
  const starters = allStarters(lineup);
  const starterIds = starters.map(playerId).filter(Boolean);
  const starterSet = new Set(starterIds.map(String));

  const pickFromOrder = (excludeId) => {
    for (const id of transferInOrder || []) {
      const sid = String(id);
      if (excludeId && sid === String(excludeId)) continue;
      if (starterSet.has(sid)) return sid;
    }
    return null;
  };

  let captainId = lineup?.captainId ? String(lineup.captainId) : null;
  let viceCaptainId = lineup?.viceCaptainId ? String(lineup.viceCaptainId) : null;

  if (!captainId) {
    captainId = pickFromOrder() || starterIds[0] || null;
  }
  if (!viceCaptainId) {
    viceCaptainId =
      pickFromOrder(captainId) ||
      starterIds.find((id) => String(id) !== String(captainId)) ||
      null;
  }

  return { captainId, viceCaptainId };
}

export function applyDefaultCaptainRoles(lineup, transferInOrder = []) {
  if (!lineup) return lineup;
  const roles = resolveDefaultCaptainRoles(lineup, transferInOrder);
  return {
    ...lineup,
    captainId: lineup.captainId || roles.captainId,
    viceCaptainId: lineup.viceCaptainId || roles.viceCaptainId,
  };
}

export function lineupPlayerIds(lineup) {
  return [...allStarters(lineup), ...(lineup.bench || [])].filter(Boolean).map(playerId);
}

export function validateLineup(lineup) {
  const starters = allStarters(lineup);
  const bench = (lineup.bench || []).filter(Boolean);
  const counts = countByPosition(starters);

  if (!starterCountsValid(counts)) {
    return { ok: false, message: describeStarterCountFailure(counts) };
  }

  if (bench.length !== 4) return { ok: false, message: 'Bench must have 4 players.' };

  const ids = lineupPlayerIds(lineup);
  if (new Set(ids).size !== ids.length) return { ok: false, message: 'Duplicate players in lineup.' };
  if (ids.length !== 13) return { ok: false, message: 'Lineup must include all 13 squad players.' };

  const starterIds = new Set(starters.map(playerId));
  if (lineup.captainId && !starterIds.has(String(lineup.captainId))) {
    return { ok: false, message: 'Captain must be in the starting 9 (not on the bench).' };
  }
  if (lineup.viceCaptainId && !starterIds.has(String(lineup.viceCaptainId))) {
    return { ok: false, message: 'Vice-captain must be in the starting 9 (not on the bench).' };
  }

  const expectedFormation = `${counts.DF}-${counts.MF}-${counts.ATT}`;
  if (lineup.formation && lineup.formation !== expectedFormation) {
    return { ok: false, message: 'Formation does not match selected starters.' };
  }

  return { ok: true };
}

function findBenchIndex(bench, pid) {
  return (bench || []).findIndex((p) => p && playerId(p) === pid);
}

function findStarterIndex(starters, pid) {
  return starters.findIndex((p) => playerId(p) === pid);
}

/** Swap two players; outfield layout is rebuilt from position counts. */
export function swapLineupPlayers(lineup, playerA, playerB) {
  if (!lineup || !playerA || !playerB || playerId(playerA) === playerId(playerB)) {
    return { ok: false, lineup, message: 'Choose a different player to swap.' };
  }

  const idA = playerId(playerA);
  const idB = playerId(playerB);
  let starters = [...allStarters(lineup)];
  let bench = [...(lineup.bench || [])];

  const aStarter = findStarterIndex(starters, idA) >= 0;
  const bStarter = findStarterIndex(starters, idB) >= 0;

  if (aStarter && bStarter) {
    const i = findStarterIndex(starters, idA);
    const j = findStarterIndex(starters, idB);
    [starters[i], starters[j]] = [starters[j], starters[i]];
  } else if (aStarter && !bStarter) {
    const i = findStarterIndex(starters, idA);
    const j = findBenchIndex(bench, idB);
    if (j < 0) return { ok: false, lineup, message: 'Player not found in lineup.' };
    const benchPlayer = bench[j];
    bench[j] = starters[i];
    starters[i] = benchPlayer;
  } else if (!aStarter && bStarter) {
    const i = findBenchIndex(bench, idA);
    const j = findStarterIndex(starters, idB);
    if (i < 0) return { ok: false, lineup, message: 'Player not found in lineup.' };
    const benchPlayer = bench[i];
    bench[i] = starters[j];
    starters[j] = benchPlayer;
  } else {
    const i = findBenchIndex(bench, idA);
    const j = findBenchIndex(bench, idB);
    if (i < 0 || j < 0) return { ok: false, lineup, message: 'Player not found on bench.' };
    [bench[i], bench[j]] = [bench[j], bench[i]];
    return {
      ok: true,
      lineup: sanitizeCaptainRoles({
        ...lineup,
        bench: padBench(bench.filter(Boolean)),
      }),
    };
  }

  const next = buildLineupFromGroups(starters, bench, {
    captainId: lineup.captainId,
    viceCaptainId: lineup.viceCaptainId,
  });

  if (!next) {
    return {
      ok: false,
      lineup,
      message: describeStarterCountFailure(countByPosition(starters)),
    };
  }

  return { ok: true, lineup: next };
}

function mapPlayerIds(arr) {
  return (arr || []).filter(Boolean).map(playerId).filter(Boolean);
}

export function lineupToPayload(lineup, options = {}) {
  const sanitized = sanitizeCaptainRoles(lineup);
  const counts = countByPosition(allStarters(sanitized));
  return {
    formation: `${counts.DF}-${counts.MF}-${counts.ATT}`,
    starters: {
      gk: mapPlayerIds(sanitized.starters.gk),
      df: mapPlayerIds(sanitized.starters.df),
      mf: mapPlayerIds(sanitized.starters.mf),
      att: mapPlayerIds(sanitized.starters.att),
    },
    bench: mapPlayerIds(sanitized.bench),
    captainId: sanitized.captainId || null,
    viceCaptainId: sanitized.viceCaptainId || null,
    chipUsed: options.chipUsed || null,
    counts: {
      def: counts.DF,
      mid: counts.MF,
      att: counts.ATT,
    },
  };
}

function normalizeIdList(arr) {
  return (arr || []).map((id) => String(id)).filter(Boolean);
}

/** Canonical payload shape for comparing saved vs current pick-team state. */
export function normalizeLineupPayload(payload) {
  if (!payload) return null;
  return {
    formation: payload.formation || null,
    starters: {
      gk: normalizeIdList(payload.starters?.gk),
      df: normalizeIdList(payload.starters?.df),
      mf: normalizeIdList(payload.starters?.mf),
      att: normalizeIdList(payload.starters?.att),
    },
    bench: normalizeIdList(payload.bench),
    captainId: payload.captainId ? String(payload.captainId) : null,
    viceCaptainId: payload.viceCaptainId ? String(payload.viceCaptainId) : null,
    chipUsed: payload.chipUsed || null,
  };
}

export function lineupPayloadsEqual(a, b) {
  const left = normalizeLineupPayload(a);
  const right = normalizeLineupPayload(b);
  if (!left || !right) return left === right;
  return JSON.stringify(left) === JSON.stringify(right);
}

export function hydrateLineupFromPayload(payload, playersById) {
  const resolvePlayer = (idOrPlayer) => {
    if (!idOrPlayer) return null;
    if (typeof idOrPlayer === 'object') {
      const pid = playerId(idOrPlayer);
      if (pid && playersById.has(pid)) return playersById.get(pid);
      if (idOrPlayer.name && idOrPlayer.position) return idOrPlayer;
      return null;
    }
    return playersById.get(String(idOrPlayer)) || null;
  };

  const starters = payload?.starters || {};
  const raw = {
    formation: payload?.formation,
    starters: {
      gk: (starters.gk || []).map(resolvePlayer),
      df: (starters.df || []).map(resolvePlayer),
      mf: (starters.mf || []).map(resolvePlayer),
      att: (starters.att || []).map(resolvePlayer),
    },
    bench: (payload.bench || []).map(resolvePlayer),
    captainId: payload.captainId ? String(payload.captainId) : null,
    viceCaptainId: payload.viceCaptainId ? String(payload.viceCaptainId) : null,
  };

  return relayoutLineup(raw) || raw;
}
