import React, { useEffect, useState } from 'react';
import api from '../utils/api';

export default function GoalScorerSelector({ match, homeScore, awayScore, onGoalscorerData }) {
  const [homePlayers, setHomePlayers] = useState([]);
  const [awayPlayers, setAwayPlayers] = useState([]);
  const [goalscorers, setGoalscorers] = useState({ home: [], away: [] });
  const [cards, setCards] = useState({ home: [], away: [] });
  const [cleanSheets, setCleanSheets] = useState({
    home: { enabled: false, playerId: '' },
    away: { enabled: false, playerId: '' }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch players for both teams
  useEffect(() => {
    const fetchPlayers = async () => {
      setLoading(true);
      try {
        const [homeRes, awayRes] = await Promise.all([
          api.get(`/players`, { params: { teamId: match.homeTeam._id || match.homeTeam } }),
          api.get(`/players`, { params: { teamId: match.awayTeam._id || match.awayTeam } }),
        ]);
        setHomePlayers(homeRes.data || []);
        setAwayPlayers(awayRes.data || []);
      } catch (e) {
        setError(e.response?.data?.message || e.message);
      }
      setLoading(false);
    };
    
    if (match) fetchPlayers();
  }, [match]);

  // Initialize goalscorers array when score changes
  useEffect(() => {
    const hScore = parseInt(homeScore) || 0;
    const aScore = parseInt(awayScore) || 0;

    setGoalscorers({
      home: Array(hScore).fill(null).map(() => ({
        scorerId: '',
        isOwnGoal: false,
        assistId: '',
      })),
      away: Array(aScore).fill(null).map(() => ({
        scorerId: '',
        isOwnGoal: false,
        assistId: '',
      }))
    });

    // Reset cards and clean sheets when scores change (keeps data in sync with a new edit)
    setCards({ home: [], away: [] });
    setCleanSheets({ home: { enabled: false, playerId: '' }, away: { enabled: false, playerId: '' } });
  }, [homeScore, awayScore, match]);

  // Notify parent when goalscorers change
  useEffect(() => {
    if (onGoalscorerData) {
      onGoalscorerData({ goals: goalscorers, cards, cleanSheets });
    }
  }, [goalscorers, cards, cleanSheets, onGoalscorerData]);

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
    <div style={{ 
      backgroundColor: '#f8f9fa', 
      padding: '12px', 
      borderRadius: '6px', 
      marginTop: '10px',
      border: '2px solid #dee2e6'
    }}>
      <h4 style={{ marginTop: 0, marginBottom: '12px' }}>Select Goalscorers & Events</h4>
      
      {error && <div style={{ color: '#dc3545', marginBottom: '10px' }}>Error: {error}</div>}
      {loading && <div style={{ color: '#0066cc', marginBottom: '10px' }}>Loading players...</div>}

      {hScore > 0 && (
        <div style={{ marginBottom: '15px' }}>
          <h5 style={{ marginBottom: '8px' }}>{match.homeTeam.name} Goals ({hScore})</h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {goalscorers.home.map((goal, idx) => (
              <div key={`home-${idx}`} style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: '6px',
                padding: '10px',
                backgroundColor: '#ffffff',
                borderRadius: '4px',
                border: '1px solid #dee2e6'
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ minWidth: '60px', fontWeight: 500 }}>Goal #{idx + 1}:</span>
                  
                  {goal.isOwnGoal ? (
                    <>
                      <select
                        value={goal.scorerId}
                        onChange={(e) => updateGoalscorer('home', idx, e.target.value, true)}
                        className="input"
                        style={{ flex: 1 }}
                      >
                        <option value="">Select own goal scorer ({match.awayTeam.name})...</option>
                        {getOwnGoalTeamPlayers('home').map(p => (
                          <option key={p._id} value={p._id}>
                            {p.number ? `${p.number} - ` : ''}{p.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => updateGoalscorer('home', idx, goal.scorerId, false)}
                        className="btn btn-secondary btn-small"
                        title="Switch to normal goal"
                      >
                        Not OG
                      </button>
                    </>
                  ) : (
                    <>
                      <select
                        value={goal.scorerId}
                        onChange={(e) => updateGoalscorer('home', idx, e.target.value, false)}
                        className="input"
                        style={{ flex: 1 }}
                      >
                        <option value="">Select scorer ({match.homeTeam.name})...</option>
                        {getPlayersByTeam('home').map(p => (
                          <option key={p._id} value={p._id}>
                            {p.number ? `${p.number} - ` : ''}{p.name}
                          </option>
                        ))}
                      </select>
                      <button
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
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingLeft: '68px' }}>
                    <span style={{ minWidth: '50px', fontSize: '0.9em', color: '#666' }}>Assist:</span>
                    <select
                      value={goal.assistId}
                      onChange={(e) => updateAssist('home', idx, e.target.value)}
                      className="input"
                      style={{ flex: 1, fontSize: '0.9em' }}
                    >
                      <option value="">No assist / Unassisted</option>
                      {getPlayersByTeam('home')
                        .filter(p => p._id !== goal.scorerId) // Can't assist own goal
                        .map(p => (
                          <option key={p._id} value={p._id}>
                            {p.number ? `${p.number} - ` : ''}{p.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {aScore > 0 && (
        <div style={{ marginBottom: '15px' }}>
          <h5 style={{ marginBottom: '8px' }}>{match.awayTeam.name} Goals ({aScore})</h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {goalscorers.away.map((goal, idx) => (
              <div key={`away-${idx}`} style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: '6px',
                padding: '10px',
                backgroundColor: '#ffffff',
                borderRadius: '4px',
                border: '1px solid #dee2e6'
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ minWidth: '60px', fontWeight: 500 }}>Goal #{idx + 1}:</span>
                  
                  {goal.isOwnGoal ? (
                    <>
                      <select
                        value={goal.scorerId}
                        onChange={(e) => updateGoalscorer('away', idx, e.target.value, true)}
                        className="input"
                        style={{ flex: 1 }}
                      >
                        <option value="">Select own goal scorer ({match.homeTeam.name})...</option>
                        {getOwnGoalTeamPlayers('away').map(p => (
                          <option key={p._id} value={p._id}>
                            {p.number ? `${p.number} - ` : ''}{p.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => updateGoalscorer('away', idx, goal.scorerId, false)}
                        className="btn btn-secondary btn-small"
                        title="Switch to normal goal"
                      >
                        Not OG
                      </button>
                    </>
                  ) : (
                    <>
                      <select
                        value={goal.scorerId}
                        onChange={(e) => updateGoalscorer('away', idx, e.target.value, false)}
                        className="input"
                        style={{ flex: 1 }}
                      >
                        <option value="">Select scorer ({match.awayTeam.name})...</option>
                        {getPlayersByTeam('away').map(p => (
                          <option key={p._id} value={p._id}>
                            {p.number ? `${p.number} - ` : ''}{p.name}
                          </option>
                        ))}
                      </select>
                      <button
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
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingLeft: '68px' }}>
                    <span style={{ minWidth: '50px', fontSize: '0.9em', color: '#666' }}>Assist:</span>
                    <select
                      value={goal.assistId}
                      onChange={(e) => updateAssist('away', idx, e.target.value)}
                      className="input"
                      style={{ flex: 1, fontSize: '0.9em' }}
                    >
                      <option value="">No assist / Unassisted</option>
                      {getPlayersByTeam('away')
                        .filter(p => p._id !== goal.scorerId) // Can't assist own goal
                        .map(p => (
                          <option key={p._id} value={p._id}>
                            {p.number ? `${p.number} - ` : ''}{p.name}
                          </option>
                        ))}
                    </select>
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
      <div style={{ marginTop: '16px', paddingTop: '10px', borderTop: '1px solid #dee2e6' }}>
        <h4 style={{ marginBottom: '10px' }}>Cards</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {[{ side: 'home', label: match.homeTeam.name }, { side: 'away', label: match.awayTeam.name }].map(({ side, label }) => (
            <div key={side} style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 6, padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong>{label}</strong>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-warning btn-small" onClick={() => addCard(side, 'YELLOW_CARD')}>+ Yellow</button>
                  <button className="btn btn-danger btn-small" onClick={() => addCard(side, 'RED_CARD')}>+ Red</button>
                </div>
              </div>
              {(cards[side] || []).length === 0 && (
                <div style={{ color: '#666', fontSize: '0.9em' }}>No cards added</div>
              )}
              {(cards[side] || []).map((card, idx) => (
                <div key={`${side}-card-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                  <select
                    className="input"
                    value={card.playerId}
                    onChange={(e) => updateCard(side, idx, { playerId: e.target.value })}
                  >
                    <option value="">Select player</option>
                    {getPlayersByTeam(side).map(p => (
                      <option key={p._id} value={p._id}>{p.number ? `${p.number} - ` : ''}{p.name}</option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8em', color: card.type === 'YELLOW_CARD' ? '#b8860b' : '#c1121f' }}>{card.type === 'YELLOW_CARD' ? 'Yellow' : 'Red'}</span>
                    <button className="btn btn-secondary btn-small" style={{ minWidth: '60px' }} onClick={() => removeCard(side, idx)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Clean sheets */}
      <div style={{ marginTop: '16px', paddingTop: '10px', borderTop: '1px solid #dee2e6' }}>
        <h4 style={{ marginBottom: '10px' }}>Clean Sheets</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {[{ side: 'home', label: match.homeTeam.name, allowed: homeCleanSheetAllowed }, { side: 'away', label: match.awayTeam.name, allowed: awayCleanSheetAllowed }].map(({ side, label, allowed }) => (
            <div key={side} style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 6, padding: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={cleanSheets[side].enabled && allowed}
                  disabled={!allowed}
                  onChange={(e) => toggleCleanSheet(side, e.target.checked && allowed)}
                />
                <span><strong>{label}</strong> clean sheet</span>
                {!allowed && <span style={{ color: '#666', fontSize: '0.85em' }}>(opponent scored)</span>}
              </div>
              {cleanSheets[side].enabled && allowed && (
                <div style={{ marginTop: 8 }}>
                  <select
                    className="input"
                    value={cleanSheets[side].playerId}
                    onChange={(e) => updateCleanSheetPlayer(side, e.target.value)}
                  >
                    <option value="">Select player for clean sheet</option>
                    {getPlayersByTeam(side).map(p => (
                      <option key={p._id} value={p._id}>{p.number ? `${p.number} - ` : ''}{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
