import React from 'react';
import { BarChart3, ChevronsDown } from 'lucide-react';
import { showFixtureScores } from '../../utils/matchDisplayState';
import { formatArchiveDate, getTeamLogoClass } from './archiveDisplayUtils';

function BracketMatch({ match }) {
  if (!match?.homeTeam || !match?.awayTeam) return null;
  return (
    <div className="bracket-match">
      <div className="bracket-team">
        <div className="team-info">
          {match.homeTeam.logo && (
            <img src={match.homeTeam.logo} alt={match.homeTeam.name} className={getTeamLogoClass(match.homeTeam.name)} />
          )}
          <span className="team-name">{match.homeTeam.name}</span>
        </div>
        {showFixtureScores(match) && <span className="team-score">{match.homeScore}</span>}
      </div>
      <div className="bracket-vs">vs</div>
      <div className="bracket-team">
        <div className="team-info">
          {match.awayTeam.logo && (
            <img src={match.awayTeam.logo} alt={match.awayTeam.name} className={getTeamLogoClass(match.awayTeam.name)} />
          )}
          <span className="team-name">{match.awayTeam.name}</span>
        </div>
        {showFixtureScores(match) && <span className="team-score">{match.awayScore}</span>}
      </div>
      <div className="match-info">
        <small>{formatArchiveDate(match.date)}{match.time ? ` at ${match.time}` : ''}</small>
      </div>
    </div>
  );
}

export default function ArchiveCupBracket({ semiFinals = [], finalMatch = null }) {
  const semis = semiFinals || [];
  const hasContent = semis.length > 0 || finalMatch;

  return (
    <div className="card archive-section" id="cup-bracket">
      <h2><BarChart3 size={18} /> Agha Cup Tournament</h2>
      {!hasContent ? (
        <p className="archive-empty-inline">No cup bracket recorded in this archive.</p>
      ) : (
        <div className="cup-bracket">
          <div className="bracket-round">
            <h3>Semi-Finals</h3>
            <div className="bracket-matches">
              {semis.length > 0 ? (
                semis.map((match) => <BracketMatch key={match._id} match={match} />)
              ) : (
                <p className="archive-empty-inline">No semi-finals recorded.</p>
              )}
            </div>
          </div>

          <div className="bracket-arrow"><ChevronsDown size={18} /></div>

          <div className="bracket-round">
            <h3>Final</h3>
            <div className="bracket-matches">
              {finalMatch ? (
                <div className="final-match">
                  <BracketMatch match={finalMatch} />
                </div>
              ) : (
                <div className="bracket-match final-match placeholder">
                  <p className="archive-empty-inline">Final not recorded in this archive.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
