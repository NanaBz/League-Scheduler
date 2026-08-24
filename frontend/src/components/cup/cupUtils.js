import { ROUND_ORDER, ROUND_META } from './cupConstants';

export function resolveMyUserId(user) {
  return user?.id || user?.fantasyUserId || null;
}

/** Merge API schedule with tie data so every round is visible. */
export function mergeAllRounds(cup) {
  const schedule = cup?.schedule || [];
  const byRound = new Map((cup?.rounds || []).map((r) => [r.round, r]));

  return schedule.map((item) => {
    const existing = byRound.get(item.round) || {};
    const meta = ROUND_META[item.round] || {};
    return {
      round: item.round,
      label: item.label || meta.label,
      gameweek: item.gameweek,
      managersIn: meta.managersIn,
      managersOut: meta.managersOut,
      ties: existing.ties || [],
    };
  });
}

export function getRoundPhase(round, cup) {
  const ties = round.ties || [];
  const roundIdx = ROUND_ORDER.indexOf(round.round);
  const currentKey = cup?.currentRound?.round;
  const currentIdx = ROUND_ORDER.indexOf(currentKey);

  if (cup?.status === 'completed') {
    return ties.length ? 'completed' : roundIdx <= ROUND_ORDER.indexOf('F') ? 'completed' : 'upcoming';
  }

  if (!ties.length) {
    if (currentKey === round.round) return 'current';
    if (currentIdx >= 0 && roundIdx < currentIdx) return 'completed';
    if (currentIdx >= 0 && roundIdx === currentIdx) return 'current';
    return 'upcoming';
  }

  const allResolved = ties.every((t) => t.resolved);
  if (allResolved) return 'completed';
  if (currentKey === round.round) return 'current';
  return 'current';
}

export function deriveUserCupStatus(cup, myUserId) {
  if (!cup) return { type: 'unknown' };
  if (!myUserId) return { type: 'guest' };

  if (cup.status === 'pending' || !cup.mw5Complete) {
    return { type: 'pre_cup' };
  }

  const id = String(myUserId);
  const excluded = cup.excludedTeams?.find((t) => String(t.fantasyUserId) === id);
  const qualified = cup.qualifiedTeams?.some((t) => String(t.fantasyUserId) === id);

  if (excluded || (cup.mw5Complete && !qualified && cup.bracketGenerated)) {
    return {
      type: 'not_qualified',
      seed: excluded?.seed,
      qualificationPoints: excluded?.qualificationPoints,
    };
  }

  if (cup.winner && String(cup.winner.fantasyUserId) === id) {
    return { type: 'champion', winner: cup.winner };
  }

  const allRounds = mergeAllRounds(cup);
  for (const round of allRounds) {
    for (const tie of round.ties || []) {
      if (!tie.resolved) continue;
      const isHome = String(tie.home.fantasyUserId) === id;
      const isAway = String(tie.away.fantasyUserId) === id;
      if (!isHome && !isAway) continue;

      const won = (isHome && tie.home.isWinner) || (isAway && tie.away.isWinner);
      if (!won) {
        return {
          type: 'eliminated',
          roundLabel: round.label,
          roundKey: round.round,
          gameweek: round.gameweek,
        };
      }
    }
  }

  if (cup.status === 'completed' && cup.winner && String(cup.winner.fantasyUserId) !== id) {
    const finalRound = allRounds.find((r) => r.round === 'F');
    const inFinal = finalRound?.ties?.some(
      (t) =>
        String(t.home.fantasyUserId) === id || String(t.away.fantasyUserId) === id
    );
    if (inFinal) {
      return {
        type: 'eliminated',
        roundLabel: 'Final',
        roundKey: 'F',
        gameweek: finalRound?.gameweek || 10,
      };
    }
  }

  return {
    type: 'active',
    currentRound: cup.currentRound?.label || null,
    currentRoundKey: cup.currentRound?.round || null,
  };
}

export function findUserTieInRound(rounds, myUserId, roundKey) {
  if (!myUserId || !roundKey) return null;
  const id = String(myUserId);
  const round = rounds.find((r) => r.round === roundKey);
  if (!round?.ties?.length) return null;
  return (
    round.ties.find(
      (t) => String(t.home.fantasyUserId) === id || String(t.away.fantasyUserId) === id
    ) || null
  );
}

/** Resolved tie where the user was eliminated (for featured result card). */
export function findUserEliminationTie(allRounds, myUserId) {
  if (!myUserId) return { tie: null, round: null };
  const id = String(myUserId);

  for (const round of allRounds) {
    for (const tie of round.ties || []) {
      if (!tie.resolved) continue;
      const isHome = String(tie.home.fantasyUserId) === id;
      const isAway = String(tie.away.fantasyUserId) === id;
      if (!isHome && !isAway) continue;

      const won = (isHome && tie.home.isWinner) || (isAway && tie.away.isWinner);
      if (!won) return { tie, round };
    }
  }
  return { tie: null, round: null };
}

