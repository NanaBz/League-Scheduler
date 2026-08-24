import React, { useState } from 'react';
import { Target } from 'lucide-react';
import { groupScorersByPlayer } from '../../utils/archiveViewAdapter';

export default function ArchiveScorersSection({ statistics, title = 'Top Scorers', showAssists = false }) {
  const [expanded, setExpanded] = useState(false);
  const ranked = groupScorersByPlayer(statistics?.goals);
  const displayItems = expanded ? ranked : ranked.slice(0, 3);
  const assists = (statistics?.assists || [])
    .filter((r) => (r.assists || 0) > 0)
    .sort((a, b) => b.assists - a.assists)
    .slice(0, 3);

  if (ranked.length === 0 && assists.length === 0) {
    return (
      <div className="card archive-section">
        <h2><Target size={18} /> {title}</h2>
        <p className="archive-empty-inline">No scorer statistics recorded in this archive.</p>
      </div>
    );
  }

  return (
    <div className="card archive-section">
      <div className="stats-section-header">
        <h2><Target size={18} /> {title}</h2>
        {ranked.length > 3 && (
          <button
            type="button"
            className={`stats-expand-btn ${expanded ? 'stats-expand-btn-active' : ''}`}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Show less' : `View all (${ranked.length})`}
          </button>
        )}
      </div>

      <ul className="stats-list">
        {displayItems.map((row, idx) => (
          <li key={row.player?._id || idx} className="stats-item">
            <div className="stats-player">
              <span className="stats-rank">{idx + 1}</span>
              <span className="stats-name">{row.player?.name || 'Unknown'}</span>
              <span className="stats-team">
                {[...new Set(row.teams.map((t) => t?.name).filter(Boolean))].join(', ')}
              </span>
            </div>
            <div className="stats-value">{row.goals}</div>
          </li>
        ))}
      </ul>

      {showAssists && assists.length > 0 && (
        <div className="archive-assists-block">
          <h3>Top Assists</h3>
          <ul className="stats-list">
            {assists.map((row, idx) => (
              <li key={row.player?._id || idx} className="stats-item">
                <div className="stats-player">
                  <span className="stats-name">{row.player?.name || 'Unknown'}</span>
                  <span className="stats-team">{row.team?.name}</span>
                </div>
                <div className="stats-value">{row.assists}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
