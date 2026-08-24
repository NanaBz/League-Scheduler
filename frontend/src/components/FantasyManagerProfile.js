import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import api from '../utils/api';
import FantasyManagerSeasonHistory from './FantasyManagerSeasonHistory';
import './FantasyManagerProfile.css';

export default function FantasyManagerProfile({ user, onClose }) {
  const [tab, setTab] = useState('current');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentSeason, setCurrentSeason] = useState(null);
  const [history, setHistory] = useState([]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/fantasy/manager-profile');
      if (!data?.success) {
        throw new Error(data?.message || 'Could not load manager profile.');
      }
      setCurrentSeason(data.currentSeason || null);
      setHistory(Array.isArray(data.history) ? data.history : []);
    } catch (err) {
      setCurrentSeason(null);
      setHistory([]);
      setError(err.response?.data?.message || err.message || 'Could not load manager profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const seasonLabel =
    currentSeason?.seasonName ||
    (currentSeason?.seasonNumber != null ? `Season ${currentSeason.seasonNumber}` : 'Current Season');

  return (
    <div className="fmp-panel">
      <div className="fmp-head">
        <button type="button" className="fmp-back" onClick={onClose}>
          <ArrowLeft size={18} aria-hidden />
          <span>Back</span>
        </button>
        <h3 className="fmp-title">Manager Profile</h3>
        <div className="fmp-user">
          <div className="fmp-user-team">{user?.teamName || 'Your Team'}</div>
          <div className="fmp-user-manager">{user?.managerName || 'Manager'}</div>
        </div>
      </div>

      <div className="fantasy-lc-toggle fmp-toggle" role="tablist" aria-label="Current season or manager history">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'current'}
          onClick={() => setTab('current')}
        >
          Current Season
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'history'}
          onClick={() => setTab('history')}
        >
          Manager Profile
        </button>
      </div>

      {tab === 'current' ? (
        <section className="fmp-current" aria-label="Current season">
          {loading ? (
            <p className="fmp-message fmp-message--muted">Loading current season…</p>
          ) : error ? (
            <p className="fmp-message fmp-message--error">{error}</p>
          ) : (
            <>
              <h4 className="fmp-current__season">{seasonLabel}</h4>
              <div className="fmp-current-grid">
                <div className="fmp-stat">
                  <span className="fmp-stat__label">Total points</span>
                  <span className="fmp-stat__value">{currentSeason?.totalPoints ?? 0}</span>
                </div>
                <div className="fmp-stat">
                  <span className="fmp-stat__label">Overall rank</span>
                  <span className="fmp-stat__value">
                    {currentSeason?.preseason || currentSeason?.rank == null ? '—' : currentSeason.rank}
                  </span>
                </div>
                <div className="fmp-stat">
                  <span className="fmp-stat__label">Latest GW pts</span>
                  <span className="fmp-stat__value">
                    {currentSeason?.preseason ? '—' : currentSeason?.latestGameweekPoints ?? 0}
                  </span>
                </div>
              </div>
              {currentSeason?.seasonComplete ? (
                <p className="fmp-message fmp-message--info">This season is complete. See archived results in Manager Profile.</p>
              ) : null}
            </>
          )}
        </section>
      ) : (
        <section className="fmp-history" aria-label="Manager season history">
          <FantasyManagerSeasonHistory history={history} loading={loading} error={error} />
        </section>
      )}
    </div>
  );
}
