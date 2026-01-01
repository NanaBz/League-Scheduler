import React from 'react';
import './PlayerDetailsModal.css';

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
              {player.team?.name} • {player.position} • {(player.fantasyPrice || 0).toFixed(1)}m
            </div>
          </div>

          <div className="pdm-stats">
            <div className="pdm-stat-item">
              <div className="pdm-stat-label">Total Points</div>
              <div className="pdm-stat-value">{player.totalPoints || 0}</div>
            </div>
            <div className="pdm-stat-item">
              <div className="pdm-stat-label">Selection</div>
              <div className="pdm-stat-value">{(player.selectionPercentage || 0).toFixed(1)}%</div>
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
