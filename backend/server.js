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
const isProduction = process.env.NODE_ENV === 'production';
console.log('TRUSTED_ORIGINS at startup:', TRUSTED_ORIGINS);
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('CORS: Allowing localhost origins in development mode');

const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // In development, allow all localhost origins (any port)
    if (!isProduction) {
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return callback(null, true);
      }
    }
    
    // Check against trusted origins
    if (TRUSTED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    
    // In production, reject unknown origins
    if (isProduction) {
      console.log('CORS: Rejected origin in production:', origin);
      return callback(new Error('Not allowed by CORS'), false);
    }
    
    // In development, allow all origins if no trusted origins are set
    if (TRUSTED_ORIGINS.length === 0) {
      return callback(null, true);
    }
    
    // Fallback: reject in development if trusted origins are set but origin doesn't match
    console.log('CORS: Rejected origin:', origin);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  optionsSuccessStatus: 200
};
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
