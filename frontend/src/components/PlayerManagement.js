import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../utils/api';

const POSITIONS = ['GK', 'DF', 'MF', 'ATT'];

export default function PlayerManagement({ onDataChange = () => {} }) {
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', number: '', position: 'MF' });
  const [staffForm, setStaffForm] = useState({ role: 'Coach', name: '' });
  const [savingRow, setSavingRow] = useState(null);

  // Boys teams: not acwpl, Girls teams: Orion/Firestorm or acwpl
  const boysTeams = useMemo(() => teams.filter(t => t && t.competition !== 'acwpl' && t.name !== 'Orion' && t.name !== 'Firestorm'), [teams]);
  const girlsTeams = useMemo(() => teams.filter(t => t && (t.competition === 'acwpl' || t.name === 'Orion' || t.name === 'Firestorm')), [teams]);

  // Tab state: 'boys' or 'girls'
  const [activeTab, setActiveTab] = useState('boys');
  const filteredTeams = useMemo(() => activeTab === 'boys' ? boysTeams : girlsTeams, [activeTab, boysTeams, girlsTeams]);
  const selectedTeam = useMemo(() => filteredTeams.find(t => t._id === selectedTeamId) || null, [filteredTeams, selectedTeamId]);
  // Transfer options: only within same group
  const transferOptions = useMemo(() => filteredTeams.filter(t => t._id !== selectedTeamId), [filteredTeams, selectedTeamId]);

  const fetchTeams = useCallback(async () => {
    try {
      const { data } = await api.get('/teams');
      setTeams(data || []);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  }, []);

  const fetchPlayers = async (teamId) => {
    if (!teamId) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/players', { params: { teamId } });
      setPlayers(data || []);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTeams(); }, [fetchTeams]);
  useEffect(() => { if (selectedTeamId) fetchPlayers(selectedTeamId); }, [selectedTeamId]);

  const updatePlayerField = (id, field, value) => {
    setPlayers(prev => prev.map(p => p._id === id ? { ...p, [field]: value } : p));
  };

  const handleCaptainToggle = (id, isCaptain) => {
    if (!isCaptain) {
      // Allowing unchecking, just toggle off
      updatePlayerField(id, 'isCaptain', false);
    } else {
      // Trying to set as captain
      const currentCaptain = players.find(p => p.isCaptain);
      if (currentCaptain && currentCaptain._id !== id) {
        // There's already a different captain
        if (window.confirm(`${currentCaptain.name} is currently the captain. Switch captaincy to ${players.find(p => p._id === id).name}?`)) {
          setPlayers(prev => prev.map(p => 
            p._id === currentCaptain._id ? { ...p, isCaptain: false } : 
            p._id === id ? { ...p, isCaptain: true } : 
            p
          ));
        }
      } else {
        // No current captain or same player, just set
        updatePlayerField(id, 'isCaptain', true);
      }
    }
  };

  const handleViceCaptainToggle = (id, isViceCaptain) => {
    if (!isViceCaptain) {
      // Allowing unchecking, just toggle off
      updatePlayerField(id, 'isViceCaptain', false);
    } else {
      // Trying to set as vice captain
      const currentViceCaptain = players.find(p => p.isViceCaptain);
      if (currentViceCaptain && currentViceCaptain._id !== id) {
        // There's already a different vice captain
        if (window.confirm(`${currentViceCaptain.name} is currently the vice captain. Switch vice captaincy to ${players.find(p => p._id === id).name}?`)) {
          setPlayers(prev => prev.map(p => 
            p._id === currentViceCaptain._id ? { ...p, isViceCaptain: false } : 
            p._id === id ? { ...p, isViceCaptain: true } : 
            p
          ));
        }
      } else {
        // No current vice captain or same player, just set
        updatePlayerField(id, 'isViceCaptain', true);
      }
    }
  };

  const savePlayer = async (player) => {
    setSavingRow(player._id);
    setError('');
    try {
      const response = await api.put(`/players/${player._id}`, {
        name: player.name,
        number: player.number === '' ? null : Number(player.number),
        position: player.position,
        isCaptain: !!player.isCaptain,
        isViceCaptain: !!player.isViceCaptain,
      });
      // Update local state with the server response to ensure consistency
      setPlayers(prev => prev.map(p => p._id === player._id ? response.data : p));
      onDataChange();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
      // On error, refetch to revert to server state
      await fetchPlayers(selectedTeamId);
    } finally {
      setSavingRow(null);
    }
  };

  const deletePlayer = async (playerId) => {
    if (!window.confirm('Remove this player?')) return;
    try {
      await api.delete(`/players/${playerId}`);
      // Optimistically remove from local state
      setPlayers(prev => prev.filter(p => p._id !== playerId));
      onDataChange();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
      // On error, refetch to restore state
      await fetchPlayers(selectedTeamId);
    }
  };

  const transferPlayer = async (playerId, toTeamId) => {
    if (!toTeamId) return;
    if (!window.confirm('Confirm transfer to selected team?')) return;
    setSavingRow(playerId);
    setError('');
    try {
      await api.post(`/players/${playerId}/transfer`, { toTeamId });
      // Remove from current team view since they've been transferred
      setPlayers(prev => prev.filter(p => p._id !== playerId));
      // Clear transfer target
      onDataChange();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
      // On error, refetch to restore state
      await fetchPlayers(selectedTeamId);
    } finally {
      setSavingRow(null);
    }
  };

  const addPlayer = async () => {
    if (!newPlayer.name || !newPlayer.position) {
      setError('Name and position are required');
      return;
    }
    setAddingPlayer(true);
    setError('');
    try {
      const response = await api.post('/players', {
        name: newPlayer.name,
        number: newPlayer.number === '' ? null : Number(newPlayer.number),
        position: newPlayer.position,
        team: selectedTeamId,
      });
      // Add the new player to local state
      setPlayers(prev => [...prev, response.data]);
      setNewPlayer({ name: '', number: '', position: 'MF' });
      onDataChange();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
      // On error, refetch to restore state
      await fetchPlayers(selectedTeamId);
    } finally {
      setAddingPlayer(false);
    }
  };

  const addStaff = async () => {
    if (!staffForm.name) { setError('Coach name is required'); return; }
    try {
      await api.post(`/teams/${selectedTeamId}/staff`, { role: staffForm.role, name: staffForm.name });
      setStaffForm({ role: 'Coach', name: '' });
      await fetchTeams();
      onDataChange();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  };

  const removeStaff = async (index) => {
    if (!window.confirm('Remove this coach?')) return;
    try {
      await api.delete(`/teams/${selectedTeamId}/staff/${index}`);
      await fetchTeams();
      onDataChange();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    }
  };

  return (
    <div>
      <div className="card">
        <h2>Player Management</h2>
        {error && <div className="error-inline" style={{ marginBottom: 10 }}>{error}</div>}
        {/* Tabs for Boys/Girls Teams */}
        {!selectedTeamId && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                className={`btn btn-tab${activeTab === 'boys' ? ' active' : ''}`}
                onClick={() => setActiveTab('boys')}
              >Boys Teams</button>
              <button
                className={`btn btn-tab${activeTab === 'girls' ? ' active' : ''}`}
                onClick={() => setActiveTab('girls')}
              >Girls Teams</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {filteredTeams.map(team => (
                <button
                  key={team._id}
                  className={`team-card ${selectedTeamId === team._id ? 'active' : ''}`}
                  onClick={() => setSelectedTeamId(team._id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {team.logo && (
                      <img
                        src={team.logo}
                        alt={team.name}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          backgroundColor: team.name === 'Falcons' ? '#94a3b8' : 'transparent',
                          padding: team.name === 'Falcons' ? 2 : 0,
                          boxSizing: 'border-box'
                        }}
                      />
                    )}
                    <div>
                      <div style={{ fontWeight: 700 }}>{team.name}</div>
                      <div style={{ fontSize: '0.85em', color: '#555' }}>{team.competition === 'league' ? 'League' : 'ACWPL'}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {selectedTeamId && (
        <>
          <div className="card">
            <div style={{ marginBottom: 10 }}>
              <button className="btn btn-secondary btn-small" onClick={() => setSelectedTeamId(null)}>Back to Teams</button>
            </div>
            <h3 style={{ padding: '8px 10px', borderRadius: 8, background: '#e2e8f0', color: '#0f172a' }}>
              Players — {selectedTeam.name}
            </h3>
            {loading && <div>Loading players…</div>}
            {!loading && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>#</th>
                    <th>Position</th>
                    <th>Captain</th>
                    <th>V. Captain</th>
                    <th>Transfer</th>
                    <th style={{ width: 160 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map(p => (
                    <tr key={p._id}>
                      <td>
                        <input
                          className="input"
                          value={p.name || ''}
                          onChange={e => updatePlayerField(p._id, 'name', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          type="number"
                          value={p.number === null || p.number === undefined ? '' : p.number}
                          onChange={e => updatePlayerField(p._id, 'number', e.target.value)}
                          style={{ width: 70 }}
                        />
                      </td>
                      <td>
                        <select
                          className="input"
                          value={p.position || 'MF'}
                          onChange={e => updatePlayerField(p._id, 'position', e.target.value)}
                        >
                          {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                        </select>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={p.isCaptain || false}
                          onChange={e => handleCaptainToggle(p._id, e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={p.isViceCaptain || false}
                          onChange={e => handleViceCaptainToggle(p._id, e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td>
                        <select
                          className="input"
                          value={p._transferTarget || ''}
                          onChange={e => updatePlayerField(p._id, '_transferTarget', e.target.value)}
                        >
                          <option value="">Select team</option>
                          {transferOptions.map(t => (
                            <option key={t._id} value={t._id}>{t.name}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-success btn-small"
                          onClick={() => savePlayer(p)}
                          disabled={savingRow === p._id}
                        >
                          {savingRow === p._id ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          className="btn btn-info btn-small"
                          onClick={() => transferPlayer(p._id, p._transferTarget)}
                          disabled={!p._transferTarget || savingRow === p._id}
                        >
                          Transfer
                        </button>
                        <button
                          className="btn btn-danger btn-small"
                          onClick={() => deletePlayer(p._id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {players.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: '#666' }}>No players yet.</td></tr>
                  )}
                </tbody>
              </table>
            )}

            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                className="input"
                placeholder="Name"
                value={newPlayer.name}
                onChange={e => setNewPlayer({ ...newPlayer, name: e.target.value })}
                style={{ minWidth: 180 }}
              />
              <input
                className="input"
                type="number"
                placeholder="#"
                value={newPlayer.number}
                onChange={e => setNewPlayer({ ...newPlayer, number: e.target.value })}
                style={{ width: 90 }}
              />
              <select
                className="input"
                value={newPlayer.position}
                onChange={e => setNewPlayer({ ...newPlayer, position: e.target.value })}
              >
                {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
              </select>
              <button className="btn btn-success" onClick={addPlayer} disabled={addingPlayer}>
                {addingPlayer ? 'Adding…' : 'Add Player'}
              </button>
            </div>
          </div>

          <div className="card">
            <h3>Coaches — {selectedTeam.name}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(selectedTeam.staff || []).map((s, idx) => (
                <div key={`${s.name}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ minWidth: 90, fontWeight: 600 }}>{s.role}</span>
                  <span>{s.name}</span>
                  <button className="btn btn-danger btn-small" onClick={() => removeStaff(idx)}>Remove</button>
                </div>
              ))}
              {(!selectedTeam.staff || selectedTeam.staff.length === 0) && (
                <div style={{ color: '#666' }}>No coaches added.</div>
              )}
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select
                className="input"
                value={staffForm.role}
                onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}
                style={{ width: 140 }}
              >
                <option value="Coach">Coach</option>
                <option value="Assistant">Assistant</option>
              </select>
              <input
                className="input"
                placeholder="Name"
                value={staffForm.name}
                onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
                style={{ minWidth: 200 }}
              />
              <button className="btn btn-success" onClick={addStaff}>Add Coach</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
