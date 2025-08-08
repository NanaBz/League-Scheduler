const mongoose = require('mongoose');

const competitionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ['league', 'cup', 'super-cup']
  },
  season: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  },
  isCompleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Competition', competitionSchema);
