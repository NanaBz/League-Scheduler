/** Session flag: admin authenticated via footer login (cleared on logout). */
const ADMIN_SESSION_KEY = 'aplAdminFooterSession';

export function markAdminSessionActive() {
  try {
    sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearAdminSession() {
  try {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function hasAdminSession() {
  try {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}
