import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import './PlayerPickerModal.css';

const POSITION_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'DF', label: 'Defenders' },
  { value: 'MF', label: 'Midfielders' },
  { value: 'ATT', label: 'Attackers' },
  { value: 'GK', label: 'Goalkeepers' },
];
const BUDGET_RANGES = [
  { label: 'Unlimited', min: null, max: null },
  { label: '≤ 4.5m', min: null, max: 4.5 },
  { label: '≤ 5.0m', min: null, max: 5.0 },
  { label: '≤ 5.5m', min: null, max: 5.5 },
  { label: '≤ 6.0m', min: null, max: 6.0 },
  { label: '≤ 7.0m', min: null, max: 7.0 },
];

export default function PlayerPickerModal({ lockedPosition, selectedIds = [], onClose, onSelect }) {
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState(lockedPosition || 'ALL');
  const [budgetLabel, setBudgetLabel] = useState('Unlimited');
  const [minPrice, setMinPrice] = useState(null);
  const [maxPrice, setMaxPrice] = useState(null);
  const [teams, setTeams] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [clubLabel, setClubLabel] = useState('All Clubs');
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (lockedPosition) setPosition(lockedPosition); }, [lockedPosition]);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const { data } = await api.get('/teams');
        setTeams((data || [])
          .filter(t => t && t.competition !== 'acwpl' && t.name !== 'Orion' && t.name !== 'Firestorm'));
      } catch {
        setTeams([]);
      }
    };
    fetchTeams();
  }, []);

  const queryPlayers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (position && position !== 'ALL') params.append('position', position);
      if (search) params.append('search', search);
      if (minPrice) params.append('minPrice', minPrice);
      if (maxPrice) params.append('maxPrice', maxPrice);
      if (selectedTeams.length) params.append('teams', selectedTeams.join(','));
      const { data } = await api.get(`/fantasy/players?${params}`);
      setPlayers(data.players || []);
    } catch {
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const queryPlayers = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (position && position !== 'ALL') params.append('position', position);
        if (search) params.append('search', search);
        if (minPrice) params.append('minPrice', minPrice);
        if (maxPrice) params.append('maxPrice', maxPrice);
        if (selectedTeams.length) params.append('teams', selectedTeams.join(','));
        const { data } = await api.get(`/fantasy/players?${params}`);
        setPlayers(data.players || []);
      } catch {
        setPlayers([]);
      } finally {
        setLoading(false);
      }
    };
    queryPlayers();
  }, [position, minPrice, maxPrice, selectedTeams, search]);

  const toggleTeam = (id) => {
    setSelectedTeams(prev => {
      const updated = prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id];
      setClubLabel(updated.length === 0 ? 'All Clubs' : updated.length === 1 ? teams.find(t => t._id === updated[0])?.name || 'Selected' : `${updated.length} Clubs`);
      return updated;
    });
  };

  const handleBudgetSelect = (range) => {
    setMinPrice(range.min);
    setMaxPrice(range.max);
    setBudgetLabel(range.label);
  };

  const handlePositionSelect = (pos) => {
    if (lockedPosition) return;
    setPosition(pos);
  };

  return (
    <div className="ppm-overlay" onClick={onClose}>
      <div className="ppm-modal" onClick={e => e.stopPropagation()}>
        <div className="ppm-header">
          <h3>Select Player</h3>
          <button className="ppm-close" onClick={onClose}>×</button>
        </div>
        <div className="ppm-controls">
          <input className="ppm-search" placeholder="Search by name" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="ppm-filters">
            <div className="ppm-filter-group">
              <button className="ppm-filter-btn" disabled={!!lockedPosition} title="Position filter">
                {POSITION_OPTIONS.find(p => p.value === position)?.label || 'Position'}
              </button>
              <div className="ppm-filter-dropdown">
                {POSITION_OPTIONS.map(p => (
                  <button
                    key={p.value}
                    className={`ppm-filter-item ${position === p.value ? 'active' : ''}`}
                    onClick={() => handlePositionSelect(p.value)}
                    disabled={!!lockedPosition}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ppm-filter-group">
              <button className="ppm-filter-btn">{budgetLabel}</button>
              <div className="ppm-filter-dropdown">
                {BUDGET_RANGES.map(range => (
                  <button key={range.label} className={`ppm-filter-item ${budgetLabel === range.label ? 'active' : ''}`} onClick={() => handleBudgetSelect(range)}>
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ppm-filter-group">
              <button className="ppm-filter-btn">{clubLabel}</button>
              <div className="ppm-filter-dropdown ppm-clubs-dropdown">
                {teams.map(team => (
                  <label key={team._id} className="ppm-club-item">
                    <input type="checkbox" checked={selectedTeams.includes(team._id)} onChange={() => toggleTeam(team._id)} />
                    <span>{team.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="ppm-list">
          {loading ? <div className="ppm-loading">Loading…</div> : (
            players.length === 0 ? <div className="ppm-empty">No players found</div> : (
              players.map(p => {
                const isTaken = selectedIds.includes(p._id);
                return (
                  <div
                    key={p._id}
                    className={`ppm-row-item ${isTaken ? 'disabled' : ''}`}
                    onClick={() => { if (!isTaken) onSelect(p); }}
                  >
                    <div className="ppm-player-main">
                      <div className="ppm-name">{p.name}</div>
                      <div className="ppm-sub">{p.team?.name} • {p.position}</div>
                    </div>
                    <div className="ppm-meta">
                      <div className="ppm-price">{(p.fantasyPrice || 0).toFixed(1)}m</div>
                      <div className="ppm-stat">Sel: {p.selectionPercentage?.toFixed ? p.selectionPercentage.toFixed(1) : p.selectionPercentage}%</div>
                      <div className="ppm-stat">Pts: {p.totalPoints}</div>
                      <div className="ppm-next">
                        {p.nextThree?.length ? p.nextThree.map((n, i) => (
                          <span key={i} className="ppm-next-pill">GW{n.matchweek || '?'}: {n.opponent || 'TBD'}</span>
                        )) : <span className="ppm-next-pill">No upcoming</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>
      </div>
    </div>
  );
}