/** Active fixture or last elimination — for pinned featured card. */
export function findUserFeaturedMatch(allRounds, myUserId, userStatus, currentRoundKey) {
  if (!myUserId || !userStatus) return { tie: null, round: null, mode: null };

  if (userStatus.type === 'active') {
    const key = userStatus.currentRoundKey || currentRoundKey;
    const round = allRounds.find((r) => r.round === key) || null;
    const tie = findUserTieInRound(allRounds, myUserId, key);
    if (tie && round) return { tie, round, mode: 'active' };
  }

  if (userStatus.type === 'eliminated') {
    const { tie, round } = findUserEliminationTie(allRounds, myUserId);
    if (tie && round) return { tie, round, mode: 'eliminated' };
  }

  return { tie: null, round: null, mode: null };
}

export function filterTiesForUser(ties, myUserId, mineOnly) {
  if (!mineOnly || !myUserId) return ties;
  const id = String(myUserId);
  return ties.filter(
    (t) => String(t.home.fantasyUserId) === id || String(t.away.fantasyUserId) === id
  );
}

export function isUserInTie(tie, myUserId) {
  if (!tie || !myUserId) return false;
  const id = String(myUserId);
  return String(tie.home.fantasyUserId) === id || String(tie.away.fantasyUserId) === id;
}

export function formatFplPoints(points, { pending = false } = {}) {
  if (points == null) return pending ? 'Pending' : '—';
  return String(points);
}

function winnerSide(tie) {
  if (tie.home.isWinner) return 'home';
  if (tie.away.isWinner) return 'away';
  return null;
}

/** Human-readable tiebreak reason when gameweek FPL points were level. */
export function formatTiebreakReason(tie) {
  const tb = tie.tiebreak;
  if (!tb?.method) return null;

  const side = winnerSide(tie);
  if (!side) return null;

  const winnerGs = side === 'home' ? tb.homeGoalsScored : tb.awayGoalsScored;
  const loserGs = side === 'home' ? tb.awayGoalsScored : tb.homeGoalsScored;
  const winnerGc = side === 'home' ? tb.homeGoalsConceded : tb.awayGoalsConceded;
  const loserGc = side === 'home' ? tb.awayGoalsConceded : tb.homeGoalsConceded;

  switch (tb.method) {
    case 'goals_scored':
      return `most goals scored by starters (${winnerGs} vs ${loserGs})`;
    case 'goals_conceded':
      return `fewest goals conceded by GK/DEF (${winnerGc} vs ${loserGc})`;
    case 'coin_toss':
      return 'virtual coin toss after level goals scored and conceded';
    default:
      return 'FPL tiebreak rules';
  }
}

export function tieResultLabel(tie, myUserId) {
  if (!tie.resolved) {
    return { kind: 'upcoming', text: `Upcoming · Matchweek ${tie.gameweek}` };
  }

  const winner = tie.home.isWinner ? tie.home : tie.away.isWinner ? tie.away : null;
  if (!winner) return { kind: 'completed', text: 'Completed' };

  const id = myUserId ? String(myUserId) : null;
  const isMe = id && String(winner.fantasyUserId) === id;
  const iLost =
    id &&
    ((String(tie.home.fantasyUserId) === id && !tie.home.isWinner) ||
      (String(tie.away.fantasyUserId) === id && !tie.away.isWinner));

  const tiebreakReason = formatTiebreakReason(tie);
  const tiedPoints = tie.home.points;

  if (isMe) {
    if (tiebreakReason) {
      return { kind: 'win', text: `✓ YOU ADVANCE based on ${tiebreakReason}`, tiebreak: true };
    }
    return { kind: 'win', text: '✓ YOU ADVANCE' };
  }

  if (iLost) {
    if (tiebreakReason) {
      const ptsLabel = tiedPoints != null ? `tied on ${tiedPoints} pts; lost on ${tiebreakReason}` : tiebreakReason;
      return { kind: 'loss', text: `Eliminated — ${ptsLabel}`, tiebreak: true };
    }
    return { kind: 'loss', text: 'Eliminated' };
  }

  if (tiebreakReason) {
    return {
      kind: 'win',
      text: `✓ ${winner.teamName} advances based on ${tiebreakReason}`,
      tiebreak: true,
    };
  }

  return { kind: 'win', text: `✓ ${winner.teamName} advances` };
}

export function tiebreakNote(tie) {
  return formatTiebreakReason(tie);
}
