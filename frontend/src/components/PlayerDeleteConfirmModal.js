import React from 'react';
import PropTypes from 'prop-types';
import './ValidationModal.css';
import './PlayerDeleteConfirmModal.css';

function StatRow({ label, value }) {
  return (
    <div className="player-delete-stat">
      <span className="player-delete-stat__label">{label}</span>
      <span className="player-delete-stat__value">{value}</span>
    </div>
  );
}

export default function PlayerDeleteConfirmModal({
  open,
  loading,
  error,
  preview,
  deleting,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const player = preview?.player;
  const totals = preview?.totals || {};
  const canPermanentDelete = preview?.canPermanentDelete === true;
  const fantasySquadReference = preview?.fantasySquadReference === true;

  const title = player?.name ? `Remove ${player.name}?` : 'Remove player?';

  return (
    <div className="vm-overlay" onClick={onCancel}>
      <div className="vm-modal player-delete-modal" onClick={(e) => e.stopPropagation()}>
        <div className={`vm-content vm-warning player-delete-modal__body`}>
          <div className="vm-icon" aria-hidden="true">⚠️</div>
          <h3 className="vm-title">{title}</h3>
          {player?.team?.name && (
            <p className="player-delete-modal__meta">
              {player.team.name}
              {player.position ? ` · ${player.position}` : ''}
              {player.number != null && player.number !== '' ? ` · #${player.number}` : ''}
            </p>
          )}

          {loading && <p className="vm-message">Loading player record…</p>}

          {error && !loading && (
            <p className="vm-message player-delete-modal__error">{error}</p>
          )}

          {preview && !loading && !error && (
            <>
              <p className="vm-message player-delete-modal__intro">
                Are you sure you want to remove <strong>{player.name}</strong>? This player has:
              </p>
              <div className="player-delete-stats" role="list">
                <StatRow label="Goals" value={totals.goals ?? 0} />
                <StatRow label="Assists" value={totals.assists ?? 0} />
                <StatRow label="Yellow cards" value={totals.yellowCards ?? 0} />
                <StatRow label="Red cards" value={totals.redCards ?? 0} />
                <StatRow label="Fantasy points" value={totals.fantasyPoints ?? 0} />
              </div>
              {canPermanentDelete ? (
                <p className="player-delete-modal__safe">
                  No stats, events, fantasy points, or fantasy squads reference this player — they can be
                  permanently removed from the database.
                </p>
              ) : (
                <p className="player-delete-modal__warn">
                  {fantasySquadReference
                    ? 'This player appears in at least one Fantasy squad or gameweek snapshot. Use Mark inactive — they will leave the transfer market but stay on existing squads until managers remove them.'
                    : 'This player has recorded data or Fantasy history. Use Mark inactive — they will be hidden from new Fantasy picks but existing squads and history stay intact.'}
                </p>
              )}
              {preview.player?.active === false ? (
                <p className="player-delete-modal__meta">This player is already marked inactive.</p>
              ) : null}
            </>
          )}
        </div>

        <div className="vm-actions vm-actions--multi">
          <button type="button" className="vm-btn vm-btn-secondary" onClick={onCancel} disabled={deleting}>
            Cancel
          </button>
          <button
            type="button"
            className="vm-btn vm-btn-warning"
            onClick={onConfirm}
            disabled={loading || deleting || !!error || !preview}
          >
            {deleting
              ? 'Removing…'
              : canPermanentDelete
                ? 'Permanently remove'
                : 'Mark inactive'}
          </button>
        </div>
      </div>
    </div>
  );
}

PlayerDeleteConfirmModal.propTypes = {
  open: PropTypes.bool.isRequired,
  loading: PropTypes.bool,
  error: PropTypes.string,
  preview: PropTypes.object,
  deleting: PropTypes.bool,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
