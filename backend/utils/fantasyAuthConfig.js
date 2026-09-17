const { isTruthyEnv, getEmailProvider } = require('./emailConfig');

function fantasySkipEmailVerifyEnabled() {
  if (isTruthyEnv(process.env.FANTASY_SKIP_EMAIL_VERIFY)) {
    return true;
  }
  return process.env.NODE_ENV !== 'production' && isTruthyEnv(process.env.FANTASY_BYPASS_EMAIL_VERIFY);
}

function googleSignInEnabled() {
  return Boolean(String(process.env.GOOGLE_CLIENT_ID || '').trim());
}

function passwordResetViaEmailEnabled() {
  const provider = getEmailProvider();
  return provider === 'resend' || provider === 'smtp';
}

function getFantasyAdminContactEmail() {
  return (
    String(process.env.FANTASY_ADMIN_CONTACT_EMAIL || '').trim() ||
    String(process.env.ADMIN_EMAIL || '').trim() ||
    null
  );
}

function getFantasyAuthPublicConfig() {
  return {
    skipEmailVerify: fantasySkipEmailVerifyEnabled(),
    googleSignInEnabled: googleSignInEnabled(),
    passwordResetViaEmail: passwordResetViaEmailEnabled(),
    adminContactEmail: getFantasyAdminContactEmail(),
  };
}

module.exports = {
  fantasySkipEmailVerifyEnabled,
  googleSignInEnabled,
  passwordResetViaEmailEnabled,
  getFantasyAdminContactEmail,
  getFantasyAuthPublicConfig,
};
