import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../utils/api';
import {
  emptyGoalsForScores,
  matchEventsToGoalscorerForm,
  resizeGoalsToScores,
} from '../utils/matchEventsForm';

function playerDisplayLabel(p) {
  if (!p) return '';
  const n = p.number;
  if (n != null && n !== '') return `${n} - ${p.name || ''}`;
  return String(p.name || '');
}

function sortPlayersByName(players) {
  return [...players].sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
  );
}

function PlayerSelect({ players, value, onChange, selectPlaceholder = 'Select player…', disabled, style, selectClassName }) {
  const sorted = useMemo(() => sortPlayersByName(players), [players]);
  return (
    <select
      className={selectClassName || 'input'}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{ flex: 1, minWidth: 0, width: '100%', ...style }}
    >
      <option value="">{selectPlaceholder}</option>
      {sorted.map((p) => (
        <option key={p._id} value={p._id}>
          {playerDisplayLabel(p)}
        </option>
      ))}
    </select>
  );
}

const defaultCleanSheets = () => ({
  home: { enabled: false, playerId: '' },
  away: { enabled: false, playerId: '' },
});

export default function GoalScorerSelector({ match, homeScore, awayScore, onGoalscorerData }) {
  const [homePlayers, setHomePlayers] = useState([]);
  const [awayPlayers, setAwayPlayers] = useState([]);
  const [goalscorers, setGoalscorers] = useState({ home: [], away: [] });
  const [cards, setCards] = useState({ home: [], away: [] });
  const [cleanSheets, setCleanSheets] = useState(defaultCleanSheets());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onGoalscorerDataRef = useRef(onGoalscorerData);
  onGoalscorerDataRef.current = onGoalscorerData;

  const homeTeamId = match?.homeTeam?._id || match?.homeTeam;
  const awayTeamId = match?.awayTeam?._id || match?.awayTeam;

  // Fetch players when fixture identity changes (not whole match object identity)
  useEffect(() => {
    const fetchPlayers = async () => {
      setLoading(true);
      try {
        const [homeRes, awayRes] = await Promise.all([
          api.get(`/players`, { params: { teamId: homeTeamId } }),
          api.get(`/players`, { params: { teamId: awayTeamId } }),
        ]);
        setHomePlayers(homeRes.data || []);
        setAwayPlayers(awayRes.data || []);
      } catch (e) {
        setError(e.response?.data?.message || e.message);
      }
      setLoading(false);
    };

    if (homeTeamId && awayTeamId) fetchPlayers();
  }, [homeTeamId, awayTeamId]);

  // Stable key for server-persisted events only (editing scores does not rewrite this)
  const serverEventsKey = useMemo(() => {
    if (!match?.events?.length) return `${match?._id || 'm'}:noevents`;
    return (
      (match._id || '') +
      ':' +
      match.events
        .map((e) => {
          const p = e.player?._id || e.player;
          const a = e.assistPlayer?._id || e.assistPlayer;
          return `${e.type}|${e.side}|${p}|${a}|${!!e.ownGoal}|${e.minute ?? ''}`;
        })
        .join(';')
    );
  }, [match._id, match.events]);

  const prevMatchIdRef = useRef(null);

  // New match row → reset rows; same match → resize goal slots when scores change (preserve picks)
  useEffect(() => {
    if (!match?._id) return;
    const hScore = parseInt(homeScore, 10) || 0;
    const aScore = parseInt(awayScore, 10) || 0;
    if (prevMatchIdRef.current !== match._id) {
      prevMatchIdRef.current = match._id;
      setGoalscorers(emptyGoalsForScores(hScore, aScore));
      setCards({ home: [], away: [] });
      setCleanSheets(defaultCleanSheets());
      return;
    }
    setGoalscorers((prev) => resizeGoalsToScores(prev, hScore, aScore));
  }, [match._id, homeScore, awayScore]);

  // When the server copy of events changes (load, save, refetch), hydrate the form from DB
  useEffect(() => {
    if (!match?.events?.length) return;
    const hScore = parseInt(homeScore, 10) || 0;
    const aScore = parseInt(awayScore, 10) || 0;
    const { goals, cards: c, cleanSheets: cs } = matchEventsToGoalscorerForm(match.events);
    setGoalscorers(resizeGoalsToScores(goals, hScore, aScore));
    setCards(c);
    setCleanSheets(cs);
  }, [serverEventsKey, homeScore, awayScore, match.events]);

  // Notify parent when local form state changes (callback ref avoids loops from unstable identity)
  useEffect(() => {
    if (onGoalscorerDataRef.current) {
      onGoalscorerDataRef.current({ goals: goalscorers, cards, cleanSheets });
    }
  }, [goalscorers, cards, cleanSheets]);

  const updateGoalscorer = (side, index, scorerId, isOwnGoal = false) => {
    setGoalscorers(prev => {
      const updated = { ...prev };
      updated[side][index] = {
        scorerId,
        isOwnGoal,
        assistId: isOwnGoal ? '' : (updated[side][index]?.assistId || ''), // Clear assist if own goal
      };
      return updated;
    });
  };

  const updateAssist = (side, index, assistId) => {
    setGoalscorers(prev => {
      const updated = { ...prev };
      updated[side][index] = {
        ...updated[side][index],
        assistId
      };
      return updated;
    });
  };

  const getPlayersByTeam = (side) => {
    return side === 'home' ? homePlayers : awayPlayers;
  };

  const getOwnGoalTeamPlayers = (side) => {
    return side === 'home' ? awayPlayers : homePlayers;
  };

  const hScore = parseInt(homeScore) || 0;
  const aScore = parseInt(awayScore) || 0;
  const homeGoalsParsed = Number.isFinite(parseInt(homeScore)) ? parseInt(homeScore) : null;
  const awayGoalsParsed = Number.isFinite(parseInt(awayScore)) ? parseInt(awayScore) : null;

  // Check if all goalscorers are filled
  const allGoalscorersSet = 
    goalscorers.home.every(g => g.scorerId !== '') &&
    goalscorers.away.every(g => g.scorerId !== '');

  const addCard = (side, type) => {
    setCards(prev => ({
      ...prev,
      [side]: [...(prev[side] || []), { playerId: '', minute: '', type }]
    }));
  };

  const updateCard = (side, idx, patch) => {
    setCards(prev => ({
      ...prev,
      [side]: prev[side].map((card, i) => i === idx ? { ...card, ...patch } : card)
    }));
  };

  const removeCard = (side, idx) => {
    setCards(prev => ({
      ...prev,
      [side]: prev[side].filter((_, i) => i !== idx)
    }));
  };

  const toggleCleanSheet = (side, enabled) => {
    setCleanSheets(prev => ({
      ...prev,
      [side]: { enabled, playerId: enabled ? prev[side].playerId : '' }
    }));
  };

  const updateCleanSheetPlayer = (side, playerId) => {
    setCleanSheets(prev => ({
      ...prev,
      [side]: { ...prev[side], playerId }
    }));
  };

  const homeCleanSheetAllowed = awayGoalsParsed !== null && awayGoalsParsed === 0;
  const awayCleanSheetAllowed = homeGoalsParsed !== null && homeGoalsParsed === 0;

  return (
    <div
      className="goalscorer-admin-root"
      style={{
      backgroundColor: '#f8f9fa', 
      padding: '12px', 
      borderRadius: '6px', 
      marginTop: '10px',
      border: '2px solid #dee2e6'
    }}
    >
      <h4 style={{ marginTop: 0, marginBottom: '12px' }}>Select Goalscorers & Events</h4>
      
      {error && <div style={{ color: '#dc3545', marginBottom: '10px' }}>Error: {error}</div>}
      {loading && <div style={{ color: '#0066cc', marginBottom: '10px' }}>Loading players...</div>}

      {hScore > 0 && (
        <div className="goalscorer-side-block" style={{ marginBottom: '15px' }}>
          <h5 style={{ marginBottom: '8px' }}>{match.homeTeam.name} Goals ({hScore})</h5>
          <div className="goalscorer-goals-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {goalscorers.home.map((goal, idx) => (
              <div key={`home-${idx}`} className="goalscorer-goal-block" style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: '6px',
                padding: '10px',
                backgroundColor: '#ffffff',
                borderRadius: '4px',
                border: '1px solid #dee2e6'
              }}>
                <div className="goalscorer-goal-line" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <span className="goalscorer-goal-label">Goal #{idx + 1}:</span>
                  
                  {goal.isOwnGoal ? (
                    <>
                      <PlayerSelect
                        players={getOwnGoalTeamPlayers('home')}
                        value={goal.scorerId}
                        onChange={(id) => updateGoalscorer('home', idx, id, true)}
                        selectPlaceholder={`Select own goal — ${match.awayTeam.name}`}
                        selectClassName="input"
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <button
                        type="button"
                        onClick={() => updateGoalscorer('home', idx, goal.scorerId, false)}
                        className="btn btn-secondary btn-small"
                        title="Switch to normal goal"
                      >
                        Not OG
                      </button>
                    </>
                  ) : (
                    <>
                      <PlayerSelect
                        players={getPlayersByTeam('home')}
                        value={goal.scorerId}
                        onChange={(id) => updateGoalscorer('home', idx, id, false)}
                        selectPlaceholder={`Select scorer — ${match.homeTeam.name}`}
                        selectClassName="input"
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <button
                        type="button"
                        onClick={() => updateGoalscorer('home', idx, goal.scorerId, true)}
                        className="btn btn-info btn-small"
                        title="Mark as own goal"
                      >
                        OG
                      </button>
                    </>
                  )}
                </div>
                
                {/* Assist selector - only for non-own goals */}
                {!goal.isOwnGoal && goal.scorerId && (
                  <div className="goalscorer-assist-row" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    <span className="goalscorer-assist-label">Assist:</span>
                    <PlayerSelect
                      players={getPlayersByTeam('home').filter((p) => p._id !== goal.scorerId)}
                      value={goal.assistId || ''}
                      onChange={(id) => updateAssist('home', idx, id)}
                      selectPlaceholder="No assist / unassisted — or choose player"
                      selectClassName="input"
                      style={{ flex: 1, minWidth: 0 }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {aScore > 0 && (
        <div className="goalscorer-side-block" style={{ marginBottom: '15px' }}>
          <h5 style={{ marginBottom: '8px' }}>{match.awayTeam.name} Goals ({aScore})</h5>
          <div className="goalscorer-goals-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {goalscorers.away.map((goal, idx) => (
              <div key={`away-${idx}`} className="goalscorer-goal-block" style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: '6px',
                padding: '10px',
                backgroundColor: '#ffffff',
                borderRadius: '4px',
                border: '1px solid #dee2e6'
              }}>
                <div className="goalscorer-goal-line" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <span className="goalscorer-goal-label">Goal #{idx + 1}:</span>
                  
                  {goal.isOwnGoal ? (
                    <>
                      <PlayerSelect
                        players={getOwnGoalTeamPlayers('away')}
                        value={goal.scorerId}
                        onChange={(id) => updateGoalscorer('away', idx, id, true)}
                        selectPlaceholder={`Select own goal — ${match.homeTeam.name}`}
                        selectClassName="input"
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <button
                        type="button"
                        onClick={() => updateGoalscorer('away', idx, goal.scorerId, false)}
                        className="btn btn-secondary btn-small"
                        title="Switch to normal goal"
                      >
                        Not OG
                      </button>
                    </>
                  ) : (
                    <>
                      <PlayerSelect
                        players={getPlayersByTeam('away')}
                        value={goal.scorerId}
                        onChange={(id) => updateGoalscorer('away', idx, id, false)}
                        selectPlaceholder={`Select scorer — ${match.awayTeam.name}`}
                        selectClassName="input"
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <button
                        type="button"
                        onClick={() => updateGoalscorer('away', idx, goal.scorerId, true)}
                        className="btn btn-info btn-small"
                        title="Mark as own goal"
                      >
                        OG
                      </button>
                    </>
                  )}
                </div>
                
                {/* Assist selector - only for non-own goals */}
                {!goal.isOwnGoal && goal.scorerId && (
                  <div className="goalscorer-assist-row" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    <span className="goalscorer-assist-label">Assist:</span>
                    <PlayerSelect
                      players={getPlayersByTeam('away').filter((p) => p._id !== goal.scorerId)}
                      value={goal.assistId || ''}
                      onChange={(id) => updateAssist('away', idx, id)}
                      selectPlaceholder="No assist / unassisted — or choose player"
                      selectClassName="input"
                      style={{ flex: 1, minWidth: 0 }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!allGoalscorersSet && (hScore + aScore > 0) && (
        <div style={{ 
          padding: '8px', 
          backgroundColor: '#fff3cd', 
          border: '1px solid #ffc107', 
          borderRadius: '4px',
          color: '#856404',
          fontSize: '0.9em',
          marginTop: '10px'
        }}>
          ⚠️ Please select a goalscorer for each goal before saving
        </div>
      )}

      {/* Cards */}
      <div className="goalscorer-panel-section goalscorer-cards-section" style={{ marginTop: '16px', paddingTop: '10px', borderTop: '1px solid #dee2e6' }}>
        <h4 className="goalscorer-cards-heading" style={{ marginBottom: '10px' }}>Cards</h4>
        <div className="goalscorer-cards-grid">
          {[{ side: 'home', label: match.homeTeam.name }, { side: 'away', label: match.awayTeam.name }].map(({ side, label }) => (
            <div key={side} className="goalscorer-team-panel" style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 6, padding: 10 }}>
              <div className="goalscorer-cards-panel-header">
                <strong className="goalscorer-cards-team-name">{label}</strong>
                <div className="goalscorer-card-actions">
                  <button type="button" className="btn btn-warning btn-small goalscorer-card-add-btn" title="Add yellow card" onClick={() => addCard(side, 'YELLOW_CARD')}>+ Y</button>
                  <button type="button" className="btn btn-danger btn-small goalscorer-card-add-btn" title="Add red card" onClick={() => addCard(side, 'RED_CARD')}>+ R</button>
                </div>
              </div>
              {(cards[side] || []).length === 0 && (
                <div className="goalscorer-cards-empty">No cards added</div>
              )}
              {(cards[side] || []).map((card, idx) => (
                <div key={`${side}-card-${idx}`} className="goalscorer-card-line" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <PlayerSelect
                    players={getPlayersByTeam(side)}
                    value={card.playerId}
                    onChange={(id) => updateCard(side, idx, { playerId: id })}
                    selectPlaceholder="Select player"
                    selectClassName="input goalscorer-card-player-select"
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <div className="goalscorer-card-meta">
                    <span className={`goalscorer-card-type-label ${card.type === 'YELLOW_CARD' ? 'is-yellow' : 'is-red'}`}>{card.type === 'YELLOW_CARD' ? 'Yellow' : 'Red'}</span>
                    <button type="button" className="btn btn-secondary btn-small goalscorer-card-remove-btn" onClick={() => removeCard(side, idx)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Clean sheets */}
      <div className="goalscorer-panel-section goalscorer-clean-section" style={{ marginTop: '16px', paddingTop: '10px', borderTop: '1px solid #dee2e6' }}>
        <h4 className="goalscorer-clean-heading" style={{ marginBottom: '10px' }}>Clean Sheets</h4>
        <div className="goalscorer-clean-grid">
          {[{ side: 'home', label: match.homeTeam.name, allowed: homeCleanSheetAllowed }, { side: 'away', label: match.awayTeam.name, allowed: awayCleanSheetAllowed }].map(({ side, label, allowed }) => (
            <div key={side} className="goalscorer-team-panel goalscorer-clean-panel" style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 6, padding: 10 }}>
              <label className={`goalscorer-clean-label ${!allowed ? 'is-disabled' : ''}`}>
                <input
                  type="checkbox"
                  className="goalscorer-clean-checkbox"
                  checked={cleanSheets[side].enabled && allowed}
                  disabled={!allowed}
                  onChange={(e) => toggleCleanSheet(side, e.target.checked && allowed)}
                />
                <span className="goalscorer-clean-text">
                  <span className="goalscorer-clean-team"><strong>{label}</strong></span>
                  <span className="goalscorer-clean-sub">Clean sheet</span>
                  {!allowed && (
                    <span className="goalscorer-clean-hint">Unavailable — opponent scored.</span>
                  )}
                </span>
              </label>
              {cleanSheets[side].enabled && allowed && (
                <div className="goalscorer-clean-player-wrap" style={{ marginTop: 8 }}>
                  <PlayerSelect
                    players={getPlayersByTeam(side)}
                    value={cleanSheets[side].playerId}
                    onChange={(id) => updateCleanSheetPlayer(side, id)}
                    selectPlaceholder="Select player for clean sheet"
                    selectClassName="input goalscorer-clean-player-select"
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
