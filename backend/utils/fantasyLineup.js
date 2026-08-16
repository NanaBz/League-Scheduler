const STARTER_LIMITS = {
  GK: { min: 1, max: 1 },
  DF: { min: 2, max: 5 },
  MF: { min: 2, max: 5 },
  ATT: { min: 1, max: 4 },
};

const OUTFIELD_STARTERS = 8;

function normalizeStarterIds(starters) {
  const s = starters || {};
  return {
    gk: (Array.isArray(s.gk) ? s.gk : []).filter(Boolean).map(String).slice(0, 1),
    df: (Array.isArray(s.df) ? s.df : []).filter(Boolean).map(String),
    mf: (Array.isArray(s.mf) ? s.mf : []).filter(Boolean).map(String),
    att: (Array.isArray(s.att) ? s.att : []).filter(Boolean).map(String),
  };
}

function starterCountsValid(counts) {
  const { gk, df, mf, att } = counts;
  return (
    gk === STARTER_LIMITS.GK.min &&
    df >= STARTER_LIMITS.DF.min &&
    df <= STARTER_LIMITS.DF.max &&
    mf >= STARTER_LIMITS.MF.min &&
    mf <= STARTER_LIMITS.MF.max &&
    att >= STARTER_LIMITS.ATT.min &&
    att <= STARTER_LIMITS.ATT.max &&
    df + mf + att === OUTFIELD_STARTERS
  );
}

function describeStarterCountFailure(counts) {
  const { gk, df, mf, att } = counts;
  if (gk !== 1) return 'Your starting XI must have exactly 1 goalkeeper.';
  if (df < STARTER_LIMITS.DF.min) return 'You need at least 2 defenders in your starting XI.';
  if (mf < STARTER_LIMITS.MF.min) return 'You need at least 2 midfielders in your starting XI.';
  if (att < STARTER_LIMITS.ATT.min) return 'You need at least 1 attacker in your starting XI.';
  if (df > STARTER_LIMITS.DF.max) return 'You can start at most 5 defenders.';
  if (mf > STARTER_LIMITS.MF.max) return 'You can start at most 5 midfielders.';
  if (att > STARTER_LIMITS.ATT.max) return 'You can start at most 4 attackers.';
  return 'Invalid starting XI.';
}

function validateLineupPayload(lineup, squadSlotIds) {
  if (!lineup) {
    return { ok: false, message: 'Lineup is required.' };
  }

  const starters = normalizeStarterIds(lineup.starters);
  const bench = (Array.isArray(lineup.bench) ? lineup.bench : []).filter(Boolean).map(String);
  const counts = {
    gk: starters.gk.length,
    df: starters.df.length,
    mf: starters.mf.length,
    att: starters.att.length,
  };

  if (!starterCountsValid(counts)) {
    return { ok: false, message: describeStarterCountFailure(counts) };
  }

  if (bench.length !== 4) return { ok: false, message: 'Bench must have 4 players.' };

  const computedFormation = `${counts.df}-${counts.mf}-${counts.att}`;
  if (lineup.formation && lineup.formation !== computedFormation) {
    return { ok: false, message: 'Formation does not match selected starters.' };
  }

  const allIds = [
    ...starters.gk,
    ...starters.df,
    ...starters.mf,
    ...starters.att,
    ...bench,
  ];
  if (allIds.length !== 13) return { ok: false, message: 'Lineup must have 13 players.' };
  if (new Set(allIds).size !== allIds.length) return { ok: false, message: 'Duplicate players in lineup.' };

  const squadSet = new Set(squadSlotIds.map(String));
  for (const id of allIds) {
    if (!squadSet.has(id)) return { ok: false, message: 'Lineup includes a player not in your squad.' };
  }

  const cap = lineup.captainId ? String(lineup.captainId) : null;
  const vc = lineup.viceCaptainId ? String(lineup.viceCaptainId) : null;
  const starterIds = new Set([
    ...starters.gk,
    ...starters.df,
    ...starters.mf,
    ...starters.att,
  ]);
  if (cap && !starterIds.has(cap)) return { ok: false, message: 'Captain must be in the starting 9.' };
  if (vc && !starterIds.has(vc)) return { ok: false, message: 'Vice-captain must be in the starting 9.' };
  if (cap && vc && cap === vc) return { ok: false, message: 'Captain and vice-captain must differ.' };

  return {
    ok: true,
    normalized: {
      formation: computedFormation,
      starters,
      bench,
      captainId: cap,
      viceCaptainId: vc,
    },
  };
}

/** Default captain / vice-captain from transfer order when user has not set them. */
function resolveDefaultCaptainRoles(lineup, transferInOrder = []) {
  const starters = normalizeStarterIds(lineup?.starters || lineup);
  const starterIds = [
    ...starters.gk,
    ...starters.df,
    ...starters.mf,
    ...starters.att,
  ];
  const starterSet = new Set(starterIds.map(String));

  const pickFromOrder = (excludeId) => {
    for (const id of transferInOrder || []) {
      const sid = String(id);
      if (excludeId && sid === String(excludeId)) continue;
      if (starterSet.has(sid)) return sid;
    }
    return null;
  };

  let captainId = lineup.captainId ? String(lineup.captainId) : null;
  let viceCaptainId = lineup.viceCaptainId ? String(lineup.viceCaptainId) : null;

  if (!captainId) {
    captainId = pickFromOrder() || starterIds[0] || null;
  }
  if (!viceCaptainId) {
    viceCaptainId = pickFromOrder(captainId) || starterIds.find((id) => String(id) !== String(captainId)) || null;
  }

  return { captainId, viceCaptainId };
}

module.exports = { validateLineupPayload, resolveDefaultCaptainRoles, STARTER_LIMITS };
