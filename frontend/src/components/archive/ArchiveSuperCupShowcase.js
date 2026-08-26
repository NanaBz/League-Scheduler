import React from 'react';
import SuperCupShowcase from '../SuperCupShowcase';
import { formatArchiveDate } from './archiveDisplayUtils';

export default function ArchiveSuperCupShowcase({ match, originalDoubleWinnerId }) {
  if (!match?.homeTeam || !match?.awayTeam) {
    return (
      <div className="card archive-section">
        <p className="archive-empty-inline">No Super Cup final recorded in this archive.</p>
      </div>
    );
  }

  const enriched = originalDoubleWinnerId
    ? { ...match, originalDoubleWinnerId }
    : match;

  return (
    <div className="card archive-section">
      <SuperCupShowcase
        match={enriched}
        formatDate={formatArchiveDate}
        archive
      />
    </div>
  );
}
