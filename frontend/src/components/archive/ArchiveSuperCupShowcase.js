import React from 'react';
import { Trophy } from 'lucide-react';
import { showFixtureScores } from '../../utils/matchDisplayState';
import { getTeamLogoClass } from './archiveDisplayUtils';

export default function ArchiveSuperCupShowcase({ match, originalDoubleWinnerId }) {
  if (!match?.homeTeam || !match?.awayTeam) {
    return (
      <div className="card archive-section">
        <p className="archive-empty-inline">No Super Cup final recorded in this archive.</p>
      </div>
    );
  }

  const homeId = String(match.homeTeam._id || '');
  const awayId = String(match.awayTeam._id || '');
  const doubleId = originalDoubleWinnerId ? String(originalDoubleWinnerId) : null;

  return (
    <div className="super-cup-responsive archive-section">
      <div className="super-cup-header-responsive">
        <div className="trophy-icon"><Trophy size={18} /></div>
        <h3>The Ultimate Showdown</h3>
        <p>League Champion vs Cup Winner</p>
        {doubleId && (
          <div className="archive-super-cup-note">
            Note:{' '}
            {homeId === doubleId
              ? `${match.homeTeam.name} won both League and Cup. ${match.awayTeam.name} (League Runner-up) played as runner-up.`
              : `${match.awayTeam.name} won both League and Cup. ${match.homeTeam.name} (League Runner-up) played as runner-up.`}
          </div>
        )}
      </div>
      <div className="super-cup-match-responsive">
        <div className="super-cup-team-responsive">
          {match.homeTeam.logo && (
            <img src={match.homeTeam.logo} alt={match.homeTeam.name} className={getTeamLogoClass(match.homeTeam.name)} />
          )}
          <h4>{match.homeTeam.name}</h4>
          <small>
            {doubleId && homeId === doubleId ? 'LEAGUE CHAMPION (Double Winner)' : 'LEAGUE CHAMPION'}
          </small>
          {showFixtureScores(match) && (
            <div className="super-cup-score-responsive">{match.homeScore}</div>
          )}
        </div>
        <div className="super-cup-vs-responsive">
          {showFixtureScores(match) && (
            <div className="match-result">
              {match.homeScore > match.awayScore
                ? `${match.homeTeam.name} Wins!`
                : match.awayScore > match.homeScore
                ? `${match.awayTeam.name} Wins!`
                : 'Draw!'}
            </div>
          )}
        </div>
        <div className="super-cup-team-responsive">
          {match.awayTeam.logo && (
            <img src={match.awayTeam.logo} alt={match.awayTeam.name} className={getTeamLogoClass(match.awayTeam.name)} />
          )}
          <h4>{match.awayTeam.name}</h4>
          <small>
            {doubleId && awayId !== doubleId ? 'LEAGUE RUNNER-UP' : 'CUP WINNER'}
          </small>
          {showFixtureScores(match) && (
            <div className="super-cup-score-responsive">{match.awayScore}</div>
          )}
        </div>
      </div>
    </div>
  );
}
