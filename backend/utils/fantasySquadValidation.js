const MAX_PLAYERS_PER_CLUB = 3;
const FANTASY_BUDGET_M = 100.0;

function clubLimitMessage(teamName, count) {
  return `You cannot have more than ${MAX_PLAYERS_PER_CLUB} players from ${teamName}. This squad has ${count}.`;
}

/** Count players per real-life club from loaded player docs keyed by id. */
function countPlayersPerClub(playersById, playerIds) {
  const counts = new Map();
  const names = new Map();

  for (const id of playerIds) {
    const player = playersById.get(String(id));
    if (!player) continue;
    const teamId = String(player.team?._id || player.team || '');
    if (!teamId) continue;
    names.set(teamId, player.team?.name || 'this team');
    counts.set(teamId, (counts.get(teamId) || 0) + 1);
  }

  return { counts, names };
}

function findClubLimitViolation(counts, names) {
  for (const [teamId, count] of counts.entries()) {
    if (count > MAX_PLAYERS_PER_CLUB) {
      return clubLimitMessage(names.get(teamId) || 'this team', count);
    }
  }
  return null;
}

/** Validate final squad slots — max 3 players from any one real-life club. */
function validateMaxPlayersPerClubFromPlayers(playersById, playerIds) {
  const ids = [...new Set((playerIds || []).filter(Boolean).map(String))];
  if (!ids.length) return { ok: true };

  const { counts, names } = countPlayersPerClub(playersById, ids);
  const message = findClubLimitViolation(counts, names);
  if (message) return { ok: false, message };
  return { ok: true };
}

/** Sum fantasyPrice for squad player ids using authoritative player docs. */
function calculateSquadTotalCost(playersById, playerIds) {
  let total = 0;
  for (const id of playerIds || []) {
    const player = playersById.get(String(id));
    if (!player) continue;
    total += Number(player.fantasyPrice) || 0;
  }
  return total;
}

/** Validate final squad cost against the standard AC 100.0m budget. */
function validateSquadBudgetFromPlayers(playersById, playerIds) {
  const ids = [...(playerIds || []).filter(Boolean).map(String)];
  if (!ids.length) return { ok: true };

  const totalCost = calculateSquadTotalCost(playersById, ids);
  if (totalCost > FANTASY_BUDGET_M) {
    return { ok: false, message: 'Squad exceeds available budget.' };
  }
  return { ok: true };
}

module.exports = {
  MAX_PLAYERS_PER_CLUB,
  FANTASY_BUDGET_M,
  validateMaxPlayersPerClubFromPlayers,
  validateSquadBudgetFromPlayers,
  calculateSquadTotalCost,
  countPlayersPerClub,
  findClubLimitViolation,
};
