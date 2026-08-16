const mongoose = require('mongoose');

const FantasyMatchweekSchema = new mongoose.Schema({
  seasonNumber: {
    type: Number,
    required: true,
    index: true,
  },
  matchweek: {
    type: Number,
    required: true,
  },
  // Optional human-facing start date for the matchweek
  startDate: {
    type: Date,
    default: null,
  },
  // Admin-configured fantasy deadline (UTC date)
  deadline: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ['OPEN', 'LOCKED', 'LIVE', 'FINISHED'],
    default: 'OPEN',
  },
}, {
  timestamps: true,
});

FantasyMatchweekSchema.index({ seasonNumber: 1, matchweek: 1 }, { unique: true });

module.exports = mongoose.model('FantasyMatchweek', FantasyMatchweekSchema);
