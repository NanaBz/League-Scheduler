import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [playerSearchOpen, setPlayerSearchOpen] = useState(false);
  const [highlightedPlayerId, setHighlightedPlayerId] = useState(null);
  const playerSearchRef = useRef(null);

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

  useEffect(() => {
    setPlayerSearchQuery('');
    setPlayerSearchOpen(false);
    setHighlightedPlayerId(null);
  }, [selectedTeamId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (playerSearchRef.current && !playerSearchRef.current.contains(e.target)) {
        setPlayerSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const playerSearchResults = useMemo(() => {
    const q = playerSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return players.filter(p => {
      const name = (p.name || '').toLowerCase();
      const num = p.number != null && p.number !== '' ? String(p.number) : '';
      const pos = (p.position || '').toLowerCase();
      return name.includes(q) || num.includes(q) || pos.includes(q);
    }).slice(0, 10);
  }, [players, playerSearchQuery]);

  const navigateToPlayer = useCallback((playerId) => {
    setHighlightedPlayerId(playerId);
    setPlayerSearchQuery('');
    setPlayerSearchOpen(false);

    requestAnimationFrame(() => {
      const el = document.querySelector(`.price-player-row[data-player-id="${playerId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const priceInput = el.querySelector('.price-input');
        if (priceInput && typeof priceInput.focus === 'function') {
          setTimeout(() => priceInput.focus({ preventScroll: true }), 400);
        }
      }
    });

    window.setTimeout(() => setHighlightedPlayerId(null), 2500);
  }, []);

  const handlePlayerSearchKeyDown = (e) => {
    if (e.key === 'Enter' && playerSearchResults.length > 0) {
      e.preventDefault();
      navigateToPlayer(playerSearchResults[0]._id);
    } else if (e.key === 'Escape') {
      setPlayerSearchOpen(false);
    }
  };

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
    <div className="price-editor-container admin-fantasy-pe-editor">
      <div className="price-editor-header">
        <button type="button" className="admin-back-link" onClick={onBack}>
          ← Fantasy Management
        </button>
        <h2 className="price-editor-title">Player Fantasy Prices</h2>
        <p className="price-editor-subtitle">Edit FPL prices for your squad</p>
      </div>

      <div className="price-team-selection">
        <p className="price-team-label" id="price-team-label">Select team</p>
        <div className="price-team-cards" role="tablist" aria-labelledby="price-team-label">
          {leagueTeams.map(team => (
            <button
              key={team._id}
              type="button"
              role="tab"
              aria-selected={selectedTeamId === team._id}
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
          {error && <div className="price-error" role="alert">{error}</div>}
          {successMessage && <div className="price-success" role="status">{successMessage}</div>}

          {!loading && players.length > 0 && (
            <div className="price-player-search" ref={playerSearchRef}>
              <label htmlFor="price-player-search-input" className="price-player-search-label">
                Search players
              </label>
              <input
                id="price-player-search-input"
                type="search"
                className="price-player-search-input"
                placeholder="Search by name, shirt number, or position…"
                value={playerSearchQuery}
                onChange={e => {
                  setPlayerSearchQuery(e.target.value);
                  setPlayerSearchOpen(true);
                }}
                onFocus={() => setPlayerSearchOpen(true)}
                onKeyDown={handlePlayerSearchKeyDown}
                autoComplete="off"
                enterKeyHint="search"
              />
              {playerSearchOpen && playerSearchQuery.trim() && (
                <ul className="price-player-search-results" aria-label="Player search results">
                  {playerSearchResults.length === 0 ? (
                    <li className="price-player-search-empty">No players found</li>
                  ) : (
                    playerSearchResults.map(p => (
                      <li key={p._id}>
                        <button
                          type="button"
                          className="price-player-search-option"
                          onClick={() => navigateToPlayer(p._id)}
                        >
                          <span className="price-player-search-option-name">{p.name || 'Unnamed player'}</span>
                          <span className="price-player-search-option-meta">
                            {p.number != null && p.number !== '' ? `#${p.number}` : 'No #'}
                            {' · '}
                            {p.position || 'MF'}
                            {p.fantasyPrice != null ? ` · ${Number(p.fantasyPrice).toFixed(1)}m` : ''}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          )}

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
                      <div
                        key={player._id}
                        data-player-id={player._id}
                        className={`price-player-row${highlightedPlayerId === player._id ? ' price-player-highlight' : ''}`}
                      >
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
                          type="button"
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
