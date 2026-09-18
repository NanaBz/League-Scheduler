/**
 * Admin fantasy password reset — email normalization regression test.
 * Uses the same findUserByEmail lookup strategy as fantasyAdmin reset-password.
 */
const assert = require('assert');
const express = require('express');
const http = require('http');
const path = require('path');
const bcrypt = require('bcryptjs');
const { validatePasswordStrength } = require('../middleware/fantasyAuth');

function httpRequest(app, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: urlPath,
          method,
          headers: { 'Content-Type': 'application/json' },
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => {
            raw += chunk;
          });
          res.on('end', () => {
            server.close();
            resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : {} });
          });
        }
      );
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      if (body != null) req.write(JSON.stringify(body));
      req.end();
    });
  });
}

async function run() {
  const store = new Map();
  const legacyEmail = 'Admin.User@acity.edu.gh';
  const user = {
    _id: 'admin-reset-user',
    email: legacyEmail,
    teamName: 'Admin FC',
    managerName: 'Admin Manager',
    authProvider: 'local',
    password: await bcrypt.hash('OldPass1!', 12),
    clearPasswordResetToken() {},
    async save() {
      store.set(legacyEmail, this);
      return this;
    },
  };
  store.set(legacyEmail, user);

  const modelPath = path.join(__dirname, '..', 'models', 'FantasyUser.js');
  require.cache[require.resolve(modelPath)] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: {
      findOne(query) {
        if (query.email && typeof query.email === 'string') {
          return Promise.resolve(store.get(query.email) || null);
        }
        if (query.email?.$regex) {
          for (const value of store.values()) {
            if (query.email.$regex.test(value.email)) return Promise.resolve(value);
          }
        }
        return Promise.resolve(null);
      },
    },
  };

  delete require.cache[require.resolve('../utils/fantasyUserLookup')];
  const { findUserByEmail } = require('../utils/fantasyUserLookup');

  const app = express();
  app.use(express.json());
  app.post('/fantasy/admin/users/reset-password', async (req, res) => {
    const email = String(req.body.email || '').trim();
    const { newPassword, confirmPassword } = req.body;
    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'Missing fields.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ success: false, message: 'Password is too weak.' });
    }
    const matchedUser = await findUserByEmail(email);
    if (!matchedUser) {
      return res.status(404).json({ success: false, message: 'Fantasy account not found.' });
    }
    matchedUser.password = newPassword;
    matchedUser.authProvider = 'local';
    matchedUser.clearPasswordResetToken();
    await matchedUser.save();
    return res.json({
      success: true,
      message: `Password updated for ${matchedUser.teamName} (${matchedUser.email}).`,
    });
  });

  const response = await httpRequest(app, 'POST', '/fantasy/admin/users/reset-password', {
    email: 'admin.user@acity.edu.gh',
    newPassword: 'NewPass1!',
    confirmPassword: 'NewPass1!',
  });

  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.body.success, true);
  assert.strictEqual(user.password, 'NewPass1!');

  console.log('fantasyAdmin.resetPassword tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
