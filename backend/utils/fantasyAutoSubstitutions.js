const {
  normalizeStarterIds,
  starterCountsValid,
} = require('./fantasyLineup');

const STARTER_SLOT_ORDER = ['gk', 'df', 'mf', 'att'];

function pid(value) {
  if (!value) return null;
  return String(typeof value === 'object' ? value._id || value.id : value);
}

/** Automatic substitution trigger: starter played 0 minutes in the gameweek. */
function starterDidNotPlay(playerId, playerMinutes) {
  if (!playerId) return false;
  const minutes = playerMinutes?.get?.(String(playerId)) ?? 0;
  return minutes === 0;
}

/** Bench players with 0 gameweek points are skipped as autosub candidates. */
function benchPlayerHasScoringPoints(playerId, playerPoints) {
  const points = playerPoints?.get?.(String(playerId)) ?? 0;
  return points > 0;
}

function cloneStarters(starters) {
  const normalized = normalizeStarterIds(starters);
  return {
    gk: [...normalized.gk],
    df: [...normalized.df],
    mf: [...normalized.mf],
    att: [...normalized.att],
  };
}

function collectLineupPlayerIds(lineup) {
  const ids = new Set();
  if (!lineup) return ids;
  const starters = normalizeStarterIds(lineup.starters);
  for (const key of STARTER_SLOT_ORDER) {
    for (const id of starters[key]) ids.add(String(id));
  }
  for (const id of lineup.bench || []) {
    const parsed = pid(id);
    if (parsed) ids.add(parsed);
  }
  return ids;
}

function findStarterSlot(starters, playerId) {
  const id = String(playerId);
  const normalized = normalizeStarterIds(starters);
  for (const key of STARTER_SLOT_ORDER) {
    const idx = normalized[key].indexOf(id);
    if (idx >= 0) return { key, idx };
  }
  return null;
}

function positionToStarterKey(position) {
  const p = String(position || '').toUpperCase();
  if (p === 'GK') return 'gk';
  if (p === 'DF') return 'df';
  if (p === 'MF') return 'mf';
  if (p === 'ATT') return 'att';
  return null;
}

function starterCountsFromStarters(starters) {
  const normalized = normalizeStarterIds(starters);
  return {
    gk: normalized.gk.length,
    df: normalized.df.length,
    mf: normalized.mf.length,
    att: normalized.att.length,
  };
}

function computeFormation(starters) {
  const counts = starterCountsFromStarters(starters);
  return `${counts.df}-${counts.mf}-${counts.att}`;
}

/**
 * Hypothetically swap a non-playing starter with a bench player.
 * Returns new starters object if valid, otherwise null.
 */
function trySubstitution(starters, starterId, benchId, playerPositions) {
  const slot = findStarterSlot(starters, starterId);
  if (!slot) return null;

  const benchPos = playerPositions.get(String(benchId));
  const benchKey = positionToStarterKey(benchPos);
  if (!benchKey) return null;

  const starterIsGk = slot.key === 'gk';
  const benchIsGk = benchPos === 'GK';
  if (starterIsGk !== benchIsGk) return null;

  const nextStarters = cloneStarters(starters);
  nextStarters[slot.key].splice(slot.idx, 1);
  nextStarters[benchKey].push(String(benchId));

  if (!starterCountsValid(starterCountsFromStarters(nextStarters))) {
    return null;
  }

  return nextStarters;
}

function listNonPlayingStarters(starters, playerMinutes) {
  const normalized = normalizeStarterIds(starters);
  const ordered = [];
  for (const key of STARTER_SLOT_ORDER) {
    for (const id of normalized[key]) {
      if (starterDidNotPlay(id, playerMinutes)) {
        ordered.push(String(id));
      }
    }
  }
  return ordered;
}

/**
 * Apply ACFPL automatic bench substitutions on a copy of the saved lineup.
 * Pure function — no database access.
 */
function applyAutoSubstitutions(lineup, playerPoints, playerMinutes, playerPositions, options = {}) {
  const { gameweekComplete = false, chipUsed = null } = options;

  if (!lineup || !gameweekComplete || chipUsed === 'BB') {
    return {
      effectiveLineup: lineup,
      substitutions: [],
      changed: false,
    };
  }

  let starters = cloneStarters(lineup.starters);
  const effectiveBench = (lineup.bench || []).map(pid).filter(Boolean);
  while (effectiveBench.length < 4) effectiveBench.push(null);

  const usedBench = new Set();
  const substitutions = [];
  const dnpStarters = listNonPlayingStarters(starters, playerMinutes);

  for (const starterId of dnpStarters) {
    if (!findStarterSlot(starters, starterId)) continue;

    for (let benchIndex = 0; benchIndex < effectiveBench.length; benchIndex += 1) {
      const benchId = effectiveBench[benchIndex];
      if (!benchId || usedBench.has(benchId)) continue;
      if (!benchPlayerHasScoringPoints(benchId, playerPoints)) continue;

      const nextStarters = trySubstitution(starters, starterId, benchId, playerPositions);
      if (!nextStarters) continue;

      starters = nextStarters;
      effectiveBench[benchIndex] = starterId;
      usedBench.add(benchId);
      substitutions.push({
        out: starterId,
        in: benchId,
        benchIndex,
      });
      break;
    }
  }

  const effectiveLineup = {
    ...lineup,
    starters,
    bench: effectiveBench.slice(0, 4),
    formation: computeFormation(starters),
  };

  return {
    effectiveLineup,
    substitutions,
    changed: substitutions.length > 0,
  };
}

module.exports = {
  starterDidNotPlay,
  benchPlayerHasScoringPoints,
  collectLineupPlayerIds,
  applyAutoSubstitutions,
};
