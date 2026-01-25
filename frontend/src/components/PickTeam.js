import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Zap, BarChart3, Crown, Target, Star } from 'lucide-react';
import './PickTeam.css';
import JerseyIcon from './JerseyIcon';
import PlayerDetailModal from './PlayerDetailModal';
import ChipDetailsModal from './ChipDetailsModal';

export default function PickTeam({ onBack }) {
  // eslint-disable-next-line no-unused-vars
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

  // Check if squad is complete (13 players)
  const isSquadComplete = useMemo(() => {
    const gks = squad.GK.filter(Boolean).length;
    const dfs = squad.DF.filter(Boolean).length;
    const mfs = squad.MF.filter(Boolean).length;
    const atts = squad.ATT.filter(Boolean).length;
    return gks === 2 && dfs === 4 && mfs === 4 && atts === 3;
  }, [squad]);

  const POSITION_LIMITS = {
    GK: { min: 1, max: 1 },
    DF: { min: 2, max: 4 },
    MF: { min: 2, max: 4 },
    ATT: { min: 1, max: 3 }
  };

  const ensureSlots = (arr, size) => {
    const copy = Array.isArray(arr) ? [...arr] : [];
    while (copy.length < size) copy.push(null);
    return copy.slice(0, size);
  };

  // Auto-select starting 9 based on transfer order (3-3-2 formation) with capacity to flex formation
  const autoSelectStarting = () => {
    return {
      GK: squad.GK[0] || null,
      DF: ensureSlots([squad.DF[0] || null, squad.DF[1] || null, squad.DF[2] || null], POSITION_LIMITS.DF.max),
      MF: ensureSlots([squad.MF[0] || null, squad.MF[1] || null, squad.MF[2] || null], POSITION_LIMITS.MF.max),
      ATT: ensureSlots([squad.ATT[0] || null, squad.ATT[1] || null], POSITION_LIMITS.ATT.max)
    };
  };

  const normalizeStarting = (s) => {
    if (!s) return autoSelectStarting();
    return {
      GK: s.GK || null,
      DF: ensureSlots(s.DF, POSITION_LIMITS.DF.max),
      MF: ensureSlots(s.MF, POSITION_LIMITS.MF.max),
      ATT: ensureSlots(s.ATT, POSITION_LIMITS.ATT.max)
    };
  };

  const [starting9] = useState(() => {
    const saved = localStorage.getItem('fantasyStarting9');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return normalizeStarting(parsed);
      } catch {
        return autoSelectStarting();
      }
    }
    return autoSelectStarting();
  });

  const [captain, setCaptain] = useState(() => localStorage.getItem('fantasyCaptain') || null);
  const [viceCaptain, setViceCaptain] = useState(() => localStorage.getItem('fantasyViceCaptain') || null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedPlayerIsStarting, setSelectedPlayerIsStarting] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null); // { pos: 'DF' | 'MF' | 'ATT' | 'GK', index: number }
  const [activeChip, setActiveChip] = useState(() => localStorage.getItem('fantasyActiveChip') || null);
  const [selectedChipDetails, setSelectedChipDetails] = useState(null); // { chipId, chip } for modal
  const [usedChips] = useState(() => {
    const saved = localStorage.getItem('fantasyUsedChips');
    return saved ? JSON.parse(saved) : {};
  });
  const [currentGameweek] = useState(() => {
    const saved = localStorage.getItem('fantasyCurrentGameweek');
    return saved ? parseInt(saved) : 1;
  });
  // setCurrentGameweek is not used, so do not declare it

  const CHIPS = {
    WC: { name: 'Wildcard', description: 'Unlimited transfers, no cost' },
    BB: { name: 'Bench Boost', description: 'Bench players score points' },
    TC: { name: 'Triple Captain', description: 'Captain scores 3× points' },
    FH: { name: 'Free Hit', description: 'Unlimited transfers (reverts next GW)' },
    DC: { name: 'Duo Captain', description: 'Both C & VC score 2×' }
  };

  const getPlayerId = (player) => player?._id || player?.id || null;

  const renderRoleBadge = (player) => {
    const id = getPlayerId(player);
    if (!id) return null;
    if (captain === id) return <span className="role-chip role-chip-c">C</span>;
    if (viceCaptain === id) return <span className="role-chip role-chip-vc">VC</span>;
    return null;
  };

  const openPlayerModal = (player, isStartingFlag, pos = null, index = null) => {
    setSelectedPlayer(player);
    setSelectedPlayerIsStarting(isStartingFlag);
    setSelectedSlot(isStartingFlag ? { pos, index } : null);
  };


  useEffect(() => {
    localStorage.setItem('fantasyStarting9', JSON.stringify(starting9));
  }, [starting9]);

  useEffect(() => {
    if (captain) {
      localStorage.setItem('fantasyCaptain', captain);
    } else {
      localStorage.removeItem('fantasyCaptain');
    }
  }, [captain]);

  useEffect(() => {
    if (activeChip) {
      localStorage.setItem('fantasyActiveChip', activeChip);
    } else {
      localStorage.removeItem('fantasyActiveChip');
    }
  }, [activeChip]);

  useEffect(() => {
    localStorage.setItem('fantasyUsedChips', JSON.stringify(usedChips));
  }, [usedChips]);

  useEffect(() => {
    localStorage.setItem('fantasyCurrentGameweek', currentGameweek.toString());
  }, [currentGameweek]);

  const getTeamCode = (player) => {
    if (!player) return 'DEF';
    const teamName = player.team?.name || player.teamName || '';
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

  // Get opponent short code for next match
  const getOpponentShort = (player) => {
    if (!player || !player.upcoming || player.upcoming.length === 0) return null;
    const nextMatch = player.upcoming[0];
    const opponent = nextMatch.side === 'home' ? nextMatch.away : nextMatch.home;
    return opponent?.short || opponent?.name?.substring(0, 3).toUpperCase() || null;
  };

  // Calculate current formation
  // const countPositions = (state = starting9) => ({
  //   GK: state.GK ? 1 : 0,
  //   DF: state.DF.filter(Boolean).length,
  //   MF: state.MF.filter(Boolean).length,
  //   ATT: state.ATT.filter(Boolean).length
  // });

  // const getFormation = () => {
  //   const counts = countPositions();
  //   return `${counts.DF}-${counts.MF}-${counts.ATT}`;
  // };

  const getChipStatus = (chipId) => {
    if (usedChips[chipId]) {
      return 'played'; // Chip already used this season
    }
    if (activeChip === chipId) {
      return 'active'; // Currently selected for this GW
    }
    return 'available'; // Can be used
  };

  const canActivateChip = (chipId) => {
    // Can't use if already used
    if (usedChips[chipId]) return false;
    // WC and FH cannot be used in GW1 (unlimited transfers already provided)
    if ((chipId === 'WC' || chipId === 'FH') && currentGameweek === 1) return false;
    // Allow direct switching: don't block if another chip is active
    return true;
  };

  const toggleChip = (chipId) => {
    if (!canActivateChip(chipId)) return;
    if (activeChip === chipId) {
      setActiveChip(null);
    } else {
      setActiveChip(chipId);
    }
  };

  // const markChipUsed = () => {
  //   if (activeChip) {
  //     setUsedChips({ ...usedChips, [activeChip]: currentGameweek });
  //   }
  // };

  const kitColors = (teamCode, pos) => {
    if (pos === 'GK') return { primary: '#8b5cf6', stroke: '#2f1e64' };
    switch (teamCode) {
      case 'KWF': return { primary: '#ffd233', stroke: '#7a5b00' };
      case 'DRA': return { primary: '#2563eb', stroke: '#0b3b9d' };
      case 'VIK': return { primary: '#dc2626', stroke: '#7a1010' };
      case 'LIO': return { primary: '#16a34a', stroke: '#0a5928' };
      case 'ELI': return { primary: '#111111', stroke: '#e5e5e5' };
      case 'FAL': return { primary: '#ffffff', stroke: '#000000' };
      default: return { primary: '#444', stroke: '#111' };
    }
  };

  const allPlayers = useMemo(() => {
    return Object.values(squad).flat().filter(Boolean);
  }, [squad]);

  const bench = useMemo(() => {
    const starting = Object.values(starting9).flat().filter(Boolean).map(p => p._id || p.id);
    return allPlayers.filter(p => !starting.includes(p._id || p.id));
  }, [allPlayers, starting9]);

  // const hasNullSlot = (pos, state = starting9) => {
  //   if (pos === 'GK') return !state.GK; // GK has one slot
  //   const arr = state[pos] || [];
  //   return arr.some(slot => !slot);
  // };

  // const canSwapWith = (benchPlayer) => {};

  // const eligibleSubstitutes = (!selectedPlayerIsStarting || !selectedSlot)
  //   ? []
  //   : bench.filter((p) => canSwapWith(p));

  // const getFirstAvailableStartingPlayer = () => {
  //   // Return first starting player (excluding selected one if applicable)
  //   const allStarting = [
  //     starting9.GK,
  //     ...starting9.DF.filter(Boolean),
  //     ...starting9.MF.filter(Boolean),
  //     ...starting9.ATT.filter(Boolean)
  //   ].filter(Boolean);
  //   return allStarting[0]?._id || allStarting[0]?.id || null;
  // };

  // const applySubstitution = (benchPlayer) => {
  //   ...function body removed for unused var...
  // };

  // const isStarting9Complete = useMemo(() => {
  //   const counts = countPositions();
  //   const meetsMin = counts.DF >= POSITION_LIMITS.DF.min && counts.MF >= POSITION_LIMITS.MF.min && counts.ATT >= POSITION_LIMITS.ATT.min;
  //   const totalOutfield = counts.DF + counts.MF + counts.ATT;
  //   return counts.GK === 1 && totalOutfield === 8 && meetsMin;
  // }, [starting9]);

  // Show prompt if transfers not completed
  if (!isSquadComplete) {
    return (
      <div className="pick-team-container">
        <div className="pick-team-header">
          <button className="back-link" onClick={onBack}>
            <ArrowLeft size={18} />
            <span>Back</span>
          </button>
          <h2>Pick Your Starting 9</h2>
        </div>
        <div className="transfers-prompt">
          <div className="prompt-icon">⚠️</div>
          <h3>Complete Your Transfers First</h3>
          <p>You need to select 13 players (2 GK, 4 DF, 4 MF, 3 ATT) before you can pick your starting lineup.</p>
          <button className="fantasy-btn fantasy-btn-primary" onClick={onBack}>
            Go to Transfers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pick-team-container">
      <div className="pick-team-header">
        <div>
          <button className="back-link" onClick={onBack}>
            <ArrowLeft size={18} />
            <span>Back</span>
          </button>
          <h2>Pick Team</h2>
        </div>
        <p className="gameweek-info">Gameweek {currentGameweek} • Deadline: Tue 30 Dec, 18:00</p>
      </div>

      {/* Chips Section */}
      <div className="chips-section">
        {Object.entries(CHIPS).map(([chipId, chip]) => {
          const status = getChipStatus(chipId);
          const isDisabled = !canActivateChip(chipId);
          return (
            <button
              key={chipId}
              className={`chip-card chip-${chipId.toLowerCase()} status-${status} ${isDisabled ? 'disabled' : ''}`}
              onClick={() => !isDisabled && setSelectedChipDetails({ chipId, chip })}
              disabled={isDisabled}
            >
              <div className="chip-icon">
                {chipId === 'WC' && <Zap size={20} strokeWidth={2.5} />}
                {chipId === 'BB' && <BarChart3 size={20} strokeWidth={2.5} />}
                {chipId === 'TC' && <Crown size={20} strokeWidth={2.5} />}
                {chipId === 'FH' && <Target size={20} strokeWidth={2.5} />}
                {chipId === 'DC' && <Star size={20} strokeWidth={2.5} />}
              </div>
              <div className="chip-name">{chip.name}</div>
              <div className={`chip-status status-${status}`}>
                {status === 'active' && 'Active'}
                {status === 'played' && `Played GW${usedChips[chipId]}`}
                {status === 'available' && 'Available'}
              </div>
            </button>
          );
        })}
      </div>

      <div className="formation-pitch">
        {/* GK */}
        <div className="formation-row gk-row">
          <div 
            className="player-slot" 
            onClick={() => openPlayerModal(starting9.GK, true, 'GK', 0)}
          >
            {starting9.GK ? (
              <>
                {renderRoleBadge(starting9.GK)}
                <JerseyIcon size={28} {...kitColors(getTeamCode(starting9.GK), starting9.GK.position)} />
                <div className="player-info">
                  <div className="player-name">{starting9.GK.name}</div>
                  {getOpponentShort(starting9.GK) && (
                    <div className="player-opponent">vs {getOpponentShort(starting9.GK)}</div>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-slot">+ GK</div>
            )}
          </div>
        </div>

        {/* DF - defenders */}
        <div className="formation-row df-row">
          {starting9.DF.filter(Boolean).map((p, idx) => {
            const actualIndex = starting9.DF.indexOf(p);
            return (
              <div 
                key={`df-${actualIndex}`} 
                className="player-slot" 
                onClick={() => openPlayerModal(p, true, 'DF', actualIndex)}
              >
                {renderRoleBadge(p)}
                <JerseyIcon size={28} {...kitColors(getTeamCode(p), p.position)} />
                <div className="player-info">
                  <div className="player-name">{p.name}</div>
                  {getOpponentShort(p) && (
                    <div className="player-opponent">vs {getOpponentShort(p)}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* MF - midfielders */}
        <div className="formation-row mf-row">
          {starting9.MF.filter(Boolean).map((p, idx) => {
            const actualIndex = starting9.MF.indexOf(p);
            return (
              <div 
                key={`mf-${actualIndex}`} 
                className="player-slot" 
                onClick={() => openPlayerModal(p, true, 'MF', actualIndex)}
              >
                {renderRoleBadge(p)}
                <JerseyIcon size={28} {...kitColors(getTeamCode(p), p.position)} />
                <div className="player-info">
                  <div className="player-name">{p.name}</div>
                  {getOpponentShort(p) && (
                    <div className="player-opponent">vs {getOpponentShort(p)}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ATT - attackers */}
        <div className="formation-row att-row">
          {starting9.ATT.filter(Boolean).map((p, idx) => {
            const actualIndex = starting9.ATT.indexOf(p);
            return (
              <div 
                key={`att-${actualIndex}`} 
                className="player-slot" 
                onClick={() => openPlayerModal(p, true, 'ATT', actualIndex)}
              >
                {renderRoleBadge(p)}
                <JerseyIcon size={28} {...kitColors(getTeamCode(p), p.position)} />
                <div className="player-info">
                  <div className="player-name">{p.name}</div>
                  {getOpponentShort(p) && (
                    <div className="player-opponent">vs {getOpponentShort(p)}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bench-section">
        <h3>Bench</h3>
        <div className="bench-players">
          {bench.map((p, idx) => (
            <div 
              key={`bench-${idx}`} 
              className="bench-player" 
              onClick={() => openPlayerModal(p, false)}
            >
              {renderRoleBadge(p)}
              <JerseyIcon size={32} {...kitColors(getTeamCode(p), p.position)} />
              <div className="bench-player-info">
                <div className="bench-name">{p.name}</div>
                <div className="bench-pos">{p.position}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedPlayer && (
        <PlayerDetailModal
          player={selectedPlayer}
          isStarting={selectedPlayerIsStarting}
          slot={selectedSlot}
          onClose={() => setSelectedPlayer(null)}
          getTeamCode={getTeamCode}
          kitColors={kitColors}
          captainId={captain}
          viceCaptainId={viceCaptain}
          onConfirmRoles={({ captainId, viceCaptainId }) => {
            setCaptain(captainId);
            setViceCaptain(viceCaptainId);
          }}
          substitutes={bench}
          onSelectSubstitute={(sub) => {
            if (!selectedPlayerIsStarting || !selectedSlot) {
              setSelectedPlayer(null);
              return;
            }
            // Swap selected starting player with chosen substitute
            const { pos, index } = selectedSlot;
            setSquad(prevSquad => {
              // Swap selectedPlayer (starting) with sub (bench)
              const newSquad = { ...prevSquad };
              // Remove sub from its current position in squad
              // Find and remove the substitute from the squad (first occurrence)
              let benchPos = null, benchIdx = null;
              for (const k of Object.keys(newSquad)) {
                for (let i = 0; i < newSquad[k].length; i++) {
                  const p = newSquad[k][i];
                  if (p && (p._id === sub._id || p.id === sub.id)) {
                    benchPos = k;
                    benchIdx = i;
                    break;
                  }
                }
                if (benchPos) break;
              }
              if (benchPos !== null && benchIdx !== null) {
                newSquad[benchPos][benchIdx] = null;
              }
              // Place sub in starting slot
              newSquad[pos] = [...newSquad[pos]];
              const prevStarter = newSquad[pos][index];
              newSquad[pos][index] = sub;
              // Add previous starter to bench (first available null slot), only if not already present
              let alreadyInBench = false;
              for (const k of Object.keys(newSquad)) {
                for (let i = 0; i < newSquad[k].length; i++) {
                  const p = newSquad[k][i];
                  if (p && prevStarter && (p._id === prevStarter._id || p.id === prevStarter.id)) {
                    alreadyInBench = true;
                  }
                }
              }
              if (prevStarter && !alreadyInBench) {
                let added = false;
                for (const k of Object.keys(newSquad)) {
                  for (let i = 0; i < newSquad[k].length; i++) {
                    if (!newSquad[k][i] && !added && k !== pos) {
                      newSquad[k][i] = prevStarter;
                      added = true;
                    }
                  }
                }
              }
              // Ensure squad completeness after swap
              const limits = { GK: 2, DF: 4, MF: 4, ATT: 3 };
              for (const k of Object.keys(limits)) {
                while (newSquad[k].length < limits[k]) {
                  newSquad[k].push(null);
                }
                if (newSquad[k].length > limits[k]) {
                  newSquad[k] = newSquad[k].slice(0, limits[k]);
                }
              }
              return newSquad;
            });
            // Also update starting9
            // (If you want to persist the new starting9, you may want to update localStorage as well)
            setSelectedPlayer(null);
          }}
        />
      )}

      {selectedChipDetails && (
        <ChipDetailsModal
          chipId={selectedChipDetails.chipId}
          chip={selectedChipDetails.chip}
          onClose={() => setSelectedChipDetails(null)}
          onPlayChip={() => {
            toggleChip(selectedChipDetails.chipId);
            setSelectedChipDetails(null);
          }}
          isDisabled={!canActivateChip(selectedChipDetails.chipId)}
          isActive={activeChip === selectedChipDetails.chipId}
        />
      )}
    </div>
  );
}
