const assert = require('assert');
const {
  resolveRegisterDuplicateKeyResponse,
  sanitizeKeyValueForLog,
} = require('./fantasyRegisterDuplicateKey');

async function run() {
  const duplicateUser = { _id: 'u1', email: 'exists@example.com' };

  const accountExists = await resolveRegisterDuplicateKeyResponse(
    { code: 11000, keyPattern: { email: 1 }, keyValue: { email: 'exists@example.com' } },
    'exists@example.com',
    {
      findUserByEmail: async () => duplicateUser,
      respondAccountAlreadyExists: async (user, email) => ({ user, email }),
    }
  );
  assert.strictEqual(accountExists.type, 'accountExists');
  const handled = await accountExists.handler();
  assert.strictEqual(handled.user, duplicateUser);

  const googleBlocked = await resolveRegisterDuplicateKeyResponse(
    { code: 11000, keyPattern: { googleId: 1 }, keyValue: { googleId: 'g-123' } },
    'new@example.com',
    {
      findUserByEmail: async () => null,
      respondAccountAlreadyExists: async () => null,
    }
  );
  assert.strictEqual(googleBlocked.type, 'registrationBlocked');
  assert.strictEqual(googleBlocked.status, 503);
  assert.strictEqual(googleBlocked.body.registrationBlocked, true);
  assert.ok(!googleBlocked.body.accountExists);

  const unknownCause = await resolveRegisterDuplicateKeyResponse(
    { code: 11000, keyPattern: { email: 1 }, keyValue: { email: 'ghost@example.com' } },
    'ghost@example.com',
    {
      findUserByEmail: async () => null,
      respondAccountAlreadyExists: async () => null,
    }
  );
  assert.strictEqual(unknownCause.type, 'registrationBlocked');
  assert.strictEqual(unknownCause.status, 503);
  assert.strictEqual(unknownCause.body.registrationBlocked, true);
  assert.strictEqual(unknownCause.body.accountExists, undefined);

  const notDuplicate = await resolveRegisterDuplicateKeyResponse(
    { code: 12345 },
    'any@example.com',
    {
      findUserByEmail: async () => null,
      respondAccountAlreadyExists: async () => null,
    }
  );
  assert.strictEqual(notDuplicate, null);

  const sanitized = sanitizeKeyValueForLog({
    email: 'a@b.com',
    password: 'secret',
    verificationCodeHash: 'hash',
  });
  assert.strictEqual(sanitized.email, 'a@b.com');
  assert.strictEqual(sanitized.password, '[redacted]');
  assert.strictEqual(sanitized.verificationCodeHash, '[redacted]');

  console.log('fantasyRegisterDuplicateKey tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
