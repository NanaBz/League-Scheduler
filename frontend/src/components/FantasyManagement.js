import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { clearFantasyClientSeasonKeys } from '../utils/fantasyGameweek';
import PlayerPriceEditor from './PlayerPriceEditor';
import FantasyAdminDashboardStats from './FantasyAdminDashboardStats';
import FantasyMatchweekEditor from './FantasyMatchweekEditor';

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
    <div className="deadline-editor">
      <h4>{title}</h4>
      <label>Matchweek</label>
      <select value={matchweekVal} onChange={handleMatchweekChange}>
        <option value="">Select matchweek...</option>
        {matchweeks.map((mw) => (
          <option key={mw.number} value={mw.number}>MW {mw.number} — {mw.matchCount ?? '0'} matches</option>
        ))}
      </select>
      {loadingMatches && <div style={{ marginTop: 8, fontSize: '0.9rem', color: '#666' }}>Loading matches...</div>}
      {!loadingMatches && matchesInWeek.length > 0 && (
        <div style={{ marginTop: 8, fontSize: '0.9rem', color: '#444' }}>
          <strong>Matches in this week:</strong>
          <ul style={{ marginTop: 6 }}>
            {matchesInWeek.map(m => (
              <li key={m._id}>{m.homeTeam?.name} vs {m.awayTeam?.name} — {m.kickoff ? new Date(m.kickoff).toLocaleString() : 'TBD'}</li>
            ))}
          </ul>
        </div>
      )}
      <label>Start Date (optional)</label>
      <input type="datetime-local" value={startVal} onChange={(e) => setStartVal(e.target.value)} />
      <label>Deadline</label>
      <input type="datetime-local" value={deadlineVal} onChange={(e) => setDeadlineVal(e.target.value)} />
      <label>Status</label>
      <select value={statusVal} onChange={(e) => setStatusVal(e.target.value)}>
        <option value="OPEN">OPEN</option>
        <option value="LOCKED">LOCKED</option>
        <option value="LIVE">LIVE</option>
        <option value="FINISHED">FINISHED</option>
      </select>
      <div className="editor-actions" style={{ marginTop: 8 }}>
        <button type="button" className="btn" onClick={async () => {
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
        <button type="button" className="btn btn-ghost" onClick={onClose} style={{ marginLeft: 8 }}>Cancel</button>
      </div>
    </div>
  );
}

export default function FantasyManagement() {
  const [view, setView] = useState('dashboard'); // dashboard | matchweek-editor | player-prices
  const [dashboard, setDashboard] = useState(null);
  const [matchweeks, setMatchweeks] = useState([]);
  const [rescoreWeek, setRescoreWeek] = useState('1');
  const [loading, setLoading] = useState(false);
  const [matchweekDeadlines, setMatchweekDeadlines] = useState([]);
  const [editingDeadline, setEditingDeadline] = useState(null);
  const [deadlineCountdowns, setDeadlineCountdowns] = useState({});

  useEffect(() => {
    fetchDashboard();
    fetchMatchweeks();
  }, []);

  const fetchDashboard = async () => {
    try {
      const { data } = await api.get('/fantasy/admin/dashboard');
      setDashboard(data.data);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
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
      <div className="admin-panel-root">
      <div className="card admin-fantasy-dashboard">
        <h2 className="admin-fantasy-dashboard-title">Fantasy Management</h2>
        <FantasyAdminDashboardStats dashboard={dashboard} />

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>🕒 Matchweek Deadlines</h3>
            <div>
              <button type="button" className="btn btn-small" onClick={() => {
                const nextAvailableMw = matchweeks.find(mw => !matchweekDeadlines.some(d => d.matchweek === mw.number));
                setEditingDeadline({ matchweek: nextAvailableMw?.number || 1, deadline: null, startDate: null, status: 'OPEN' });
              }}>
                + Add Deadline
              </button>
            </div>
          </div>
          <p style={{ marginTop: 4, marginBottom: 8 }}>Configure fantasy deadlines per matchweek.</p>
          <div className="deadline-list">
            {matchweekDeadlines.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
              matchweekDeadlines.map((row) => {
                const remaining = deadlineCountdowns[row.matchweek] || 0;
                const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
                const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
                const secs = Math.floor((remaining % (60 * 1000)) / 1000);
                const remainingLabel = remaining > 0 ? `${String(days).padStart(2,'0')}d ${String(hours).padStart(2,'0')}h ${String(mins).padStart(2,'0')}m ${String(secs).padStart(2,'0')}s` : 'Closed';
                return (
                  <div key={row.matchweek} className="deadline-row" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 8 }}>
                    <div className="mw">MW {row.matchweek}</div>
                    <div className="dl">{row.deadline ? new Date(row.deadline).toLocaleString() : '—'}</div>
                    <div className="st">{row.status || '—'}</div>
                    <div className="rem">{remainingLabel}</div>
                    <div className="actions"><button type="button" className="btn-small" onClick={() => setEditingDeadline(row)}>Edit</button></div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        {editingDeadline ? (
          <div className="modal-overlay" style={{ zIndex: 20000, pointerEvents: 'auto' }}>
            <div className="modal" style={{ zIndex: 20001, pointerEvents: 'auto' }}>
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
        </div>
      </div>
      </div>
    );
  }

  if (view === 'player-prices') {
    return (
      <div className="admin-panel-root">
      <div className="card">
        <PlayerPriceEditor onBack={() => setView('dashboard')} />
      </div>
      </div>
    );
  }

  return (
    <div className="admin-panel-root">
      <div className="card">
        <FantasyMatchweekEditor
          matchweeks={matchweeks}
          onBackToDashboard={() => setView('dashboard')}
        />
      </div>
    </div>
  );
}
