import React, { useEffect, useState } from 'react';
import { Trophy, Clock } from 'lucide-react';
import api from '../utils/api';
import { clearFantasyClientSeasonKeys } from '../utils/fantasyGameweek';
import PlayerPriceEditor from './PlayerPriceEditor';
import FantasyAdminDashboardStats from './FantasyAdminDashboardStats';
import FantasyMatchweekEditor from './FantasyMatchweekEditor';
import '../styles/adminFantasyDeadline.css';

function deadlineStatusClass(status) {
  const key = String(status || '').toLowerCase();
  if (['open', 'locked', 'live', 'finished'].includes(key)) {
    return `admin-deadline-status admin-deadline-status--${key}`;
  }
  return 'admin-deadline-status admin-deadline-status--finished';
}

function formatRemainingLabel(remaining) {
  if (remaining <= 0) return 'Closed';
  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  const secs = Math.floor((remaining % (60 * 1000)) / 1000);
  return `${String(days).padStart(2, '0')}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
}

function DeadlineEditor({ row, onClose, matchweeks, saveDeadline }) {
  const [matchweekVal, setMatchweekVal] = useState(row?.matchweek ?? (matchweeks?.[0]?.number ?? ''));
  const [deadlineVal, setDeadlineVal] = useState(row?.deadline ? new Date(row.deadline).toISOString().slice(0,16) : '');
  const [startVal, setStartVal] = useState(row?.startDate ? new Date(row.startDate).toISOString().slice(0,16) : '');
  const [statusVal, setStatusVal] = useState(row?.status || 'OPEN');
  const [matchesInWeek, setMatchesInWeek] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  const handleMatchweekChange = async (e) => {
    const mwNum = e.target.value;
    setMatchweekVal(mwNum);
    if (!mwNum) {
      setMatchesInWeek([]);
      return;
    }
    setLoadingMatches(true);
    try {
      const { data } = await api.get(`/fantasy/admin/matchweeks/${mwNum}/matches`);
      setMatchesInWeek(data?.data || []);
    } catch (err) {
      console.error('Failed to fetch matches:', err);
      setMatchesInWeek([]);
    } finally {
      setLoadingMatches(false);
    }
  };

  const title = matchweekVal ? `Edit Matchweek ${matchweekVal}` : 'New Matchweek Deadline';

  return (
    <div className="admin-deadline-editor">
      <h4 className="admin-deadline-editor__title" id="admin-deadline-editor-title">{title}</h4>

      <div className="admin-deadline-editor__field">
        <label htmlFor="admin-deadline-mw">Matchweek</label>
        <select id="admin-deadline-mw" value={matchweekVal} onChange={handleMatchweekChange}>
          <option value="">Select matchweek...</option>
          {matchweeks.map((mw) => (
            <option key={mw.number} value={mw.number}>MW {mw.number} — {mw.matchCount ?? '0'} matches</option>
          ))}
        </select>
      </div>

      {loadingMatches && <p className="admin-deadline-editor__loading">Loading matches…</p>}
      {!loadingMatches && matchesInWeek.length > 0 && (
        <div className="admin-deadline-editor__matches">
          <strong>Matches in this week</strong>
          <ul>
            {matchesInWeek.map(m => (
              <li key={m._id}>{m.homeTeam?.name} vs {m.awayTeam?.name} — {m.kickoff ? new Date(m.kickoff).toLocaleString() : 'TBD'}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="admin-deadline-editor__field">
        <label htmlFor="admin-deadline-start">Start date (optional)</label>
        <input id="admin-deadline-start" type="datetime-local" value={startVal} onChange={(e) => setStartVal(e.target.value)} />
      </div>

      <div className="admin-deadline-editor__field">
        <label htmlFor="admin-deadline-deadline">Deadline</label>
        <input id="admin-deadline-deadline" type="datetime-local" value={deadlineVal} onChange={(e) => setDeadlineVal(e.target.value)} />
      </div>

      <div className="admin-deadline-editor__field">
        <label htmlFor="admin-deadline-status">Status</label>
        <select id="admin-deadline-status" value={statusVal} onChange={(e) => setStatusVal(e.target.value)}>
          <option value="OPEN">OPEN</option>
          <option value="LOCKED">LOCKED</option>
          <option value="LIVE">LIVE</option>
          <option value="FINISHED">FINISHED</option>
        </select>
      </div>

      <div className="admin-deadline-editor__actions">
        <button type="button" className="btn btn-success" onClick={async () => {
          const mwNum = Number(matchweekVal);
          if (!Number.isFinite(mwNum) || mwNum < 1) {
            alert('Select a valid matchweek');
            return;
          }
          const payload = {};
          if (deadlineVal) payload.deadline = new Date(deadlineVal).toISOString();
          if (startVal) payload.startDate = new Date(startVal).toISOString();
          if (statusVal) payload.status = statusVal;
          const ok = await saveDeadline(mwNum, payload);
          if (ok) onClose();
        }}>Save</button>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

export default function FantasyManagement() {
  const [view, setView] = useState('dashboard'); // dashboard | matchweek-editor | player-prices
  const [dashboard, setDashboard] = useState(null);
  const [dashboardError, setDashboardError] = useState(null);
  const [matchweeks, setMatchweeks] = useState([]);
  const [rescoreWeek, setRescoreWeek] = useState('1');
  const [loading, setLoading] = useState(false);
  const [matchweekDeadlines, setMatchweekDeadlines] = useState([]);
  const [editingDeadline, setEditingDeadline] = useState(null);
  const [deadlineCountdowns, setDeadlineCountdowns] = useState({});
  const [resetEmail, setResetEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    fetchDashboard();
    fetchMatchweeks();
  }, []);

  const fetchDashboard = async () => {
    try {
      setDashboardError(null);
      const { data } = await api.get('/fantasy/admin/dashboard');
      setDashboard(data.data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setDashboard(null);
      setDashboardError(err.response?.data?.message || err.message || 'Failed to load dashboard statistics');
    }
  };

  const fetchMatchweeks = async () => {
    try {
      const { data } = await api.get('/fantasy/admin/matchweeks');
      setMatchweeks(data.data);
    } catch (err) {
      console.error('Matchweeks fetch error:', err);
    }
  };

  const handleResetFantasySeason = async () => {
    if (
      !window.confirm(
        'Reset the fantasy season to Gameweek 1?\n\nThis clears all manager squads and matchweek scores. Fantasy accounts are kept.'
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/fantasy/admin/reset-season');
      clearFantasyClientSeasonKeys();
      await Promise.all([fetchDashboard(), fetchMatchweeks()]);
      alert(
        data?.message ||
          `Fantasy reset complete. Current gameweek: ${data?.currentGameweek ?? 1}. Ask managers to refresh the fantasy page.`
      );
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to reset fantasy season';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatchweekDeadlines = async () => {
    try {
      const { data } = await api.get('/fantasy/admin/matchweeks/deadlines');
      if (data?.success) setMatchweekDeadlines(Array.isArray(data.data) ? data.data : []);
      else setMatchweekDeadlines([]);
    } catch (err) {
      console.error('Error fetching matchweek deadlines:', err.response?.data || err.message);
      setMatchweekDeadlines([]);
    }
  };

  useEffect(() => {
    fetchMatchweekDeadlines();
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const next = {};
      for (const d of matchweekDeadlines || []) {
        if (!d || !d.deadline) continue;
        const dt = new Date(d.deadline);
        const now = new Date();
        const remaining = dt > now ? dt.getTime() - now.getTime() : 0;
        next[d.matchweek] = remaining;
      }
      setDeadlineCountdowns(next);
    }, 1000);
    return () => clearInterval(id);
  }, [matchweekDeadlines]);

  const saveDeadline = async (mw, payload) => {
    try {
      const res = await api.put(`/fantasy/admin/matchweeks/${mw}/deadline`, payload);
      if (res?.data?.success) {
        await fetchMatchweekDeadlines();
        setEditingDeadline(null);
        return true;
      }
    } catch (err) {
      alert('Error saving deadline: ' + (err.response?.data?.message || err.message));
    }
    return false;
  };

  const handleAdminPasswordReset = async (e) => {
    e.preventDefault();
    if (resetPassword !== resetConfirmPassword) {
      alert('Passwords do not match.');
      return;
    }
    setResettingPassword(true);
    try {
      const { data } = await api.post('/fantasy/admin/users/reset-password', {
        email: resetEmail.trim(),
        newPassword: resetPassword,
        confirmPassword: resetConfirmPassword,
      });
      alert(data?.message || 'Password updated.');
      setResetEmail('');
      setResetPassword('');
      setResetConfirmPassword('');
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Could not reset password.');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleRescoreGameweek = async () => {
    const mw = Number(rescoreWeek);
    if (!Number.isFinite(mw) || mw < 1) {
      alert('Enter a valid gameweek number.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post(`/fantasy/admin/rescore-gameweek/${mw}`);
      alert(
        data?.message ||
          `Gameweek ${mw} rescored.${data?.backfilled ? ` ${data.backfilled} team snapshot(s) backfilled.` : ''}`
      );
      await fetchDashboard();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to rescore gameweek';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  if (view === 'dashboard') {
    return (
      <div className="admin-panel-root admin-fantasy-mgmt-page">
      <div className="card admin-fantasy-dashboard">
        <header className="admin-page-header admin-fantasy-page-header">
          <div className="admin-page-header__main">
            <div className="admin-page-header__icon" aria-hidden="true">
              <Trophy size={20} />
            </div>
            <div className="admin-page-header__text">
              <p className="admin-page-header__eyebrow">Admin · Fantasy</p>
              <h1 className="admin-page-header__title">Fantasy Management</h1>
              <p className="admin-page-header__subtitle">
                Season overview, matchweek tools, and manager statistics.
              </p>
            </div>
          </div>
        </header>
        <FantasyAdminDashboardStats
          dashboard={dashboard}
          error={dashboardError}
          onRetry={fetchDashboard}
        />

        <div className="admin-fantasy-dash-actions">
          <div className="admin-fantasy-action-group">
            <span className="admin-fantasy-action-label">Edit matchweek data</span>
            <button type="button" className="btn btn-success admin-fantasy-editor-btn" onClick={() => setView('matchweek-editor')}>
              Edit Matchweek Data
            </button>
          </div>

          <div className="admin-fantasy-action-group admin-fantasy-action-group--rescore">
            <span className="admin-fantasy-action-label">Rescore gameweek</span>
            <div className="admin-fantasy-rescore-row">
              <label className="admin-fantasy-gw-field">
                <span className="admin-fantasy-gw-label">GW</span>
                <input
                  type="number"
                  className="admin-fantasy-gw-input"
                  min="1"
                  max="38"
                  value={rescoreWeek}
                  onChange={(e) => setRescoreWeek(e.target.value)}
                  aria-label="Gameweek to rescore"
                />
              </label>
              <button type="button" className="btn btn-secondary admin-fantasy-rescore-btn" onClick={handleRescoreGameweek} disabled={loading}>
                Rescore gameweek
              </button>
            </div>
          </div>
        </div>

        <div className="admin-fantasy-dash-btns">
        <div className="card admin-deadline-card">
          <div className="admin-deadline-card__header">
            <h3 className="admin-deadline-card__title">
              <Clock size={17} aria-hidden="true" />
              Matchweek Deadlines
            </h3>
            <button
              type="button"
              className="btn btn-secondary btn-small admin-deadline-card__add-btn"
              onClick={() => {
                const nextAvailableMw = matchweeks.find(mw => !matchweekDeadlines.some(d => d.matchweek === mw.number));
                setEditingDeadline({ matchweek: nextAvailableMw?.number || 1, deadline: null, startDate: null, status: 'OPEN' });
              }}
            >
              + Add Deadline
            </button>
          </div>
          <p className="admin-deadline-card__lead">Configure fantasy deadlines per matchweek.</p>
          <div className="admin-deadline-list">
            {matchweekDeadlines.length === 0 ? (
              <div className="admin-deadline-empty">
                <p>No deadlines configured yet.</p>
                <div>
                  {(() => {
                    const mw1Exists = matchweekDeadlines.some(d => d.matchweek === 1);
                    const mw1Available = matchweeks.some(mw => mw.number === 1);
                    const isDisabled = mw1Exists || !mw1Available;
                    let tooltipText = '';
                    if (mw1Exists) tooltipText = 'MW1 deadline already configured';
                    if (!mw1Available) tooltipText = 'MW1 has already been played';
                    return (
                      <button
                        type="button"
                        className="btn btn-primary btn-small"
                        onClick={() => setEditingDeadline({ matchweek: 1, deadline: null, startDate: null, status: 'OPEN' })}
                        disabled={isDisabled}
                        title={tooltipText}
                      >
                        Create first deadline
                      </button>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <>
                <div className="admin-deadline-list-header" aria-hidden="true">
                  <span>Matchweek</span>
                  <span>Deadline</span>
                  <span>Status</span>
                  <span>Time left</span>
                  <span>Actions</span>
                </div>
                {matchweekDeadlines.map((row) => {
                  const remaining = deadlineCountdowns[row.matchweek] || 0;
                  const remainingLabel = formatRemainingLabel(remaining);
                  const deadlineLabel = row.deadline ? new Date(row.deadline).toLocaleString() : '—';
                  return (
                    <article key={row.matchweek} className="admin-deadline-item">
                      <div className="admin-deadline-item__cell admin-deadline-item__mw" data-label="Matchweek">
                        <span className="admin-deadline-item__mw-badge">MW {row.matchweek}</span>
                      </div>
                      <div className="admin-deadline-item__cell admin-deadline-item__dl" data-label="Deadline" title={deadlineLabel}>
                        {deadlineLabel}
                      </div>
                      <div className="admin-deadline-item__cell admin-deadline-item__st" data-label="Status">
                        <span className={deadlineStatusClass(row.status)}>{row.status || '—'}</span>
                      </div>
                      <div
                        className={`admin-deadline-item__cell admin-deadline-item__rem${remaining <= 0 ? ' is-closed' : ''}`}
                        data-label="Time left"
                      >
                        {remainingLabel}
                      </div>
                      <div className="admin-deadline-item__cell admin-deadline-item__actions" data-label="Actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-small admin-deadline-edit-btn"
                          onClick={() => setEditingDeadline(row)}
                        >
                          Edit
                        </button>
                      </div>
                    </article>
                  );
                })}
              </>
            )}
          </div>
        </div>
        {editingDeadline ? (
          <div className="modal-overlay admin-deadline-modal-overlay" role="presentation" onClick={() => setEditingDeadline(null)}>
            <div
              className="modal admin-deadline-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-deadline-editor-title"
              onClick={(e) => e.stopPropagation()}
            >
              <DeadlineEditor row={editingDeadline} onClose={() => setEditingDeadline(null)} matchweeks={matchweeks} saveDeadline={saveDeadline} />
            </div>
          </div>
        ) : null}
        <button type="button" className="btn btn-warning btn-small" onClick={() => setView('player-prices')}>
          Edit Player Prices
        </button>
        <button
          type="button"
          className="btn btn-danger btn-small"
          onClick={handleResetFantasySeason}
          disabled={loading}
        >
          Reset fantasy to GW1
        </button>
        <div className="card admin-fantasy-password-reset">
          <h3>Reset manager password</h3>
          <p className="admin-fantasy-password-reset__lead">
            Fallback when email reset is unavailable. Sets a new password for a fantasy account.
          </p>
          <form className="admin-fantasy-password-reset__form" onSubmit={handleAdminPasswordReset}>
            <label className="admin-fantasy-password-reset__field">
              <span>Manager email</span>
              <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
            </label>
            <label className="admin-fantasy-password-reset__field">
              <span>New password</span>
              <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} required minLength={8} />
            </label>
            <label className="admin-fantasy-password-reset__field">
              <span>Confirm password</span>
              <input type="password" value={resetConfirmPassword} onChange={(e) => setResetConfirmPassword(e.target.value)} required minLength={8} />
            </label>
            <button type="submit" className="btn btn-secondary btn-small" disabled={resettingPassword}>
              {resettingPassword ? 'Updating…' : 'Reset password'}
            </button>
          </form>
        </div>
        </div>
      </div>
      </div>
    );
  }

  if (view === 'player-prices') {
    return (
      <div className="admin-panel-root admin-fantasy-pe-page">
      <div className="card admin-fantasy-pe-card">
        <PlayerPriceEditor onBack={() => setView('dashboard')} />
      </div>
      </div>
    );
  }

  return (
    <div className="admin-panel-root admin-fantasy-mw-page">
      <div className="card admin-fantasy-mw-card">
        <FantasyMatchweekEditor
          matchweeks={matchweeks}
          onBackToDashboard={() => setView('dashboard')}
        />
      </div>
    </div>
  );
}
