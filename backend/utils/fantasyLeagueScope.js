/**
 * Fantasy is scoped to league competition matches only.
 * Cup, Super Cup, ACWPL, and girls competitions must not affect fantasy data or admin tools.
 */
const FANTASY_MATCH_COMPETITION = 'league';

function assertFantasyLeagueMatch(match, res) {
  if (!match) {
    res.status(404).json({ success: false, message: 'Match not found' });
    return false;
  }
  if (match.competition !== FANTASY_MATCH_COMPETITION) {
    res.status(403).json({
      success: false,
      message: 'This match is not a league fixture.',
    });
    return false;
  }
  return true;
}

module.exports = {
  FANTASY_MATCH_COMPETITION,
  assertFantasyLeagueMatch,
};
