import React, { useEffect, useState } from 'react';
import api from '../utils/api';

const COMP_TABS = [
  { id: 'league', label: 'League' },
  { id: 'cup', label: 'Cup' },
  { id: 'super-cup', label: 'Super Cup' },
  { id: 'acwpl', label: 'ACWPL' }
];

export default function StatsPage() {
  const [competition, setCompetition] = useState('league');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});

  const fetchSummary = async () => {
    setLoading(true); 
    setError(null);
    try {
      const { data } = await api.get('/stats/summary', { params: { competition } });
      setSummary(data);
    } catch (e) {
      setError('Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchSummary();
    // Reset expanded sections when competition changes
    setExpandedSections({});
    /* eslint-disable-next-line */ 
  }, [competition]);

  const toggleSection = (sectionKey) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const Section = ({ title, items, metricKey }) => {
    const sectionKey = `${competition}-${metricKey}`;
    const isExpanded = expandedSections[sectionKey] || false;
    const allItems = items || [];
    // Show top 3 by default, all items when expanded
    const displayItems = isExpanded ? allItems : allItems.slice(0, 3);

    const handleToggle = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSection(sectionKey);
    };

    return (
      <div className={`stats-section ${isExpanded ? 'stats-section-expanded' : ''}`}>
        <div className="stats-section-header">
          <h4>{title}</h4>
          {allItems.length > 0 && (
            <button
              type="button"
              className={`stats-expand-btn ${isExpanded ? 'stats-expand-btn-active' : ''}`}
              onClick={handleToggle}
              aria-label={isExpanded ? `Collapse ${title}` : `Expand ${title}`}
            >
              {isExpanded ? 'Show less' : `View all (${allItems.length})`}
            </button>
          )}
        </div>
        <ul className="stats-list">
          {displayItems.map((row, idx) => (
            <li key={`${metricKey}-${row.player?._id || idx}`} className="stats-item">
              <div className="stats-player">
                <img
                  src={row.team?.logo}
                  alt="logo"
                  className="stats-team-logo"
                  style={row.team?.name === 'Falcons' ? { backgroundColor: '#94a3b8', padding: 4, borderRadius: 8 } : undefined}
                />
                <span className="stats-name">{row.player?.name}</span>
                <span className="stats-team">{row.team?.name}</span>
              </div>
              <div className="stats-value">{row[metricKey] || 0}</div>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="stats-page">
      <div className="comp-tabs">
        {COMP_TABS.map(ct => (
          <button
            key={ct.id}
            className={`comp-tab ${competition === ct.id ? 'active' : ''}`}
            onClick={() => setCompetition(ct.id)}
          >{ct.label}</button>
        ))}
      </div>

      {loading && <div className="loading-inline">Loading stats…</div>}
      {error && <div className="error-inline">{error}</div>}

      {summary && (
        <div className="stats-grid">
          <Section key={`${competition}-goals`} title="Goals" items={summary.goals} metricKey="goals" />
          <Section key={`${competition}-assists`} title="Assists" items={summary.assists} metricKey="assists" />
          <Section key={`${competition}-cleanSheets`} title="Clean Sheets" items={summary.cleanSheets} metricKey="cleanSheets" />
          <Section key={`${competition}-yellowCards`} title="Yellow Cards" items={summary.yellowCards} metricKey="yellowCards" />
          <Section key={`${competition}-redCards`} title="Red Cards" items={summary.redCards} metricKey="redCards" />
        </div>
      )}
    </div>
  );
}
