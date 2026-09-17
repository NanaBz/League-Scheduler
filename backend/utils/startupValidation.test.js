const assert = require('assert');
const { validateProductionStartup, isTruthyEnv } = require('./startupValidation');

function withEnv(overrides, fn) {
  const saved = {};
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key];
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key];
    }
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  }
}

withEnv({ NODE_ENV: 'development' }, () => {
  validateProductionStartup();
});

withEnv(
  {
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb://localhost/test',
    ADMIN_JWT_SECRET: 'admin-secret',
    FANTASY_JWT_SECRET: 'fantasy-secret',
    CORS_ORIGINS: 'https://example.com',
    FRONTEND_URL: 'https://example.com',
    FANTASY_SKIP_EMAIL_VERIFY: 'true',
    GOOGLE_CLIENT_ID: 'google-client-id.apps.googleusercontent.com',
  },
  () => {
    validateProductionStartup();
  }
);

let threw = false;
withEnv(
  {
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb://localhost/test',
    ADMIN_JWT_SECRET: 'same',
    FANTASY_JWT_SECRET: 'same',
    CORS_ORIGINS: 'https://example.com',
    FRONTEND_URL: 'https://example.com',
    FANTASY_SKIP_EMAIL_VERIFY: 'true',
    GOOGLE_CLIENT_ID: 'google-client-id.apps.googleusercontent.com',
  },
  () => {
    try {
      validateProductionStartup();
    } catch (err) {
      threw = true;
      assert.ok(err.message.includes('FANTASY_JWT_SECRET must differ'));
    }
  }
);
assert.strictEqual(threw, true);

assert.strictEqual(isTruthyEnv('true'), true);
assert.strictEqual(isTruthyEnv('0'), false);

console.log('startupValidation tests passed');
