export const FANTASY_PASSWORD_HINT =
  'At least 8 characters with uppercase, lowercase, a number, and a special character (!@#$…).';

export function validateFantasyPassword(password) {
  const errors = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long.');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Include at least one uppercase letter.');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Include at least one lowercase letter.');
  }
  if (!/\d/.test(password)) {
    errors.push('Include at least one number.');
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Include at least one special character.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
