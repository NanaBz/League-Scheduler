import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import api from '../utils/api';
import './PlayerPriceEditor.css';

const POSITIONS = ['GK', 'DF', 'MF', 'ATT'];

export default function PlayerPriceEditor({ onBack }) {
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savingPlayerId, setSavingPlayerId] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const leagueTeams = useMemo(() => teams.filter(t => t && t.competition !== 'acwpl'), [teams]);
  const selectedTeam = useMemo(() => leagueTeams.find(t => t._id === selectedTeamId) || null, [leagueTeams, selectedTeamId]);

  // Fetch teams
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const { data } = await api.get('/teams');
        setTeams(data || []);
        const first = (data || []).find(t => t && t.competition !== 'acwpl' && !['Orion', 'Firestorm'].includes(t.name));
        if (first) setSelectedTeamId(first._id);
      } catch (e) {
        setError(e.response?.data?.message || e.message);
      }
    };
    fetchTeams();
  }, []);

  // Fetch players when team changes
  useEffect(() => {
    if (!selectedTeamId) return;
    const fetchPlayers = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/players', { params: { teamId: selectedTeamId } });
        setPlayers(data || []);
      } catch (e) {
        setError(e.response?.data?.message || e.message);
        setPlayers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPlayers();
  }, [selectedTeamId]);

  // Update price in local state
  const updatePrice = (playerId, price) => {
    setPlayers(prev =>
      prev.map(p =>
        p._id === playerId ? { ...p, fantasyPrice: price === '' ? null : parseFloat(price) } : p
      )
    );
  };

  // Save player price
  const savePrice = async (player) => {
    setSavingPlayerId(player._id);
    setError('');
    setSuccessMessage('');
    try {
      await api.put(`/players/${player._id}`, {
        fantasyPrice: player.fantasyPrice
      });
      setSuccessMessage(`${player.name}'s price updated!`);
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setSavingPlayerId(null);
    }
  };

  const groupedPlayers = useMemo(() => {
    const groups = {};
    POSITIONS.forEach(pos => groups[pos] = []);
    players.forEach(p => {
      if (groups[p.position]) groups[p.position].push(p);
    });
    return groups;
  }, [players]);

  return (
    <div className="price-editor-container">
      {/* Header */}
      <div className="price-editor-header">
        <button className="price-back-link" onClick={onBack} aria-label="Back">
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
        <div className="price-editor-title-block">
          <h2 className="price-editor-title">Player Fantasy Prices</h2>
          <p className="price-editor-subtitle">Edit FPL prices for your squad</p>
        </div>
      </div>

      {/* Team Selection */}
      <div className="price-team-selection">
        <p className="price-team-label">Select Team:</p>
        <div className="price-team-cards">
          {leagueTeams.map(team => (
            <button
              key={team._id}
              className={`price-team-card ${selectedTeamId === team._id ? 'active' : ''}`}
              onClick={() => setSelectedTeamId(team._id)}
            >
              {team.logo ? <img src={team.logo} alt={team.name} /> : <span>{team.name}</span>}
              <p>{team.name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Player List */}
      {selectedTeam && (
        <div className="price-editor-content">
          {error && <div className="price-error">{error}</div>}
          {successMessage && <div className="price-success">{successMessage}</div>}

          {loading ? (
            <p className="price-loading">Loading players...</p>
          ) : players.length === 0 ? (
            <p className="price-empty">No players for this team.</p>
          ) : (
            <div className="price-editor-grid">
              {POSITIONS.map(pos => (
                <div key={pos} className="price-position-group">
                  <h3 className="price-position-title">{pos}s</h3>
                  <div className="price-position-list">
                    {groupedPlayers[pos].map(player => (
                      <div key={player._id} className="price-player-row">
                        <div className="price-player-info">
                          <p className="price-player-name">{player.name}</p>
                          <p className="price-player-number">#{player.number || '—'}</p>
                        </div>
                        <div className="price-input-group">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={player.fantasyPrice !== null ? player.fantasyPrice : ''}
                            onChange={e => updatePrice(player._id, e.target.value)}
                            placeholder="Price"
                            className="price-input"
                            disabled={savingPlayerId === player._id}
                          />
                          <span className="price-currency">m</span>
                        </div>
                        <button
                          className="price-save-btn"
                          onClick={() => savePrice(player)}
                          disabled={savingPlayerId === player._id}
                        >
                          {savingPlayerId === player._id ? '...' : 'Save'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
