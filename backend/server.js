const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Leagues API
app.use('/api/leagues', require('./routes/leagues'));

// Middleware
const TRUSTED_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
console.log('TRUSTED_ORIGINS at startup:', TRUSTED_ORIGINS);

let corsOptions;
if (TRUSTED_ORIGINS.length === 0) {
  // Allow all origins if no CORS_ORIGINS is set
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
const effectiveMongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/league-scheduler';
console.log('Mongo URI (sanitized):', effectiveMongoUri.replace(/:\/\/.*@/, '://<credentials>@'));
mongoose.connect(effectiveMongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  const host = db?.client?.s?.url || db?.host || 'unknown-host';
  const name = db?.name || 'unknown-db';
  console.log('Connected to MongoDB');
  console.log(`Mongo details: host/db -> ${host} / ${name}`);
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
app.use('/api/stats', require('./routes/stats'));
app.use('/api/fantasy', require('./routes/fantasy'));
// app.use('/api/fantasy/leagues', require('./routes/fantasyLeagues'));

app.get('/', (req, res) => {
  res.json({ message: 'League Scheduler API is running!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
