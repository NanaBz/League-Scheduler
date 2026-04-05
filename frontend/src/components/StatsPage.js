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

  // Group stats by player, aggregate teams and stat values
  const Section = ({ title, items, metricKey }) => {
    const sectionKey = `${competition}-${metricKey}`;
    const isExpanded = expandedSections[sectionKey] || false;
    const allItems = items || [];

    // Group by player id (includes orphanedPlayerId when the Player doc was deleted)
    const grouped = {};
    allItems.forEach((row) => {
      const pid = row.player?._id || row.orphanedPlayerId;
      if (!pid) return;
      const key = String(pid);
      if (!grouped[key]) {
        grouped[key] = {
          player: row.player,
          orphanedPlayerId: row.orphanedPlayerId,
          teams: [],
          stat: 0,
        };
      }
      grouped[key].teams.push(row.team);
      grouped[key].stat += row[metricKey] || 0;
    });
    // Convert to array and sort by stat desc
    const groupedArr = Object.values(grouped).sort((a, b) => b.stat - a.stat);
    const displayItems = isExpanded ? groupedArr : groupedArr.slice(0, 3);

    const handleToggle = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSection(sectionKey);
    };

    return (
      <div className={`stats-section ${isExpanded ? 'stats-section-expanded' : ''}`}>
        <div className="stats-section-header">
          <h4>{title}</h4>
          {groupedArr.length > 0 && (
            <button
              type="button"
              className={`stats-expand-btn ${isExpanded ? 'stats-expand-btn-active' : ''}`}
              onClick={handleToggle}
              aria-label={isExpanded ? `Collapse ${title}` : `Expand ${title}`}
            >
              {isExpanded ? 'Show less' : `View all (${groupedArr.length})`}
            </button>
          )}
        </div>
        <ul className="stats-list">
          {displayItems.map((row, idx) => (
            <li
              key={`${metricKey}-${row.player?._id || row.orphanedPlayerId || idx}`}
              className="stats-item"
            >
              <div className="stats-player">
                {/* Show all team logos for this player */}
                {row.teams.map((team, tIdx) => (
                  <img
                    key={team?._id || tIdx}
                    src={team?.logo}
                    alt="logo"
                    className="stats-team-logo"
                    style={team?.name === 'Falcons' ? { backgroundColor: '#94a3b8', padding: 4, borderRadius: 8, marginRight: 2 } : { marginRight: 2 }}
                  />
                ))}
                <span className="stats-name">
                  {(row.player?.name && String(row.player.name).trim()) ||
                    (row.orphanedPlayerId ? 'Former player (removed)' : 'Unknown')}
                </span>
                {/* Show all team names, comma separated */}
                <span className="stats-team">{row.teams.map(t => t?.name).filter(Boolean).join(', ')}</span>
              </div>
              <div className="stats-value">{row.stat || 0}</div>
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
