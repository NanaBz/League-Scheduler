const assert = require('assert');
const {
  getEmailProvider,
  getProductionEmailConfigErrors,
  resendConfigured,
} = require('./emailConfig');

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
    NODE_ENV: 'development',
    RESEND_API_KEY: 're_test',
    EMAIL_FROM: 'ACity Fantasy <noreply@example.com>',
    SMTP_HOST: undefined,
    SMTP_PORT: undefined,
    SMTP_USER: undefined,
    SMTP_PASS: undefined,
  },
  () => {
    assert.strictEqual(getEmailProvider(), 'resend');
    assert.strictEqual(resendConfigured(), true);
    assert.deepStrictEqual(getProductionEmailConfigErrors(), []);
  }
);

withEnv(
  {
    NODE_ENV: 'production',
    RESEND_API_KEY: 're_test',
    EMAIL_FROM: undefined,
    SMTP_HOST: undefined,
    SMTP_PORT: undefined,
    SMTP_USER: undefined,
    SMTP_PASS: undefined,
  },
  () => {
    const errors = getProductionEmailConfigErrors();
    assert.ok(errors.some((err) => err.includes('EMAIL_FROM')));
  }
);

withEnv(
  {
    NODE_ENV: 'production',
    RESEND_API_KEY: undefined,
    EMAIL_FROM: undefined,
    SMTP_HOST: 'smtp.test',
    SMTP_PORT: '587',
    SMTP_USER: 'user',
    SMTP_PASS: 'pass',
  },
  () => {
    assert.strictEqual(getEmailProvider(), 'smtp');
    assert.deepStrictEqual(getProductionEmailConfigErrors(), []);
  }
);

withEnv(
  {
    NODE_ENV: 'production',
    RESEND_API_KEY: undefined,
    EMAIL_FROM: undefined,
    SMTP_HOST: undefined,
    SMTP_PORT: undefined,
    SMTP_USER: undefined,
    SMTP_PASS: undefined,
  },
  () => {
    assert.strictEqual(getEmailProvider(), null);
    assert.ok(getProductionEmailConfigErrors().length > 0);
  }
);

console.log('emailConfig tests passed');
