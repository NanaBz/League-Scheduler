import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import './PlayerDetailModal.css';
import JerseyIcon from './JerseyIcon';

export default function PlayerDetailModal({
  player,
  isStarting,
  captainId,
  viceCaptainId,
  substitutes = [],
  onSelectSubstitute,
  onClose,
  onConfirmRoles,
  getTeamCode,
  kitColors
}) {
  const [showSubstitutes, setShowSubstitutes] = useState(false);
  const [localCaptain, setLocalCaptain] = useState(captainId || null);
  const [localViceCaptain, setLocalViceCaptain] = useState(viceCaptainId || null);

  const playerId = player?._id || player?.id;

  useEffect(() => {
    setLocalCaptain(captainId || null);
    setLocalViceCaptain(viceCaptainId || null);
  }, [captainId, viceCaptainId, playerId]);

  if (!player) return null;

  // Get opponent short code
  const getOpponentShort = () => {
    if (!player.upcoming || player.upcoming.length === 0) return '-';
    const nextMatch = player.upcoming[0];
    const opponent = nextMatch.side === 'home' ? nextMatch.away : nextMatch.home;
    return opponent?.short || opponent?.name?.substring(0, 3).toUpperCase() || '-';
  };

  // Get form (last 3 games)
  const getForm = () => {
    if (!player.past || player.past.length === 0) return ['-', '-', '-'];
    const form = player.past.slice(0, 3).map(game => {
      if (game.played) {
        if (game.goals > 0) return 'G';
        if (game.assists > 0) return 'A';
        return 'P';
      }
      return '-';
    });
    while (form.length < 3) form.unshift('-');
    return form;
  };

  // Get next fixtures (up to 3)
  const getFixtures = () => {
    if (!player.upcoming) return [];
    return player.upcoming.slice(0, 3);
  };

  const form = getForm();
  const fixtures = getFixtures();
  const opponent = getOpponentShort();

  const handleCaptainToggle = () => {
    if (!isStarting) return;
    if (localCaptain === playerId) {
      // If removing captain, don't set to null - let confirm logic handle auto-assign
      setLocalCaptain(null);
    } else {
      // Assigning this player as captain
      // If this player is vice captain, swap: vice becomes captain
      setLocalCaptain(playerId);
      if (localViceCaptain === playerId) {
        setLocalViceCaptain(null); // Will be auto-assigned on confirm
      }
    }
  };

  const handleViceCaptainToggle = () => {
    if (!isStarting) return;
    if (localViceCaptain === playerId) {
      // If removing vice captain, don't set to null - let confirm logic handle auto-assign
      setLocalViceCaptain(null);
    } else {
      // Assigning this player as vice captain
      // If this player is captain, swap: captain becomes vice captain
      setLocalViceCaptain(playerId);
      if (localCaptain === playerId) {
        setLocalCaptain(null); // Will be auto-assigned on confirm
      }
    }
  };

  const handleConfirm = () => {
    if (onConfirmRoles) {
      onConfirmRoles({ captainId: localCaptain, viceCaptainId: localViceCaptain });
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-actions">
          <button className="action-btn action-cancel" onClick={onClose}>Cancel</button>
          <div className="modal-title">Pick Team</div>
          <button className="action-btn action-confirm" onClick={handleConfirm}>Confirm</button>
        </div>

        <button className="modal-close" onClick={onClose}>
          <X size={24} />
        </button>

        {/* Player Profile */}
        <div className="player-profile">
          <div className="profile-jersey">
            <JerseyIcon size={56} {...kitColors(getTeamCode(player), player.position)} />
          </div>
          <div className="profile-info">
            <div className="profile-name">{player.name}</div>
            <div className="profile-meta">
              <span className="profile-pos">{player.position}</span>
              <span className="profile-team">{player.team?.name || player.teamName}</span>
            </div>
            {opponent !== '-' && (
              <div className="profile-opponent">vs {opponent}</div>
            )}
          </div>
        </div>

        {/* Price & Selection % */}
        <div className="player-stats-row">
          <div className="stat-card">
            <div className="stat-label">Price</div>
            <div className="stat-value">${player.price}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Selected</div>
            <div className="stat-value">{player.selectionPercentage || 0}%</div>
          </div>
        </div>

        {/* Form & Fixtures */}
        <div className="form-fixtures">
          <div className="form-section">
            <div className="section-label">Form</div>
            <div className="form-display">
              {form.map((f, idx) => (
                <span key={idx} className={`form-badge ${f === '-' ? 'none' : f.toLowerCase()}`}>
                  {f}
                </span>
              ))}
            </div>
          </div>

          <div className="fixtures-section">
            <div className="section-label">Next 3</div>
            <div className="fixtures-display">
              {fixtures.length > 0 ? (
                fixtures.map((fixture, idx) => {
                  const opp = fixture.side === 'home' ? fixture.away : fixture.home;
                  const oppShort = opp?.short || opp?.name?.substring(0, 3).toUpperCase() || '-';
                  return (
                    <span key={idx} className="fixture-badge">
                      {oppShort}
                    </span>
                  );
                })
              ) : (
                <span className="fixture-badge none">-</span>
              )}
            </div>
          </div>
        </div>

        {/* Captain/VC Selection */}
        <div className="captain-selection">
          <label className="captain-checkbox">
            <input
              type="checkbox"
              checked={localCaptain === playerId}
              onChange={handleCaptainToggle}
              disabled={!isStarting}
            />
            <span>Make Captain</span>
          </label>
          <label className="vice-captain-checkbox">
            <input
              type="checkbox"
              checked={localViceCaptain === playerId}
              onChange={handleViceCaptainToggle}
              disabled={!isStarting}
            />
            <span>Make Vice-Captain</span>
          </label>
          {!isStarting && (
            <div className="captain-note">Only starting players can be set as captain or vice-captain.</div>
          )}
        </div>

        {/* Substitute Button */}
        <button
          className={`substitute-btn ${(!isStarting || substitutes.length === 0) ? 'disabled' : ''}`}
          onClick={() => {
            if (!isStarting || substitutes.length === 0) return;
            setShowSubstitutes(!showSubstitutes);
          }}
          disabled={!isStarting || substitutes.length === 0}
        >
          {showSubstitutes ? 'Close Substitutes' : 'Substitute'}
        </button>

        {/* Substitutes List */}
        {showSubstitutes && (
          <div className="substitutes-list">
            <div className="substitutes-label">Available Substitutes</div>
            {substitutes.length === 0 && (
              <div className="substitute-placeholder">No eligible substitutes</div>
            )}
            {substitutes.length > 0 && (
              <div className="substitutes-grid">
                {substitutes.map((sub) => (
                  <button
                    key={sub._id || sub.id}
                    className="substitute-card"
                    onClick={() => {
                      if (onSelectSubstitute) onSelectSubstitute(sub);
                      setShowSubstitutes(false);
                    }}
                  >
                    <div className="sub-card-top">
                      <JerseyIcon size={32} {...kitColors(getTeamCode(sub), sub.position)} />
                      <span className="sub-pos">{sub.position}</span>
                    </div>
                    <div className="sub-name">{sub.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
