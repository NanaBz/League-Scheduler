const assert = require('assert');
const express = require('express');
const http = require('http');
const healthRouter = require('./health');

function httpGet(app, urlPath) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      http.get(`http://127.0.0.1:${port}${urlPath}`, (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        });
      }).on('error', (err) => {
        server.close();
        reject(err);
      });
    });
  });
}

async function run() {
  const app = express();
  app.use('/api/health', healthRouter);

  const response = await httpGet(app, '/api/health');

  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.body.status, 'ok');
  assert.strictEqual(response.body.service, 'league-scheduler');

  console.log('health endpoint tests passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
