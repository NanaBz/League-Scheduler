import { userFixturePhase } from './matchDisplayState';

export function isMatchweekComplete(matches, matchweek) {
  const list = (matches || []).filter(
    (m) => m && m.competition === 'league' && m.isVoided !== true && Number(m.matchweek) === Number(matchweek)
  );
  if (!list.length) return false;
  return list.every((m) => {
    const ph = userFixturePhase(m);
    return ph === 'ft' || ph === 'void';
  });
}

export function latestCompletedMatchweek(matches) {
  const weeks = [
    ...new Set(
      (matches || [])
        .filter((m) => m && m.competition === 'league' && m.isVoided !== true && m.matchweek != null)
        .map((m) => Number(m.matchweek))
    ),
  ].sort((a, b) => a - b);

  let latest = 0;
  for (const w of weeks) {
    if (isMatchweekComplete(matches, w)) latest = w;
    else break;
  }
  return latest;
}

export function isPastDeadline(deadline) {
  if (!deadline) return false;
  return Date.now() > new Date(deadline).getTime();
}
