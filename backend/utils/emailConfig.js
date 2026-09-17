function isDevelopmentEnv() {
  return process.env.NODE_ENV !== 'production';
}

function isTruthyEnv(value) {
  if (value == null || value === '') return false;
  const s = String(value).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

function getEmailFrom() {
  return String(process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
}

function resendConfigured() {
  return Boolean(String(process.env.RESEND_API_KEY || '').trim());
}

function smtpConfigured() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  return [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS].every((value) => String(value || '').trim());
}

/** @returns {'resend' | 'smtp' | 'console' | null} */
function getEmailProvider() {
  if (resendConfigured()) return 'resend';
  if (smtpConfigured()) return 'smtp';
  if (isDevelopmentEnv()) return 'console';
  return null;
}

function getProductionEmailConfigErrors() {
  const errors = [];

  if (resendConfigured()) {
    if (!getEmailFrom()) {
      errors.push('EMAIL_FROM is required in production when using Resend (e.g. ACity Fantasy <noreply@yourdomain.com>)');
    }
    return errors;
  }

  if (smtpConfigured()) {
    return errors;
  }

  errors.push(
    'Email is not configured for production. Set RESEND_API_KEY + EMAIL_FROM (recommended), or SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS'
  );
  return errors;
}

module.exports = {
  getEmailFrom,
  getEmailProvider,
  getProductionEmailConfigErrors,
  isTruthyEnv,
  resendConfigured,
  smtpConfigured,
};
