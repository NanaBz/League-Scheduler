/**
 * Fantasy auth route regression tests (mocked model + dependencies).
 */
const assert = require('assert');
const express = require('express');
const http = require('http');
const path = require('path');
const bcrypt = require('bcryptjs');

const VALID_PASSWORD = 'SecurePass1!';

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
            let parsed = {};
            try {
              parsed = raw ? JSON.parse(raw) : {};
            } catch {
              parsed = { raw };
            }
            resolve({ status: res.statusCode, body: parsed });
          });
        }
      );
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      if (body != null) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  });
}

function createMockUser(data = {}) {
  const user = {
    _id: data._id || `user-${Math.random().toString(36).slice(2)}`,
    email: data.email,
    password: data.password || null,
    teamName: data.teamName || 'Team',
    managerName: data.managerName || 'Manager',
    authProvider: data.authProvider || 'local',
    isVerified: data.isVerified ?? true,
    googleId: data.googleId,
    verificationCodeHash: null,
    verificationCodeExpires: null,
    lastLogin: data.lastLogin ?? null,
    isModified(field) {
      return field === 'password';
    },
    async save() {
      if (createMockUser.saveError) {
        throw createMockUser.saveError;
      }
      createMockUser.store.set(user.email, user);
      return user;
    },
    async comparePassword(candidate) {
      if (!user.password) return false;
      return bcrypt.compare(candidate, user.password);
    },
    hasPasswordLogin() {
      return user.authProvider !== 'google' && Boolean(user.password);
    },
    async setVerificationCode() {},
    clearPasswordResetToken() {},
  };
  return user;
}
createMockUser.store = new Map();
createMockUser.saveError = null;

function installMocks() {
  const modelPath = path.join(__dirname, '..', 'models', 'FantasyUser.js');
  require.cache[require.resolve(modelPath)] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: class FantasyUser {
      constructor(data) {
        Object.assign(this, createMockUser(data));
      }
      static findOne(query) {
        if (query.googleId) {
          for (const user of createMockUser.store.values()) {
            if (user.googleId === query.googleId) {
              return Promise.resolve(user);
            }
          }
          return Promise.resolve(null);
        }
        if (query.email && typeof query.email === 'string') {
          return Promise.resolve(createMockUser.store.get(query.email) || null);
        }
        if (query.email?.$regex) {
          for (const user of createMockUser.store.values()) {
            if (query.email.$regex.test(user.email)) {
              return Promise.resolve(user);
            }
          }
        }
        return Promise.resolve(null);
      }
      static find() {
        return { select: () => ({ lean: async () => [] }) };
      }
    },
  };

  const mailerPath = path.join(__dirname, '..', 'utils', 'mailer.js');
  require.cache[require.resolve(mailerPath)] = {
    id: mailerPath,
    filename: mailerPath,
    loaded: true,
    exports: {
      sendVerificationEmail: async () => {},
      sendPasswordResetEmail: async () => {},
    },
  };

  const googlePath = path.join(__dirname, '..', 'utils', 'googleAuth.js');
  require.cache[require.resolve(googlePath)] = {
    id: googlePath,
    filename: googlePath,
    loaded: true,
    exports: {
      verifyGoogleIdToken: async (credential) => {
        if (credential === 'missing-account') {
          return { googleId: 'gid-missing', email: 'missing@example.com' };
        }
        if (credential === 'existing-account') {
          return { googleId: 'gid-existing', email: 'google@example.com' };
        }
        throw new Error('Unknown test credential');
      },
    },
  };

  const configPath = path.join(__dirname, '..', 'utils', 'fantasyAuthConfig.js');
  require.cache[require.resolve(configPath)] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      fantasySkipEmailVerifyEnabled: () => true,
      passwordResetViaEmailEnabled: () => false,
      getFantasyAuthPublicConfig: () => ({
        skipEmailVerify: true,
        googleSignInEnabled: true,
        passwordResetViaEmail: false,
        adminContactEmail: 'admin@example.com',
      }),
      getFantasyAdminContactEmail: () => 'admin@example.com',
      googleSignInEnabled: () => true,
    },
  };

  const deletePath = path.join(__dirname, '..', 'utils', 'fantasyAccountDelete.js');
  require.cache[require.resolve(deletePath)] = {
    id: deletePath,
    filename: deletePath,
    loaded: true,
    exports: { deleteFantasyAccount: async () => ({ deleted: true }) },
  };
}

