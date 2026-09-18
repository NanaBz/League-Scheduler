/**
 * Resolve HTTP response for MongoDB E11000 during fantasy registration.
 * Returns null when err is not a duplicate-key error.
 */
async function resolveRegisterDuplicateKeyResponse(err, email, { findUserByEmail, respondAccountAlreadyExists }) {
  if (err?.code !== 11000) {
    return null;
  }

  const keyPattern = err.keyPattern || {};
  const keyValue = err.keyValue || {};
  console.error('Fantasy register duplicate key:', keyPattern, sanitizeKeyValueForLog(keyValue));

  const duplicateUser = await findUserByEmail(email);
  if (duplicateUser) {
    return {
      type: 'accountExists',
      handler: () => respondAccountAlreadyExists(duplicateUser, email),
    };
  }

  if (keyPattern.googleId != null) {
    return {
      type: 'registrationBlocked',
      status: 503,
      body: {
        success: false,
        registrationBlocked: true,
        message:
          'Registration is temporarily blocked by a database configuration issue. The league admin must run the googleId index fix script, then try again.',
      },
    };
  }

  return {
    type: 'registrationBlocked',
    status: 503,
    body: {
      success: false,
      registrationBlocked: true,
      message:
        'Registration could not be completed due to a temporary server issue. Please try again in a few minutes or contact the league admin if this continues.',
    },
  };
}

function sanitizeKeyValueForLog(keyValue) {
  const safe = {};
  for (const [key, value] of Object.entries(keyValue)) {
    if (key === 'password' || key === 'verificationCodeHash' || key === 'passwordResetTokenHash') {
      safe[key] = '[redacted]';
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

module.exports = {
  resolveRegisterDuplicateKeyResponse,
  sanitizeKeyValueForLog,
};
