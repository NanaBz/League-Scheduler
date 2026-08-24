export const MAX_PLAYERS_PER_CLUB = 3;

export function resolvePlayerTeamId(player) {
  if (!player) return null;
  const teamRef = player.team?._id || player.teamId || player.team;
  return teamRef ? String(teamRef) : null;
}

/** Validate hydrated squad object (GK/DF/MF/ATT arrays) — final state, max 3 per club. */
export function validateSquadClubLimits(squad) {
  if (!squad) return { valid: true };

  const counts = new Map();
  const names = new Map();

  for (const player of Object.values(squad).flat().filter(Boolean)) {
    const teamId = resolvePlayerTeamId(player);
    if (!teamId) continue;
    names.set(teamId, player.team?.name || 'this team');
    counts.set(teamId, (counts.get(teamId) || 0) + 1);
  }

  for (const [teamId, count] of counts.entries()) {
    if (count > MAX_PLAYERS_PER_CLUB) {
      return {
        valid: false,
        message: `You cannot have more than ${MAX_PLAYERS_PER_CLUB} players from ${names.get(teamId)}. This squad would have ${count}.`,
      };
    }
  }

  return { valid: true };
}
