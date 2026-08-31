const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const { validateProductionStartup } = require('./utils/startupValidation');

validateProductionStartup();

// Always load backend/.env (not cwd). In non-production, .env overrides pre-set vars so a
// stale Windows/shell MONGODB_URI cannot silently beat the file you are editing.
const envPath = path.join(__dirname, '.env');
const dotenvResult = require('dotenv').config({
  path: envPath,
  override: process.env.NODE_ENV === 'production' ? false : true,
});
if (dotenvResult.error) {
  console.warn('[env] Could not load', envPath, '-', dotenvResult.error.message);
} else {
  console.log('[env] Loaded', envPath, process.env.NODE_ENV === 'production' ? '(does not override existing env in production)' : '(values override pre-set env in dev)');
}

/** Trim BOM/newlines and optional wrapping quotes from .env values */
function normalizeMongoUri(uri) {
  if (uri == null || typeof uri !== 'string') return '';
  let v = uri.trim().replace(/^\uFEFF/, '').replace(/\r/g, '');
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

const app = express();
const PORT = process.env.PORT || 5001;
const HOST = process.env.HOST || '0.0.0.0';

// Leagues API
app.use('/api/leagues', require('./routes/leagues'));

// Middleware
const TRUSTED_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
console.log('TRUSTED_ORIGINS at startup:', TRUSTED_ORIGINS);

let corsOptions;
if (TRUSTED_ORIGINS.length === 0) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CORS_ORIGINS must be set in production (comma-separated frontend origins)');
  }
  // Development: allow all origins when CORS_ORIGINS is unset
  corsOptions = {};
} else {
  corsOptions = {
    origin: function(origin, callback) {
      if (!origin) return callback(null, true);
      if (TRUSTED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    optionsSuccessStatus: 200
  };
}
app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json());

// Enforce HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect('https://' + req.headers.host + req.url);
    }
    next();
  });
}

// MongoDB connection
const effectiveMongoUri =
  normalizeMongoUri(process.env.MONGODB_URI) || 'mongodb://localhost:27017/league-scheduler';
const mongoUserMatch = effectiveMongoUri.match(/^mongodb(\+srv)?:\/\/([^:]+):/);
const mongoUserFromUri = mongoUserMatch ? decodeURIComponent(mongoUserMatch[2]) : null;
console.log('Mongo URI (sanitized):', effectiveMongoUri.replace(/:\/\/.*@/, '://<credentials>@'));
if (mongoUserFromUri) {
  console.log('[mongo] Database user from URI:', mongoUserFromUri);
}
mongoose.connect(effectiveMongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', async () => {
  const host = db?.client?.s?.url || db?.host || 'unknown-host';
  const name = db?.name || 'unknown-db';
  console.log('Connected to MongoDB');
  console.log(`Mongo details: host/db -> ${host} / ${name}`);
  try {
    const { syncSeasonActiveFlagsToLatest } = require('./utils/seasonContext');
    const sn = await syncSeasonActiveFlagsToLatest();
    if (sn != null) {
      console.log('[season] Synced isActive flags; canonical seasonNumber:', sn);
    }
  } catch (e) {
    console.warn('[season] Could not sync season flags:', e.message);
  }
});

// Debug log for JWT_SECRET
console.log('JWT_SECRET at startup:', process.env.JWT_SECRET ? '[SET]' : '[NOT SET]');

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/fantasy/auth', require('./routes/fantasyAuth'));
app.use('/api/fantasy/admin', require('./routes/fantasyAdmin'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/players', require('./routes/players'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/competitions', require('./routes/competitions'));
app.use('/api/seasons', require('./routes/seasons'));
app.use('/api/admin/activity', require('./routes/adminActivity'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/fantasy', require('./routes/fantasy'));
// app.use('/api/fantasy/leagues', require('./routes/fantasyLeagues'));

app.get('/', (req, res) => {
  res.json({ message: 'League Scheduler API is running!' });
});

app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
});
