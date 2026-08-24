/**
 * User-facing fixture phase (scheduled / live / ft).
 * Legacy API rows may omit matchState; infer from isPlayed.
 */

export function userFixturePhase(match) {
  if (!match || match.isVoided) return 'void';
  if (match.matchState === 'live') return 'live';
  if (match.isPlayed || match.matchState === 'ft') return 'ft';
  return 'scheduled';
}

export function statusBadgeClass(phase) {
  if (phase === 'void') return 'status-badge state-void';
  if (phase === 'live') return 'status-badge state-live';
  if (phase === 'ft') return 'status-badge state-ft';
  return 'status-badge state-scheduled';
}

export function statusBadgeLabel(phase) {
  if (phase === 'void') return 'VOID';
  if (phase === 'live') return 'LIVE';
  if (phase === 'ft') return 'FT';
  return 'Scheduled';
}

export function showFixtureScores(match) {
  const ph = userFixturePhase(match);
  return ph === 'live' || ph === 'ft';
}

/** Cup / knockout tie-breakers only — league matches never show a pens line in the UI. */
export function shouldShowMatchPenalties(match) {
  if (!match || match.competition === 'league') return false;
  const h = match.homePenalties;
  const a = match.awayPenalties;
  if (h === undefined || a === undefined || h === null || a === null) return false;
  if (h === '' || a === '') return false;
  return Number.isFinite(Number(h)) && Number.isFinite(Number(a));
}

export function fixtureCardClassName(match) {
  if (!match) return 'fixture-card scheduled';
  if (match.isVoided) return 'fixture-card scheduled';
  const ph = userFixturePhase(match);
  if (ph === 'live') return 'fixture-card fixture-live';
  if (ph === 'ft') return 'fixture-card played';
  return 'fixture-card scheduled';
}

export function desktopFixtureBadgeClass(match) {
  if (match.isVoided) return 'badge-danger';
  const ph = userFixturePhase(match);
  if (ph === 'live') return 'badge-live';
  if (ph === 'ft') return 'badge-success';
  return 'badge-scheduled';
}

export function desktopFixtureBadgeLabel(match) {
  if (match.isVoided) return 'Void';
  const ph = userFixturePhase(match);
  if (ph === 'live') return 'Live';
  if (ph === 'ft') return 'Played';
  return 'Scheduled';
}
