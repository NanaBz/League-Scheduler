const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  number: {
    type: Number,
    default: null
  },
  position: {
    type: String,
    enum: ['GK', 'DF', 'MF', 'ATT'],
    required: true
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  isCaptain: {
    type: Boolean,
    default: false
  },
  isViceCaptain: {
    type: Boolean,
    default: false
  },
  active: {
    type: Boolean,
    default: true
  },
  fantasyPrice: {
    type: Number,
    default: 4.5
  }
}, {
  timestamps: true
});

playerSchema.index({ team: 1, position: 1 });
playerSchema.index({ name: 1, team: 1 }, { unique: false });

module.exports = mongoose.model('Player', playerSchema);
