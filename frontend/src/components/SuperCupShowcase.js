import React from 'react';
import { Calendar, Clock, Star } from 'lucide-react';
import { getTeamLogoClass } from './archive/archiveDisplayUtils';

function getSuperCupRoles(match, originalDoubleWinnerId, archive) {
  const homeId = String(match.homeTeam._id || '');
  const awayId = String(match.awayTeam._id || '');
  const doubleId = originalDoubleWinnerId ? String(originalDoubleWinnerId) : null;

  const homeRole =
    doubleId && homeId === doubleId ? 'League Champion (Double Winner)' : 'League Champion';
  const awayRole = doubleId && awayId !== doubleId ? 'League Runner-up' : 'Cup Winner';

  let doubleNote = null;
  if (doubleId) {
    if (archive) {
      doubleNote =
        homeId === doubleId
          ? `${match.homeTeam.name} won both League and Cup. ${match.awayTeam.name} (League Runner-up) played as runner-up.`
          : `${match.awayTeam.name} won both League and Cup. ${match.homeTeam.name} (League Runner-up) played as runner-up.`;
    } else {
      doubleNote =
        homeId === doubleId
          ? `${match.homeTeam.name} won both League and Cup. ${match.awayTeam.name} (League Runner-up) plays as runner-up in Super Cup.`
          : `${match.awayTeam.name} won both League and Cup. ${match.homeTeam.name} (League Runner-up) plays as runner-up in Super Cup.`;
    }
  }

  return { homeRole, awayRole, doubleNote };
}

/**
 * Featured Super Cup header — teams, logos, roles. Scores live in Fixtures below.
 */
export default function SuperCupShowcase({
  match,
  formatDate,
  archive = false,
  className = '',
}) {
  if (!match?.homeTeam || !match?.awayTeam) return null;

  const { homeRole, awayRole, doubleNote } = getSuperCupRoles(
    match,
    match.originalDoubleWinnerId,
    archive
  );
  const rootClass = ['super-cup-showcase', archive ? 'super-cup-showcase--archive' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass}>
      <header className="super-cup-showcase__hero">
        <div className="super-cup-showcase__icon" aria-hidden="true">
          <Star size={26} strokeWidth={1.75} />
        </div>
        <div className="super-cup-showcase__hero-text">
          <p className="super-cup-showcase__eyebrow">Featured competition</p>
          <h2 className="super-cup-showcase__title">Super Cup</h2>
          <p className="super-cup-showcase__tagline">League Champion vs Cup Winner</p>
        </div>
      </header>

      {doubleNote && (
        <p className="super-cup-showcase__note">
          <strong>Note:</strong> {doubleNote}
        </p>
      )}

      <div className="super-cup-showcase__matchup">
        <article className="super-cup-showcase__team">
          <div className="super-cup-showcase__team-logo-wrap">
            {match.homeTeam.logo && (
              <img
                src={match.homeTeam.logo}
                alt=""
                className={getTeamLogoClass(match.homeTeam.name)}
              />
            )}
          </div>
          <div className="super-cup-showcase__team-copy">
            <h3 className="super-cup-showcase__team-name">{match.homeTeam.name}</h3>
            <p className="super-cup-showcase__team-role">{homeRole}</p>
          </div>
        </article>

        <div className="super-cup-showcase__vs" aria-hidden="true">VS</div>

        <article className="super-cup-showcase__team">
          <div className="super-cup-showcase__team-logo-wrap">
            {match.awayTeam.logo && (
              <img
                src={match.awayTeam.logo}
                alt=""
                className={getTeamLogoClass(match.awayTeam.name)}
              />
            )}
          </div>
          <div className="super-cup-showcase__team-copy">
            <h3 className="super-cup-showcase__team-name">{match.awayTeam.name}</h3>
            <p className="super-cup-showcase__team-role">{awayRole}</p>
          </div>
        </article>
      </div>

      {(match.date || match.time || match.matchweek) && (
        <footer className="super-cup-showcase__meta">
          {match.date && formatDate && (
            <span className="super-cup-showcase__meta-item">
              <Calendar size={14} aria-hidden="true" />
              {formatDate(match.date)}
            </span>
          )}
          {match.time && (
            <span className="super-cup-showcase__meta-item">
              <Clock size={14} aria-hidden="true" />
              {match.time}
            </span>
          )}
          {match.matchweek != null && match.matchweek !== '' && (
            <span className="super-cup-showcase__meta-item">
              Matchweek {match.matchweek}
            </span>
          )}
        </footer>
      )}
    </div>
  );
}
