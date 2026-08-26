import React from 'react';
import JerseyIcon from './JerseyIcon';
import { getTeamCode, kitColors } from '../utils/fantasyKitColors';
import { formatPitchFixture } from '../utils/fantasyPlayerFixtures';
import { displaySelectionPercentage, displayTotalPoints } from '../utils/fantasyPlayerStatsDisplay';
import { allStarters, playerId } from '../utils/fantasyLineup';
import './PickTeamPlayerModal.css';

function playerLocation(lineup, player) {
  const pid = playerId(player);
  if (!lineup || !pid) return 'Squad';

  for (const [pos, arr] of Object.entries(lineup.starters || {})) {
    if ((arr || []).some((p) => p && playerId(p) === pid)) {
      const labels = { gk: 'Starting GK', df: 'Starting DEF', mf: 'Starting MID', att: 'Starting FWD' };
      return labels[pos] || 'Starting XI';
    }
  }
  const benchIdx = (lineup.bench || []).findIndex((p) => p && playerId(p) === pid);
  if (benchIdx >= 0) return `Bench ${benchIdx + 1}`;
  return 'Squad';
}

function swapCandidates(lineup, sourcePlayer) {
  const sourceId = playerId(sourcePlayer);
  const starters = allStarters(lineup);
  const bench = (lineup.bench || []).filter(Boolean);
  return [...starters, ...bench].filter((p) => playerId(p) !== sourceId);
}

export default function PickTeamPlayerModal({
  player,
  lineup,
  matches,
  currentGameweek,
  captainId,
  viceCaptainId,
  mode = 'actions',
  onClose,
  onMakeCaptain,
  onMakeVice,
  onStartSwap,
  onBackToActions,
  onSwapWith,
}) {
  if (!player) return null;

  const pid = playerId(player);
  const isStarter = allStarters(lineup).some((p) => playerId(p) === pid);
  const isCaptain = captainId === pid;
  const isVice = viceCaptainId === pid;
  const location = playerLocation(lineup, player);

  if (mode === 'swap') {
    const candidates = swapCandidates(lineup, player);

    return (
      <div className="ptpm-overlay" onClick={onClose}>
        <div className="ptpm-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ptpm-header">
            <h3>Swap {player.name}</h3>
            <button type="button" className="ptpm-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
          <p className="ptpm-hint">Choose a player to swap positions with.</p>
          <div className="ptpm-swap-list">
            {candidates.map((candidate) => (
              <button
                type="button"
                key={playerId(candidate)}
                className="ptpm-swap-row"
                onClick={() => onSwapWith(candidate)}
              >
                <JerseyIcon size={36} {...kitColors(getTeamCode(candidate), candidate.position)} />
                <div className="ptpm-swap-info">
                  <span className="ptpm-swap-name">{candidate.name}</span>
                  <span className="ptpm-swap-meta">
                    {candidate.position} · {playerLocation(lineup, candidate)}
                  </span>
                  <span className="ptpm-swap-fixture">
                    {formatPitchFixture(candidate, matches, currentGameweek)}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <button type="button" className="ptpm-btn ptpm-btn-secondary" onClick={onBackToActions}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ptpm-overlay" onClick={onClose}>
      <div className="ptpm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ptpm-header">
          <h3>Player actions</h3>
          <button type="button" className="ptpm-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="ptpm-player">
          <JerseyIcon size={56} {...kitColors(getTeamCode(player), player.position)} />
          <div className="ptpm-player-text">
            <span className="ptpm-name">{player.name}</span>
            <span className="ptpm-meta">
              {player.team?.name || '—'} · {player.position} · {location}
            </span>
            <span className="ptpm-fixture">
              {formatPitchFixture(player, matches, currentGameweek)}
            </span>
            <div className="ptpm-stats-grid">
              <div className="ptpm-stat-tile">
                <span className="ptpm-stat-tile__label">Total points</span>
                <span className="ptpm-stat-tile__value">{displayTotalPoints(player.totalPoints)}</span>
              </div>
              <div className="ptpm-stat-tile">
                <span className="ptpm-stat-tile__label">Selected by</span>
                <span className="ptpm-stat-tile__value">{displaySelectionPercentage(player.selectionPercentage)}%</span>
              </div>
              <div className="ptpm-stat-tile">
                <span className="ptpm-stat-tile__label">Price</span>
                <span className="ptpm-stat-tile__value">{(player.fantasyPrice || 0).toFixed(1)}m</span>
              </div>
              <div className="ptpm-stat-tile">
                <span className="ptpm-stat-tile__label">Club</span>
                <span className="ptpm-stat-tile__value">{player.team?.name || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="ptpm-actions">
          <button
            type="button"
            className="ptpm-btn ptpm-btn-primary"
            disabled={!isStarter}
            onClick={onMakeCaptain}
          >
            {isCaptain ? 'Remove captain' : 'Make captain'}
          </button>
          <button
            type="button"
            className="ptpm-btn ptpm-btn-primary"
            disabled={!isStarter || isCaptain}
            onClick={onMakeVice}
          >
            {isVice ? 'Remove vice-captain' : 'Make vice-captain'}
          </button>
          <button type="button" className="ptpm-btn ptpm-btn-swap" onClick={onStartSwap}>
            Swap player
          </button>
          <button type="button" className="ptpm-btn ptpm-btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>

        {!isStarter ? (
          <p className="ptpm-note">Captain and vice-captain must be in your starting 9.</p>
        ) : null}
      </div>
    </div>
  );
}
