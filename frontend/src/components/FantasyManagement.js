import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import EditPlayerAvailability from './EditPlayerAvailability';
import PlayerPriceEditor from './PlayerPriceEditor';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1=select gw, 2=select match, 3=minutes, 4=bonus, 5=special, 6=submit

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

  const handleSubmitAll = () => {
    alert('Fantasy data submitted successfully! (Will reflect in user view)');
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

  if (view === 'dashboard') {
    return (
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
              <div className="stat-value">{dashboard.mostCaptained[0]?.player || 'N/A'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Top Transfer In</div>
              <div className="stat-value">{dashboard.transfersIn[0]?.player || 'N/A'}</div>
            </div>
          </div>
        ) : (
          <div>Loading dashboard...</div>
        )}
        <button className="btn btn-success" onClick={() => setView('matchweek-editor')}>
          Edit Matchweek Data
        </button>
        <button className="btn btn-info" onClick={() => setView('player-availability')} style={{ marginLeft: 8 }}>
          Edit Player Data
        </button>
        <button className="btn btn-warning" onClick={() => setView('player-prices')} style={{ marginLeft: 8 }}>
          Edit Player Prices
        </button>
      </div>
    );
  }

  if (view === 'player-availability') {
    return (
      <div className="card">
        <div style={{ marginBottom: 10 }}>
          <button className="btn btn-secondary btn-small" onClick={() => setView('dashboard')}>← Back to Dashboard</button>
        </div>
        <h2>Edit Player Availability</h2>
        <p style={{ color: '#666', marginBottom: 16 }}>
          Set player injury status and chance of playing to alert fantasy users in their team selection view.
        </p>
        <EditPlayerAvailability 
          onClose={() => setView('dashboard')} 
          onSuccess={() => fetchDashboard()}
        />
      </div>
    );
  }

  if (view === 'player-prices') {
    return (
      <div className="card">
        <PlayerPriceEditor onBack={() => setView('dashboard')} />
      </div>
    );
  }

  return (
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
            Points: &lt;35 min = +1, 35-60 min = +2, &gt;60 min = +2
          </p>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <h4>{matchPlayers.match.homeTeam.name}</h4>
              {matchPlayers.homePlayers.map(player => (
                <div key={player._id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ minWidth: 180 }}>{player.name} ({player.position})</span>
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
              ))}
            </div>
            <div>
              <h4>{matchPlayers.match.awayTeam.name}</h4>
              {matchPlayers.awayPlayers.map(player => (
                <div key={player._id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ minWidth: 180 }}>{player.name} ({player.position})</span>
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
              ))}
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
  );
}
