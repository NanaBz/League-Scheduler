import React from 'react';
import PropTypes from 'prop-types';
import { showFixtureScores, shouldShowMatchPenalties } from '../utils/matchDisplayState';

/**
 * Desktop fixture matchup block: Home | Score/VS | Away
 * Used inside .match-row (5-column outer grid).
 */
export default function FixtureDesktopMatchup({ match, getTeamLogoClass }) {
  if (!match?.homeTeam || !match?.awayTeam) return null;

  const renderScore = () => {
    if (match.isVoided) {
      return <span><strong>VOID</strong></span>;
    }
    if (showFixtureScores(match)) {
      return (
        <div>
          <span><strong>{match.homeScore} - {match.awayScore}</strong></span>
          {shouldShowMatchPenalties(match) && (
            <div style={{ fontSize: '0.8em', color: '#666' }}>
              ({match.homePenalties} - {match.awayPenalties} pens)
            </div>
          )}
        </div>
      );
    }
    return <span>vs</span>;
  };

  return (
    <div className="fixture-matchup">
      <div className="fixture-home-team">
        <div className="team-info">
          {match.homeTeam.logo && (
            <img
              src={match.homeTeam.logo}
              alt={match.homeTeam.name}
              className={getTeamLogoClass(match.homeTeam.name)}
            />
          )}
          <strong>{match.homeTeam.name}</strong>
        </div>
      </div>
      <div className="fixture-matchup-score score-display">
        {renderScore()}
      </div>
      <div className="fixture-away-team">
        <div className="team-info">
          {match.awayTeam.logo && (
            <img
              src={match.awayTeam.logo}
              alt={match.awayTeam.name}
              className={getTeamLogoClass(match.awayTeam.name)}
            />
          )}
          <strong>{match.awayTeam.name}</strong>
        </div>
      </div>
    </div>
  );
}

FixtureDesktopMatchup.propTypes = {
  match: PropTypes.shape({
    homeTeam: PropTypes.object,
    awayTeam: PropTypes.object,
    isVoided: PropTypes.bool,
    homeScore: PropTypes.number,
    awayScore: PropTypes.number,
    homePenalties: PropTypes.number,
    awayPenalties: PropTypes.number,
  }).isRequired,
  getTeamLogoClass: PropTypes.func.isRequired,
};

export function FixtureDesktopTableHeader() {
  return (
    <div className="match-header">
      <div>Date</div>
      <div>Time</div>
      <div>Match</div>
      <div>Stage</div>
      <div>Status</div>
    </div>
  );
}
