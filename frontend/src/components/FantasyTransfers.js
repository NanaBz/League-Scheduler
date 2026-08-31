import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import api from '../utils/api';
import {
  EMPTY_SQUAD,
  countSquadPlayers,
  fantasyUserId,
  normalizeSquadShape,
  resolveSquadFromApiAndCache,
  saveSquadToLocalStorage,
  saveFinancialToLocalStorage,
} from '../utils/fantasySquadStorage';
import {
  applyPlayerToSlot,
  createEmptyFinancialState,
  mapLedgerErrorMessage,
  parseFinancialFromApiResponse,
  previewSquadFinancial,
} from '../utils/fantasySquadLedger';
import { deriveGameweekInfo } from '../utils/fantasyGameweek';
import {
  freeTransfersDisplay,
  transferChipDisplayLabel,
} from '../utils/fantasyChips';
import { validateSquadClubLimits } from '../utils/fantasySquadValidation';
import {
  countPendingTransfers,
  isStagedSquadDirty,
  previewTransferSummary,
} from '../utils/fantasyTransfers';
import { isPastDeadline } from '../utils/fantasyMatchweek';
import {
  formatPitchFixture,
  refreshSquadFixtures,
} from '../utils/fantasyPlayerFixtures';
import { acityPriceAriaLabel, formatAcityPrice } from '../utils/formatAcityPrice';
import './FantasyTransfers.css';
import JerseyIcon from './JerseyIcon';
import { getTeamCode, kitColors } from '../utils/fantasyKitColors';
import PlayerPickerModal from './PlayerPickerModal';
import PlayerDetailsModal from './PlayerDetailsModal';
import ValidationModal from './ValidationModal';