function loadRouter() {
  const routerPath = path.join(__dirname, 'fantasyAuth.js');
  delete require.cache[require.resolve(routerPath)];
  return require('./fantasyAuth');
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function run() {
  process.env.NODE_ENV = 'test';
  process.env.FANTASY_JWT_SECRET = 'fantasy-test-secret';
  process.env.JWT_SECRET = 'fallback-secret';

  installMocks();
  const router = loadRouter();
  const app = express();
  app.use(express.json());
  app.use('/fantasy/auth', router);

  createMockUser.store.clear();
  createMockUser.saveError = null;

  const registerPayload = {
    email: 'newuser@example.com',
    password: VALID_PASSWORD,
    confirmPassword: VALID_PASSWORD,
    teamName: 'New FC',
    managerName: 'New Manager',
  };

  const registerOk = await httpRequest(app, 'POST', '/fantasy/auth/register', registerPayload);
  assert.strictEqual(registerOk.status, 200);
  assert.strictEqual(registerOk.body.success, true);
  assert.ok(registerOk.body.token);

  const duplicate = await httpRequest(app, 'POST', '/fantasy/auth/register', registerPayload);
  assert.strictEqual(duplicate.status, 409);
  assert.strictEqual(duplicate.body.accountExists, true);

  const loginMissing = await httpRequest(app, 'POST', '/fantasy/auth/login', {
    email: 'unknown@example.com',
    password: VALID_PASSWORD,
  });
  assert.strictEqual(loginMissing.status, 404);
  assert.strictEqual(loginMissing.body.accountNotFound, true);

  const loginWrong = await httpRequest(app, 'POST', '/fantasy/auth/login', {
    email: 'newuser@example.com',
    password: 'WrongPass1!',
  });
  assert.strictEqual(loginWrong.status, 401);
  assert.strictEqual(loginWrong.body.accountExists, true);
  assert.strictEqual(loginWrong.body.accountNotFound, undefined);

  createMockUser.saveError = {
    code: 11000,
    keyPattern: { email: 1 },
    keyValue: { email: 'race@example.com' },
  };
  const raceUser = createMockUser({
    email: 'race@example.com',
    password: await hashPassword(VALID_PASSWORD),
    isVerified: true,
  });
  createMockUser.store.set('race@example.com', raceUser);

  const e11000Email = await httpRequest(app, 'POST', '/fantasy/auth/register', {
    email: 'race@example.com',
    password: VALID_PASSWORD,
    confirmPassword: VALID_PASSWORD,
    teamName: 'Race FC',
    managerName: 'Race Manager',
  });
  assert.strictEqual(e11000Email.status, 409);
  assert.strictEqual(e11000Email.body.accountExists, true);
  createMockUser.saveError = null;

  createMockUser.saveError = {
    code: 11000,
    keyPattern: { googleId: 1 },
    keyValue: { googleId: 'gid-blocked' },
  };
  const e11000Google = await httpRequest(app, 'POST', '/fantasy/auth/register', {
    email: 'blocked@example.com',
    password: VALID_PASSWORD,
    confirmPassword: VALID_PASSWORD,
    teamName: 'Blocked FC',
    managerName: 'Blocked Manager',
  });
  assert.strictEqual(e11000Google.status, 503);
  assert.strictEqual(e11000Google.body.registrationBlocked, true);
  assert.strictEqual(e11000Google.body.accountExists, undefined);
  createMockUser.saveError = null;

  createMockUser.saveError = {
    code: 11000,
    keyPattern: { email: 1 },
    keyValue: { email: 'ghost@example.com' },
  };
  const e11000Unknown = await httpRequest(app, 'POST', '/fantasy/auth/register', {
    email: 'ghost@example.com',
    password: VALID_PASSWORD,
    confirmPassword: VALID_PASSWORD,
    teamName: 'Ghost FC',
    managerName: 'Ghost Manager',
  });
  assert.strictEqual(e11000Unknown.status, 503);
  assert.strictEqual(e11000Unknown.body.registrationBlocked, true);
  assert.strictEqual(e11000Unknown.body.accountExists, undefined);
  createMockUser.saveError = null;

  const concurrentPayload = {
    email: 'concurrent@example.com',
    password: VALID_PASSWORD,
    confirmPassword: VALID_PASSWORD,
    teamName: 'Concurrent FC',
    managerName: 'Concurrent Manager',
  };
  createMockUser.saveError = {
    code: 11000,
    keyPattern: { email: 1 },
    keyValue: { email: 'concurrent@example.com' },
  };
  const firstConcurrent = httpRequest(app, 'POST', '/fantasy/auth/register', concurrentPayload);
  createMockUser.store.set(
    'concurrent@example.com',
    createMockUser({
      email: 'concurrent@example.com',
      password: await hashPassword(VALID_PASSWORD),
      isVerified: true,
    })
  );
  const secondConcurrent = httpRequest(app, 'POST', '/fantasy/auth/register', concurrentPayload);
  const [c1, c2] = await Promise.all([firstConcurrent, secondConcurrent]);
  assert.ok([c1.status, c2.status].includes(409));
  createMockUser.saveError = null;

  const googleMissing = await httpRequest(app, 'POST', '/fantasy/auth/google', {
    credential: 'missing-account',
  });
  assert.strictEqual(googleMissing.status, 404);
  assert.strictEqual(googleMissing.body.registerRequired, true);

  const googleExistingUser = createMockUser({
    email: 'google@example.com',
    password: await hashPassword(VALID_PASSWORD),
    isVerified: true,
  });
  createMockUser.store.set('google@example.com', googleExistingUser);

  const googleOk = await httpRequest(app, 'POST', '/fantasy/auth/google', {
    credential: 'existing-account',
  });
  assert.strictEqual(googleOk.status, 200);
  assert.strictEqual(googleOk.body.success, true);
  assert.ok(googleOk.body.token);

  const mixedCaseUser = createMockUser({ email: 'Mixed.Case@acity.edu.gh', isVerified: true });
  mixedCaseUser.password = await hashPassword(VALID_PASSWORD);
  createMockUser.store.set('Mixed.Case@acity.edu.gh', mixedCaseUser);
  const normalizedLogin = await httpRequest(app, 'POST', '/fantasy/auth/login', {
    email: 'mixed.case@acity.edu.gh',
    password: VALID_PASSWORD,
  });
  assert.strictEqual(normalizedLogin.status, 200);
  assert.strictEqual(normalizedLogin.body.success, true);

  console.log('fantasyAuth.routes tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
