const mongoose = require('mongoose');

/** In-progress 13-player squad (transfers / squad builder) — one row per fantasy user. */
const FantasyDraftSquadSchema = new mongoose.Schema({
  fantasyUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FantasyUser',
    required: true,
    unique: true
  },
  /** { GK: [id|null, ...], DF: [...], MF: [...], ATT: [...] } */
  slots: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  /** Pick team: 9 starters + 4 bench, captain, formation */
  lineup: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  /** Chronological order players were first added to the squad (for default C/VC). */
  transferInOrder: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player'
  }],
  /** Chip selected for the current gameweek (before or after pick-team save). */
  activeChip: {
    type: String,
    default: null,
  },
  activeChipGameweek: {
    type: Number,
    default: null,
  },
  /** Squad snapshot before Free Hit transfers — restored after that GW ends. */
  freeHitBaselineSlots: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  freeHitGameweek: {
    type: Number,
    default: null,
  },
}, {
  timestamps: true
});

module.exports = mongoose.model('FantasyDraftSquad', FantasyDraftSquadSchema);
