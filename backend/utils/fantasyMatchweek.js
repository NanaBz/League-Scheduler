const { FANTASY_MATCH_COMPETITION } = require('./fantasyLeagueScope');

function leagueMatches(matches) {
  return (matches || []).filter(
    (m) => m && m.competition === FANTASY_MATCH_COMPETITION && m.isVoided !== true
  );
}

function isMatchFinished(m) {
  if (!m) return false;
  if (m.isVoided) return true;
  return m.isPlayed === true || m.matchState === 'ft';
}

/** True when every published league fixture in this matchweek is FT or voided. */
function isMatchweekComplete(matches, matchweek) {
  const list = leagueMatches(matches).filter(
    (m) => m.isPublished !== false && Number(m.matchweek) === Number(matchweek)
  );
  if (!list.length) return false;
  return list.every(isMatchFinished);
}

function latestCompletedMatchweek(matches) {
  const weeks = [
    ...new Set(
      leagueMatches(matches)
        .filter((m) => m.isPublished !== false && m.matchweek != null)
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

function completedMatchweeks(matches) {
  const weeks = [
    ...new Set(
      leagueMatches(matches)
        .filter((m) => m.isPublished !== false && m.matchweek != null)
        .map((m) => Number(m.matchweek))
    ),
  ].sort((a, b) => a - b);
  return weeks.filter((w) => isMatchweekComplete(matches, w));
}

module.exports = {
  isMatchFinished,
  isMatchweekComplete,
  latestCompletedMatchweek,
  completedMatchweeks,
};
