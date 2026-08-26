import React from 'react';
import { Crown, Shield, Target, Share2, Users } from 'lucide-react';
import { teamProfileAccent } from '../utils/teamBrandColors';

const POSITION_LABELS = {
  GK: 'Goalkeepers',
  DF: 'Defenders',
  MF: 'Midfielders',
  ATT: 'Attackers',
};

function HighlightTile({ icon: Icon, label, primary, secondary, empty = 'Not assigned' }) {
  return (
    <div className="team-highlight-tile">
      <div className="team-highlight-tile__icon" aria-hidden="true">
        <Icon size={18} />
      </div>
      <div className="team-highlight-tile__content">
        <span className="team-highlight-tile__label">{label}</span>
        <span className="team-highlight-tile__primary">{primary || empty}</span>
        {secondary ? <span className="team-highlight-tile__secondary">{secondary}</span> : null}
      </div>
    </div>
  );
}

function PlayerBadge({ type }) {
  if (type === 'captain') {
    return <span className="team-player-badge team-player-badge--captain">Captain</span>;
  }
  if (type === 'vice') {
    return <span className="team-player-badge team-player-badge--vice">Vice</span>;
  }
  return null;
}

/**
 * Shared profile body below TeamDetailHero — boys & girls teams.
 * Presentation only; all data passed from parent pages.
 */
export default function TeamDetailBody({
  team,
  loading,
  error,
  captain,
  viceCaptain,
  topScorer,
  topAssister,
  grouped,
  variant = 'boys',
}) {
  const profileAccent = teamProfileAccent(team?.name);
  const totalPlayers = ['GK', 'DF', 'MF', 'ATT'].reduce(
    (sum, pos) => sum + (grouped[pos]?.length || 0),
    0
  );

  return (
    <div
      className={`team-detail-body team-detail-body--${variant}${team?.name === 'Falcons' ? ' team-detail-body--falcons' : ''}`}
      style={{
        '--team-accent': profileAccent.accent,
        '--team-accent-muted': profileAccent.accentMuted,
        '--team-border-accent': profileAccent.borderAccent,
      }}
    >
      {loading && <div className="loading-inline">Loading squad…</div>}
      {error && <div className="error-inline">{error}</div>}

      {!loading && !error && (
        <div className="team-profile-layout">
          <section className="team-profile-panel team-profile-panel--highlights" aria-labelledby="team-highlights-heading">
            <h3 id="team-highlights-heading" className="team-profile-heading">
              <Users size={18} aria-hidden="true" />
              Squad highlights
            </h3>
            <div className="team-highlight-grid">
              <HighlightTile
                icon={Crown}
                label="Captain"
                primary={captain?.name}
              />
              <HighlightTile
                icon={Shield}
                label="Vice captain"
                primary={viceCaptain?.name}
              />
              <HighlightTile
                icon={Target}
                label="Top scorer"
                primary={topScorer?.player?.name}
                secondary={topScorer ? `${topScorer.goals || 0} goals` : null}
              />
              <HighlightTile
                icon={Share2}
                label="Top assister"
                primary={topAssister?.player?.name}
                secondary={topAssister ? `${topAssister.assists || 0} assists` : null}
              />
            </div>
          </section>

          {team?.staff?.length > 0 && (
            <section className="team-profile-panel team-profile-panel--staff" aria-labelledby="team-staff-heading">
              <h3 id="team-staff-heading" className="team-profile-heading">Coaching staff</h3>
              <ul className="team-staff-list">
                {team.staff.map((member, idx) => (
                  <li key={idx} className="team-staff-item">
                    <span className="team-staff-name">{member.name}</span>
                    <span className="team-staff-role">{member.role}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section
            className="team-profile-panel team-profile-panel--squad"
            aria-labelledby="team-squad-heading"
          >
            <div className="team-squad-header">
              <h3 id="team-squad-heading" className="team-profile-heading">Squad</h3>
              <span className="team-squad-count">{totalPlayers} players</span>
            </div>

            {totalPlayers === 0 ? (
              <p className="team-profile-empty">No players registered for this team yet.</p>
            ) : (
              <div className="squad-groups">
                {['GK', 'DF', 'MF', 'ATT'].map((pos) => {
                  const players = grouped[pos] || [];
                  if (players.length === 0) return null;
                  return (
                    <div key={pos} className={`squad-group squad-${pos}`}>
                      <div className="group-title">
                        <span className="group-title__code">{pos}</span>
                        <span className="group-title__label">{POSITION_LABELS[pos]}</span>
                        <span className="group-title__count">{players.length}</span>
                      </div>
                      <ul className="squad-player-list">
                        {players.map((p) => (
                          <li key={p._id} className="player-row">
                            <div className="player-row__main">
                              <span className="shirt-number">{p.number ?? '–'}</span>
                              <span className="player-name">{p.name}</span>
                            </div>
                            <div className="player-row__badges">
                              {p.isCaptain && <PlayerBadge type="captain" />}
                              {p.isViceCaptain && <PlayerBadge type="vice" />}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
