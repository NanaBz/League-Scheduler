const { OAuth2Client } = require('google-auth-library');

async function verifyGoogleIdToken(credential) {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  if (!clientId) {
    throw new Error('Google Sign-In is not configured.');
  }

  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: clientId,
  });
  const payload = ticket.getPayload();

  if (!payload?.email) {
    throw new Error('Google account did not provide an email address.');
  }
  if (!payload.email_verified) {
    throw new Error('Your Google email must be verified before signing in.');
  }

  return {
    googleId: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: payload.name || '',
    picture: payload.picture || null,
  };
}

module.exports = {
  verifyGoogleIdToken,
};
