import React from 'react';
import { Zap, BarChart3, Crown, Target, Star, X } from 'lucide-react';
import './ChipDetailsModal.css';

const CHIP_ICONS = {
  WC: Zap,
  BB: BarChart3,
  TC: Crown,
  FH: Target,
  DC: Star
};

const CHIP_FULL_DESCRIPTIONS = {
  WC: {
    name: 'Wildcard',
    description: 'Make unlimited transfers for this gameweek with no deductions. Use wisely—you only get one per season.',
    how: 'Activate to enter transfer mode with no limits or costs. Lock in your team before the deadline.'
  },
  BB: {
    name: 'Bench Boost',
    description: 'Your entire bench scores points this gameweek, not just your starting 9.',
    how: 'Activate to earn points from all 12 squad members. Great for gameweeks with favorable fixtures.'
  },
  TC: {
    name: 'Triple Captain',
    description: 'Your captain earns 3× points instead of 2×.',
    how: 'Choose your captain wisely—they will score triple points for all actions this gameweek.'
  },
  FH: {
    name: 'Free Hit',
    description: 'Make unlimited transfers for this gameweek only. Your team reverts after the deadline.',
    how: 'Perfect for one-off fixture rounds. Activate to experiment with transfers that won\'t affect future gameweeks.'
  },
  DC: {
    name: 'Duo Captain',
    description: 'Both your captain and vice-captain earn 2× points.',
    how: 'Activate to double the points from your top two leaders. Strategy-focused chip for consistent returns.'
  }
};

export default function ChipDetailsModal({ chipId, chip, onClose, onPlayChip, isDisabled, isActive }) {
  const Icon = CHIP_ICONS[chipId];
  const details = CHIP_FULL_DESCRIPTIONS[chipId];

  return (
    <div className="chip-modal-overlay" onClick={onClose}>
      <div className="chip-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="chip-modal-close" onClick={onClose}>
          <X size={24} />
        </button>

        <div className="chip-modal-header">
          <div className="chip-modal-icon">
            {Icon && <Icon size={40} strokeWidth={2} />}
          </div>
          <h2>{details.name}</h2>
        </div>

        <div className="chip-modal-body">
          <div className="chip-modal-section">
            <h3>About</h3>
            <p>{details.description}</p>
          </div>

          <div className="chip-modal-section">
            <h3>How It Works</h3>
            <p>{details.how}</p>
          </div>
        </div>

        <button
          className="chip-modal-button"
          onClick={onPlayChip}
          disabled={isDisabled}
        >
          {isActive ? 'Cancel Chip' : 'Play Chip'}
        </button>
      </div>
    </div>
  );
}
