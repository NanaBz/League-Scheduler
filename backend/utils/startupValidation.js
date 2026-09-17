/**
 * Fail fast in production when required secrets or safety flags are misconfigured.
 * Development keeps convenient fallbacks elsewhere in the codebase.
 */
const {
  isTruthyEnv,
  getProductionEmailConfigErrors,
} = require('./emailConfig');
const { fantasySkipEmailVerifyEnabled } = require('./fantasyAuthConfig');

function fantasyEmailVerifyBypassEnabled() {
  return fantasySkipEmailVerifyEnabled();
}

function validateProductionStartup() {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const errors = [];

  const required = [
    'MONGODB_URI',
    'ADMIN_JWT_SECRET',
    'FANTASY_JWT_SECRET',
    'CORS_ORIGINS',
    'FRONTEND_URL',
  ];

  for (const key of required) {
    if (!String(process.env[key] || '').trim()) {
      errors.push(`${key} is required in production`);
    }
  }

  if (!fantasySkipEmailVerifyEnabled()) {
    errors.push(...getProductionEmailConfigErrors());
  }

  if (
    process.env.FANTASY_JWT_SECRET &&
    process.env.ADMIN_JWT_SECRET &&
    process.env.FANTASY_JWT_SECRET === process.env.ADMIN_JWT_SECRET
  ) {
    errors.push('FANTASY_JWT_SECRET must differ from ADMIN_JWT_SECRET in production');
  }

  if (errors.length) {
    throw new Error(`Production startup validation failed:\n- ${errors.join('\n- ')}`);
  }
}

module.exports = {
  validateProductionStartup,
  fantasyEmailVerifyBypassEnabled,
  isTruthyEnv,
};
