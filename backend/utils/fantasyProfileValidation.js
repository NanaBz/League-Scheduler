const MAX_MANAGER_NAME_LENGTH = 50;
const MAX_TEAM_NAME_LENGTH = 50;

function validateManagerName(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return { ok: false, message: 'Manager name is required.' };
  }
  if (trimmed.length > MAX_MANAGER_NAME_LENGTH) {
    return {
      ok: false,
      message: `Manager name must be ${MAX_MANAGER_NAME_LENGTH} characters or fewer.`,
    };
  }
  return { ok: true, value: trimmed };
}

function validateFantasyTeamName(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return { ok: false, message: 'Fantasy team name is required.' };
  }
  if (trimmed.length > MAX_TEAM_NAME_LENGTH) {
    return {
      ok: false,
      message: `Fantasy team name must be ${MAX_TEAM_NAME_LENGTH} characters or fewer.`,
    };
  }
  return { ok: true, value: trimmed };
}

function serializeFantasyUser(user) {
  return {
    id: user._id,
    email: user.email,
    teamName: user.teamName,
    managerName: user.managerName,
    isVerified: user.isVerified,
    lastLogin: user.lastLogin,
  };
}

module.exports = {
  MAX_MANAGER_NAME_LENGTH,
  MAX_TEAM_NAME_LENGTH,
  validateManagerName,
  validateFantasyTeamName,
  serializeFantasyUser,
};
