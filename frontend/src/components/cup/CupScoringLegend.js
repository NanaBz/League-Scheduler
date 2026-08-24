import React from 'react';
import { Info } from 'lucide-react';

/** Explains that scores are gameweek FPL points — not football goals. */
export default function CupScoringLegend() {
  return (
    <p className="acfpl-cup-legend" role="note">
      <Info size={14} aria-hidden className="acfpl-cup-legend__icon" />
      <span>
        Scores shown are <strong>FPL points</strong> earned that matchweek. Higher total advances.
        Ties use FPL tiebreak rules.
      </span>
    </p>
  );
}
