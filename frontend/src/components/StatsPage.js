import React, { useEffect, useState } from 'react';
import { BarChart3, Target, Share2, Shield, Square } from 'lucide-react';
import api from '../utils/api';

const COMP_TABS = [
  { id: 'league', label: 'League' },
  { id: 'cup', label: 'Cup' },
  { id: 'super-cup', label: 'Super Cup' },
  { id: 'acwpl', label: 'ACWPL' },
  { id: 'girls-super-cup', label: 'Girls Super Cup' },
];

const METRIC_CONFIG = {
  goals: { title: 'Goals', Icon: Target },
  assists: { title: 'Assists', Icon: Share2 },
  cleanSheets: { title: 'Clean Sheets', Icon: Shield },
  yellowCards: { title: 'Yellow Cards', Icon: Square, sectionClass: 'stats-section--cards-yellow', iconClass: 'stats-metric-icon--yellow' },
  redCards: { title: 'Red Cards', Icon: Square, sectionClass: 'stats-section--cards-red', iconClass: 'stats-metric-icon--red' },
};

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
      setError(e.response?.data?.message || 'Failed to load stats');
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
    const config = METRIC_CONFIG[metricKey] || { title, Icon: Target };
    const { Icon, sectionClass, iconClass } = config;

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
    // Only players with a positive value for *this* stat (defense if API ever mixes rows)
    const rankedPlayers = Object.values(grouped)
      .filter((row) => row.stat > 0)
      .sort((a, b) => b.stat - a.stat);
    const displayItems = isExpanded ? rankedPlayers : rankedPlayers.slice(0, 3);

    const handleToggle = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSection(sectionKey);
    };

    return (
      <div className={`stats-section ${sectionClass || ''} ${isExpanded ? 'stats-section-expanded' : ''}`}>
        <div className="stats-section-header">
          <h4 className="stats-section-title">
            <Icon size={18} className={iconClass || undefined} aria-hidden="true" />
            {title}
          </h4>
          {rankedPlayers.length > 3 && (
            <button
              type="button"
              className={`stats-expand-btn ${isExpanded ? 'stats-expand-btn-active' : ''}`}
              onClick={handleToggle}
              aria-label={isExpanded ? `Collapse ${title}` : `Expand ${title}`}
            >
              {isExpanded ? 'Show less' : `View all (${rankedPlayers.length})`}
            </button>
          )}
        </div>
        {rankedPlayers.length === 0 ? (
          <p className="stats-empty">No {title.toLowerCase()} recorded yet.</p>
        ) : (
          <ul className="stats-list">
            {displayItems.map((row, idx) => (
              <li
                key={`${metricKey}-${row.player?._id || row.orphanedPlayerId || idx}`}
                className={`stats-item${idx < 3 ? ` stats-item--top-${idx + 1}` : ''}`}
              >
                <div className="stats-player">
                  <span className="stats-rank" aria-hidden="true">{idx + 1}</span>
                  <div className="stats-player-logos">
                    {row.teams.map((team, tIdx) => (
                      <img
                        key={team?._id || tIdx}
                        src={team?.logo}
                        alt=""
                        className={`stats-team-logo${team?.name === 'Falcons' ? ' stats-team-logo--falcons' : ''}`}
                      />
                    ))}
                  </div>
                  <div className="stats-player-meta">
                    <span className="stats-name">
                      {(row.player?.name && String(row.player.name).trim()) ||
                        (row.orphanedPlayerId ? 'Former player (removed)' : 'Unknown')}
                    </span>
                    <span className="stats-team">{row.teams.map(t => t?.name).filter(Boolean).join(', ')}</span>
                  </div>
                </div>
                <div className="stats-value">{row.stat || 0}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const activeCompLabel = COMP_TABS.find((tab) => tab.id === competition)?.label || 'League';

  return (
    <div className="stats-page">
      <header className="stats-page-header">
        <h1><BarChart3 size={22} aria-hidden="true" /> Statistics</h1>
        <p>Player rankings across school competitions — goals, assists, clean sheets, and discipline.</p>
      </header>

      <div className="comp-tabs" role="tablist" aria-label="Competition statistics">
        {COMP_TABS.map(ct => (
          <button
            key={ct.id}
            type="button"
            role="tab"
            aria-selected={competition === ct.id}
            className={`comp-tab ${competition === ct.id ? 'active' : ''}`}
            onClick={() => setCompetition(ct.id)}
          >{ct.label}</button>
        ))}
      </div>

      {summary?.seasonNumber != null && (
        <p className="stats-season-hint">Season {summary.seasonNumber} · {activeCompLabel}</p>
      )}

      {loading && <div className="loading-inline">Loading stats…</div>}
      {error && <div className="error-inline">{error}</div>}

      {summary && (
        <div className="stats-grid">
          <Section key={`${competition}-goals`} title={METRIC_CONFIG.goals.title} items={summary.goals} metricKey="goals" />
          <Section key={`${competition}-assists`} title={METRIC_CONFIG.assists.title} items={summary.assists} metricKey="assists" />
          <Section key={`${competition}-cleanSheets`} title={METRIC_CONFIG.cleanSheets.title} items={summary.cleanSheets} metricKey="cleanSheets" />
          <Section key={`${competition}-yellowCards`} title={METRIC_CONFIG.yellowCards.title} items={summary.yellowCards} metricKey="yellowCards" />
          <Section key={`${competition}-redCards`} title={METRIC_CONFIG.redCards.title} items={summary.redCards} metricKey="redCards" />
        </div>
      )}
    </div>
  );
}
