import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import api from '../utils/api';
import PlayerDeleteConfirmModal from './PlayerDeleteConfirmModal';
import './PlayerManagement.css';

const POSITIONS = ['GK', 'DF', 'MF', 'ATT'];

function playerSnapshot(player) {
  return JSON.stringify({
    name: player.name || '',
    number: player.number === null || player.number === undefined ? '' : String(player.number),
    position: player.position || 'MF',
    isCaptain: !!player.isCaptain,
    isViceCaptain: !!player.isViceCaptain,
  });
}

function buildSnapshots(list) {
  return Object.fromEntries((list || []).map((p) => [p._id, playerSnapshot(p)]));
}

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
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [playerSearchOpen, setPlayerSearchOpen] = useState(false);
  const [highlightedPlayerId, setHighlightedPlayerId] = useState(null);
  const [savedSnapshots, setSavedSnapshots] = useState({});
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePreview, setDeletePreview] = useState(null);
  const [deletePreviewLoading, setDeletePreviewLoading] = useState(false);
  const [deletePreviewError, setDeletePreviewError] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deletingPlayer, setDeletingPlayer] = useState(false);
  const playerSearchRef = useRef(null);

  const isPlayerDirty = useCallback((player) => {
    const saved = savedSnapshots[player._id];
    if (saved === undefined) return false;
    return playerSnapshot(player) !== saved;
  }, [savedSnapshots]);

  const dirtyCount = useMemo(
    () => players.filter((p) => isPlayerDirty(p)).length,
    [players, isPlayerDirty]
  );

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
      const list = data || [];
      setPlayers(list);
      setSavedSnapshots(buildSnapshots(list));
    } catch (e) {
      setError(e.response?.data?.message || e.message);
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTeams(); }, [fetchTeams]);
  useEffect(() => { if (selectedTeamId) fetchPlayers(selectedTeamId); }, [selectedTeamId]);

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
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      const selector = isMobile
        ? `.admin-player-mobile-only [data-player-id="${playerId}"]`
        : `.admin-player-desktop-only [data-player-id="${playerId}"]`;
      const el = document.querySelector(selector);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const nameInput = el.querySelector('input[type="text"], input:not([type])');
        if (nameInput && typeof nameInput.focus === 'function') {
          setTimeout(() => nameInput.focus({ preventScroll: true }), 400);
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
      setSavedSnapshots(prev => ({ ...prev, [player._id]: playerSnapshot(response.data) }));
      onDataChange();
    } catch (e) {
      setError(e.response?.data?.message || e.message);
      // On error, refetch to revert to server state
      await fetchPlayers(selectedTeamId);
    } finally {
      setSavingRow(null);
    }
  };

  const requestDeletePlayer = async (player) => {
    setDeleteModalOpen(true);
    setDeleteTargetId(player._id);
    setDeletePreview(null);
    setDeletePreviewError('');
    setDeletePreviewLoading(true);
    try {
      const { data } = await api.get(`/players/${player._id}/removal-preview`);
      setDeletePreview(data);
    } catch (e) {
      setDeletePreviewError(e.response?.data?.message || e.message);
    } finally {
      setDeletePreviewLoading(false);
    }
  };

  const resetDeleteModal = () => {
    setDeleteModalOpen(false);
    setDeleteTargetId(null);
    setDeletePreview(null);
    setDeletePreviewError('');
    setDeletingPlayer(false);
  };

  const closeDeleteModal = () => {
    if (deletingPlayer) return;
    resetDeleteModal();
  };

  const confirmDeletePlayer = async () => {
    if (!deleteTargetId || !deletePreview) return;
    setDeletingPlayer(true);
    setError('');
    try {
      const permanent = deletePreview.canPermanentDelete;
      await api.delete(`/players/${deleteTargetId}${permanent ? '?permanent=true' : ''}`);
      setPlayers((prev) => prev.filter((p) => p._id !== deleteTargetId));
      setSavedSnapshots((prev) => {
        const next = { ...prev };
        delete next[deleteTargetId];
        return next;
      });
      onDataChange();
      resetDeleteModal();
    } catch (e) {
      setDeletePreviewError(e.response?.data?.message || e.message);
    } finally {
      setDeletingPlayer(false);
    }
  };

  const deletePlayer = requestDeletePlayer;

  const transferPlayer = async (playerId, toTeamId) => {
    if (!toTeamId) return;
    if (!window.confirm('Confirm transfer to selected team?')) return;
    setSavingRow(playerId);
    setError('');
    try {
      await api.post(`/players/${playerId}/transfer`, { toTeamId });
      // Remove from current team view since they've been transferred
      setPlayers(prev => prev.filter(p => p._id !== playerId));
      setSavedSnapshots(prev => {
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
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
      setSavedSnapshots(prev => ({ ...prev, [response.data._id]: playerSnapshot(response.data) }));
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
    <div className="admin-panel-root admin-player-mgmt-page">
      <header className="admin-page-header admin-player-page-header">
        <div className="admin-page-header__main">
          <div className="admin-page-header__icon" aria-hidden="true">
            <Users size={20} />
          </div>
          <div className="admin-page-header__text">
            <p className="admin-page-header__eyebrow">Admin · Squad</p>
            <h1 className="admin-page-header__title">Player Management</h1>
            <p className="admin-page-header__subtitle">
              Manage rosters, captains, transfers, and coaching staff.
            </p>
          </div>
        </div>
        {selectedTeamId && dirtyCount > 0 && (
          <div className="admin-page-header__actions">
            <span className="admin-player-unsaved-badge" title={`${dirtyCount} player${dirtyCount === 1 ? '' : 's'} with unsaved changes`}>
              {dirtyCount} unsaved
            </span>
          </div>
        )}
      </header>

      <div className="card admin-player-mgmt">
        <div className="admin-player-mgmt-header">
          <h2 className="admin-player-mgmt-title">Select Team</h2>
          {!selectedTeamId && (
            <div className="admin-player-category-toggle" role="tablist" aria-label="Team category">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'boys'}
                className={activeTab === 'boys' ? 'active' : ''}
                onClick={() => setActiveTab('boys')}
              >
                Boys
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'girls'}
                className={activeTab === 'girls' ? 'active' : ''}
                onClick={() => setActiveTab('girls')}
              >
                Girls
              </button>
            </div>
          )}
        </div>
        {error && <div className="error-inline" style={{ marginBottom: 10 }}>{error}</div>}
        {!selectedTeamId && (
          <div className="team-cards admin-player-team-picker">
            {filteredTeams.map(team => (
              <button
                type="button"
                key={team._id}
                className={`team-card ${selectedTeamId === team._id ? 'active' : ''}`}
                onClick={() => setSelectedTeamId(team._id)}
              >
                {team.logo && (
                  <img
                    src={team.logo}
                    alt=""
                    className={team.name === 'Falcons' ? 'team-logo--falcons-bg' : undefined}
                  />
                )}
                <span className="admin-player-team-name" title={team.name}>{team.name}</span>
                <span className="admin-player-team-meta">
                  {team.competition === 'league' ? 'League' : 'ACWPL'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedTeamId && (
        <>
          <div className="card admin-player-roster-card">
            <div className="admin-player-back-row">
              <button type="button" className="btn btn-secondary btn-small admin-player-back-btn" onClick={() => setSelectedTeamId(null)}>Back to Teams</button>
            </div>
            <h3 className="admin-player-roster-title">
              Players — {selectedTeam.name}
            </h3>
            {!loading && players.length > 0 && (
              <div className="admin-player-search" ref={playerSearchRef}>
                <label htmlFor="admin-player-search-input" className="admin-player-search-label">
                  Search players
                </label>
                <input
                  id="admin-player-search-input"
                  type="search"
                  className="input admin-player-search-input"
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
                  <ul className="admin-player-search-results" aria-label="Player search results">
                    {playerSearchResults.length === 0 ? (
                      <li className="admin-player-search-empty">No players found</li>
                    ) : (
                      playerSearchResults.map(p => (
                        <li key={p._id}>
                          <button
                            type="button"
                            className="admin-player-search-option"
                            onClick={() => navigateToPlayer(p._id)}
                          >
                            <span className="admin-player-search-option-name">{p.name || 'Unnamed player'}</span>
                            <span className="admin-player-search-option-meta">
                              {p.number != null && p.number !== '' ? `#${p.number}` : 'No #'}
                              {' · '}
                              {p.position || 'MF'}
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            )}
            {loading && (
              <div className="admin-player-loading" aria-busy="true" aria-label="Loading players">
                <div className="admin-player-skeleton admin-player-skeleton--desktop admin-player-desktop-only">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="admin-player-skeleton-row" aria-hidden="true">
                      <span /><span /><span /><span /><span /><span /><span /><span />
                    </div>
                  ))}
                </div>
                <div className="admin-player-skeleton admin-player-skeleton--mobile admin-player-mobile-only">
                  {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="admin-player-skeleton-card" aria-hidden="true">
                      <div className="admin-player-skeleton-card-head" />
                      <div className="admin-player-skeleton-line" />
                      <div className="admin-player-skeleton-line admin-player-skeleton-line--short" />
                      <div className="admin-player-skeleton-actions" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!loading && (
              <>
              <div className="admin-player-table-wrap admin-player-desktop-only">
              <table className="table admin-player-table">
                <thead>
                  <tr>
                    <th className="admin-player-th-index" scope="col" title="Order in this list">No.</th>
                    <th scope="col">Name</th>
                    <th scope="col" title="Shirt number">#</th>
                    <th scope="col">Position</th>
                    <th scope="col">Captain</th>
                    <th scope="col">V. Captain</th>
                    <th scope="col">Transfer</th>
                    <th className="admin-player-actions-th" scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p, idx) => (
                    <tr
                      key={p._id}
                      data-player-id={p._id}
                      className={`admin-player-row${highlightedPlayerId === p._id ? ' admin-player-highlight' : ''}${isPlayerDirty(p) ? ' admin-player-row--dirty' : ''}`}
                    >
                      <td className="admin-player-index-cell" title={`Player ${idx + 1} of ${players.length}`}>
                        {idx + 1}
                      </td>
                      <td className="admin-player-name-cell">
                        <input
                          className="input admin-player-table-input"
                          value={p.name || ''}
                          title={p.name || 'Player name'}
                          onChange={e => updatePlayerField(p._id, 'name', e.target.value)}
                        />
                      </td>
                      <td className="admin-player-num-cell">
                        <input
                          className="input admin-player-num-input admin-player-table-input"
                          type="number"
                          value={p.number === null || p.number === undefined ? '' : p.number}
                          title={p.number != null && p.number !== '' ? `Shirt #${p.number}` : 'No shirt number'}
                          onChange={e => updatePlayerField(p._id, 'number', e.target.value)}
                        />
                      </td>
                      <td className="admin-player-pos-cell">
                        <select
                          className="input admin-player-table-input"
                          value={p.position || 'MF'}
                          title={`Position: ${p.position || 'MF'}`}
                          onChange={e => updatePlayerField(p._id, 'position', e.target.value)}
                        >
                          {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                        </select>
                      </td>
                      <td className="admin-player-flag-cell">
                        <input
                          type="checkbox"
                          className="admin-player-flag-checkbox"
                          checked={p.isCaptain || false}
                          title={p.isCaptain ? 'Captain' : 'Set as captain'}
                          onChange={e => handleCaptainToggle(p._id, e.target.checked)}
                          aria-label={`${p.name || 'Player'} captain`}
                        />
                      </td>
                      <td className="admin-player-flag-cell">
                        <input
                          type="checkbox"
                          className="admin-player-flag-checkbox"
                          checked={p.isViceCaptain || false}
                          title={p.isViceCaptain ? 'Vice captain' : 'Set as vice captain'}
                          onChange={e => handleViceCaptainToggle(p._id, e.target.checked)}
                          aria-label={`${p.name || 'Player'} vice captain`}
                        />
                      </td>
                      <td className="admin-player-transfer-cell">
                        <select
                          className="input admin-player-table-input admin-player-transfer-select"
                          value={p._transferTarget || ''}
                          title={p._transferTarget ? `Transfer to ${transferOptions.find(t => t._id === p._transferTarget)?.name || 'selected team'}` : 'Select transfer destination'}
                          onChange={e => updatePlayerField(p._id, '_transferTarget', e.target.value)}
                        >
                          <option value="">Select team</option>
                          {transferOptions.map(t => (
                            <option key={t._id} value={t._id}>{t.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="admin-player-actions-cell">
                        <div className="admin-player-action-btns">
                          <button
                            type="button"
                            className={`btn btn-success btn-small admin-player-save-btn${isPlayerDirty(p) ? ' admin-player-save-btn--dirty' : ''}`}
                            onClick={() => savePlayer(p)}
                            disabled={savingRow === p._id}
                            title={isPlayerDirty(p) ? 'Save unsaved changes' : 'Save player'}
                          >
                            {savingRow === p._id ? 'Saving…' : isPlayerDirty(p) ? 'Save *' : 'Save'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-info btn-small"
                            onClick={() => transferPlayer(p._id, p._transferTarget)}
                            disabled={!p._transferTarget || savingRow === p._id}
                          >
                            Transfer
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-small"
                            onClick={() => deletePlayer(p)}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {players.length === 0 && (
                    <tr className="admin-player-empty-row"><td colSpan={8} className="admin-player-empty-cell">No players yet.</td></tr>
                  )}
                </tbody>
              </table>
              </div>

              <div className="admin-player-cards admin-player-mobile-only">
                {players.length === 0 ? (
                  <div className="admin-player-empty">No players yet.</div>
                ) : (
                  players.map((p, idx) => (
                    <article
                      key={p._id}
                      data-player-id={p._id}
                      className={`admin-player-card${highlightedPlayerId === p._id ? ' admin-player-highlight' : ''}${isPlayerDirty(p) ? ' admin-player-card--dirty' : ''}`}
                    >
                      <div className="admin-player-card-header">
                        <span className="admin-player-card-index">#{idx + 1}</span>
                        <span className="admin-player-card-name-preview" title={p.name || 'Unnamed player'}>{p.name || 'Unnamed player'}</span>
                        {isPlayerDirty(p) && (
                          <span className="admin-player-card-unsaved" title="Unsaved changes">Unsaved</span>
                        )}
                      </div>

                      <label className="admin-player-field admin-player-field-full">
                        <span className="admin-player-field-label">Name</span>
                        <input
                          className="input admin-player-input"
                          value={p.name || ''}
                          onChange={e => updatePlayerField(p._id, 'name', e.target.value)}
                        />
                      </label>

                      <div className="admin-player-field-row">
                        <label className="admin-player-field">
                          <span className="admin-player-field-label">Position</span>
                          <select
                            className="input admin-player-input"
                            value={p.position || 'MF'}
                            onChange={e => updatePlayerField(p._id, 'position', e.target.value)}
                          >
                            {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                          </select>
                        </label>
                        <label className="admin-player-field">
                          <span className="admin-player-field-label">Shirt #</span>
                          <input
                            className="input admin-player-input admin-player-num-input"
                            type="number"
                            value={p.number === null || p.number === undefined ? '' : p.number}
                            onChange={e => updatePlayerField(p._id, 'number', e.target.value)}
                          />
                        </label>
                      </div>

                      <div className="admin-player-check-row">
                        <label className="admin-player-check">
                          <input
                            type="checkbox"
                            checked={p.isCaptain || false}
                            onChange={e => handleCaptainToggle(p._id, e.target.checked)}
                          />
                          <span>Captain</span>
                        </label>
                        <label className="admin-player-check">
                          <input
                            type="checkbox"
                            checked={p.isViceCaptain || false}
                            onChange={e => handleViceCaptainToggle(p._id, e.target.checked)}
                          />
                          <span>Vice Captain</span>
                        </label>
                      </div>

                      <label className="admin-player-field admin-player-field-full">
                        <span className="admin-player-field-label">Transfer</span>
                        <select
                          className="input admin-player-input"
                          value={p._transferTarget || ''}
                          onChange={e => updatePlayerField(p._id, '_transferTarget', e.target.value)}
                        >
                          <option value="">Select team</option>
                          {transferOptions.map(t => (
                            <option key={t._id} value={t._id}>{t.name}</option>
                          ))}
                        </select>
                      </label>

                      <div className="admin-player-card-actions">
                        <button
                          type="button"
                          className={`btn btn-success btn-small admin-player-action-btn${isPlayerDirty(p) ? ' admin-player-save-btn--dirty' : ''}`}
                          onClick={() => savePlayer(p)}
                          disabled={savingRow === p._id}
                        >
                          {savingRow === p._id ? 'Saving…' : isPlayerDirty(p) ? 'Save *' : 'Save'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-info btn-small admin-player-action-btn"
                          onClick={() => transferPlayer(p._id, p._transferTarget)}
                          disabled={!p._transferTarget || savingRow === p._id}
                        >
                          Transfer
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-small admin-player-action-btn admin-player-action-btn--remove"
                          onClick={() => deletePlayer(p)}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
              </>
            )}

            <div className="admin-player-add-section">
              <h4 className="admin-player-add-title">Add Player</h4>
              <div className="admin-player-add-form">
              <label className="admin-player-field admin-player-field-full admin-player-add-name">
                <span className="admin-player-field-label">Name</span>
                <input
                  className="input admin-player-input"
                  placeholder="Name"
                  value={newPlayer.name}
                  onChange={e => setNewPlayer({ ...newPlayer, name: e.target.value })}
                />
              </label>
              <div className="admin-player-field-row admin-player-add-row">
                <label className="admin-player-field">
                  <span className="admin-player-field-label">Number</span>
                  <input
                    className="input admin-player-input"
                    type="number"
                    placeholder="#"
                    value={newPlayer.number}
                    onChange={e => setNewPlayer({ ...newPlayer, number: e.target.value })}
                  />
                </label>
                <label className="admin-player-field">
                  <span className="admin-player-field-label">Position</span>
                  <select
                    className="input admin-player-input"
                    value={newPlayer.position}
                    onChange={e => setNewPlayer({ ...newPlayer, position: e.target.value })}
                  >
                    {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                  </select>
                </label>
              </div>
              <button type="button" className="btn btn-success btn-small admin-player-add-player-btn" onClick={addPlayer} disabled={addingPlayer}>
                {addingPlayer ? 'Adding…' : 'Add Player'}
              </button>
            </div>
            </div>
          </div>

          <div className="card admin-player-coaches-card">
            <h3 className="admin-player-coaches-title">Coaches — {selectedTeam.name}</h3>
            <div className="admin-player-coach-list">
              {(selectedTeam.staff || []).map((s, idx) => (
                <div key={`${s.name}-${idx}`} className="admin-player-coach-line">
                  <span className="admin-player-coach-role">{s.role}</span>
                  <span className="admin-player-coach-name">{s.name}</span>
                  <button type="button" className="btn btn-danger btn-small" onClick={() => removeStaff(idx)}>Remove</button>
                </div>
              ))}
              {(!selectedTeam.staff || selectedTeam.staff.length === 0) && (
                <div className="admin-player-coach-empty">No coaches added.</div>
              )}
            </div>

            <div className="admin-coach-add-form">
              <select
                className="input admin-coach-role-select"
                value={staffForm.role}
                onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}
              >
                <option value="Coach">Coach</option>
                <option value="Assistant">Assistant</option>
              </select>
              <input
                className="input admin-coach-name-input"
                placeholder="Name"
                value={staffForm.name}
                onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
              />
              <button type="button" className="btn btn-success btn-small admin-coach-add-btn" onClick={addStaff}>Add Coach</button>
            </div>
          </div>
        </>
      )}

      <PlayerDeleteConfirmModal
        open={deleteModalOpen}
        loading={deletePreviewLoading}
        error={deletePreviewError}
        preview={deletePreview}
        deleting={deletingPlayer}
        onConfirm={confirmDeletePlayer}
        onCancel={closeDeleteModal}
      />
    </div>
  );
}
