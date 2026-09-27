/**
 * Read-only Fantasy integrity audit (safe for production inspection).
 * Usage: node scripts/fantasy-integrity-audit.js
 * Requires MONGODB_URI in backend/.env or environment.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), override: true });
const mongoose = require('mongoose');
const { buildIntegrityAuditReport } = require('../utils/fantasyIntegrityAudit');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const report = await buildIntegrityAuditReport();
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
