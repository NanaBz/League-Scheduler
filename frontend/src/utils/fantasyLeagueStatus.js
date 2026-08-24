/** Shared helpers for Overall Acity League user status (UI only). */

export function isSameFantasyUser(resultOrRow, user) {
  if (!resultOrRow || !user) return false;
  const id = resultOrRow.fantasyUserId;
  if (id && user.id && String(id) === String(user.id)) return true;
  const team = String(resultOrRow.teamName || resultOrRow.team || '').trim().toLowerCase();
  const userTeam = String(user.teamName || '').trim().toLowerCase();
  return Boolean(team && userTeam && team === userTeam);
}

export function deriveUserLeagueStatus({
  seasonComplete,
  champion,
  runnerUp,
  user,
  displayRank,
  userEntry,
}) {
  if (!user) return { type: 'guest' };

  if (seasonComplete) {
    if (champion && isSameFantasyUser(champion, user)) {
      return { type: 'champion', result: champion };
    }
    if (runnerUp && isSameFantasyUser(runnerUp, user)) {
      return { type: 'runner_up', result: runnerUp };
    }
    return {
      type: 'finished',
      rank: displayRank,
      totalPoints: userEntry?.total ?? null,
    };
  }

  if (displayRank != null) {
    return { type: 'active', rank: displayRank };
  }

  return { type: 'preseason' };
}

function entryToSeasonResult(entry) {
  if (!entry || entry.pos == null) return null;
  return {
    fantasyUserId: entry.fantasyUserId,
    teamName: entry.team,
    managerName: entry.user,
    totalPoints: entry.total,
    rank: entry.pos,
  };
}

/** Supports older API responses that omit champion/runnerUp/seasonComplete. */
export function normalizeSeasonResults({
  seasonComplete,
  latestCompletedGameweek,
  preseason,
  champion,
  runnerUp,
  entries,
  maxMatchweek = 10,
}) {
  const complete =
    Boolean(seasonComplete) ||
    (!preseason && (latestCompletedGameweek || 0) >= maxMatchweek);

  if (!complete) {
    return { seasonComplete: false, champion: null, runnerUp: null };
  }

  if (champion) {
    return { seasonComplete: true, champion, runnerUp: runnerUp || null };
  }

  const sorted = [...(entries || [])].sort((a, b) => (a.pos ?? 999) - (b.pos ?? 999));
  return {
    seasonComplete: true,
    champion: entryToSeasonResult(sorted.find((e) => e.pos === 1)),
    runnerUp: entryToSeasonResult(sorted.find((e) => e.pos === 2)),
  };
}
