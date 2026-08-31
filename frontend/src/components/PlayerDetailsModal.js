import React from 'react';
import { displaySelectionPercentage, displayTotalPoints } from '../utils/fantasyPlayerStatsDisplay';
import { acityPriceAriaLabel, formatAcityPrice } from '../utils/formatAcityPrice';
import './PlayerDetailsModal.css';

function roundPriceDisplay(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

export default function PlayerDetailsModal({ player, onReplace, onRemove, onClose }) {
  if (!player) return null;

  const hasPastGames = player.pastThree && player.pastThree.length > 0;

  return (
    <div className="pdm-overlay" onClick={onClose}>
      <div className="pdm-modal" onClick={e => e.stopPropagation()}>
        <div className="pdm-header">
          <h3>Player Details</h3>
          <button className="pdm-close" onClick={onClose}>×</button>
        </div>

        <div className="pdm-body">
          <div className="pdm-player-info">
            <div className="pdm-name">{player.name}</div>
            <div className="pdm-meta">
              {player.team?.name} • {player.position}
            </div>
            <div className="pdm-prices">
              <div className="pdm-price-row">
                <span className="pdm-price-label">Current Price</span>
                <span className="pdm-price-value" aria-label={acityPriceAriaLabel(player.fantasyPrice)}>
                  {formatAcityPrice(player.fantasyPrice)}
                </span>
              </div>
              {player.purchasePrice != null &&
              roundPriceDisplay(player.purchasePrice) !== roundPriceDisplay(player.fantasyPrice) ? (
                <div className="pdm-price-row pdm-price-row--purchase">
                  <span className="pdm-price-label">Bought for</span>
                  <span className="pdm-price-value" aria-label={acityPriceAriaLabel(player.purchasePrice)}>
                    {formatAcityPrice(player.purchasePrice)}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="pdm-stats">
            <div className="pdm-stat-item">
              <div className="pdm-stat-label">Total Points</div>
              <div className="pdm-stat-value">{displayTotalPoints(player.totalPoints)}</div>
            </div>
            <div className="pdm-stat-item">
              <div className="pdm-stat-label">Selection</div>
              <div className="pdm-stat-value">{displaySelectionPercentage(player.selectionPercentage)}%</div>
            </div>
          </div>

          {hasPastGames && (
            <div className="pdm-past-games">
              <h4>Past Games</h4>
              {player.pastThree.map((game, idx) => (
                <div key={idx} className="pdm-game-row">
                  <div className="pdm-game-gw">GW{game.matchweek || '?'}</div>
                  <div className="pdm-game-opponent">vs {game.opponent}</div>
                  <div className="pdm-game-points">{game.points || 0} pts</div>
                </div>
              ))}
            </div>
          )}

          <div className="pdm-upcoming">
            <h4>Upcoming Fixtures</h4>
            {player.nextThree && player.nextThree.length > 0 ? (
              player.nextThree.map((fixture, idx) => (
                <div key={idx} className="pdm-fixture-pill">
                  GW{fixture.matchweek || '?'}: {fixture.opponent || 'TBD'}
                </div>
              ))
            ) : (
              <div className="pdm-empty">No upcoming fixtures</div>
            )}
          </div>
        </div>

        <div className="pdm-actions">
          <button className="pdm-btn pdm-btn-replace" onClick={onReplace}>
            Replace Player
          </button>
          <button className="pdm-btn pdm-btn-remove" onClick={onRemove}>
            Remove Player
          </button>
        </div>
      </div>
    </div>
  );
}
