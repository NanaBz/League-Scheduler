const assert = require('assert');
const path = require('path');

function installFantasyUserMock(store) {
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
          for (const [, user] of store.entries()) {
            if (query.email.$regex.test(user.email)) {
              return Promise.resolve(user);
            }
          }
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      },
    },
  };
}

async function run() {
  delete require.cache[require.resolve('./fantasyUserLookup')];
  const store = new Map();
  store.set('Legacy.User@acity.edu.gh', {
    _id: 'legacy1',
    email: 'Legacy.User@acity.edu.gh',
  });
  installFantasyUserMock(store);

  const { normalizeEmail, findUserByEmail } = require('./fantasyUserLookup');

  assert.strictEqual(normalizeEmail('  User@Example.COM  '), 'user@example.com');

  const legacy = await findUserByEmail('legacy.user@acity.edu.gh');
  assert.ok(legacy);
  assert.strictEqual(legacy.email, 'Legacy.User@acity.edu.gh');

  const missing = await findUserByEmail('nobody@example.com');
  assert.strictEqual(missing, null);

  console.log('fantasyUserLookup tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
