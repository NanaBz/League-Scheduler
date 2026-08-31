import {
  markAdminSessionActive,
  clearAdminSession,
  hasAdminSession,
} from './adminSession';

describe('adminSession', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('starts inactive', () => {
    expect(hasAdminSession()).toBe(false);
  });

  it('marks and detects an active admin session', () => {
    markAdminSessionActive();
    expect(hasAdminSession()).toBe(true);
  });

  it('clears the session on logout', () => {
    markAdminSessionActive();
    clearAdminSession();
    expect(hasAdminSession()).toBe(false);
  });
});
