import { FANTASY_PASSWORD_HINT, validateFantasyPassword } from './fantasyPasswordRules';

describe('fantasy password UX matches backend policy', () => {
  it('shows all backend requirements in the registration hint', () => {
    expect(FANTASY_PASSWORD_HINT).toMatch(/8 characters/i);
    expect(FANTASY_PASSWORD_HINT).toMatch(/uppercase/i);
    expect(FANTASY_PASSWORD_HINT).toMatch(/lowercase/i);
    expect(FANTASY_PASSWORD_HINT).toMatch(/number/i);
    expect(FANTASY_PASSWORD_HINT).toMatch(/special character/i);
  });

  it('accepts a strong password and rejects a weak one', () => {
    expect(validateFantasyPassword('SecurePass1!').isValid).toBe(true);
    expect(validateFantasyPassword('weak').isValid).toBe(false);
  });
});
