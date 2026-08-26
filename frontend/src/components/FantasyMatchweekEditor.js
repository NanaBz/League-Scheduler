import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../utils/api';
import ValidationModal from './ValidationModal';
import './FantasyMatchweekEditor.css';

const STEPS = [
  { id: 1, key: 'matchweek', label: 'Matchweek' },
  { id: 2, key: 'match', label: 'Match' },
  { id: 3, key: 'performance', label: 'Performance' },
  { id: 4, key: 'review', label: 'Review' },
];

const EMPTY_BONUS = { bp3: null, bp2: null, bp1: null };
const EMPTY_SPECIAL = { playerId: '', points: 0, reason: '' };

function performanceMapFromMatchPlayers(matchPlayers) {
  const map = {};
  (matchPlayers?.performances || []).forEach((row) => {
    const id = row.player?._id || row.player;
    if (id) map[String(id)] = row;
  });
  return map;
}

const GOAL_POINTS_BY_POSITION = { GK: 10, DF: 6, MF: 5, ATT: 4 };

function goalPointsForGoals(goals, position) {
  const rate = GOAL_POINTS_BY_POSITION[String(position || '').toUpperCase()] ?? 4;
  return (goals || 0) * rate;
}

function formatEventStatsLabel(perf, position) {
  if (!perf) return '';
  const pos = position || perf.player?.position;
  const parts = [];
  if (perf.goals) parts.push(`${perf.goals}G (+${goalPointsForGoals(perf.goals, pos)})`);
  if (perf.assists) parts.push(`${perf.assists}A (+${perf.assists * 3})`);
  if (perf.cleansheetPoints) parts.push(`CS +${perf.cleansheetPoints}`);
  if (perf.ownGoals) parts.push(`${perf.ownGoals}OG (-${perf.ownGoals * 2})`);
  if (perf.yellowCards) parts.push(`${perf.yellowCards}YC (-${perf.yellowCards})`);
  if (perf.redCards) parts.push(`${perf.redCards}RC (-${perf.redCards * 3})`);
  return parts.join(' · ');
}

function bonusFromPerformances(performances) {
  const bonus = { ...EMPTY_BONUS };
  (performances || []).forEach((row) => {
    const id = row.player?._id || row.player;
    if (!id) return;
    const pid = String(id);
    if (row.bonusPoints === 3) bonus.bp3 = pid;
    if (row.bonusPoints === 2) bonus.bp2 = pid;
    if (row.bonusPoints === 1) bonus.bp1 = pid;
  });
  return bonus;
}

function specialFromPerformances(performances) {
  const row = (performances || []).find((p) => (p.specialPoints || 0) > 0);
  if (!row) return { ...EMPTY_SPECIAL };
  const id = row.player?._id || row.player;
  return {
    playerId: id ? String(id) : '',
    points: row.specialPoints || 0,
    reason: row.specialPointsReason || '',
  };
}

function minutesFromPerformances(performances) {
  const map = {};
  (performances || []).forEach((row) => {
    const id = row.player?._id || row.player;
    if (id) map[String(id)] = defaultMinutesForPerformance(row);
  });
  return map;
}

function hasScoringEventStats(perf) {
  if (!perf) return false;
  return (
    (perf.goals || 0) > 0 ||
    (perf.assists || 0) > 0 ||
    (perf.ownGoals || 0) > 0 ||
    (perf.yellowCards || 0) > 0 ||
    (perf.redCards || 0) > 0
  );
}

function defaultMinutesForPerformance(row) {
  const played = Number(row?.minutesPlayed) || 0;
  if (played > 0) return played;
  if (hasScoringEventStats(row)) return 1;
  return 0;
}

function matchLabel(match) {
  if (!match) return '';
  return `${match.homeTeam?.name || 'Home'} vs ${match.awayTeam?.name || 'Away'}`;
}

function draftSnapshot(minutes, bonus, special) {
  return JSON.stringify({ minutes, bonus, special });
}

