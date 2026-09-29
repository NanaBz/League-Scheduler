export const MAX_PLAYERS_PER_CLUB = 3;

export function resolvePlayerTeamId(player) {
  if (!player) return null;
  const teamRef = player.team?._id || player.teamId || player.team;
  return teamRef ? String(teamRef) : null;
}

function countPlayersPerClubFromSquad(squad) {
  const counts = new Map();
  const names = new Map();

  for (const player of Object.values(squad || {}).flat().filter(Boolean)) {
    const teamId = resolvePlayerTeamId(player);
    if (!teamId) continue;
    names.set(teamId, player.team?.name || 'this team');
    counts.set(teamId, (counts.get(teamId) || 0) + 1);
  }

  return { counts, names };
}

function clubLimitExcessTotal(squad) {
  const { counts } = countPlayersPerClubFromSquad(squad);
  let total = 0;
  for (const count of counts.values()) {
    if (count > MAX_PLAYERS_PER_CLUB) {
      total += count - MAX_PLAYERS_PER_CLUB;
    }
  }
  return total;
}

function findClubLimitViolation(counts, names) {
  for (const [teamId, count] of counts.entries()) {
    if (count > MAX_PLAYERS_PER_CLUB) {
      return `You cannot have more than ${MAX_PLAYERS_PER_CLUB} players from ${names.get(teamId) || 'this team'}. This squad would have ${count}.`;
    }
  }
  return null;
}

/** Strict check — final squad must be legal. */
export function validateSquadClubLimits(squad) {
  const { counts, names } = countPlayersPerClubFromSquad(squad);
  const message = findClubLimitViolation(counts, names);
  if (message) return { valid: false, message };
  return { valid: true };
}

/** Allow corrective transfers that reduce an existing >3-club violation. */
export function validateSquadClubLimitTransition(previousSquad, nextSquad) {
  const oldExcess = previousSquad ? clubLimitExcessTotal(previousSquad) : 0;
  const newExcess = clubLimitExcessTotal(nextSquad);

  if (newExcess === 0) return { valid: true };

  if (oldExcess > 0 && newExcess < oldExcess) {
    return { valid: true };
  }

  const { counts, names } = countPlayersPerClubFromSquad(nextSquad);
  let message = findClubLimitViolation(counts, names);
  if (oldExcess > 0) {
    message = `${message} Sell a player from that club to fix your squad before making other changes.`;
  }
  return { valid: false, message };
}

export function isInactiveOwnedPlayer(player) {
  return Boolean(player && player.fantasyAvailability === 'inactive');
}

export function squadHasInactivePlayers(squad) {
  return Object.values(squad || {})
    .flat()
    .filter(Boolean)
    .some(isInactiveOwnedPlayer);
}

export function squadHasMissingPlayers(squad) {
  return Object.values(squad || {})
    .flat()
    .filter(Boolean)
    .some((p) => p.fantasyAvailability === 'missing');
}
