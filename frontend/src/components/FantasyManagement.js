import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { clearFantasyClientSeasonKeys } from '../utils/fantasyGameweek';
import EditPlayerAvailability from './EditPlayerAvailability';
import PlayerPriceEditor from './PlayerPriceEditor';

function performanceMapFromMatchPlayers(matchPlayers) {
  const map = {};
  (matchPlayers?.performances || []).forEach((row) => {
    const id = row.player?._id || row.player;
    if (id) map[String(id)] = row;
  });
  return map;
}

function formatEventStatsLabel(perf) {
  if (!perf) return '';
  const parts = [];
  if (perf.goals) parts.push(`${perf.goals}G (+${perf.goals * 4})`);
  if (perf.assists) parts.push(`${perf.assists}A (+${perf.assists * 3})`);
  if (perf.cleansheetPoints) parts.push(`CS +${perf.cleansheetPoints}`);
  if (perf.yellowCards) parts.push(`${perf.yellowCards}YC (-${perf.yellowCards})`);
  if (perf.redCards) parts.push(`${perf.redCards}RC (-${perf.redCards * 3})`);
  return parts.join(' · ');
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
  const [view, setView] = useState('dashboard'); // dashboard | matchweek-editor | player-availability | player-prices
  const [dashboard, setDashboard] = useState(null);
  const [matchweeks, setMatchweeks] = useState([]);
  const [selectedMatchweek, setSelectedMatchweek] = useState(null);
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [matchPlayers, setMatchPlayers] = useState(null);
  const [playerMinutes, setPlayerMinutes] = useState({});
  const [bonusAssignments, setBonusAssignments] = useState({ bp3: null, bp2: null, bp1: null });
  const [specialPoints, setSpecialPoints] = useState({ playerId: '', points: 0, reason: '' });
  const [rescoreWeek, setRescoreWeek] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [matchweekDeadlines, setMatchweekDeadlines] = useState([]);
  const [editingDeadline, setEditingDeadline] = useState(null);
  const [deadlineCountdowns, setDeadlineCountdowns] = useState({});
  const [step, setStep] = useState(1); // 1=select gw, 2=select match, 3=minutes, 4=bonus, 5=special, 6=submit

  const performanceByPlayer = useMemo(
    () => performanceMapFromMatchPlayers(matchPlayers),
    [matchPlayers]
  );

  const renderPlayerMinutesRow = (player) => {
    const perf = performanceByPlayer[String(player._id)];
    const eventLabel = formatEventStatsLabel(perf);
    return (
      <div key={player._id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ minWidth: 180 }}>{player.name} ({player.position})</span>
        {eventLabel ? (
          <span style={{ fontSize: '0.82rem', color: '#166534', fontWeight: 600 }} title="Auto-pulled from match events">
            {eventLabel}
          </span>
        ) : (
          <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>No match events</span>
        )}
        <input
          type="number"
          className="input"
          style={{ width: 100 }}
          placeholder="Minutes"
          min="0"
          max="70"
          value={playerMinutes[player._id] || ''}
          onChange={(e) => handleMinutesChange(player._id, e.target.value)}
        />
      </div>
    );
  };

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

  const handleSelectMatchweek = async (mw) => {
    setSelectedMatchweek(mw);
    setStep(2);
    setLoading(true);
    try {
      const { data } = await api.get(`/fantasy/admin/matchweeks/${mw.number}/matches`);
      setMatches(data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMatch = async (match) => {
    setSelectedMatch(match);
    setStep(3);
    setLoading(true);
    try {
      const { data } = await api.get(`/fantasy/admin/matches/${match._id}/players`);
      setMatchPlayers(data.data);
      // Pre-fill existing minutes if any
      const minutesMap = {};
      (data.data.performances || []).forEach(p => {
        minutesMap[p.player._id] = p.minutesPlayed || 0;
      });
      setPlayerMinutes(minutesMap);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load players');
    } finally {
      setLoading(false);
    }
  };

  const handleMinutesChange = (playerId, value) => {
    setPlayerMinutes(prev => ({ ...prev, [playerId]: Number(value) || 0 }));
  };

  const handleSaveMinutes = async () => {
    setLoading(true);
    setError('');
    try {
      const playerMinutesArray = Object.entries(playerMinutes).map(([playerId, minutes]) => ({ playerId, minutes }));
      await api.post(`/fantasy/admin/matches/${selectedMatch._id}/minutes`, {
        matchweek: selectedMatchweek.number,
        playerMinutes: playerMinutesArray
      });
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save minutes');
    } finally {
      setLoading(false);
    }
  };

  const handleBonusSelect = (level, playerId) => {
    // Check if player already assigned to another level
    const alreadyAssigned = Object.values(bonusAssignments).includes(playerId);
    if (alreadyAssigned && bonusAssignments[level] !== playerId) {
      setError('Player already assigned bonus points');
      return;
    }
    setBonusAssignments(prev => ({ ...prev, [level]: playerId }));
    setError('');
  };

  const handleSaveBonus = async () => {
    setLoading(true);
    setError('');
    try {
      const assignments = [];
      if (bonusAssignments.bp3) assignments.push({ playerId: bonusAssignments.bp3, bonusPoints: 3 });
      if (bonusAssignments.bp2) assignments.push({ playerId: bonusAssignments.bp2, bonusPoints: 2 });
      if (bonusAssignments.bp1) assignments.push({ playerId: bonusAssignments.bp1, bonusPoints: 1 });
      await api.post(`/fantasy/admin/matches/${selectedMatch._id}/bonus`, { bonusAssignments: assignments });
      setStep(5);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save bonus points');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSpecial = async () => {
    if (!specialPoints.playerId || !specialPoints.points) {
      setStep(6);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post(`/fantasy/admin/matches/${selectedMatch._id}/special`, {
        playerId: specialPoints.playerId,
        specialPoints: specialPoints.points,
        reason: specialPoints.reason
      });
      setStep(6);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save special points');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAll = async () => {
    if (selectedMatchweek?.number) {
      try {
        await api.post(`/fantasy/admin/rescore-gameweek/${selectedMatchweek.number}`);
      } catch (err) {
        console.error('Rescore failed:', err);
      }
    }
    alert('Fantasy data submitted successfully! Points will reflect in the user view.');
    // Reset
    setSelectedMatchweek(null);
    setSelectedMatch(null);
    setMatchPlayers(null);
    setPlayerMinutes({});
    setBonusAssignments({ bp3: null, bp2: null, bp1: null });
    setSpecialPoints({ playerId: '', points: 0, reason: '' });
    setStep(1);
    setView('dashboard');
  };

  const resetFlow = () => {
    setSelectedMatchweek(null);
    setSelectedMatch(null);
    setMatchPlayers(null);
    setPlayerMinutes({});
    setBonusAssignments({ bp3: null, bp2: null, bp1: null });
    setSpecialPoints({ playerId: '', points: 0, reason: '' });
    setStep(1);
    setView('dashboard');
  };

  const handleResetFantasySeason = async () => {
    if (
      !window.confirm(
        'Reset the fantasy season to Gameweek 1?\n\nThis clears all manager squads, matchweek scores, and player availability data. Fantasy accounts are kept.'
      )
    ) {
      return;
    }
    setLoading(true);
    setError('');
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
      setError(msg);
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  // Matchweek deadlines (admin-configured)
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
    setError('');
    try {
      const { data } = await api.post(`/fantasy/admin/rescore-gameweek/${mw}`);
      alert(
        data?.message ||
          `Gameweek ${mw} rescored.${data?.backfilled ? ` ${data.backfilled} team snapshot(s) backfilled.` : ''}`
      );
      await fetchDashboard();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to rescore gameweek';
      setError(msg);
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  if (view === 'dashboard') {
    return (
      <div className="admin-panel-root">
      <div className="card">
        <h2>Fantasy Management</h2>
        {dashboard ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div className="stat-card">
              <div className="stat-label">Total Fantasy Players</div>
              <div className="stat-value">{dashboard.totalFantasyPlayers}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Average Points</div>
              <div className="stat-value">{dashboard.avgPoints}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Most Captained</div>
              <div className="stat-value">
                {dashboard.mostCaptained?.[0]?.player || 'N/A'}
                {dashboard.mostCaptained?.[0]?.count
                  ? ` (${dashboard.mostCaptained[0].count})`
                  : ''}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Top Transfer In</div>
              <div className="stat-value">
                {dashboard.showTransferStats
                  ? dashboard.transfersIn?.[0]?.player || '—'
                  : 'From GW2'}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Top Transfer Out</div>
              <div className="stat-value">
                {dashboard.showTransferStats
                  ? dashboard.transfersOut?.[0]?.player || '—'
                  : 'From GW2'}
              </div>
            </div>
          </div>
        ) : (
          <div>Loading dashboard...</div>
        )}
        <div className="admin-fantasy-dash-btns">
        <button className="btn btn-success" onClick={() => setView('matchweek-editor')}>
          Edit Matchweek Data
        </button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="number"
            className="input"
            min="1"
            max="38"
            value={rescoreWeek}
            onChange={(e) => setRescoreWeek(e.target.value)}
            style={{ width: 72 }}
            aria-label="Gameweek to rescore"
          />
          <button type="button" className="btn btn-secondary" onClick={handleRescoreGameweek} disabled={loading}>
            Rescore gameweek
          </button>
        </div>
        <div className="card admin-deadline-card" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>🕒 Matchweek Deadlines</h3>
            <div>
              <button type="button" className="btn" onClick={() => {
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
                        className="btn btn-primary" 
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
        <button className="btn btn-info" onClick={() => setView('player-availability')}>
          Edit Player Data
        </button>
        <button className="btn btn-warning" onClick={() => setView('player-prices')}>
          Edit Player Prices
        </button>
        <button
          type="button"
          className="btn btn-danger"
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

  if (view === 'player-availability') {
    return (
      <div className="admin-panel-root">
      <div className="card">
        <div style={{ marginBottom: 10 }}>
          <button className="btn btn-secondary btn-small" onClick={() => setView('dashboard')}>← Back to Dashboard</button>
        </div>
        <h2>Edit Player Availability</h2>
        <EditPlayerAvailability 
          onClose={() => setView('dashboard')} 
          onSuccess={() => fetchDashboard()}
        />
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
      <div style={{ marginBottom: 10 }}>
        <button className="btn btn-secondary btn-small" onClick={resetFlow}>← Back to Dashboard</button>
      </div>
      <h2>Fantasy Matchweek Editor</h2>
      <div style={{ marginBottom: 12, padding: 10, background: '#e0f2fe', borderRadius: 8 }}>
        <strong>Step {step}/6:</strong>{' '}
        {step === 1 && 'Select Matchweek'}
        {step === 2 && 'Select Match'}
        {step === 3 && 'Assign Minutes Played'}
        {step === 4 && 'Assign Bonus Points'}
        {step === 5 && 'Assign Special Points (Optional)'}
        {step === 6 && 'Submit'}
      </div>

      {error && <div className="error-inline" style={{ marginBottom: 10 }}>{error}</div>}

      {step === 1 && (
        <div>
          <h3>Select Matchweek</h3>
          {matchweeks.length === 0 ? (
            <p>No matchweeks with matches yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {matchweeks.map(mw => (
                <button
                  key={mw.number}
                  className="btn btn-secondary"
                  onClick={() => handleSelectMatchweek(mw)}
                  style={{ textAlign: 'left' }}
                >
                  Matchweek {mw.number} ({mw.matchCount} match{mw.matchCount !== 1 ? 'es' : ''})
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 2 && selectedMatchweek && (
        <div>
          <h3>Select Match (Matchweek {selectedMatchweek.number})</h3>
          {loading ? (
            <div>Loading matches...</div>
          ) : matches.length === 0 ? (
            <p>No matches in this gameweek.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {matches.map(match => (
                <button
                  key={match._id}
                  className="btn btn-secondary"
                  onClick={() => handleSelectMatch(match)}
                  style={{ textAlign: 'left' }}
                >
                  {match.homeTeam?.name} vs {match.awayTeam?.name} {match.isPlayed ? '✅' : '⏳'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 3 && selectedMatch && matchPlayers && (
        <div>
          <h3>Assign Minutes Played</h3>
          <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: 10 }}>
            Match: {selectedMatch.homeTeam?.name} vs {selectedMatch.awayTeam?.name}<br />
            Goals, assists, clean sheets, and cards are pulled automatically from match events.
            Enter minutes and bonus below — those are added on top.<br />
            Minutes: &lt;35 min = +1, 35+ min = +2
          </p>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <h4>{matchPlayers.match.homeTeam.name}</h4>
              {matchPlayers.homePlayers.map(renderPlayerMinutesRow)}
            </div>
            <div>
              <h4>{matchPlayers.match.awayTeam.name}</h4>
              {matchPlayers.awayPlayers.map(renderPlayerMinutesRow)}
            </div>
          </div>
          <button className="btn btn-success" onClick={handleSaveMinutes} disabled={loading}>
            {loading ? 'Saving...' : 'Save Minutes & Continue'}
          </button>
        </div>
      )}

      {step === 4 && selectedMatch && matchPlayers && (
        <div>
          <h3>Assign Bonus Points</h3>
          <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: 10 }}>
            Select players for 3, 2, and 1 bonus points. A player can only be assigned once.
          </p>
          {['bp3', 'bp2', 'bp1'].map(level => (
            <div key={level} style={{ marginBottom: 12 }}>
              <label className="input-label">{level === 'bp3' ? '3' : level === 'bp2' ? '2' : '1'} Bonus Points</label>
              <select
                className="input"
                value={bonusAssignments[level] || ''}
                onChange={(e) => handleBonusSelect(level, e.target.value)}
              >
                <option value="">Select player...</option>
                {matchPlayers.homePlayers.concat(matchPlayers.awayPlayers).map(player => (
                  <option
                    key={player._id}
                    value={player._id}
                    disabled={Object.values(bonusAssignments).includes(player._id) && bonusAssignments[level] !== player._id}
                  >
                    {player.name} ({player.team.name})
                  </option>
                ))}
              </select>
            </div>
          ))}
          <button className="btn btn-success" onClick={handleSaveBonus} disabled={loading}>
            {loading ? 'Saving...' : 'Save Bonus & Continue'}
          </button>
        </div>
      )}

      {step === 5 && selectedMatch && matchPlayers && (
        <div>
          <h3>Assign Special Points (Optional)</h3>
          <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: 10 }}>
            For rare cases like an outfield player keeping a clean sheet as GK.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label className="input-label">Player</label>
              <select
                className="input"
                value={specialPoints.playerId}
                onChange={(e) => setSpecialPoints({ ...specialPoints, playerId: e.target.value })}
              >
                <option value="">Select player...</option>
                {matchPlayers.homePlayers.concat(matchPlayers.awayPlayers).map(player => (
                  <option key={player._id} value={player._id}>{player.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">Special Points</label>
              <input
                type="number"
                className="input"
                value={specialPoints.points}
                onChange={(e) => setSpecialPoints({ ...specialPoints, points: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="input-label">Reason</label>
              <input
                className="input"
                value={specialPoints.reason}
                onChange={(e) => setSpecialPoints({ ...specialPoints, reason: e.target.value })}
                placeholder="e.g., Played as GK and kept clean sheet"
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-success" onClick={handleSaveSpecial} disabled={loading}>
              {loading ? 'Saving...' : 'Save Special & Continue'}
            </button>
            <button className="btn btn-secondary" onClick={() => setStep(6)}>
              Skip Special Points
            </button>
          </div>
        </div>
      )}

      {step === 6 && (
        <div>
          <h3>Submit Fantasy Data</h3>
          <p style={{ marginBottom: 12 }}>
            All changes for <strong>{selectedMatch?.homeTeam?.name} vs {selectedMatch?.awayTeam?.name}</strong> are ready.
            Click submit to finalize and reflect in user view.
          </p>
          <button className="btn btn-success" onClick={handleSubmitAll}>
            Submit & Return to Dashboard
          </button>
        </div>
      )}
    </div>
    </div>
  );
}
