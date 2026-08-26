import React from 'react';
import { Award, BarChart3, ChevronsDown, Trophy } from 'lucide-react';
import {
  showFixtureScores,
  shouldShowMatchPenalties,
  statusBadgeClass,
  statusBadgeLabel,
  userFixturePhase,
} from '../../utils/matchDisplayState';
import { formatArchiveDate, getTeamLogoClass } from './archiveDisplayUtils';

function aghaCupTeamIsWinner(match, side) {
  if (!match || !showFixtureScores(match)) return false;
  const h = Number(match.homeScore);
  const a = Number(match.awayScore);
  if (Number.isFinite(h) && Number.isFinite(a) && h !== a) {
    return side === 'home' ? h > a : a > h;
  }
  if (shouldShowMatchPenalties(match)) {
    const hp = Number(match.homePenalties);
    const ap = Number(match.awayPenalties);
    if (Number.isFinite(hp) && Number.isFinite(ap) && hp !== ap) {
      return side === 'home' ? hp > ap : ap > hp;
    }
  }
  return false;
}

function BracketMatch({ match, label, isFinal }) {
  if (!match?.homeTeam || !match?.awayTeam) return null;
  const phase = userFixturePhase(match);
  return (
    <div className={`agha-cup-match agha-cup-match--${phase}${isFinal ? ' agha-cup-match--final' : ''}`}>
      <div className="agha-cup-match-meta">
        {label ? <span className="agha-cup-match-label">{label}</span> : <span />}
        <span className={statusBadgeClass(phase)}>{statusBadgeLabel(phase)}</span>
      </div>
      <div className="agha-cup-teams">
        <div className={`agha-cup-team${aghaCupTeamIsWinner(match, 'home') ? ' agha-cup-team--winner' : ''}`}>
          <div className="agha-cup-team-main">
            {match.homeTeam.logo && (
              <img src={match.homeTeam.logo} alt={match.homeTeam.name} className={getTeamLogoClass(match.homeTeam.name)} />
            )}
            <span className="agha-cup-team-name">{match.homeTeam.name}</span>
          </div>
          {showFixtureScores(match) && <span className="agha-cup-team-score">{match.homeScore}</span>}
        </div>
        <div className="agha-cup-vs" aria-hidden="true">vs</div>
        <div className={`agha-cup-team${aghaCupTeamIsWinner(match, 'away') ? ' agha-cup-team--winner' : ''}`}>
          <div className="agha-cup-team-main">
            {match.awayTeam.logo && (
              <img src={match.awayTeam.logo} alt={match.awayTeam.name} className={getTeamLogoClass(match.awayTeam.name)} />
            )}
            <span className="agha-cup-team-name">{match.awayTeam.name}</span>
          </div>
          {showFixtureScores(match) && <span className="agha-cup-team-score">{match.awayScore}</span>}
        </div>
      </div>
      <div className="agha-cup-match-info">
        <small>{formatArchiveDate(match.date)}{match.time ? ` at ${match.time}` : ''}</small>
        {shouldShowMatchPenalties(match) && (
          <span className="agha-cup-pens">
            ({match.homePenalties} - {match.awayPenalties} pens)
          </span>
        )}
      </div>
    </div>
  );
}

export default function ArchiveCupBracket({ semiFinals = [], finalMatch = null }) {
  const semis = semiFinals || [];
  const hasContent = semis.length > 0 || finalMatch;

  return (
    <div className="card archive-section" id="cup-bracket">
      <div className="agha-cup-bracket-header">
        <h2><BarChart3 size={18} /> Agha Cup Tournament</h2>
        <p className="agha-cup-bracket-sub">Historical school cup · Semi-Finals → Final</p>
      </div>
      {!hasContent ? (
        <p className="archive-empty-inline">No cup bracket recorded in this archive.</p>
      ) : (
        <div className="agha-cup-bracket">
          <section className="agha-cup-round agha-cup-round--semis" aria-label="Semi-Finals">
            <h3 className="agha-cup-round-title">
              <span className="agha-cup-round-icon" aria-hidden="true"><Award size={16} /></span>
              Semi-Finals
            </h3>
            <div className="agha-cup-semis-grid">
              {semis.length > 0 ? (
                semis.map((match, idx) => (
                  <BracketMatch key={match._id} match={match} label={`Semi-Final ${idx + 1}`} />
                ))
              ) : (
                <p className="archive-empty-inline">No semi-finals recorded.</p>
              )}
            </div>
          </section>

          <div className="agha-cup-connector" aria-hidden="true">
            <div className="agha-cup-connector-line" />
            <ChevronsDown size={20} />
            <span className="agha-cup-connector-label">Final</span>
            <div className="agha-cup-connector-line" />
          </div>

          <section className="agha-cup-round agha-cup-round--final" aria-label="Final">
            <h3 className="agha-cup-round-title">
              <span className="agha-cup-round-icon" aria-hidden="true"><Trophy size={16} /></span>
              Final
            </h3>
            {finalMatch ? (
              <BracketMatch match={finalMatch} label="Agha Cup Final" isFinal />
            ) : (
              <div className="agha-cup-match agha-cup-match--placeholder agha-cup-match--final">
                <p className="archive-empty-inline">Final not recorded in this archive.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
