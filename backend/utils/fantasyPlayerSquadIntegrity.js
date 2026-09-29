const {
  MAX_PLAYERS_PER_CLUB,
  countPlayersPerClub,
  findClubLimitViolation,
  validateMaxPlayersPerClubFromPlayers,
} = require('./fantasySquadValidation');

function isPlayerInactive(player) {
  return Boolean(player && player.active === false);
}

function clubLimitExcessTotal(playersById, playerIds) {
  const { counts } = countPlayersPerClub(playersById, playerIds);
  let total = 0;
  for (const count of counts.values()) {
    if (count > MAX_PLAYERS_PER_CLUB) {
      total += count - MAX_PLAYERS_PER_CLUB;
    }
  }
  return total;
}

/**
 * Allow saves that reduce (or clear) a >3-club violation; reject new/worsening violations.
 */
function validateClubLimitTransition(playersById, previousPlayerIds, nextPlayerIds) {
  const prev = [...new Set((previousPlayerIds || []).map(String))];
  const next = [...new Set((nextPlayerIds || []).map(String))];

  if (!next.length) {
    return validateMaxPlayersPerClubFromPlayers(playersById, next);
  }

  const oldExcess = prev.length ? clubLimitExcessTotal(playersById, prev) : 0;
  const newExcess = clubLimitExcessTotal(playersById, next);

  if (newExcess === 0) {
    return { ok: true };
  }
  if (oldExcess > 0 && newExcess < oldExcess) {
    return { ok: true };
  }

  const { counts, names } = countPlayersPerClub(playersById, next);
  const message =
    findClubLimitViolation(counts, names) ||
    `You cannot have more than ${MAX_PLAYERS_PER_CLUB} players from one club.`;
  if (oldExcess > 0) {
    return {
      ok: false,
      message: `${message} Sell a player from that club to fix your squad before making other changes.`,
    };
  }
  return { ok: false, message };
}

/**
 * Inactive players may remain only until removed; cannot be newly added or kept on save.
 */
function validateInactivePlayerTransition(playersById, previousPlayerIds, nextPlayerIds) {
  const prev = new Set((previousPlayerIds || []).map(String));
  const next = [...new Set((nextPlayerIds || []).map(String))];

  for (const id of next) {
    const player = playersById.get(String(id));
    if (!player) continue;
    if (!isPlayerInactive(player)) continue;

    const label = player.name || 'This player';
    if (!prev.has(String(id))) {
      return {
        ok: false,
        message: `${label} is inactive and cannot be added to your squad.`,
      };
    }
    return {
      ok: false,
      message: `${label} is inactive. Remove them from your squad before saving.`,
    };
  }

  return { ok: true };
}

function validateSquadPlayerLifecycle(playersById, previousPlayerIds, nextPlayerIds) {
  const inactiveCheck = validateInactivePlayerTransition(
    playersById,
    previousPlayerIds,
    nextPlayerIds
  );
  if (!inactiveCheck.ok) return inactiveCheck;

  const prev = previousPlayerIds || [];
  if (prev.length) {
    return validateClubLimitTransition(playersById, prev, nextPlayerIds);
  }
  return validateMaxPlayersPerClubFromPlayers(playersById, nextPlayerIds);
}

module.exports = {
  isPlayerInactive,
  clubLimitExcessTotal,
  validateClubLimitTransition,
  validateInactivePlayerTransition,
  validateSquadPlayerLifecycle,
};
