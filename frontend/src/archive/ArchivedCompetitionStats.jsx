import React, { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import api from '../utils/api';
import { groupStatsItems, COMP_ROWS } from './teamArchiveModel';

export default function ArchivedCompetitionStats({
  seasonNumber,
  competition,
  /** When false, empty stats are explained as “no completed fixtures” rather than missing data. */
  hasPlayedMatchesInCompetition = false,
}) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setSummary(null);
      try {
        const { data } = await api.get('/stats/summary', {
          params: { competition, seasonNumber },
        });
        if (!cancelled) setSummary(data);
      } catch (e) {
        if (!cancelled) {
          setError(e.response?.data?.message || e.message || 'Could not load stats for this season.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seasonNumber, competition]);

  const sections = [
    { title: 'Goals', items: summary?.goals, metricKey: 'goals' },
    { title: 'Assists', items: summary?.assists, metricKey: 'assists' },
    { title: 'Clean Sheets', items: summary?.cleanSheets, metricKey: 'cleanSheets' },
    { title: 'Yellow Cards', items: summary?.yellowCards, metricKey: 'yellowCards' },
    { title: 'Red Cards', items: summary?.redCards, metricKey: 'redCards' },
  ];

  const hasAnyStats =
    summary &&
    sections.some(({ items, metricKey }) => groupStatsItems(items, metricKey, 8).length > 0);

  return (
    <div className="archived-stats-block">
      <h2 className="archived-section-title">
        <Zap size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        Player statistics
      </h2>
      <p className="archived-stats-hint">
        Season {seasonNumber} · {COMP_ROWS.find((c) => c.id === competition)?.label || competition}
      </p>
      {loading && <div className="loading-inline">Loading stats…</div>}
      {error && <div className="error-inline archived-stats-error">{error}</div>}
      {summary && (
        <div className="stats-grid">
          {sections.map(({ title, items, metricKey }) => {
            const ranked = groupStatsItems(items, metricKey, 8);
            if (ranked.length === 0) return null;
            return (
              <div key={`${competition}-${metricKey}`} className="stats-section">
                <div className="stats-section-header">
                  <h4>{title}</h4>
                </div>
                <ul className="stats-list">
                  {ranked.map((row, idx) => (
                    <li key={`${metricKey}-${row.player?._id || row.orphanedPlayerId || idx}`} className="stats-item">
                      <div className="stats-player">
                        {row.teams.map((team, tIdx) => (
                          <img
                            key={team?._id || tIdx}
                            src={team?.logo}
                            alt=""
                            className="stats-team-logo"
                            style={
                              team?.name === 'Falcons'
                                ? { backgroundColor: '#94a3b8', padding: 4, borderRadius: 8, marginRight: 2 }
                                : { marginRight: 2 }
                            }
                          />
                        ))}
                        <span className="stats-name">
                          {(row.player?.name && String(row.player.name).trim()) ||
                            (row.orphanedPlayerId ? 'Former player (removed)' : 'Unknown')}
                        </span>
                        <span className="stats-team">{row.teams.map((t) => t?.name).filter(Boolean).join(', ')}</span>
                      </div>
                      <div className="stats-value">{row.stat || 0}</div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      {summary && !hasAnyStats && (
        <p className="archived-stats-empty">
          {hasPlayedMatchesInCompetition
            ? 'No player statistics were recorded for this competition in this season.'
            : 'No matches were played in this competition this season, so there are no player statistics to show.'}
        </p>
      )}
    </div>
  );
}