export default function FantasyMatchweekEditor({ matchweeks, onBackToDashboard }) {
  const [step, setStep] = useState(1);
  const [selectedMatchweek, setSelectedMatchweek] = useState(null);
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [matchPlayers, setMatchPlayers] = useState(null);
  const [playerMinutes, setPlayerMinutes] = useState({});
  const [bonusAssignments, setBonusAssignments] = useState(EMPTY_BONUS);
  const [specialPoints, setSpecialPoints] = useState(EMPTY_SPECIAL);
  const [savedMatchIds, setSavedMatchIds] = useState(() => new Set());
  const [matchDrafts, setMatchDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [pendingNav, setPendingNav] = useState(null);

  const baselineRef = useRef('');
  const historyTrapRef = useRef(false);

  const performanceByPlayer = useMemo(
    () => performanceMapFromMatchPlayers(matchPlayers),
    [matchPlayers]
  );

  const allPlayers = useMemo(() => {
    if (!matchPlayers) return [];
    return [...(matchPlayers.homePlayers || []), ...(matchPlayers.awayPlayers || [])];
  }, [matchPlayers]);

  const currentDraftKey = selectedMatch?._id ? String(selectedMatch._id) : null;

  const isDirty = useMemo(() => {
    if (step < 3 || !currentDraftKey) return false;
    return draftSnapshot(playerMinutes, bonusAssignments, specialPoints) !== baselineRef.current;
  }, [step, currentDraftKey, playerMinutes, bonusAssignments, specialPoints]);

  const persistDraft = useCallback(() => {
    if (!currentDraftKey) return;
    setMatchDrafts((prev) => ({
      ...prev,
      [currentDraftKey]: {
        playerMinutes,
        bonusAssignments,
        specialPoints,
      },
    }));
  }, [currentDraftKey, playerMinutes, bonusAssignments, specialPoints]);

  const applyDraftOrLoaded = useCallback((matchId, loadedMinutes, loadedBonus, loadedSpecial) => {
    const draft = matchDrafts[matchId];
    const minutes = draft?.playerMinutes ?? loadedMinutes;
    const bonus = draft?.bonusAssignments ?? loadedBonus;
    const special = draft?.specialPoints ?? loadedSpecial;
    setPlayerMinutes(minutes);
    setBonusAssignments(bonus);
    setSpecialPoints(special);
    baselineRef.current = draftSnapshot(minutes, bonus, special);
  }, [matchDrafts]);

  const resetEditorState = useCallback(() => {
    setStep(1);
    setSelectedMatchweek(null);
    setMatches([]);
    setSelectedMatch(null);
    setMatchPlayers(null);
    setPlayerMinutes({});
    setBonusAssignments(EMPTY_BONUS);
    setSpecialPoints(EMPTY_SPECIAL);
    setSavedMatchIds(new Set());
    setMatchDrafts({});
    setError('');
    setSuccessMessage('');
    baselineRef.current = '';
  }, []);

  const loadMatchesForWeek = async (mw) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/fantasy/admin/matchweeks/${mw.number}/matches`);
      setMatches(data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load matches');
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMatchweek = async (mw) => {
    setSelectedMatchweek(mw);
    setSelectedMatch(null);
    setMatchPlayers(null);
    setSuccessMessage('');
    setStep(2);
    await loadMatchesForWeek(mw);
  };

  const handleSelectMatch = async (match) => {
    setSelectedMatch(match);
    setStep(3);
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const { data } = await api.get(`/fantasy/admin/matches/${match._id}/players`);
      const payload = data.data;
      setMatchPlayers(payload);
      const loadedMinutes = minutesFromPerformances(payload.performances);
      const loadedBonus = bonusFromPerformances(payload.performances);
      const loadedSpecial = specialFromPerformances(payload.performances);
      applyDraftOrLoaded(String(match._id), loadedMinutes, loadedBonus, loadedSpecial);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load players');
      setStep(2);
      setSelectedMatch(null);
    } finally {
      setLoading(false);
    }
  };

  const handleMinutesChange = (playerId, value, perf) => {
    let next = value === '' ? '' : Number(value);
    if (next !== '' && hasScoringEventStats(perf) && next < 1) {
      next = 1;
    }
    setPlayerMinutes((prev) => ({ ...prev, [playerId]: next }));
    setError('');
  };

  const getPlayerBonusValue = (playerId) => {
    const id = String(playerId);
    if (bonusAssignments.bp3 === id) return '3';
    if (bonusAssignments.bp2 === id) return '2';
    if (bonusAssignments.bp1 === id) return '1';
    return '';
  };

  const handlePlayerBonusChange = (playerId, level) => {
    const id = String(playerId);
    setBonusAssignments((prev) => {
      const next = { ...prev };
      if (next.bp3 === id) next.bp3 = null;
      if (next.bp2 === id) next.bp2 = null;
      if (next.bp1 === id) next.bp1 = null;
      if (level === '3') {
      next.bp3 = id;
    } else if (level === '2') {
      next.bp2 = id;
    } else if (level === '1') {
      next.bp1 = id;
    }
    setError('');
    return next;
  });
};

  const handleSpecialChange = (field, value) => {
    setSpecialPoints((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleContinue = () => {
    if (step === 3) {
      persistDraft();
      setStep(4);
      return;
    }
  };

  const handleBack = () => {
    if (step === 4) {
      setStep(3);
      return;
    }
    if (step === 3) {
      persistDraft();
      setSelectedMatch(null);
      setMatchPlayers(null);
      setStep(2);
      return;
    }
    if (step === 2) {
      setSelectedMatchweek(null);
      setMatches([]);
      setSuccessMessage('');
      setStep(1);
    }
  };

  const requestCancel = () => {
    if (isDirty) {
      setPendingNav(() => () => {
        resetEditorState();
        onBackToDashboard();
      });
      setCancelModalOpen(true);
      return;
    }
    resetEditorState();
    onBackToDashboard();
  };

  const handleSaveMatch = async () => {
    if (!selectedMatch || !selectedMatchweek) return;
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const playerMinutesArray = Object.entries(playerMinutes).map(([playerId, minutes]) => ({
        playerId,
        minutes: Number(minutes) || 0,
      }));
      await api.post(`/fantasy/admin/matches/${selectedMatch._id}/minutes`, {
        matchweek: selectedMatchweek.number,
        playerMinutes: playerMinutesArray,
      });

      const assignments = [];
      if (bonusAssignments.bp3) assignments.push({ playerId: bonusAssignments.bp3, bonusPoints: 3 });
      if (bonusAssignments.bp2) assignments.push({ playerId: bonusAssignments.bp2, bonusPoints: 2 });
      if (bonusAssignments.bp1) assignments.push({ playerId: bonusAssignments.bp1, bonusPoints: 1 });
      await api.post(`/fantasy/admin/matches/${selectedMatch._id}/bonus`, { bonusAssignments: assignments });

      if (specialPoints.playerId && specialPoints.points) {
        await api.post(`/fantasy/admin/matches/${selectedMatch._id}/special`, {
          playerId: specialPoints.playerId,
          specialPoints: specialPoints.points,
          reason: specialPoints.reason,
        });
      }

      await api.post(`/fantasy/admin/rescore-gameweek/${selectedMatchweek.number}`);

      setSavedMatchIds((prev) => new Set([...prev, String(selectedMatch._id)]));
      setMatchDrafts((prev) => {
        const next = { ...prev };
        delete next[String(selectedMatch._id)];
        return next;
      });
      baselineRef.current = draftSnapshot(playerMinutes, bonusAssignments, specialPoints);
      setSuccessMessage(`Match data saved successfully for ${matchLabel(selectedMatch)}.`);
      setSelectedMatch(null);
      setMatchPlayers(null);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save match data. Your entries are still here — please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isDirty) {
      if (historyTrapRef.current) {
        historyTrapRef.current = false;
      }
      return undefined;
    }

    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    const onPopState = () => {
      window.history.pushState({ mwEditorGuard: true }, '');
      setPendingNav(() => () => {
        historyTrapRef.current = false;
        window.history.back();
      });
      setCancelModalOpen(true);
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('popstate', onPopState);
    if (!historyTrapRef.current) {
      window.history.pushState({ mwEditorGuard: true }, '');
      historyTrapRef.current = true;
    }

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
    };
  }, [isDirty]);

  const playerName = (id) => allPlayers.find((p) => String(p._id) === String(id))?.name || 'Unknown';

  const renderProgress = () => (
    <nav className="fme-progress" aria-label="Matchweek editor progress">
      {STEPS.map((s, idx) => {
        const isActive = step === s.id;
        const isComplete = step > s.id;
        return (
          <React.Fragment key={s.key}>
            {idx > 0 ? <span className={`fme-progress-line${isComplete || isActive ? ' active' : ''}`} aria-hidden="true" /> : null}
            <div
              className={`fme-progress-step${isActive ? ' active' : ''}${isComplete ? ' complete' : ''}`}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="fme-progress-dot" aria-hidden="true">{isComplete ? '✓' : s.id}</span>
              <span className="fme-progress-label">{s.label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </nav>
  );

  const renderContextBar = () => {
    if (step < 2 || !selectedMatchweek) return null;
    return (
      <div className="fme-context" role="status" aria-live="polite">
        <span className="fme-context-chip fme-context-chip--mw">
          <span className="fme-context-chip-label">Matchweek</span>
          <strong>{selectedMatchweek.number}</strong>
        </span>
        {selectedMatch ? (
          <span className="fme-context-chip fme-context-chip--match">
            <span className="fme-context-chip-label">Match</span>
            <strong>{matchLabel(selectedMatch)}</strong>
          </span>
        ) : null}
        <span className="fme-context-step">Step {step} of 4</span>
        {isDirty ? <span className="fme-unsaved-pill">Unsaved changes</span> : null}
      </div>
    );
  };

  const renderPlayerRows = (players, teamName) => (
    <div className="fme-team-block" key={teamName}>
      <h4 className="fme-team-title">{teamName}</h4>
      <div className="fme-player-table-wrap">
        <table className="fme-player-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Pos</th>
              <th className="fme-col-events">Events</th>
              <th>Min</th>
              <th>Bonus</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => {
              const perf = performanceByPlayer[String(player._id)];
              const eventLabel = formatEventStatsLabel(perf, player.position);
              const minMinutes = hasScoringEventStats(perf) ? 1 : 0;
              return (
                <tr key={player._id}>
                  <td className="fme-col-player" data-label="Player">{player.name}</td>
                  <td data-label="Pos">{player.position}</td>
                  <td className="fme-col-events" data-label="Events">
                    {eventLabel ? (
                      <span className="fme-events-ok" title="From match events">{eventLabel}</span>
                    ) : (
                      <span className="fme-events-none">—</span>
                    )}
                  </td>
                  <td data-label="Min">
                    <input
                      type="number"
                      className="fme-input fme-input-min"
                      min={minMinutes}
                      max="70"
                      value={playerMinutes[player._id] ?? ''}
                      onChange={(e) => handleMinutesChange(player._id, e.target.value, perf)}
                      aria-label={`Minutes for ${player.name}`}
                    />
                  </td>
                  <td data-label="Bonus">
                    <select
                      className="fme-input fme-input-bonus"
                      value={getPlayerBonusValue(player._id)}
                      onChange={(e) => handlePlayerBonusChange(player._id, e.target.value)}
                      aria-label={`Bonus for ${player.name}`}
                    >
                      <option value="">—</option>
                      <option value="3">+3</option>
                      <option value="2">+2</option>
                      <option value="1">+1</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="fme-player-cards">
        {players.map((player) => {
          const perf = performanceByPlayer[String(player._id)];
          const eventLabel = formatEventStatsLabel(perf, player.position);
          const minMinutes = hasScoringEventStats(perf) ? 1 : 0;
          return (
            <article key={player._id} className="fme-player-card">
              <div className="fme-player-card-head">
                <span className="fme-player-card-name">{player.name}</span>
                <span className="fme-player-card-pos">{player.position}</span>
              </div>
              <div className="fme-player-card-events">
                {eventLabel || 'No match events'}
              </div>
              <div className="fme-player-card-fields">
                <label className="fme-field">
                  <span>Minutes</span>
                  <input
                    type="number"
                    className="fme-input"
                    min={minMinutes}
                    max="70"
                    value={playerMinutes[player._id] ?? ''}
                    onChange={(e) => handleMinutesChange(player._id, e.target.value, perf)}
                  />
                </label>
                <label className="fme-field">
                  <span>Bonus</span>
                  <select
                    className="fme-input"
                    value={getPlayerBonusValue(player._id)}
                    onChange={(e) => handlePlayerBonusChange(player._id, e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="3">+3</option>
                    <option value="2">+2</option>
                    <option value="1">+1</option>
                  </select>
                </label>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );

  const renderStepContent = () => {
    if (step === 1) {
      return (
        <div className="fme-step">
          <h3 className="fme-step-title">Select matchweek</h3>
          <p className="fme-step-desc">Choose the gameweek you want to edit fantasy performance data for.</p>
          {matchweeks.length === 0 ? (
            <p className="fme-empty">No matchweeks with matches yet.</p>
          ) : (
            <ul className="fme-pick-list">
              {matchweeks.map((mw) => (
                <li key={mw.number}>
                  <button
                    type="button"
                    className="fme-pick-btn"
                    onClick={() => handleSelectMatchweek(mw)}
                  >
                    <span className="fme-pick-main">Matchweek {mw.number}</span>
                    <span className="fme-pick-meta">{mw.matchCount} match{mw.matchCount !== 1 ? 'es' : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }

    if (step === 2 && selectedMatchweek) {
      return (
        <div className="fme-step">
          <h3 className="fme-step-title">Matchweek {selectedMatchweek.number} — select a match</h3>
          <p className="fme-step-desc">Pick a fixture to enter minutes, bonus, and special points.</p>
          {successMessage ? <div className="fme-success" role="status">{successMessage}</div> : null}
          {loading ? (
            <p className="fme-loading">Loading matches…</p>
          ) : matches.length === 0 ? (
            <p className="fme-empty">No matches in this gameweek.</p>
          ) : (
            <ul className="fme-pick-list fme-match-list">
              {matches.map((match) => {
                const saved = savedMatchIds.has(String(match._id));
                return (
                  <li key={match._id}>
                    <button
                      type="button"
                      className={`fme-pick-btn${saved ? ' saved' : ''}`}
                      onClick={() => handleSelectMatch(match)}
                    >
                      <span className="fme-pick-main">
                        {saved ? <Check size={16} className="fme-saved-icon" aria-hidden="true" /> : null}
                        {matchLabel(match)}
                      </span>
                      <span className="fme-pick-meta">{match.isPlayed ? 'Played' : 'Pending'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      );
    }

    if (step === 3 && selectedMatch && matchPlayers) {
      return (
        <div className="fme-step">
          <h3 className="fme-step-title">Player performance</h3>
          <p className="fme-step-desc">
            Goals, assists, clean sheets, and cards are pulled from match events automatically.
            Enter minutes and bonus below. Minutes: 1–44 = +1, 45+ = +2. Players with a goal, assist, card, or own goal must have at least 1 minute.
          </p>
          {renderPlayerRows(matchPlayers.homePlayers, matchPlayers.match.homeTeam.name)}
          {renderPlayerRows(matchPlayers.awayPlayers, matchPlayers.match.awayTeam.name)}

          <div className="fme-special-block">
            <h4 className="fme-special-title">Special points (optional)</h4>
            <p className="fme-special-desc">For rare cases such as an outfield player keeping a clean sheet as GK.</p>
            <div className="fme-special-fields">
              <label className="fme-field fme-field-grow">
                <span>Player</span>
                <select
                  className="fme-input"
                  value={specialPoints.playerId}
                  onChange={(e) => handleSpecialChange('playerId', e.target.value)}
                >
                  <option value="">None</option>
                  {allPlayers.map((player) => (
                    <option key={player._id} value={player._id}>{player.name}</option>
                  ))}
                </select>
              </label>
              <label className="fme-field">
                <span>Points</span>
                <input
                  type="number"
                  className="fme-input"
                  value={specialPoints.points || ''}
                  onChange={(e) => handleSpecialChange('points', Number(e.target.value) || 0)}
                />
              </label>
              <label className="fme-field fme-field-grow">
                <span>Reason</span>
                <input
                  type="text"
                  className="fme-input"
                  value={specialPoints.reason}
                  onChange={(e) => handleSpecialChange('reason', e.target.value)}
                  placeholder="e.g. Played as GK, clean sheet"
                />
              </label>
            </div>
          </div>
        </div>
      );
    }

    if (step === 4 && selectedMatch && matchPlayers) {
      const bonusSummary = [
        bonusAssignments.bp3 ? `3 pts — ${playerName(bonusAssignments.bp3)}` : null,
        bonusAssignments.bp2 ? `2 pts — ${playerName(bonusAssignments.bp2)}` : null,
        bonusAssignments.bp1 ? `1 pt — ${playerName(bonusAssignments.bp1)}` : null,
      ].filter(Boolean);

      return (
        <div className="fme-step">
          <h3 className="fme-step-title">Review &amp; save</h3>
          <p className="fme-step-desc">
            Confirm data for <strong>{matchLabel(selectedMatch)}</strong> before saving.
          </p>
          <div className="fme-review-grid">
            <div className="fme-review-card">
              <span className="fme-review-label">Matchweek</span>
              <span className="fme-review-value">{selectedMatchweek.number}</span>
            </div>
            <div className="fme-review-card">
              <span className="fme-review-label">Players with minutes</span>
              <span className="fme-review-value">
                {Object.values(playerMinutes).filter((m) => Number(m) > 0).length}
              </span>
            </div>
            <div className="fme-review-card fme-review-card-wide">
              <span className="fme-review-label">Bonus points</span>
              <span className="fme-review-value">{bonusSummary.length ? bonusSummary.join(' · ') : 'None assigned'}</span>
            </div>
            <div className="fme-review-card fme-review-card-wide">
              <span className="fme-review-label">Special points</span>
              <span className="fme-review-value">
                {specialPoints.playerId && specialPoints.points
                  ? `${specialPoints.points} pts — ${playerName(specialPoints.playerId)}${specialPoints.reason ? ` (${specialPoints.reason})` : ''}`
                  : 'None'}
              </span>
            </div>
          </div>
          <p className="fme-review-note">
            Saving will update fantasy performance, rescore gameweek {selectedMatchweek.number}, and return you to the match list.
          </p>
        </div>
      );
    }

    return null;
  };

  const showBack = step > 1;
  const showContinue = step === 3;
  const showSave = step === 4;

  return (
    <div className="fme-root admin-fantasy-mw-editor">
      <div className="fme-header">
        <button type="button" className="admin-back-link" onClick={requestCancel}>
          ← Fantasy Management
        </button>
        <h2 className="fme-title">Edit Matchweek Data</h2>
      </div>

      {renderProgress()}
      {renderContextBar()}

      {error ? <div className="fme-error" role="alert">{error}</div> : null}

      <div className="fme-body">
        {renderStepContent()}
      </div>

      <div className="fme-actions-bar">
        {showBack ? (
          <button type="button" className="fme-btn fme-btn-back" onClick={handleBack} disabled={loading}>
            <ChevronLeft size={16} aria-hidden="true" />
            Back
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="fme-btn fme-btn-cancel" onClick={requestCancel} disabled={loading}>
          Cancel
        </button>
        {showContinue ? (
          <button type="button" className="fme-btn fme-btn-primary" onClick={handleContinue} disabled={loading}>
            Continue
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        ) : null}
        {showSave ? (
          <button type="button" className="fme-btn fme-btn-primary" onClick={handleSaveMatch} disabled={loading}>
            {loading ? 'Saving…' : 'Save match data'}
          </button>
        ) : null}
      </div>

      {cancelModalOpen ? (
        <ValidationModal
          title="Discard unsaved changes?"
          message="You have unsaved match performance data. Leaving now will discard your entries for this match."
          type="warning"
          actionText="Stay and continue editing"
          onClose={() => {
            setCancelModalOpen(false);
            setPendingNav(null);
          }}
          secondaryAction={{
            label: 'Discard and leave',
            onClick: () => {
              setCancelModalOpen(false);
              const nav = pendingNav;
              setPendingNav(null);
              if (nav) {
                resetEditorState();
                nav();
              } else {
                resetEditorState();
                onBackToDashboard();
              }
            },
          }}
        />
      ) : null}
    </div>
  );
}
