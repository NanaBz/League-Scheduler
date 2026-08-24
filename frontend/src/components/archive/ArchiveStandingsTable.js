import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { archivedTeamPath } from '../../utils/archiveTeamModel';
import { getTeamLogoClass, renderForm } from './archiveDisplayUtils';

function LeagueLegend() {
  return (
    <div
      className="table-legend"
      style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.9rem', flexWrap: 'wrap' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div
          style={{
            width: '20px',
            height: '15px',
            backgroundColor: 'rgba(40, 167, 69, 0.2)',
            border: '1px solid #28a745',
            borderRadius: '3px',
          }}
        />
        <span>Agha Cup Qualification (Top 4)</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div
          style={{
            width: '20px',
            height: '15px',
            backgroundColor: 'rgba(220, 53, 69, 0.2)',
            border: '1px solid #dc3545',
            borderRadius: '3px',
          }}
        />
        <span>Miss Agha Cup (Bottom 2)</span>
      </div>
    </div>
  );
}

function TeamNameLink({ team, seasonNumber }) {
  const nameEl = <strong>{team.name}</strong>;
  if (!seasonNumber || !team._id) return nameEl;
  return (
    <Link to={archivedTeamPath(seasonNumber, team._id)} className="archive-standings-team-link">
      {nameEl}
    </Link>
  );
}

export default function ArchiveStandingsTable({
  standings,
  variant = 'league',
  title,
  seasonNumber = null,
}) {
  const rows = (standings || []).slice().sort((a, b) => (a.position || 99) - (b.position || 99));
  const heading = title || (variant === 'acwpl' ? 'ACWPL Table' : 'League Table');

  if (rows.length === 0) {
    return (
      <div className="card archive-section">
        <h2><BarChart3 size={18} /> {heading}</h2>
        <p className="archive-empty-inline">No standings recorded in this archive.</p>
      </div>
    );
  }

  return (
    <div className="card archive-section" id="standings">
      <h2><BarChart3 size={18} /> {heading}</h2>
      {variant === 'league' && <LeagueLegend />}

      <div className="desktop-only">
        <table className="table">
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
            {rows.map((team, index) => {
              const position = team.position || index + 1;
              let rowClass = '';
              if (variant === 'league') {
                if (position <= 4) rowClass = 'champions-league-qualification';
                else if (position >= 5) rowClass = 'relegation-zone';
              } else if (variant === 'acwpl') {
                if (index === 0) rowClass = 'champions-league-qualification';
              }
              return (
                <tr
                  key={team._id || team.name}
                  className={rowClass}
                  style={
                    variant === 'acwpl' && index === 1
                      ? { background: '#fef2f2' }
                      : undefined
                  }
                >
                  <td>{position}</td>
                  <td>
                    <div className="team-info">
                      {team.logo && (
                        <img src={team.logo} alt={team.name} className={getTeamLogoClass(team.name)} />
                      )}
                      <TeamNameLink team={team} seasonNumber={seasonNumber} />
                    </div>
                  </td>
                  <td>{team.played}</td>
                  <td>{team.won}</td>
                  <td>{team.drawn}</td>
                  <td>{team.lost}</td>
                  <td>{team.goalsFor}</td>
                  <td>{team.goalsAgainst}</td>
                  <td>{team.goalDifference > 0 ? '+' : ''}{team.goalDifference}</td>
                  <td><strong>{team.points}</strong></td>
                  <td>{renderForm(team.form)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mobile-only">
        <div className="league-cards">
          {rows.map((team, index) => {
            const position = team.position || index + 1;
            let cardClass = 'league-card';
            let cardStyle = {};
            if (variant === 'league') {
              if (position <= 4) cardClass += ' qualified';
              else if (position >= 5) cardClass += ' not-qualified';
            } else if (variant === 'acwpl') {
              cardStyle =
                index === 0
                  ? { border: '2.5px solid #22c55e', boxShadow: '0 0 0 2px #bbf7d0', background: '#f0fdf4' }
                  : index === 1
                  ? { border: '2.5px solid #dc2626', boxShadow: '0 0 0 2px #fee2e2', background: '#fef2f2' }
                  : {};
            }
            return (
              <div key={team._id || team.name} className={cardClass} style={cardStyle}>
                <div className="league-card-header">
                  <div
                    className="position-badge"
                    style={
                      variant === 'acwpl'
                        ? { background: index === 0 ? '#22c55e' : '#dc2626', color: '#fff', fontWeight: 700 }
                        : undefined
                    }
                  >
                    {position}
                  </div>
                  <div className="team-info">
                    {team.logo && (
                      <img src={team.logo} alt={team.name} className={getTeamLogoClass(team.name)} />
                    )}
                    <div className="team-details">
                      <h3>
                        <TeamNameLink team={team} seasonNumber={seasonNumber} />
                      </h3>
                    </div>
                  </div>
                  <div className="points-display">
                    <div className="points">{team.points}</div>
                    <div className="points-label">PTS</div>
                  </div>
                </div>
                <div className="league-card-stats">
                  <div className="stat-group">
                    <div className="stat-item"><span className="stat-label">P</span><span className="stat-value">{team.played}</span></div>
                    <div className="stat-item"><span className="stat-label">W</span><span className="stat-value">{team.won}</span></div>
                    <div className="stat-item"><span className="stat-label">D</span><span className="stat-value">{team.drawn}</span></div>
                    <div className="stat-item"><span className="stat-label">L</span><span className="stat-value">{team.lost}</span></div>
                  </div>
                  <div className="stat-group">
                    <div className="stat-item"><span className="stat-label">GF</span><span className="stat-value">{team.goalsFor}</span></div>
                    <div className="stat-item"><span className="stat-label">GA</span><span className="stat-value">{team.goalsAgainst}</span></div>
                    <div className="stat-item"><span className="stat-label">GD</span><span className="stat-value">{team.goalDifference > 0 ? '+' : ''}{team.goalDifference}</span></div>
                    <div className="stat-item"><span className="stat-label">Form</span><span className="stat-value form-display">{renderForm((team.form || []).slice(0, 3))}</span></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
