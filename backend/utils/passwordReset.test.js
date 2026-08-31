const assert = require('assert');
const {
  generateResetToken,
  hashResetToken,
  isResetTokenValid,
  resetTokenExpiry,
  buildResetUrl,
  GENERIC_FORGOT_MESSAGE,
} = require('./passwordReset');

async function run() {
  const token = generateResetToken();
  assert.strictEqual(typeof token, 'string');
  assert.ok(token.length >= 32);

  const hash = await hashResetToken(token);
  assert.ok(hash.startsWith('$2'));

  const valid = await isResetTokenValid(token, hash, resetTokenExpiry(60));
  assert.strictEqual(valid, true);

  const expired = await isResetTokenValid(token, hash, new Date(Date.now() - 1000));
  assert.strictEqual(expired, false);

  const wrong = await isResetTokenValid('wrong-token', hash, resetTokenExpiry(60));
  assert.strictEqual(wrong, false);

  const url = buildResetUrl('/fantasy', token);
  assert.ok(url.includes('/fantasy?reset='));

  assert.ok(GENERIC_FORGOT_MESSAGE.includes('If an account exists'));

  console.log('passwordReset tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
