import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import api from '../utils/api';
import {
  EMPTY_SQUAD,
  loadSquadFromLocalStorage,
  normalizeSquadShape,
  saveSquadToLocalStorage,
} from '../utils/fantasySquadStorage';
import { deriveGameweekInfo } from '../utils/fantasyGameweek';
import { transferChipSummaryLabel } from '../utils/fantasyChips';
import { isPastDeadline } from '../utils/fantasyMatchweek';
import {
  formatPitchFixture,
  refreshSquadFixtures,
} from '../utils/fantasyPlayerFixtures';
import './FantasyTransfers.css';
import JerseyIcon from './JerseyIcon';
import { getTeamCode, kitColors } from '../utils/fantasyKitColors';
import PlayerPickerModal from './PlayerPickerModal';
import PlayerDetailsModal from './PlayerDetailsModal';
import ValidationModal from './ValidationModal';

export default function FantasyTransfers({ user, onBack, onGoToPickTeam }) {
  const userId = user?.id;
  const [view, setView] = useState('pitch'); // 'pitch' | 'list'
  const [matches, setMatches] = useState([]);
  const [serverSeasonInfo, setServerSeasonInfo] = useState(null);
  const [squadLoading, setSquadLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLock, setPickerLock] = useState(null); // { position: 'DF', slotIndex: 0 }
  const [detailsPlayer, setDetailsPlayer] = useState(null);
  const [detailsSlot, setDetailsSlot] = useState(null); // { position, index }
  const [validationError, setValidationError] = useState(null);
  const [squad, setSquad] = useState(() => normalizeSquadShape(EMPTY_SQUAD));
  const saveTimerRef = useRef(null);
  const squadHydratedRef = useRef(false);

  const persistSquad = useCallback(async (nextSquad, userKey) => {
    if (!userKey) return;
    saveSquadToLocalStorage(userKey, nextSquad);
    try {
      await api.put('/fantasy/my-squad', { squad: nextSquad });
    } catch (err) {
      console.error('Failed to save squad:', err.response?.data || err.message);
    }
  }, []);

  // Load this user's squad when account changes
  useEffect(() => {
    if (!userId) {
      setSquad(normalizeSquadShape(EMPTY_SQUAD));
      setSquadLoading(false);
      return undefined;
    }

    let cancelled = false;
    squadHydratedRef.current = false;
    setSquadLoading(true);

    (async () => {
      try {
        const { data } = await api.get('/fantasy/my-squad');
        if (cancelled) return;
        if (data?.success && data.squad) {
          setSquad(normalizeSquadShape(data.squad));
          saveSquadToLocalStorage(userId, data.squad);
        } else {
          const cached = loadSquadFromLocalStorage(userId);
          setSquad(cached ? normalizeSquadShape(cached) : normalizeSquadShape(EMPTY_SQUAD));
        }
      } catch {
        if (!cancelled) {
          const cached = loadSquadFromLocalStorage(userId);
          setSquad(cached ? normalizeSquadShape(cached) : normalizeSquadShape(EMPTY_SQUAD));
        }
      } finally {
        if (!cancelled) {
          squadHydratedRef.current = true;
          setSquadLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Debounced save — only after initial load for this user
  useEffect(() => {
    if (!userId || !squadHydratedRef.current || squadLoading) return undefined;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      persistSquad(squad, userId);
    }, 400);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [squad, userId, squadLoading, persistSquad]);

  // Fetch matches for deadline computation and server season info
  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const { data } = await api.get('/matches', { params: { competition: 'league' } });
        setMatches(Array.isArray(data) ? data : []);
      } catch {
        setMatches([]);
      }
    };
    const fetchSeasonInfo = async () => {
      try {
        const s = await api.get('/fantasy/season');
        if (s?.data?.success) setServerSeasonInfo(s.data);
      } catch (err) {
        setServerSeasonInfo(null);
      }
    };
    fetchMatches();
    fetchSeasonInfo();
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

  const derivedGameweekInfo = useMemo(() => deriveGameweekInfo(matches), [matches]);
  const upcomingInfo = useMemo(() => {
    if (serverSeasonInfo?.deadline) {
      return { week: derivedGameweekInfo.week, deadline: new Date(serverSeasonInfo.deadline) };
    }
    return derivedGameweekInfo;
  }, [derivedGameweekInfo, serverSeasonInfo]);

  // Free transfers: GW1 unlimited, GW2+ 1 per week
  const currentGameweek = upcomingInfo.week || 1;
  const freeTransfersAvailable = currentGameweek === 1 ? 999 : 1;
  const deadlinePassed = isPastDeadline(upcomingInfo.deadline);
  const wildcardLabel = transferChipSummaryLabel(currentGameweek, false);
  const freeHitLabel = transferChipSummaryLabel(currentGameweek, false);

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

  const displaySquad = useMemo(
    () => refreshSquadFixtures(squad, matches, currentGameweek),
    [squad, matches, currentGameweek]
  );

  const grouped = useMemo(() => ({
    GK: displaySquad.GK,
    DF: displaySquad.DF,
    MF: displaySquad.MF,
    ATT: displaySquad.ATT,
  }), [displaySquad]);

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

  const handleSubmitTeam = async () => {
    if (deadlinePassed) {
      setValidationError({
        title: 'Deadline passed',
        message: 'The gameweek deadline has passed. Transfers are locked until the next gameweek.',
        type: 'warning',
      });
      return;
    }
    if (!isSquadComplete) {
      setValidationError({ 
        title: 'Incomplete Squad', 
        message: 'You must select all 13 players (2 GK, 4 DF, 4 MF, 3 ATT) before saving.',
        type: 'warning' 
      });
      return;
    }
    try {
      if (userId) {
        await api.put('/fantasy/my-squad', { squad });
        saveSquadToLocalStorage(userId, squad);
      }
      setValidationError({ 
        title: 'Squad saved', 
        message: `Your 13-player squad is saved for Gameweek ${upcomingInfo.week}. Head to Pick team to set your starting XI.`,
        type: 'success' 
      });
    } catch (err) {
      setValidationError({
        title: 'Save Failed',
        message: err.response?.data?.message || 'Could not save your squad. Please try again.',
        type: 'error',
      });
    }
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
            {user?.teamName ? `${user.teamName} · ` : ''}
            Gameweek {upcomingInfo.week || '—'} • Deadline: {upcomingInfo.deadline ? formatDeadline(upcomingInfo.deadline) : '—'}
          </div>
        </div>
      </div>

      <div className="summary-bar">
        <div className="summary-item"><div className="label">Free Transfers</div><div className="value">{freeTransfersAvailable === 999 ? '∞' : freeTransfersAvailable}</div></div>
        <div className="summary-item"><div className="label">Cost</div><div className="value">{cost}</div></div>
        <div className="summary-item"><div className="label">Budget</div><div className="value">{budget.toFixed(1)}m</div></div>
        <div className="summary-item"><div className="label">Wildcard</div><div className="value">{wildcardLabel}</div></div>
        <div className="summary-item"><div className="label">Free Hit</div><div className="value">{freeHitLabel}</div></div>
      </div>

      <div className="toggle-bar toggle-bar--fpl">
        <button type="button" className={`toggle-btn ${view === 'pitch' ? 'active' : ''}`} onClick={() => setView('pitch')}>Pitch</button>
        <button type="button" className={`toggle-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>List</button>
      </div>

      <div className="squad-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(Object.values(squad).flat().filter(Boolean).length / 13) * 100}%` }}></div>
        </div>
        <div className="progress-text">{Object.values(squad).flat().filter(Boolean).length} / 13 Players Selected</div>
      </div>

      {squadLoading ? (
        <p className="transfers-loading" style={{ textAlign: 'center', color: '#64748b', padding: '24px 0' }}>
          Loading your squad…
        </p>
      ) : null}

      {!squadLoading && view === 'pitch' ? (
        <div className="transfers-pitch-wrap">
          <div className="pitch" aria-label="Squad pitch view">
            <div className="pitch-row pitch-row--gk">
              {grouped.GK.map((p, idx) => (
                <div className="pitch-slot" key={`GK-${idx}`}>
                  {p ? (
                    <button
                      type="button"
                      className="pitch-player-card"
                      onClick={() => openPlayerDetails(p, 'GK', idx)}
                    >
                      <div className="pitch-player-price">{(p.fantasyPrice || 0).toFixed(1)}m</div>
                      <div className="pitch-player-kit">
                        <JerseyIcon className="pitch-player-kit-svg" size={52} {...kitColors(getTeamCode(p), p.position)} />
                      </div>
                      <div className="pitch-player-info">
                        <span className="pitch-player-name">{p.name}</span>
                        <span className="pitch-player-fixture">{formatPitchFixture(p, matches, currentGameweek)}</span>
                      </div>
                    </button>
                  ) : (
                    <button type="button" className="pitch-empty-slot" aria-label="Add goalkeeper" onClick={() => openPicker('GK', idx)}>
                      <span className="pitch-empty-slot__plus" aria-hidden>+</span>
                      <span className="pitch-empty-slot__label">Add GK</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="pitch-row pitch-row--df">
              {grouped.DF.map((p, idx) => (
                <div className="pitch-slot" key={`DF-${idx}`}>
                  {p ? (
                    <button type="button" className="pitch-player-card" onClick={() => openPlayerDetails(p, 'DF', idx)}>
                      <div className="pitch-player-price">{(p.fantasyPrice || 0).toFixed(1)}m</div>
                      <div className="pitch-player-kit">
                        <JerseyIcon className="pitch-player-kit-svg" size={52} {...kitColors(getTeamCode(p), p.position)} />
                      </div>
                      <div className="pitch-player-info">
                        <span className="pitch-player-name">{p.name}</span>
                        <span className="pitch-player-fixture">{formatPitchFixture(p, matches, currentGameweek)}</span>
                      </div>
                    </button>
                  ) : (
                    <button type="button" className="pitch-empty-slot" aria-label="Add defender" onClick={() => openPicker('DF', idx)}>
                      <span className="pitch-empty-slot__plus" aria-hidden>+</span>
                      <span className="pitch-empty-slot__label">Add DEF</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="pitch-row pitch-row--mf">
              {grouped.MF.map((p, idx) => (
                <div className="pitch-slot" key={`MF-${idx}`}>
                  {p ? (
                    <button type="button" className="pitch-player-card" onClick={() => openPlayerDetails(p, 'MF', idx)}>
                      <div className="pitch-player-price">{(p.fantasyPrice || 0).toFixed(1)}m</div>
                      <div className="pitch-player-kit">
                        <JerseyIcon className="pitch-player-kit-svg" size={52} {...kitColors(getTeamCode(p), p.position)} />
                      </div>
                      <div className="pitch-player-info">
                        <span className="pitch-player-name">{p.name}</span>
                        <span className="pitch-player-fixture">{formatPitchFixture(p, matches, currentGameweek)}</span>
                      </div>
                    </button>
                  ) : (
                    <button type="button" className="pitch-empty-slot" aria-label="Add midfielder" onClick={() => openPicker('MF', idx)}>
                      <span className="pitch-empty-slot__plus" aria-hidden>+</span>
                      <span className="pitch-empty-slot__label">Add MID</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="pitch-row pitch-row--att">
              {grouped.ATT.map((p, idx) => (
                <div className="pitch-slot" key={`ATT-${idx}`}>
                  {p ? (
                    <button type="button" className="pitch-player-card" onClick={() => openPlayerDetails(p, 'ATT', idx)}>
                      <div className="pitch-player-price">{(p.fantasyPrice || 0).toFixed(1)}m</div>
                      <div className="pitch-player-kit">
                        <JerseyIcon className="pitch-player-kit-svg" size={52} {...kitColors(getTeamCode(p), p.position)} />
                      </div>
                      <div className="pitch-player-info">
                        <span className="pitch-player-name">{p.name}</span>
                        <span className="pitch-player-fixture">{formatPitchFixture(p, matches, currentGameweek)}</span>
                      </div>
                    </button>
                  ) : (
                    <button type="button" className="pitch-empty-slot" aria-label="Add forward" onClick={() => openPicker('ATT', idx)}>
                      <span className="pitch-empty-slot__plus" aria-hidden>+</span>
                      <span className="pitch-empty-slot__label">Add FWD</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : !squadLoading ? (
        <div className="list-view">
          {['GK','DF','MF','ATT'].flatMap(pos => grouped[pos].map((p, idx) => (
            <div className="list-item" key={`${pos}-${idx}`}>
              {p ? (
                <div className="list-item-content" onClick={() => openPlayerDetails(p, pos, idx)}>
                  <div className="name">{p.name}</div>
                  <div className="pos">{p.position}</div>
                  <div className="price">{(p.fantasyPrice || 0).toFixed(1)}m</div>
                  <div className="opp">Next: {formatPitchFixture(p, matches, currentGameweek)}</div>
                </div>
              ) : (
                <button
                  type="button"
                  className="add-slot add-slot--list"
                  aria-label={`Add ${pos === 'DF' ? 'defender' : pos === 'MF' ? 'midfielder' : pos === 'ATT' ? 'forward' : 'goalkeeper'}`}
                  onClick={() => openPicker(pos, idx)}
                >
                  <span className="add-slot__plus" aria-hidden>+</span>
                  <span className="add-slot__label">{pos === 'GK' ? 'GK' : pos === 'DF' ? 'DEF' : pos === 'MF' ? 'MID' : 'FWD'}</span>
                </button>
              )}
            </div>
          )))}
        </div>
      ) : null}

      <div className="submit-section">
        <button 
          className={`submit-btn ${isSquadComplete ? 'active' : 'disabled'}`}
          onClick={handleSubmitTeam}
          disabled={!isSquadComplete || squadLoading || deadlinePassed}
        >
          {deadlinePassed
            ? 'Deadline passed — squad locked'
            : `Save squad for Gameweek ${upcomingInfo.week || '—'}`}
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
          secondaryAction={
            validationError.title === 'Squad saved' && onGoToPickTeam
              ? {
                  label: 'Pick Team',
                  onClick: () => {
                    setValidationError(null);
                    onGoToPickTeam();
                  },
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