export default function FantasyTransfers({ user, onBack, onGoToPickTeam }) {
  const userId = fantasyUserId(user);
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
  const [chipState, setChipState] = useState(null);
  const [transferState, setTransferState] = useState(null);
  const [savedSquad, setSavedSquad] = useState(null);
  const [savedFinancial, setSavedFinancial] = useState(() => createEmptyFinancialState());
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [saveError, setSaveError] = useState('');
  const [unsavedModalOpen, setUnsavedModalOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const squadHydratedRef = useRef(false);
  const historyTrapActiveRef = useRef(false);
  const skipHistoryCleanupRef = useRef(false);

  const persistSquad = useCallback(async (nextSquad, userKey, { showFeedback = false, gameweek } = {}) => {
    if (!userKey) return { ok: false };
    const count = countSquadPlayers(nextSquad);
    saveSquadToLocalStorage(userKey, nextSquad);
    if (count !== 13) {
      setSaveStatus('idle');
      return { ok: false, reason: 'incomplete' };
    }
    setSaveStatus('saving');
    setSaveError('');
    try {
      const { data } = await api.put('/fantasy/my-squad', { squad: nextSquad });
      if (!data?.success) {
        throw new Error(data?.message || 'Could not save your squad.');
      }
      if (data?.chipState) setChipState(data.chipState);
      if (data?.transferState) setTransferState(data.transferState);
      const normalized = normalizeSquadShape(data.squad || nextSquad);
      const financial = parseFinancialFromApiResponse(data);
      setSquad(normalized);
      setSavedSquad(normalized);
      setSavedFinancial(financial);
      saveSquadToLocalStorage(userKey, normalized);
      saveFinancialToLocalStorage(userKey, financial);
      setSaveStatus('saved');
      if (showFeedback) {
        setValidationError({
          title: 'Squad saved',
          message: `Your 13-player squad is saved for Gameweek ${gameweek || '—'}. Head to Pick team to set your starting XI.`,
          type: 'success',
        });
      }
      return { ok: true, data };
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Could not save your squad.';
      setSaveStatus('error');
      setSaveError(message);
      console.error('Failed to save squad:', message);
      if (showFeedback) {
        setValidationError({ title: 'Save Failed', message, type: 'error' });
      }
      return { ok: false, error: message };
    }
  }, []);

  // Load this user's squad when account changes
  useEffect(() => {
    if (!userId) {
      setSquad(normalizeSquadShape(EMPTY_SQUAD));
      setSavedFinancial(createEmptyFinancialState());
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
          const apiHydratedCount = countSquadPlayers(data.squad);
          const serverCount =
            typeof data.squadPlayerCount === 'number' ? data.squadPlayerCount : apiHydratedCount;
          const preferApi = data.chipState?.freeHitExpired === true;
          const resolved = resolveSquadFromApiAndCache(data.squad, userId, serverCount, { preferApi });
          const normalized = normalizeSquadShape(resolved);
          const financial = parseFinancialFromApiResponse(data);
          setSquad(normalized);
          setSavedSquad(normalized);
          setSavedFinancial(financial);
          saveSquadToLocalStorage(userId, normalized);
          saveFinancialToLocalStorage(userId, financial);
          if (data.chipState) setChipState(data.chipState);
          if (data.transferState) setTransferState(data.transferState);
          if (countSquadPlayers(resolved) === 13) {
            setSaveStatus(serverCount >= 13 ? 'saved' : 'idle');
          } else {
            setSaveStatus('idle');
          }
        } else {
          const normalized = normalizeSquadShape(EMPTY_SQUAD);
          setSquad(normalized);
          setSavedSquad(normalized);
          setSavedFinancial(createEmptyFinancialState());
        }
      } catch {
        if (!cancelled) {
          const normalized = normalizeSquadShape(EMPTY_SQUAD);
          setSquad(normalized);
          setSavedSquad(normalized);
          setSavedFinancial(createEmptyFinancialState());
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

  // Summary values — bank comes from server + staged preview (see financialPreview)

  const pendingTransfers = useMemo(
    () => countPendingTransfers(savedSquad, squad),
    [savedSquad, squad]
  );

  const isDirty = useMemo(() => {
    const baseline = savedSquad || normalizeSquadShape(EMPTY_SQUAD);
    return isStagedSquadDirty(baseline, squad);
  }, [savedSquad, squad]);

  const attemptNavigation = useCallback(
    (navigateFn) => {
      if (!navigateFn) return;
      if (!isDirty) {
        navigateFn();
        return;
      }
      setPendingNavigation(() => navigateFn);
      setUnsavedModalOpen(true);
    },
    [isDirty]
  );

  const closeUnsavedModal = useCallback(() => {
    setUnsavedModalOpen(false);
    setPendingNavigation(null);
  }, []);

  const discardStagedTransfers = useCallback(() => {
    const baseline = savedSquad || normalizeSquadShape(EMPTY_SQUAD);
    const restored = normalizeSquadShape(baseline);
    setSquad(restored);
    if (userId) saveSquadToLocalStorage(userId, restored);
  }, [savedSquad, userId]);

  const leaveWithoutSaving = useCallback(() => {
    setUnsavedModalOpen(false);
    const navigateFn = pendingNavigation;
    setPendingNavigation(null);
    discardStagedTransfers();
    skipHistoryCleanupRef.current = true;
    navigateFn?.();
  }, [pendingNavigation, discardStagedTransfers]);

  useEffect(() => {
    if (!isDirty) {
      if (unsavedModalOpen) {
        setUnsavedModalOpen(false);
        setPendingNavigation(null);
      } else if (historyTrapActiveRef.current && !skipHistoryCleanupRef.current) {
        historyTrapActiveRef.current = false;
        window.history.back();
      }
      skipHistoryCleanupRef.current = false;
      return undefined;
    }

    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    const onPopState = () => {
      window.history.pushState({ transfersGuard: true }, '');
      setPendingNavigation(() => () => {
        skipHistoryCleanupRef.current = true;
        historyTrapActiveRef.current = false;
        discardStagedTransfers();
        window.history.back();
      });
      setUnsavedModalOpen(true);
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('popstate', onPopState);

    if (!historyTrapActiveRef.current) {
      window.history.pushState({ transfersGuard: true }, '');
      historyTrapActiveRef.current = true;
    }

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
    };
  }, [isDirty, unsavedModalOpen, discardStagedTransfers]);

  const transferSummary = useMemo(
    () => previewTransferSummary(transferState, pendingTransfers),
    [transferState, pendingTransfers]
  );

  const cost = transferSummary.transferCost;

  const savedBaseline = savedSquad || normalizeSquadShape(EMPTY_SQUAD);

  const financialPreview = useMemo(
    () =>
      previewSquadFinancial({
        savedFinancial,
        savedSquad: savedBaseline,
        stagedSquad: squad,
      }),
    [savedFinancial, savedBaseline, squad]
  );

  const bankDisplay = financialPreview.bankBalance;
  const squadValueDisplay = financialPreview.squadMarketValue;
  const totalValueDisplay = financialPreview.totalTeamValue;

  const derivedGameweekInfo = useMemo(() => deriveGameweekInfo(matches), [matches]);
  const upcomingInfo = useMemo(() => {
    if (serverSeasonInfo?.deadline) {
      return { week: derivedGameweekInfo.week, deadline: new Date(serverSeasonInfo.deadline) };
    }
    return derivedGameweekInfo;
  }, [derivedGameweekInfo, serverSeasonInfo]);

  const currentGameweek = upcomingInfo.week || 1;
  const unlimitedTransfers = chipState?.unlimitedTransfers === true;
  const freeTransfersLabel = freeTransfersDisplay(currentGameweek, chipState, transferState);
  const deadlinePassed = isPastDeadline(upcomingInfo.deadline);
  const wildcardLabel = transferChipDisplayLabel('WC', { gameweek: currentGameweek, chipState });
  const freeHitLabel = transferChipDisplayLabel('FH', { gameweek: currentGameweek, chipState });
  const wildcardActive = chipState?.wildcardActive === true;
  const freeHitActive = chipState?.freeHitActive === true;

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

  const validateStagedFinancial = (newSquad) => {
    const preview = previewSquadFinancial({
      savedFinancial,
      savedSquad: savedBaseline,
      stagedSquad: newSquad,
    });
    if (!preview.ok) {
      return {
        valid: false,
        message: mapLedgerErrorMessage(preview.message || 'Squad exceeds available budget.'),
      };
    }
    return { valid: true };
  };

  const canAffordPlayer = useCallback(
    (player) => {
      if (!pickerLock) return true;
      const trialSquad = applyPlayerToSlot(squad, pickerLock, player);
      const preview = previewSquadFinancial({
        savedFinancial,
        savedSquad: savedBaseline,
        stagedSquad: trialSquad,
      });
      return preview.ok;
    },
    [pickerLock, squad, savedFinancial, savedBaseline]
  );

  const assignPlayer = (player) => {
    if (!pickerLock) return;

    const newSquad = {
      GK: [...squad.GK],
      DF: [...squad.DF],
      MF: [...squad.MF],
      ATT: [...squad.ATT],
    };
    const arr = [...newSquad[pickerLock.position]];

    // Apply replacement first, then validate the final squad state.
    arr[pickerLock.index] = player;
    newSquad[pickerLock.position] = arr;

    const teamLimitCheck = validateSquadClubLimits(newSquad);
    if (!teamLimitCheck.valid) {
      setValidationError({ title: 'Team Limit Exceeded', message: teamLimitCheck.message, type: 'error' });
      return;
    }

    const budgetCheck = validateStagedFinancial(newSquad);
    if (!budgetCheck.valid) {
      setValidationError({ title: 'Insufficient Bank', message: budgetCheck.message, type: 'error' });
      return;
    }

    setSquad(newSquad);
    setPickerOpen(false);
    setPickerLock(null);
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

  const squadSelectedCount = Object.values(squad).flat().filter(Boolean).length;

  const commitStagedSquad = useCallback(
    async ({ showFeedback = false, quiet = false } = {}) => {
      if (deadlinePassed) {
        if (!quiet) {
          setValidationError({
            title: 'Deadline passed',
            message: 'The gameweek deadline has passed. Transfers are locked until the next gameweek.',
            type: 'warning',
          });
        }
        return false;
      }
      if (!isSquadComplete) {
        if (!quiet) {
          setValidationError({
            title: 'Incomplete Squad',
            message: 'You must select all 13 players (2 GK, 4 DF, 4 MF, 3 ATT) before saving.',
            type: 'warning',
          });
        }
        return false;
      }
      if (!userId) {
        if (!quiet) {
          setValidationError({
            title: 'Save Failed',
            message: 'You must be signed in to save your squad.',
            type: 'error',
          });
        }
        return false;
      }
      const result = await persistSquad(squad, userId, {
        showFeedback: showFeedback && !quiet,
        gameweek: currentGameweek,
      });
      return result.ok;
    },
    [deadlinePassed, isSquadComplete, userId, squad, persistSquad, currentGameweek]
  );

  const handleGoToPickTeam = () => {
    if (!onGoToPickTeam) return;
    attemptNavigation(onGoToPickTeam);
  };

  const handleSubmitTeam = async () => {
    await commitStagedSquad({ showFeedback: true });
  };

  const handleSaveFromUnsavedModal = async () => {
    const ok = await commitStagedSquad({ quiet: true });
    if (!ok) return;
    setUnsavedModalOpen(false);
    const navigateFn = pendingNavigation;
    setPendingNavigation(null);
    skipHistoryCleanupRef.current = Boolean(navigateFn);
    navigateFn?.();
  };

  return (
    <div className="transfers-container">
      <div className="transfers-header">
        <button className="back-link" onClick={() => attemptNavigation(onBack)} aria-label="Back to fantasy">
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

      {unlimitedTransfers ? (
        <div className="transfers-chip-banner" role="status">
          {wildcardActive ? (
            <>
              <strong>Wildcard active</strong> — unlimited transfers. Squad changes are{' '}
              <strong>permanent</strong> after this gameweek.
            </>
          ) : null}
          {freeHitActive ? (
            <>
              <strong>Free Hit active</strong> — unlimited transfers this gameweek only. Your
              squad reverts next gameweek.
            </>
          ) : null}
        </div>
      ) : null}

      <div className="summary-bar summary-bar--financial">
        <div className="summary-item">
          <div className="label">Bank</div>
          <div className="value" aria-label={acityPriceAriaLabel(bankDisplay)}>{formatAcityPrice(bankDisplay)}</div>
        </div>
        <div className="summary-item">
          <div className="label">Squad Value</div>
          <div className="value" aria-label={acityPriceAriaLabel(squadValueDisplay)}>{formatAcityPrice(squadValueDisplay)}</div>
        </div>
        <div className="summary-item">
          <div className="label">Team Value</div>
          <div className="value" aria-label={acityPriceAriaLabel(totalValueDisplay)}>{formatAcityPrice(totalValueDisplay)}</div>
        </div>
      </div>

      <div className="summary-bar">
        <div className={`summary-item${unlimitedTransfers ? ' summary-item--active' : ''}`}>
          <div className="label">Free Transfers</div>
          <div className="value">{freeTransfersLabel}</div>
        </div>
        <div className="summary-item">
          <div className="label">Transfer Hit</div>
          <div className="value">{cost > 0 ? `-${cost} pts` : '0 pts'}</div>
        </div>
        <div className={`summary-item${wildcardActive ? ' summary-item--chip-active' : ''}`}>
          <div className="label">Wildcard</div>
          <div className="value">{wildcardLabel}</div>
        </div>
        <div className={`summary-item${freeHitActive ? ' summary-item--chip-active' : ''}`}>
          <div className="label">Free Hit</div>
          <div className="value">{freeHitLabel}</div>
        </div>
      </div>

      <div className="toggle-bar toggle-bar--fpl">
        <button type="button" className={`toggle-btn ${view === 'pitch' ? 'active' : ''}`} onClick={() => setView('pitch')}>Pitch</button>
        <button type="button" className={`toggle-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>List</button>
      </div>

      <div className="squad-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(squadSelectedCount / 13) * 100}%` }}></div>
        </div>
        <div className="progress-text">{squadSelectedCount} / 13 Players Selected</div>
      </div>

      {!squadLoading && unlimitedTransfers && squadSelectedCount < 13 ? (
        <div className="transfers-chip-banner transfers-chip-banner--hint" role="status">
          Free Hit is active — pick all <strong>13 players</strong>, then tap{' '}
          <strong>Save squad</strong> before opening Pick team.
        </div>
      ) : null}

      {!squadLoading && saveStatus === 'saving' ? (
        <div className="transfers-save-status transfers-save-status--saving" role="status">
          Saving squad…
        </div>
      ) : null}

      {!squadLoading && saveStatus === 'saved' && isSquadComplete ? (
        <div className="transfers-save-status transfers-save-status--saved" role="status">
          Squad saved — you can open Pick team now.
        </div>
      ) : null}

      {!squadLoading && saveStatus === 'error' && saveError ? (
        <div className="transfers-save-status transfers-save-status--error" role="alert">
          Save failed: {saveError}
        </div>
      ) : null}

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
                      <div className="pitch-player-price" aria-label={acityPriceAriaLabel(p.fantasyPrice)}>{formatAcityPrice(p.fantasyPrice)}</div>
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
                      <div className="pitch-player-price" aria-label={acityPriceAriaLabel(p.fantasyPrice)}>{formatAcityPrice(p.fantasyPrice)}</div>
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
                      <div className="pitch-player-price" aria-label={acityPriceAriaLabel(p.fantasyPrice)}>{formatAcityPrice(p.fantasyPrice)}</div>
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
                      <div className="pitch-player-price" aria-label={acityPriceAriaLabel(p.fantasyPrice)}>{formatAcityPrice(p.fantasyPrice)}</div>
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
                  <div className="price" aria-label={acityPriceAriaLabel(p.fantasyPrice)}>{formatAcityPrice(p.fantasyPrice)}</div>
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
          disabled={!isSquadComplete || squadLoading || deadlinePassed || saveStatus === 'saving'}
        >
          {deadlinePassed
            ? 'Deadline passed — squad locked'
            : saveStatus === 'saving'
              ? 'Saving…'
              : `Save squad for Gameweek ${upcomingInfo.week || '—'}`}
        </button>
        {isSquadComplete && !deadlinePassed && onGoToPickTeam ? (
          <button
            type="button"
            className="submit-btn submit-btn--secondary active"
            onClick={handleGoToPickTeam}
            disabled={squadLoading || saveStatus === 'saving'}
          >
            Go to Pick team
          </button>
        ) : null}
      </div>

      {pickerOpen && (
        <PlayerPickerModal
          lockedPosition={pickerLock?.position}
          selectedIds={selectedIds}
          canAffordPlayer={canAffordPlayer}
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
                    attemptNavigation(onGoToPickTeam);
                  },
                }
              : undefined
          }
        />
      )}

      {unsavedModalOpen ? (
        <ValidationModal
          title="Unsaved Transfers"
          message="You have unsaved changes to your team. If you leave now, your transfers will be lost."
          type="warning"
          actionText="Stay and Continue"
          onClose={closeUnsavedModal}
          secondaryAction={{
            label: 'Leave Without Saving',
            onClick: leaveWithoutSaving,
          }}
          saveAction={{
            label: saveStatus === 'saving' ? 'Saving…' : 'Save',
            onClick: handleSaveFromUnsavedModal,
            disabled: saveStatus === 'saving' || deadlinePassed || !isSquadComplete,
          }}
        />
      ) : null}
    </div>
  );
}
