const assert = require('assert');
const {
  fantasySkipEmailVerifyEnabled,
  getFantasyAuthPublicConfig,
} = require('./fantasyAuthConfig');

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

withEnv(
  {
    NODE_ENV: 'production',
    FANTASY_SKIP_EMAIL_VERIFY: 'true',
    GOOGLE_CLIENT_ID: 'google-client-id',
    ADMIN_EMAIL: 'admin@example.com',
  },
  () => {
    assert.strictEqual(fantasySkipEmailVerifyEnabled(), true);
    const config = getFantasyAuthPublicConfig();
    assert.strictEqual(config.skipEmailVerify, true);
    assert.strictEqual(config.googleSignInEnabled, true);
    assert.strictEqual(config.adminContactEmail, 'admin@example.com');
  }
);

withEnv(
  {
    NODE_ENV: 'development',
    FANTASY_SKIP_EMAIL_VERIFY: undefined,
    FANTASY_BYPASS_EMAIL_VERIFY: 'true',
  },
  () => {
    assert.strictEqual(fantasySkipEmailVerifyEnabled(), true);
  }
);

console.log('fantasyAuthConfig tests passed');
