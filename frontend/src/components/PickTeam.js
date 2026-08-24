import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BarChart3, Crown, Star, Target, Zap } from 'lucide-react';
import api, { parseApiErrorMessage } from '../utils/api';
import {
  countSquadPlayers,
  fantasyUserId,
  loadLineupFromLocalStorage,
  loadSquadFromLocalStorage,
  normalizeSquadShape,
  resolveSquadFromApiAndCache,
  saveLineupToLocalStorage,
  saveSquadToLocalStorage,
} from '../utils/fantasySquadStorage';
import { deriveGameweekInfo } from '../utils/fantasyGameweek';
import { formatPitchFixture, refreshSquadFixtures } from '../utils/fantasyPlayerFixtures';
import {
  buildLineupFromSquad,
  flattenSquad,
  formationFromLineup,
  hydrateLineupFromPayload,
  lineupToPayload,
  playerId,
  relayoutLineup,
  swapLineupPlayers,
  validateLineup,
  applyDefaultCaptainRoles,
  lineupPayloadsEqual,
} from '../utils/fantasyLineup';
import JerseyIcon from './JerseyIcon';
import { getTeamCode, kitColors } from '../utils/fantasyKitColors';
import ValidationModal from './ValidationModal';
import PickTeamPlayerModal from './PickTeamPlayerModal';
import ChipDetailsModal from './ChipDetailsModal';
import { isPastDeadline } from '../utils/fantasyMatchweek';
import {
  buildChipStatusForGameweek,
  chipStatusLabel,
  isTransferChip,
  transferChipsAvailableForGameweek,
} from '../utils/fantasyChips';
import './PickTeam.css';

const FANTASY_CHIPS = [
  { id: 'WC', name: 'Wildcard', Icon: Zap },
  { id: 'BB', name: 'Bench Boost', Icon: BarChart3 },
  { id: 'TC', name: 'Triple Captain', Icon: Crown },
  { id: 'FH', name: 'Free Hit', Icon: Target },
  { id: 'DC', name: 'Duo Captain', Icon: Star },
];

function PlayerSlot({
  player,
  matches,
  currentGameweek,
  captainId,
  viceCaptainId,
  onOpen,
  emptyLabel,
}) {
  if (!player) {
    return (
      <div className="player-slot">
        <span className="empty-slot">{emptyLabel}</span>
      </div>
    );
  }

  const pid = playerId(player);
  const isCaptain = captainId === pid;
  const isVice = viceCaptainId === pid;

  return (
    <button type="button" className="player-slot" onClick={() => onOpen(player)}>
      {isCaptain ? <span className="role-chip">C</span> : null}
      {isVice ? <span className="role-chip role-chip-vc">V</span> : null}
      <JerseyIcon size={40} {...kitColors(getTeamCode(player), player.position)} />
      <div className="player-info">
        <span className="player-name">{player.name}</span>
        <span className="player-opponent">{formatPitchFixture(player, matches, currentGameweek)}</span>
      </div>
    </button>
  );
}

