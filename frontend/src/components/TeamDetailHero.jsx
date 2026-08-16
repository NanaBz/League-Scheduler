import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { teamHeroTheme } from '../utils/teamBrandColors';

/**
 * Top “hero” strip for team detail: brand gradient, circular back control, crest, name.
 */
export default function TeamDetailHero({ team, onBack, subtitle, backLabel = 'Back to teams' }) {
  const theme = teamHeroTheme(team?.name);
  const falconsPad = team?.name === 'Falcons';

  return (
    <div
      className={`team-hero-card${falconsPad ? ' team-hero-card--tone-light' : ''}`}
      style={{ background: theme.background, color: theme.color }}
    >
      <div className="team-hero-card__sheen" aria-hidden />
      <button
        type="button"
        className="team-hero-back"
        onClick={onBack}
        style={{ background: theme.backBtnBg }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = theme.backBtnHoverBg;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = theme.backBtnBg;
        }}
        aria-label={backLabel}
      >
        <ArrowLeft size={28} strokeWidth={2.75} aria-hidden />
      </button>

      <div className="team-hero-main">
        {team.logo && (
          <div
            className="team-hero-logo-wrap"
            style={{
              background: theme.logoWrapBg,
              border: `1px solid ${theme.logoBorder}`,
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            }}
          >
            <img
              src={team.logo}
              alt={team.name}
              style={{
                backgroundColor: falconsPad ? '#94a3b8' : 'transparent',
                padding: falconsPad ? 4 : 0,
                borderRadius: falconsPad ? 8 : 0,
              }}
            />
          </div>
        )}
        <div className="team-hero-text">
          <h2 className="team-hero-name">{team.name}</h2>
          {subtitle ? (
            <p className="team-hero-tagline" style={{ color: theme.mutedColor }}>
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
