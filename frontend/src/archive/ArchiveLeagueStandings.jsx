import React from 'react';
import { BarChart3 } from 'lucide-react';
import ArchivedTeamAvatar from './ArchivedTeamAvatar';
import {
  teamRefId,
  resolveTeamFromMap,
  normalizeLogoUrl,
  defaultLogoForName,
  getTeamLogoClass,
} from './teamArchiveModel';

export default function ArchiveLeagueStandings({ season, leagueStandingsRows, teamByIdMap }) {
  const resolveStanding = (standing) => {
    const r = resolveTeamFromMap(teamByIdMap, standing.team);
    if (r.name !== 'Unknown') return r;
    return { name: `Team ${standing.position}`, logo: null };
  };

  const getTeamDisplayName = (standing) => resolveStanding(standing).name;

  const getTeamLogo = (standing) => {
    const { name, logo } = resolveStanding(standing);
    return normalizeLogoUrl(logo) || defaultLogoForName(name);
  };

  return (
    <div className="table-container responsive-table archived-league-table-wrap">
      <div className="archived-league-table-head">
        <div className="archived-badge archived-badge-inline">
          <BarChart3 size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Archived Season {season.seasonNumber}
        </div>
      </div>

      <div className="mobile-league-cards">
        {leagueStandingsRows.map((standing, index) => {
          const teamName = getTeamDisplayName(standing);
          const teamLogo = getTeamLogo(standing);
          const qualified = !standing._synthetic && standing.position <= 2;
          const rowKey = teamRefId(standing.team) || `standing-${index}`;
          return (
            <div
              key={rowKey}
              className={`mobile-league-card ${qualified ? 'qualified' : 'not-qualified'}`}
            >
              <div className="league-card-header">
                <div className="position-badge">{standing.position}</div>
                <div className="team-info">
                  <ArchivedTeamAvatar name={teamName} logoUrl={teamLogo} logoClass={getTeamLogoClass(teamName)} />
                  <span className="team-name">{teamName}</span>
                </div>
                <div className="points-badge">{standing.points} PTS</div>
              </div>
              <div className="league-card-stats">
                <div className="stat-group">
                  <div className="stat">
                    <span className="stat-label">P</span>
                    <span className="stat-value">{standing.played}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">W</span>
                    <span className="stat-value">{standing.won}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">D</span>
                    <span className="stat-value">{standing.drawn}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">L</span>
                    <span className="stat-value">{standing.lost}</span>
                  </div>
                </div>
                <div className="stat-group">
                  <div className="stat">
                    <span className="stat-label">GF</span>
                    <span className="stat-value">{standing.goalsFor}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">GA</span>
                    <span className="stat-value">{standing.goalsAgainst}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">GD</span>
                    <span className={`stat-value ${standing.goalDifference >= 0 ? 'positive' : 'negative'}`}>
                      {standing.goalDifference >= 0 ? '+' : ''}
                      {standing.goalDifference}
                    </span>
                  </div>
                </div>
              </div>
              <div className="league-card-form">
                <span className="form-label">Form:</span>
                {standing.form && standing.form.length > 0 ? (
                  <div className="form-display">
                    {standing.form.map((result, idx) => (
                      <span
                        key={idx}
                        className={`form-result ${result.toLowerCase()}`}
                        title={result === 'W' ? 'Win' : result === 'D' ? 'Draw' : 'Loss'}
                      >
                        {result}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="no-form">-</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="table-wrapper">
        <table className="league-table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Team</th>
              <th>P</th>
              <th>W</th>
              <th>D</th>
              <th>L</th>
              <th>GF</th>
              <th>GA</th>
              <th>GD</th>
              <th>Pts</th>
              <th>Form</th>
            </tr>
          </thead>
          <tbody>
            {leagueStandingsRows.map((standing, index) => {
              const teamName = getTeamDisplayName(standing);
              const teamLogo = getTeamLogo(standing);
              const qualified = !standing._synthetic && standing.position <= 2;
              const rowKey = teamRefId(standing.team) || `standing-${index}`;
              return (
                <tr key={rowKey} className={qualified ? 'agha-cup-position' : ''}>
                  <td className="position">{standing.position}</td>
                  <td className="team-cell">
                    <div className="team-info">
                      <ArchivedTeamAvatar name={teamName} logoUrl={teamLogo} logoClass={getTeamLogoClass(teamName)} />
                      <span className="team-name">{teamName}</span>
                    </div>
                  </td>
                  <td>{standing.played}</td>
                  <td>{standing.won}</td>
                  <td>{standing.drawn}</td>
                  <td>{standing.lost}</td>
                  <td>{standing.goalsFor}</td>
                  <td>{standing.goalsAgainst}</td>
                  <td className={standing.goalDifference >= 0 ? 'positive' : 'negative'}>
                    {standing.goalDifference >= 0 ? '+' : ''}
                    {standing.goalDifference}
                  </td>
                  <td className="points">{standing.points}</td>
                  <td>
                    {standing.form && standing.form.length > 0 ? (
                      <div className="form-display">
                        {standing.form.map((result, idx) => (
                          <span
                            key={idx}
                            className={`form-result ${result.toLowerCase()}`}
                            title={result === 'W' ? 'Win' : result === 'D' ? 'Draw' : 'Loss'}
                          >
                            {result}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="no-form">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