export default function PickTeam({ user, onBack, onGoToTransfers }) {
  const [squad, setSquad] = useState(null);
  const [lineup, setLineup] = useState(null);
  const [matches, setMatches] = useState([]);
  const [serverSeasonInfo, setServerSeasonInfo] = useState(null);
  const [chipHistory, setChipHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [playerModal, setPlayerModal] = useState(null);
  const [chipStatus, setChipStatus] = useState(() => buildChipStatusForGameweek(1));
  const [activeChip, setActiveChip] = useState(null);
  const [chipState, setChipState] = useState(null);
  const [serverSquadCount, setServerSquadCount] = useState(0);
  const [chipModalId, setChipModalId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const [unsavedModalOpen, setUnsavedModalOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const hydrateRetryRef = useRef(0);
  const savedBaselineRef = useRef(null);
  const historyTrapActiveRef = useRef(false);
  const skipHistoryCleanupRef = useRef(false);

  const derivedGameweekInfo = useMemo(() => deriveGameweekInfo(matches), [matches]);
  const upcomingInfo = useMemo(() => {
    if (serverSeasonInfo?.deadline) {
      return { week: derivedGameweekInfo.week, deadline: new Date(serverSeasonInfo.deadline) };
    }
    return derivedGameweekInfo;
  }, [derivedGameweekInfo, serverSeasonInfo]);
  const currentGameweek = upcomingInfo.week || 1;

  useEffect(() => {
    setChipStatus((prev) =>
      buildChipStatusForGameweek(currentGameweek, prev, chipHistory, activeChip, chipState)
    );
  }, [currentGameweek, chipHistory, activeChip, chipState]);

  const loadData = useCallback(async () => {
    setLoading(true);
    savedBaselineRef.current = null;
    setSavedSnapshot(null);
    try {
      const matchRes = await api.get('/matches', { params: { competition: 'league' } });
      const matchList = Array.isArray(matchRes.data) ? matchRes.data : [];
      setMatches(matchList);
      try {
        const s = await api.get('/fantasy/season');
        if (s?.data?.success) setServerSeasonInfo(s.data);
      } catch (err) {
        setServerSeasonInfo(null);
      }
      let rawSquad = null;
      let savedLineup = null;
      let transferInOrder = [];
      let serverChipState = null;
      let apiSquadCount = 0;
      try {
        const squadRes = await api.get('/fantasy/my-squad');
        if (squadRes.data?.success) {
          rawSquad = squadRes.data.squad;
          savedLineup = squadRes.data.lineup;
          transferInOrder = squadRes.data.transferInOrder || [];
          serverChipState = squadRes.data.chipState || null;
          apiSquadCount =
            typeof squadRes.data.squadPlayerCount === 'number'
              ? squadRes.data.squadPlayerCount
              : countSquadPlayers(rawSquad);
        }
      } catch {
        /* fall back to local cache */
      }

      const uid = fantasyUserId(user);
      if ((!rawSquad || countSquadPlayers(rawSquad) === 0) && uid) {
        const cachedOnly = loadSquadFromLocalStorage(uid);
        if (countSquadPlayers(cachedOnly) > 0) {
          rawSquad = cachedOnly;
        }
      }

      let history = chipHistory;
      try {
        const chipsRes = await api.get('/fantasy/my-chips');
        if (chipsRes?.data?.success) {
          history = chipsRes.data.chipHistory || {};
          setChipHistory(history);
          if (chipsRes.data.chipState) serverChipState = chipsRes.data.chipState;
        }
      } catch {
        if (serverChipState?.chipHistory) {
          history = serverChipState.chipHistory;
          setChipHistory(history);
        }
      }

      const gameweek = deriveGameweekInfo(matchList).week || 1;
      rawSquad = resolveSquadFromApiAndCache(rawSquad, uid, apiSquadCount, {
        preferApi: serverChipState?.freeHitExpired === true,
      });
      let resolvedCount = countSquadPlayers(rawSquad);
      if (apiSquadCount >= 13 && resolvedCount < 13 && uid) {
        const cached = loadSquadFromLocalStorage(uid);
        if (countSquadPlayers(cached) === 13) {
          rawSquad = normalizeSquadShape(cached);
          resolvedCount = 13;
        }
      }
      setServerSquadCount(Math.max(apiSquadCount, resolvedCount));
      setChipState(serverChipState);
      const resolvedChip =
        serverChipState?.activeChip || savedLineup?.chipUsed || null;

      if (uid && !savedLineup) {
        savedLineup = loadLineupFromLocalStorage(uid);
      }

      if (resolvedCount >= 13 || apiSquadCount >= 13) {
        const refreshed = refreshSquadFixtures(
          normalizeSquadShape(rawSquad),
          matchList,
          gameweek
        );
        setSquad(refreshed);
        if (uid) saveSquadToLocalStorage(uid, refreshed);
        if (uid && countSquadPlayers(refreshed) === 13 && apiSquadCount < 13) {
          api.put('/fantasy/my-squad', { squad: refreshed }).catch(() => {});
        }

        try {
          const players = flattenSquad(refreshed);
          if (players.length === 13) {
            if (savedLineup) {
              const byId = new Map(players.map((p) => [playerId(p), p]));
              const hydrated = hydrateLineupFromPayload(savedLineup, byId);
              const relaid = relayoutLineup(hydrated);
              const check = validateLineup(relaid);
              const baseLineup = check.ok
                ? relaid
                : buildLineupFromSquad(players, {
                    captainId: savedLineup.captainId,
                    viceCaptainId: savedLineup.viceCaptainId,
                  });
              const order = transferInOrder.length ? transferInOrder : players.map(playerId);
              setLineup(applyDefaultCaptainRoles(baseLineup, order));
            } else {
              const order = transferInOrder.length ? transferInOrder : players.map(playerId);
              setLineup(applyDefaultCaptainRoles(buildLineupFromSquad(players), order));
            }
          } else {
            setLineup(null);
          }
        } catch {
          const players = flattenSquad(refreshed);
          if (players.length === 13) {
            setLineup(
              applyDefaultCaptainRoles(
                buildLineupFromSquad(players),
                transferInOrder.length ? transferInOrder : players.map(playerId)
              )
            );
          } else {
            setLineup(null);
          }
        }
      } else {
        setSquad(null);
        setLineup(null);
      }
      setActiveChip(resolvedChip);
      setChipStatus(buildChipStatusForGameweek(gameweek, {}, history, resolvedChip, serverChipState));
    } catch (err) {
      console.error('Pick team load failed:', err);
      const uid = fantasyUserId(user);
      const cached = uid ? loadSquadFromLocalStorage(uid) : null;
      if (countSquadPlayers(cached) === 13) {
        setSquad(normalizeSquadShape(cached));
        setServerSquadCount(13);
        const players = flattenSquad(cached);
        setLineup(applyDefaultCaptainRoles(buildLineupFromSquad(players), players.map(playerId)));
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const players = useMemo(() => flattenSquad(squad), [squad]);
  const squadComplete = players.length === 13;
  const squadDisplayCount = Math.max(players.length, serverSquadCount);
  const squadHydrating = !loading && serverSquadCount >= 13 && players.length < 13;
  const formation = formationFromLineup(lineup);
  const deadlinePassed = isPastDeadline(upcomingInfo.deadline);

  const closePlayerModal = () => setPlayerModal(null);

  const openPlayerModal = (player) => {
    setPlayerModal({ player, mode: 'actions' });
  };

  const handleSetCaptain = (player) => {
    const pid = playerId(player);
    setLineup((prev) => {
      if (!prev) return prev;
      if (prev.captainId === pid) {
        return { ...prev, captainId: null };
      }
      if (prev.viceCaptainId === pid) {
        return { ...prev, viceCaptainId: null, captainId: pid };
      }
      return { ...prev, captainId: pid };
    });
    closePlayerModal();
  };

  const handleSetVice = (player) => {
    const pid = playerId(player);
    setLineup((prev) => {
      if (!prev) return prev;
      if (prev.captainId === pid) return prev;
      if (prev.viceCaptainId === pid) {
        return { ...prev, viceCaptainId: null };
      }
      return { ...prev, viceCaptainId: pid };
    });
    closePlayerModal();
  };

  const handleSwapWith = (targetPlayer) => {
    if (!playerModal?.player) return;
    const result = swapLineupPlayers(lineup, playerModal.player, targetPlayer);
    if (!result.ok) {
      setFeedback({
        title: 'Swap not allowed',
        message: result.message || 'That swap would break lineup rules. Try a different player.',
        type: 'warning',
      });
    } else {
      setLineup(result.lineup);
    }
    closePlayerModal();
  };

  const handleChipClick = (chipId) => {
    const status = chipStatus[chipId];
    if (status === 'played' || status === 'inactive') return;
    setChipModalId(chipId);
  };

  const handlePlayChip = async () => {
    if (!chipModalId) return;
    if (
      isTransferChip(chipModalId) &&
      !transferChipsAvailableForGameweek(currentGameweek)
    ) {
      setFeedback({
        title: 'Not available in GW1',
        message: 'Wildcard and Free Hit are transfer chips and unlock from Gameweek 2.',
        type: 'info',
      });
      setChipModalId(null);
      return;
    }

    const cancelling = activeChip === chipModalId;
    const nextChip = cancelling ? null : chipModalId;

    if (nextChip && activeChip && activeChip !== nextChip) {
      setFeedback({
        title: 'One chip at a time',
        message: 'Cancel your active chip before playing another.',
        type: 'warning',
      });
      setChipModalId(null);
      return;
    }

    if (nextChip && chipState?.used?.[chipModalId]) {
      const usedGw = chipState?.usedGameweek?.[chipModalId];
      setFeedback({
        title: 'Chip already used',
        message: usedGw
          ? `This chip was already played in Gameweek ${usedGw}. Each chip can only be used once per season.`
          : 'This chip has already been used this season.',
        type: 'warning',
      });
      setChipModalId(null);
      return;
    }

    if (nextChip && isTransferChip(chipModalId)) {
      const uid = fantasyUserId(user);
      let squadToSave = squad;
      if (countSquadPlayers(squadToSave) < 13 && uid) {
        const cached = loadSquadFromLocalStorage(uid);
        if (countSquadPlayers(cached) === 13) {
          squadToSave = normalizeSquadShape(cached);
          setSquad(squadToSave);
        }
      }
      if (countSquadPlayers(squadToSave) === 13) {
        try {
          await api.put('/fantasy/my-squad', { squad: squadToSave });
          if (uid) saveSquadToLocalStorage(uid, squadToSave);
        } catch (err) {
          setFeedback({
            title: 'Squad not saved',
            message: parseApiErrorMessage(err, 'Save your squad before playing this chip.'),
            type: 'error',
          });
          setChipModalId(null);
          return;
        }
      }
    }

    try {
      const { data } = await api.put('/fantasy/my-chip', { chip: nextChip });
      if (!data?.success) {
        setFeedback({
          title: 'Chip not saved',
          message: data?.message || 'Could not update chip.',
          type: 'error',
        });
        setChipModalId(null);
        return;
      }
      const cs = data.chipState;
      setChipState(cs || null);
      if (cs?.chipHistory) setChipHistory(cs.chipHistory);
      setActiveChip(cs?.activeChip || null);
      setChipStatus(
        buildChipStatusForGameweek(
          currentGameweek,
          {},
          cs?.chipHistory || chipHistory,
          cs?.activeChip || null,
          cs
        )
      );
      if (nextChip && isTransferChip(nextChip)) {
        setFeedback({
          title: `${chipModalId === 'WC' ? 'Wildcard' : 'Free Hit'} active`,
          message:
            chipModalId === 'WC'
              ? 'Unlimited transfers in Transfers. Squad changes are permanent.'
              : 'Unlimited transfers this gameweek only. Your squad reverts next gameweek.',
          type: 'success',
        });
      } else if (nextChip) {
        setFeedback({
          title: `${FANTASY_CHIPS.find((c) => c.id === nextChip)?.name || 'Chip'} active`,
          message: `Chip is active for Gameweek ${currentGameweek}. Save your team to confirm.`,
          type: 'success',
        });
      }
    } catch (err) {
      setFeedback({
        title: 'Chip not saved',
        message: parseApiErrorMessage(err, 'Could not update chip.'),
        type: 'error',
      });
      setChipModalId(null);
      return;
    }
    setChipModalId(null);
  };

  const currentSnapshot = useMemo(() => {
    if (!lineup) return null;
    return lineupToPayload(lineup, { chipUsed: activeChip });
  }, [lineup, activeChip]);

  const isDirty = useMemo(() => {
    if (!currentSnapshot || !savedSnapshot) return false;
    return !lineupPayloadsEqual(currentSnapshot, savedSnapshot);
  }, [currentSnapshot, savedSnapshot]);

  useEffect(() => {
    if (loading || !lineup || !squadComplete || savedBaselineRef.current) return;
    const snapshot = lineupToPayload(lineup, { chipUsed: activeChip });
    savedBaselineRef.current = snapshot;
    setSavedSnapshot(snapshot);
  }, [loading, lineup, squadComplete, activeChip]);

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

  const leaveWithoutSaving = useCallback(() => {
    setUnsavedModalOpen(false);
    const navigateFn = pendingNavigation;
    setPendingNavigation(null);
    skipHistoryCleanupRef.current = true;
    navigateFn?.();
  }, [pendingNavigation]);

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
      window.history.pushState({ pickTeamGuard: true }, '');
      setPendingNavigation(() => () => {
        skipHistoryCleanupRef.current = true;
        historyTrapActiveRef.current = false;
        window.history.back();
      });
      setUnsavedModalOpen(true);
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('popstate', onPopState);

    if (!historyTrapActiveRef.current) {
      window.history.pushState({ pickTeamGuard: true }, '');
      historyTrapActiveRef.current = true;
    }

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
    };
  }, [isDirty, unsavedModalOpen]);

  const handleSave = async ({ quiet = false } = {}) => {
    if (deadlinePassed) {
      setFeedback({
        title: 'Deadline passed',
        message: 'The gameweek deadline has passed. Your team is locked until the next gameweek.',
        type: 'warning',
      });
      return false;
    }
    const check = validateLineup(lineup);
    if (!check.ok) {
      setFeedback({ title: 'Invalid lineup', message: check.message, type: 'warning' });
      return false;
    }
    setSaving(true);
    const payload = lineupToPayload(lineup, { chipUsed: activeChip });
    try {
      const { data } = await api.put('/fantasy/my-lineup', { lineup: payload });
      if (user?.id) {
        saveLineupToLocalStorage(fantasyUserId(user), payload);
        if (squad) saveSquadToLocalStorage(fantasyUserId(user), squad);
      }
      let lineupForSnapshot = lineup;
      let chipForSnapshot = activeChip;
      if (data?.lineup && squad) {
        const players = flattenSquad(squad);
        const byId = new Map(players.map((p) => [playerId(p), p]));
        const hydrated = hydrateLineupFromPayload(data.lineup, byId);
        const relaid = relayoutLineup(hydrated);
        if (relaid && validateLineup(relaid).ok) {
          setLineup(relaid);
          lineupForSnapshot = relaid;
        }
      }
      if (data?.chipState) {
        setChipState(data.chipState);
        if (data.chipState.chipHistory) setChipHistory(data.chipState.chipHistory);
        chipForSnapshot = data.chipState.activeChip || activeChip || null;
        setActiveChip(chipForSnapshot);
        setChipStatus(
          buildChipStatusForGameweek(
            currentGameweek,
            {},
            data.chipState.chipHistory || chipHistory,
            chipForSnapshot,
            data.chipState
          )
        );
      }
      if (!quiet) {
        setFeedback({
          title: 'Team saved',
          message: `Your starting 9 and bench are saved for Gameweek ${currentGameweek}. They stay until you make transfers.`,
          type: 'success',
        });
      }
      const snapshot = lineupToPayload(lineupForSnapshot, { chipUsed: chipForSnapshot });
      savedBaselineRef.current = snapshot;
      setSavedSnapshot(snapshot);
      return true;
    } catch (err) {
      if (user?.id) {
        saveLineupToLocalStorage(fantasyUserId(user), payload);
        if (squad) saveSquadToLocalStorage(fantasyUserId(user), squad);
      }
      if (!quiet) {
        setFeedback({
          title: 'Save failed',
          message: parseApiErrorMessage(err, 'Could not save your team.'),
          type: 'error',
        });
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFromUnsavedModal = async () => {
    const ok = await handleSave({ quiet: false });
    if (!ok) return;
    setUnsavedModalOpen(false);
    const navigateFn = pendingNavigation;
    setPendingNavigation(null);
    skipHistoryCleanupRef.current = Boolean(navigateFn);
    navigateFn?.();
  };

  const handleSaveClick = () => {
    handleSave();
  };

  useEffect(() => {
    if (!squadHydrating) {
      hydrateRetryRef.current = 0;
      return undefined;
    }
    const uid = fantasyUserId(user);
    const cached = uid ? loadSquadFromLocalStorage(uid) : null;
    if (countSquadPlayers(cached) === 13) {
      const refreshed = refreshSquadFixtures(
        normalizeSquadShape(cached),
        matches,
        currentGameweek
      );
      setSquad(refreshed);
      const flat = flattenSquad(refreshed);
      setLineup(applyDefaultCaptainRoles(buildLineupFromSquad(flat), flat.map(playerId)));
      hydrateRetryRef.current = 0;
      return undefined;
    }
    if (hydrateRetryRef.current >= 1) return undefined;
    hydrateRetryRef.current += 1;
    loadData();
    return undefined;
  }, [squadHydrating, user, matches, currentGameweek, loadData]);

  if (loading || squadHydrating) {
    return (
      <div className="pick-team-container fantasy-section">
        <p style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>Loading your squad…</p>
      </div>
    );
  }

  if (!squadComplete) {
    const transferChipActive =
      !squadComplete &&
      (chipState?.unlimitedTransfers ||
        (isTransferChip(activeChip) && transferChipsAvailableForGameweek(currentGameweek)));

    return (
      <div className="pick-team-container fantasy-section">
        <button type="button" className="back-link" onClick={() => attemptNavigation(onBack)}>
          <ArrowLeft size={18} aria-hidden />
          <span>Back</span>
        </button>
        <div className="transfers-prompt">
          <div className="prompt-icon" aria-hidden>👕</div>
          <h3>{transferChipActive ? 'Head to Transfers' : 'Complete transfers first'}</h3>
          <p>
            {transferChipActive ? (
              <>
                <strong>{activeChip === 'WC' ? 'Wildcard' : 'Free Hit'}</strong> is active — unlimited
                transfers in Transfers. Pick all <strong>13 players</strong>, tap{' '}
                <strong>Save squad</strong>, then return here ({squadDisplayCount}/13 saved).
                {activeChip === 'WC'
                  ? ' Squad changes are permanent.'
                  : ' Your squad reverts next gameweek.'}
              </>
            ) : (
              <>
                Pick team unlocks once all <strong>13 players</strong> are saved in Transfers
                ({squadDisplayCount}/13 so far).
              </>
            )}
          </p>
          {onGoToTransfers ? (
            <button type="button" className="fantasy-btn fantasy-btn-primary" onClick={() => attemptNavigation(onGoToTransfers)}>
              Go to Transfers
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="pick-team-container fantasy-section">
      <div className="pick-team-header">
        <div>
          <button type="button" className="back-link" onClick={() => attemptNavigation(onBack)}>
            <ArrowLeft size={18} aria-hidden />
            <span>Back</span>
          </button>
          <h2>Pick team</h2>
        </div>
        <p className="gameweek-info">
          Gameweek {currentGameweek}
          {upcomingInfo.deadline
            ? ` · Deadline ${upcomingInfo.deadline.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
            : ''}
        </p>
        <p className="formation-label">Tap a player to swap, set captain, or vice-captain</p>
      </div>

      <section className="chips-section" aria-label="Fantasy chips">
        {FANTASY_CHIPS.map(({ id, name, Icon }) => {
          const status = chipStatus[id];
          const isDisabled = status === 'played' || status === 'inactive';
          return (
            <button
              key={id}
              type="button"
              className={`chip-card status-${status} ${isDisabled ? 'disabled' : ''}`}
              onClick={() => handleChipClick(id)}
              disabled={isDisabled}
              aria-label={`${name} — ${chipStatusLabel(status, id, chipState)}`}
            >
              <span className="chip-icon">
                <Icon size={22} strokeWidth={2.2} />
              </span>
              <span className="chip-name">{name}</span>
              <span className={`chip-status status-${status}`}>
                {chipStatusLabel(status, id, chipState)}
              </span>
            </button>
          );
        })}
      </section>

      <div className="formation-display" aria-live="polite">
        <span className="formation-display__label">Formation</span>
        <span className="formation-display__value">{formation.label}</span>
        <span className="formation-display__hint">1 GK · min 2 DEF · min 2 MID · min 1 FWD</span>
      </div>

      <div className="formation-pitch" aria-label="Starting 9">
        <div className="formation-row">
          {(lineup?.starters?.gk || []).map((p, idx) => (
            <PlayerSlot
              key={`gk-${idx}`}
              player={p}
              matches={matches}
              currentGameweek={currentGameweek}
              captainId={lineup.captainId}
              viceCaptainId={lineup.viceCaptainId}
              onOpen={openPlayerModal}
              emptyLabel="GK"
            />
          ))}
        </div>
        <div className={`formation-row df-row-${formation.def}`}>
          {(lineup?.starters?.df || []).map((p, idx) => (
            <PlayerSlot
              key={`df-${idx}`}
              player={p}
              matches={matches}
              currentGameweek={currentGameweek}
              captainId={lineup.captainId}
              viceCaptainId={lineup.viceCaptainId}
              onOpen={openPlayerModal}
              emptyLabel="DEF"
            />
          ))}
        </div>
        <div className={`formation-row mf-row-${formation.mid}`}>
          {(lineup?.starters?.mf || []).map((p, idx) => (
            <PlayerSlot
              key={`mf-${idx}`}
              player={p}
              matches={matches}
              currentGameweek={currentGameweek}
              captainId={lineup.captainId}
              viceCaptainId={lineup.viceCaptainId}
              onOpen={openPlayerModal}
              emptyLabel="MID"
            />
          ))}
        </div>
        <div className={`formation-row att-row-${formation.att}`}>
          {(lineup?.starters?.att || []).map((p, idx) => (
            <PlayerSlot
              key={`att-${idx}`}
              player={p}
              matches={matches}
              currentGameweek={currentGameweek}
              captainId={lineup.captainId}
              viceCaptainId={lineup.viceCaptainId}
              onOpen={openPlayerModal}
              emptyLabel="FWD"
            />
          ))}
        </div>
      </div>

      <section className="bench-section" aria-label="Bench">
        <h3>Bench ({(lineup?.bench || []).filter(Boolean).length}/4)</h3>
        <div className="bench-players">
          {(lineup?.bench || []).map((p, idx) =>
            p ? (
              <button
                type="button"
                key={playerId(p) || idx}
                className="bench-player"
                onClick={() => openPlayerModal(p)}
              >
                <JerseyIcon size={32} {...kitColors(getTeamCode(p), p.position)} />
                <div className="bench-player-info">
                  <span className="bench-name">{p.name}</span>
                  <span className="bench-pos">{formatPitchFixture(p, matches, currentGameweek)}</span>
                </div>
              </button>
            ) : (
              <div key={`empty-bench-${idx}`} className="bench-player" style={{ opacity: 0.5 }}>
                <span className="bench-name">Empty</span>
              </div>
            )
          )}
        </div>
      </section>

      <button
        type="button"
        className="fantasy-btn fantasy-btn-primary"
        style={{ width: '100%', marginTop: 8 }}
        disabled={saving || deadlinePassed}
        onClick={handleSaveClick}
      >
        {deadlinePassed
          ? 'Deadline passed — team locked'
          : saving
            ? 'Saving…'
            : `Save team for Gameweek ${currentGameweek}`}
      </button>

      {playerModal ? (
        <PickTeamPlayerModal
          player={playerModal.player}
          lineup={lineup}
          matches={matches}
          currentGameweek={currentGameweek}
          captainId={lineup?.captainId}
          viceCaptainId={lineup?.viceCaptainId}
          mode={playerModal.mode}
          onClose={closePlayerModal}
          onMakeCaptain={() => handleSetCaptain(playerModal.player)}
          onMakeVice={() => handleSetVice(playerModal.player)}
          onStartSwap={() => setPlayerModal((prev) => ({ ...prev, mode: 'swap' }))}
          onBackToActions={() => setPlayerModal((prev) => ({ ...prev, mode: 'actions' }))}
          onSwapWith={handleSwapWith}
        />
      ) : null}

      {chipModalId ? (
        <ChipDetailsModal
          chipId={chipModalId}
          onClose={() => setChipModalId(null)}
          onPlayChip={handlePlayChip}
          isDisabled={chipStatus[chipModalId] === 'played' || chipStatus[chipModalId] === 'inactive'}
          isActive={activeChip === chipModalId}
        />
      ) : null}

      {feedback ? (
        <ValidationModal
          title={feedback.title}
          message={feedback.message}
          type={feedback.type}
          onClose={() => setFeedback(null)}
        />
      ) : null}

      {unsavedModalOpen ? (
        <ValidationModal
          title="Unsaved Changes"
          message="You have unsaved changes to your team. If you leave now, your changes will be lost."
          type="warning"
          actionText="Stay and Continue"
          onClose={closeUnsavedModal}
          secondaryAction={{
            label: 'Leave Without Saving',
            onClick: leaveWithoutSaving,
          }}
          saveAction={{
            label: saving ? 'Saving…' : 'Save',
            onClick: handleSaveFromUnsavedModal,
            disabled: saving || deadlinePassed,
          }}
        />
      ) : null}
    </div>
  );
}
