import React from 'react';
import { Calendar, Star } from 'lucide-react';
import ArchivedTeamAvatar from './ArchivedTeamAvatar';
import { resolveMatchSide, normalizeLogoUrl, defaultLogoForName, getTeamLogoClass } from './teamArchiveModel';
import { archiveFixturePhase, statusBadgeClass, statusBadgeLabel, shouldShowMatchPenalties } from '../utils/matchDisplayState';

export default function ArchiveFixtureCard({ match, teamByIdMap, formatDate, variant = 'league' }) {
  const home = resolveMatchSide(match, 'home', teamByIdMap);
  const away = resolveMatchSide(match, 'away', teamByIdMap);
  const homeLogo = normalizeLogoUrl(home.logo) || defaultLogoForName(home.name);
  const awayLogo = normalizeLogoUrl(away.logo) || defaultLogoForName(away.name);
  const voided = Boolean(match.isVoided);
  const phase = voided ? 'void' : archiveFixturePhase(match);
  const played = phase === 'ft' && !voided;
  const showCupHeader = variant === 'cup' || variant === 'super-cup';
  const isSuperCup = variant === 'super-cup';

  const dateBlock = showCupHeader ? (
    <div
      className="fixture-datetime"
      style={{
        background: '#dc2626',
        border: '2px solid #dc2626',
        borderRadius: 14,
        padding: '1.5px 8px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minWidth: 0,
      }}
    >
      <Calendar size={14} style={{ color: '#fff', flexShrink: 0 }} />
      <span className="fixture-date" style={{ fontSize: '0.82rem', fontWeight: 400, color: '#fff' }}>
        {formatDate(match.date)}
      </span>
      <span className="fixture-time" style={{ fontSize: '0.82rem', fontWeight: 400, color: '#fff' }}>
        {match.time}
      </span>
    </div>
  ) : (
    <div
      className="fixture-datetime"
      style={{
        background: '#dc2626',
        border: '2px solid #dc2626',
        borderRadius: 14,
        padding: '1.5px 8px',
        display: 'inline-block',
        minWidth: 0,
      }}
    >
      <span className="fixture-date" style={{ fontSize: '0.82rem', fontWeight: 400, color: '#fff', letterSpacing: '0.2px' }}>
        {formatDate(match.date)}
      </span>
      <span className="fixture-time" style={{ fontSize: '0.82rem', fontWeight: 400, color: '#fff', marginLeft: 6 }}>
        {match.time}
      </span>
    </div>
  );

  const cardClass = [
    'fixture-card',
    'archived',
    variant === 'cup' || variant === 'super-cup' ? 'cup-archive' : '',
    isSuperCup ? 'super-cup' : '',
    voided ? 'scheduled' : played ? 'played' : 'scheduled',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cardClass}>
      <div className="fixture-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {dateBlock}
        <div className="fixture-status" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isSuperCup && (
            <span className="super-cup-chip">
              <Star size={12} /> Super Cup
            </span>
          )}
          <span className={statusBadgeClass(phase)}>
            {statusBadgeLabel(phase)}
          </span>
        </div>
      </div>

      <div className="fixture-teams arc-fixture-teams">
        <div className="team-section home">
          <div className="team-info">
            <ArchivedTeamAvatar name={home.name} logoUrl={homeLogo} logoClass={getTeamLogoClass(home.name)} />
            <span className="team-name">{home.name}</span>
          </div>
        </div>

        <div className="vs-section">
          {voided ? (
            <div className="vs-display">VOID</div>
          ) : played ? (
            <div className="final-score">
              <span className="score-display">
                {match.homeScore} - {match.awayScore}
              </span>
              {shouldShowMatchPenalties(match) && (
                  <div className="penalties-display-mobile" style={{ fontSize: '0.85em', color: '#666', marginTop: 2 }}>
                    ({match.homePenalties} - {match.awayPenalties} pens)
                  </div>
                )}
            </div>
          ) : (
            <div className="vs-display">VS</div>
          )}
        </div>

        <div className="team-section away">
          <div className="team-info">
            <ArchivedTeamAvatar name={away.name} logoUrl={awayLogo} logoClass={getTeamLogoClass(away.name)} />
            <span className="team-name">{away.name}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
