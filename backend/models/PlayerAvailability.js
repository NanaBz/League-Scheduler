const mongoose = require('mongoose');

const PlayerAvailabilitySchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  matchweek: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['available', 'injured', 'suspended'],
    default: 'available'
  },
  // For injuries
  injuryDetails: {
    type: String,
    default: ''
  },
  chanceOfPlaying: {
    type: Number,
    min: 0,
    max: 100,
    default: 100
  },
  // Auto-calculated suspension (3 YC or 1 RC)
  isSuspended: {
    type: Boolean,
    default: false
  },
  suspensionReason: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

PlayerAvailabilitySchema.index({ player: 1, matchweek: 1 }, { unique: true });

module.exports = mongoose.model('PlayerAvailability', PlayerAvailabilitySchema);
