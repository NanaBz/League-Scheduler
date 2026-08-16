/** Map real team names → kit codes for fantasy jerseys (extend as you add teams). */
const TEAM_NAME_TO_CODE = {
  Warriors: 'KWF',
  Dragons: 'DRA',
  Vikings: 'VIK',
  Lions: 'LIO',
  Elites: 'ELI',
  Falcons: 'FAL',
};

export function getTeamCode(player) {
  if (!player) return 'DEF';
  const teamName = player.team?.name || player.teamName || '';
  return player.teamCode || TEAM_NAME_TO_CODE[teamName] || 'DEF';
}

/**
 * Gradient fills for outfield kits; GK uses a distinct purple keeper gradient.
 * Pairs align with the pitch kit-* CSS theme (gold/black, blue/slate, etc.).
 */
export function kitColors(teamCode, pos) {
  const isGk = String(pos || '').toUpperCase() === 'GK';
  if (isGk) {
    return {
      gradientFrom: '#f5f3ff',
      gradientTo: '#5b21b6',
      stroke: '#1e1033',
      primary: '#6d28d9',
    };
  }
  switch (teamCode) {
    case 'KWF':
      return { gradientFrom: '#fde047', gradientTo: '#171717', stroke: '#422006' };
    case 'DRA':
      return { gradientFrom: '#bfdbfe', gradientTo: '#1e40af', stroke: '#172554' };
    case 'VIK':
      return { gradientFrom: '#fecaca', gradientTo: '#b91c1c', stroke: '#7f1d1d' };
    case 'LIO':
      return { gradientFrom: '#bbf7d0', gradientTo: '#166534', stroke: '#14532d' };
    case 'ELI':
      return { gradientFrom: '#737373', gradientTo: '#0a0a0a', stroke: '#e5e5e5' };
    case 'FAL':
      return { gradientFrom: '#ffffff', gradientTo: '#94a3b8', stroke: '#0f172a' };
    default:
      return { gradientFrom: '#94a3b8', gradientTo: '#1e293b', stroke: '#0f172a' };
  }
}
