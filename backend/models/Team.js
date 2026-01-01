const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  // Team category: boys or girls
  category: {
    type: String,
    enum: ['boys', 'girls'],
    default: 'boys',
    required: true
  },
  logo: {
    type: String,
    default: ''
  },
  competition: {
    type: String,
    enum: ['league', 'acwpl'],
    required: true,
    default: 'league'
  },
  played: {
    type: Number,
    default: 0
  },
  
  won: {
    type: Number,
    default: 0
  },
  drawn: {
    type: Number,
    default: 0
  },
  lost: {
    type: Number,
    default: 0
  },
  goalsFor: {
    type: Number,
    default: 0
  },
  goalsAgainst: {
    type: Number,
    default: 0
  },
  goalDifference: {
    type: Number,
    default: 0
  },
  points: {
    type: Number,
    default: 0
  },
  form: {
    type: [String],
    default: [],
    validate: {
      validator: function(v) {
        return v.length <= 3;
      },
      message: 'Form array can only contain up to 3 results'
    }
  },
  staff: [{
    role: {
      type: String,
      enum: ['Coach', 'Assistant'],
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    }
  }]
}, {
  timestamps: true
});

// Calculate goal difference whenever the document is saved
teamSchema.pre('save', function(next) {
  this.goalDifference = this.goalsFor - this.goalsAgainst;
  next();
});

module.exports = mongoose.model('Team', teamSchema);
