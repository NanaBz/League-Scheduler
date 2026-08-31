/** Girls Super Cup — best-of-3, first to 2 wins (Orion vs Firestorm). */

export const GSC_WINS_TO_CLINCH = 2;
export const GSC_MAX_ROUNDS = 3;
export const GSC_TEAMS = ['Orion', 'Firestorm'];

export function resolveGscMatchWinnerName(match) {
  if (!match || match.isVoided || !match.isPlayed) return null;
  const h = match.homeScore;
  const a = match.awayScore;
  if (typeof h !== 'number' || typeof a !== 'number') return null;
  if (h > a) return match.homeTeam?.name || null;
  if (a > h) return match.awayTeam?.name || null;
  const hp = match.homePenalties;
  const ap = match.awayPenalties;
  if (hp != null && ap != null && hp !== ap) {
    return hp > ap ? match.homeTeam?.name : match.awayTeam?.name;
  }
  return null;
}

export function buildGirlsSuperCupSeries(matches) {
  const gscMatches = (matches || [])
    .filter((m) => m?.competition === 'girls-super-cup' && m.homeTeam && m.awayTeam)
    .slice()
    .sort((a, b) => Number(a.matchweek) - Number(b.matchweek));

  const winsByTeam = { Orion: 0, Firestorm: 0 };
  for (const m of gscMatches) {
    const winner = resolveGscMatchWinnerName(m);
    if (winner && Object.prototype.hasOwnProperty.call(winsByTeam, winner)) {
      winsByTeam[winner] += 1;
    }
  }

  let champion = null;
  if (winsByTeam.Orion >= GSC_WINS_TO_CLINCH) champion = 'Orion';
  else if (winsByTeam.Firestorm >= GSC_WINS_TO_CLINCH) champion = 'Firestorm';

  const rounds = Array.from({ length: GSC_MAX_ROUNDS }, (_, i) => {
    const round = i + 1;
    const match = gscMatches.find((m) => String(m.matchweek) === String(round)) || null;
    return { round, match };
  });

  return { rounds, winsByTeam, champion, matches: gscMatches };
}

export function gscTeamIsMatchWinner(match, teamName) {
  return resolveGscMatchWinnerName(match) === teamName;
}
