import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import api from '../utils/api';
import './FantasyTransfers.css';
import JerseyIcon from './JerseyIcon';
import PlayerPickerModal from './PlayerPickerModal';
import PlayerDetailsModal from './PlayerDetailsModal';
import ValidationModal from './ValidationModal';

export default function FantasyTransfers({ onBack }) {
  const [view, setView] = useState('pitch'); // 'pitch' | 'list'
  const [matches, setMatches] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLock, setPickerLock] = useState(null); // { position: 'DF', slotIndex: 0 }
  const [detailsPlayer, setDetailsPlayer] = useState(null);
  const [detailsSlot, setDetailsSlot] = useState(null); // { position, index }
  const [validationError, setValidationError] = useState(null);
  const [squad, setSquad] = useState(() => {
    const saved = localStorage.getItem('fantasySquad');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return { GK: [null, null], DF: [null, null, null, null], MF: [null, null, null, null], ATT: [null, null, null] };
      }
    }
    return { GK: [null, null], DF: [null, null, null, null], MF: [null, null, null, null], ATT: [null, null, null] };
  });

  // Save squad to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('fantasySquad', JSON.stringify(squad));
  }, [squad]);

  // Fetch matches for deadline computation
  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const { data } = await api.get('/matches');
        setMatches(Array.isArray(data) ? data : []);
      } catch {
        setMatches([]);
      }
    };
    fetchMatches();
  }, []);

  // Summary values — to be wired to backend later
  const cost = 0;
  const totalBudget = 100.0;
  
  const totalSpent = useMemo(() => {
    return Object.values(squad)
      .flat()
      .filter(Boolean)
      .reduce((sum, p) => sum + (p.fantasyPrice || 0), 0);
  }, [squad]);
  
  const budget = totalBudget - totalSpent;
  const wildcard = true;
  const freeHit = true;

  const upcomingInfo = useMemo(() => {
    const now = new Date();
    const future = matches
      .map(m => ({ ...m, dt: m.date && m.time ? new Date(`${m.date.split('T')[0]}T${m.time}`) : null }))
      .filter(m => m.dt && m.dt.getTime() > now.getTime());
    if (future.length === 0) return { week: null, deadline: null };
    const nextWeek = Math.min(...future.map(m => m.matchweek || 0).filter(Boolean));
    const inWeek = future.filter(m => (m.matchweek || 0) === nextWeek);
    if (inWeek.length === 0) return { week: nextWeek, deadline: null };
    const earliest = inWeek.reduce((a, b) => (a.dt < b.dt ? a : b));
    const deadline = new Date(earliest.dt.getTime() - 60 * 60 * 1000);
    return { week: nextWeek, deadline };
  }, [matches]);

  // Free transfers: GW1 unlimited, GW2+ 1 per week
  const currentGameweek = upcomingInfo.week || 1;
  const freeTransfersAvailable = currentGameweek === 1 ? 999 : 1;

  const formatDeadline = (dt) => {
    if (!dt) return '—';
    const d = new Date(dt);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = days[d.getDay()];
    const date = d.getDate();
    const month = months[d.getMonth()];
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${day} ${date} ${month}, ${hours}:${mins}`;
  };

  const validateTeamLimit = (newSquad, playerToAdd) => {
    const playerTeamId = playerToAdd.team?._id || playerToAdd.teamId;
    const allPlayers = Object.values(newSquad).flat().filter(Boolean);
    const teamPlayerCount = allPlayers.filter(p => (p.team?._id || p.teamId) === playerTeamId).length;
    
    if (teamPlayerCount >= 3) {
      return { valid: false, message: `You already have 3 players from ${playerToAdd.team?.name || 'this team'}. Maximum allowed is 3.` };
    }
    return { valid: true };
  };

  const validateBudget = (newSquad, playerToAdd, playerToRemove) => {
    const currentSpent = Object.values(newSquad)
      .flat()
      .filter(Boolean)
      .reduce((sum, p) => sum + (p.fantasyPrice || 0), 0);
    
    const addPrice = playerToAdd.fantasyPrice || 0;
    const removePrice = playerToRemove?.fantasyPrice || 0;
    const newTotal = currentSpent + addPrice - removePrice;
    
    if (newTotal > totalBudget) {
      return { valid: false, message: `Budget exceeded. This transfer costs ${addPrice.toFixed(1)}m and would exceed your budget. You have ${(totalBudget - currentSpent + removePrice).toFixed(1)}m remaining.` };
    }
    return { valid: true };
  };

  const getTeamCode = (player) => {
    // Extract team code from player.team object or fallback
    if (!player) return 'DEF';
    const teamName = player.team?.name || player.teamName || '';
    // Map full team names to short codes
    const mapping = {
      'Warriors': 'KWF',
      'Dragons': 'DRA',
      'Vikings': 'VIK',
      'Lions': 'LIO',
      'Elites': 'ELI',
      'Falcons': 'FAL'
    };
    return player.teamCode || mapping[teamName] || 'DEF';
  };

  const kitColors = (teamCode, pos) => {
    // Flat primary colors only; keepers use a neutral purple
    if (pos === 'GK') return { primary: '#8b5cf6', stroke: '#2f1e64' };
    switch (teamCode) {
      case 'KWF': // Warriors (yellow)
        return { primary: '#ffd233', stroke: '#7a5b00' };
      case 'DRA': // Dragons (blue)
        return { primary: '#2563eb', stroke: '#0b3b9d' };
      case 'VIK': // Vikings (red)
        return { primary: '#dc2626', stroke: '#7a1010' };
      case 'LIO': // Lions (green)
        return { primary: '#16a34a', stroke: '#0a5928' };
      case 'ELI': // Elites (black)
        return { primary: '#111111', stroke: '#e5e5e5' };
      case 'FAL': // Falcons (white with black outline)
        return { primary: '#ffffff', stroke: '#000000' };
      default:
        return { primary: '#444', stroke: '#111' };
    }
  };

  const grouped = useMemo(() => ({
    GK: squad.GK,
    DF: squad.DF,
    MF: squad.MF,
    ATT: squad.ATT,
  }), [squad]);

  const selectedIds = useMemo(() => (
    Object.values(grouped)
      .flat()
      .filter(Boolean)
      .map(p => p._id || p.id)
  ), [grouped]);

  const openPicker = (position, index) => {
    setPickerLock({ position, index });
    setPickerOpen(true);
  };

  const assignPlayer = (player) => {
    if (!pickerLock) return;
    
    const newSquad = {
      GK: [...squad.GK],
      DF: [...squad.DF],
      MF: [...squad.MF],
      ATT: [...squad.ATT]
    };
    const arr = [...newSquad[pickerLock.position]];
    const playerToRemove = arr[pickerLock.index];
    
    // Validate team limit
    const teamLimitCheck = validateTeamLimit(newSquad, player);
    if (!teamLimitCheck.valid) {
      setValidationError({ title: 'Team Limit Exceeded', message: teamLimitCheck.message, type: 'error' });
      return;
    }
    
    // Validate budget
    const budgetCheck = validateBudget(newSquad, player, playerToRemove);
    if (!budgetCheck.valid) {
      setValidationError({ title: 'Budget Exceeded', message: budgetCheck.message, type: 'error' });
      return;
    }
    
    // All validations passed, assign player
    arr[pickerLock.index] = player;
    newSquad[pickerLock.position] = arr;
    setSquad(newSquad);
    setPickerOpen(false);
    setPickerLock(null);
  };

  const openPlayerDetails = (player, position, index) => {
    setDetailsPlayer(player);
    setDetailsSlot({ position, index });
  };

  const handleReplacePlayer = () => {
    if (!detailsSlot) return;
    setPickerLock(detailsSlot);
    setPickerOpen(true);
    setDetailsPlayer(null);
    setDetailsSlot(null);
  };

  const handleRemovePlayer = () => {
    if (!detailsSlot) return;
    setSquad(prev => {
      const copy = { ...prev };
      const arr = [...copy[detailsSlot.position]];
      arr[detailsSlot.index] = null;
      copy[detailsSlot.position] = arr;
      return copy;
    });
    setDetailsPlayer(null);
    setDetailsSlot(null);
  };

  const isSquadComplete = useMemo(() => {
    return Object.values(squad).flat().filter(Boolean).length === 13;
  }, [squad]);

  const handleSubmitTeam = () => {
    if (!isSquadComplete) {
      setValidationError({ 
        title: 'Incomplete Squad', 
        message: 'You must select all 13 players (2 GK, 4 DF, 4 MF, 3 ATT) before submitting.',
        type: 'warning' 
      });
      return;
    }
    // TODO: Submit to backend and activate squad for gameweek
    console.log('Squad submitted:', squad);
    setValidationError({ 
      title: 'Squad Submitted', 
      message: `Your squad has been submitted for Gameweek ${upcomingInfo.week}. Good luck!`,
      type: 'success' 
    });
  };

  return (
    <div className="transfers-container">
      <div className="transfers-header">
        <button className="back-link" onClick={onBack} aria-label="Back to fantasy">
          <ArrowLeft size={18} />
          <span className="back-text">Back to Fantasy</span>
        </button>
        <div className="transfers-title-block">
          <h2 className="transfers-title">Transfers</h2>
          <div className="transfers-subtitle">
            Gameweek {upcomingInfo.week || '—'} • Deadline: {upcomingInfo.deadline ? formatDeadline(upcomingInfo.deadline) : '—'}
          </div>
        </div>
      </div>

      <div className="summary-bar">
        <div className="summary-item"><div className="label">Free Transfers</div><div className="value">{freeTransfersAvailable === 999 ? '∞' : freeTransfersAvailable}</div></div>
        <div className="summary-item"><div className="label">Cost</div><div className="value">{cost}</div></div>
        <div className="summary-item"><div className="label">Budget</div><div className="value">{budget.toFixed(1)}m</div></div>
        <div className="summary-item"><div className="label">Wildcard</div><div className="value">{wildcard ? 'Available' : 'Used'}</div></div>
        <div className="summary-item"><div className="label">Free Hit</div><div className="value">{freeHit ? 'Available' : 'Used'}</div></div>
      </div>

      <div className="toggle-bar">
        <button className={`toggle-btn ${view==='pitch'?'active':''}`} onClick={() => setView('pitch')}>Pitch View</button>
        <button className={`toggle-btn ${view==='list'?'active':''}`} onClick={() => setView('list')}>List View</button>
      </div>

      <div className="squad-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(Object.values(squad).flat().filter(Boolean).length / 13) * 100}%` }}></div>
        </div>
        <div className="progress-text">{Object.values(squad).flat().filter(Boolean).length} / 13 Players Selected</div>
      </div>

      {view === 'pitch' ? (
        <div className="pitch">
          {/* GK */}
          <div className="pitch-row gk">
            {grouped.GK.map((p, idx) => (
              <div className="jersey-card" key={`GK-${idx}`}>
                {p ? (
                  <div className="jersey-content" onClick={() => openPlayerDetails(p, 'GK', idx)}>
                    <div className="jersey-price">{(p.fantasyPrice || 0).toFixed(1)}m</div>
                    <div className="jersey-kit">
                      <JerseyIcon size={44} {...kitColors(getTeamCode(p), p.position)} />
                    </div>
                    <div className="jersey-meta">
                      <span className="name">{p.name}</span>
                      <span className="opp">Next: {p.nextThree?.[0]?.opponent || '—'}</span>
                    </div>
                  </div>
                ) : (
                  <button className="add-slot" onClick={() => openPicker('GK', idx)}>+ Add GK</button>
                )}
              </div>
            ))}
          </div>
          {/* DF */}
          <div className="pitch-row df">
            {grouped.DF.map((p, idx) => (
              <div className="jersey-card" key={`DF-${idx}`}>
                {p ? (
                  <div className="jersey-content" onClick={() => openPlayerDetails(p, 'DF', idx)}>
                    <div className="jersey-price">{(p.fantasyPrice || 0).toFixed(1)}m</div>
                    <div className="jersey-kit">
                      <JerseyIcon size={44} {...kitColors(getTeamCode(p), p.position)} />
                    </div>
                    <div className="jersey-meta">
                      <span className="name">{p.name}</span>
                      <span className="opp">Next: {p.nextThree?.[0]?.opponent || '—'}</span>
                    </div>
                  </div>
                ) : (
                  <button className="add-slot" onClick={() => openPicker('DF', idx)}>+ Add Defender</button>
                )}
              </div>
            ))}
          </div>
          {/* MF */}
          <div className="pitch-row mf">
            {grouped.MF.map((p, idx) => (
              <div className="jersey-card" key={`MF-${idx}`}>
                {p ? (
                  <div className="jersey-content" onClick={() => openPlayerDetails(p, 'MF', idx)}>
                    <div className="jersey-price">{(p.fantasyPrice || 0).toFixed(1)}m</div>
                    <div className="jersey-kit">
                      <JerseyIcon size={44} {...kitColors(getTeamCode(p), p.position)} />
                    </div>
                    <div className="jersey-meta">
                      <span className="name">{p.name}</span>
                      <span className="opp">Next: {p.nextThree?.[0]?.opponent || '—'}</span>
                    </div>
                  </div>
                ) : (
                  <button className="add-slot" onClick={() => openPicker('MF', idx)}>+ Add Midfielder</button>
                )}
              </div>
            ))}
          </div>
          {/* ATT */}
          <div className="pitch-row att">
            {grouped.ATT.map((p, idx) => (
              <div className="jersey-card" key={`ATT-${idx}`}>
                {p ? (
                  <div className="jersey-content" onClick={() => openPlayerDetails(p, 'ATT', idx)}>
                    <div className="jersey-price">{(p.fantasyPrice || 0).toFixed(1)}m</div>
                    <div className="jersey-kit">
                      <JerseyIcon size={44} {...kitColors(getTeamCode(p), p.position)} />
                    </div>
                    <div className="jersey-meta">
                      <span className="name">{p.name}</span>
                      <span className="opp">Next: {p.nextThree?.[0]?.opponent || '—'}</span>
                    </div>
                  </div>
                ) : (
                  <button className="add-slot" onClick={() => openPicker('ATT', idx)}>+ Add Forward</button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="list-view">
          {['GK','DF','MF','ATT'].flatMap(pos => grouped[pos].map((p, idx) => (
            <div className="list-item" key={`${pos}-${idx}`}>
              {p ? (
                <div className="list-item-content" onClick={() => openPlayerDetails(p, pos, idx)}>
                  <div className="name">{p.name}</div>
                  <div className="pos">{p.position}</div>
                  <div className="price">{(p.fantasyPrice || 0).toFixed(1)}m</div>
                  <div className="opp">Next: {p.nextThree?.[0]?.opponent || '—'}</div>
                </div>
              ) : (
                <button className="add-slot" onClick={() => openPicker(pos, idx)}>+ Add {pos}</button>
              )}
            </div>
          )))}
        </div>
      )}

      <div className="submit-section">
        <button 
          className={`submit-btn ${isSquadComplete ? 'active' : 'disabled'}`}
          onClick={handleSubmitTeam}
          disabled={!isSquadComplete}
        >
          Submit Team for Gameweek {upcomingInfo.week || '—'}
        </button>
      </div>

      {pickerOpen && (
        <PlayerPickerModal
          lockedPosition={pickerLock?.position}
          selectedIds={selectedIds}
          onClose={() => { setPickerOpen(false); setPickerLock(null); }}
          onSelect={assignPlayer}
        />
      )}
      {detailsPlayer && (
        <PlayerDetailsModal
          player={detailsPlayer}
          onReplace={handleReplacePlayer}
          onRemove={handleRemovePlayer}
          onClose={() => { setDetailsPlayer(null); setDetailsSlot(null); }}
        />
      )}
      {validationError && (
        <ValidationModal
          title={validationError.title}
          message={validationError.message}
          type={validationError.type || 'error'}
          onClose={() => setValidationError(null)}
        />
      )}
    </div>
  );
}
