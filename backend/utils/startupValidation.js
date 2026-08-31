/**
 * Fail fast in production when required secrets or safety flags are misconfigured.
 * Development keeps convenient fallbacks elsewhere in the codebase.
 */
function isTruthyEnv(value) {
  if (value == null || value === '') return false;
  const s = String(value).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

function fantasyEmailVerifyBypassEnabled() {
  return isTruthyEnv(process.env.FANTASY_BYPASS_EMAIL_VERIFY);
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

  const smtpKeys = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  for (const key of smtpKeys) {
    if (!String(process.env[key] || '').trim()) {
      errors.push(`${key} is required in production for email verification and password reset`);
    }
  }

  if (fantasyEmailVerifyBypassEnabled()) {
    errors.push('FANTASY_BYPASS_EMAIL_VERIFY must not be enabled in production');
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
