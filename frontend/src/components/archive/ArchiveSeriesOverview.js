import React from 'react';
import { Trophy } from 'lucide-react';
import { getTeamColors } from '../../utils/teamBrandColors';
import { showFixtureScores } from '../../utils/matchDisplayState';
import { formatArchiveDate, getTeamLogoClass } from './archiveDisplayUtils';

export default function ArchiveSeriesOverview({
  fixtures = [],
  winsByTeam = [],
  winner,
  format = 'best-of-3',
  competitionLabel = 'Girls Super Cup',
}) {
  const playedGames = (fixtures || []).filter((m) => m.isPlayed);
  const formatLabel = format === 'best-of-5' ? 'Best of 5' : 'Best of 3';
  const winnerName = winner?.name;

  return (
    <div className="card archive-section">
      <h2><Trophy size={18} /> {competitionLabel} Series</h2>
      <p className="archive-series-format">{formatLabel} — showing games actually played</p>

      {winnerName && (
        <div
          className="banner archive-series-banner"
          style={{
            backgroundColor: getTeamColors(winnerName).primary,
            color: getTeamColors(winnerName).secondary,
            border: `3px solid ${getTeamColors(winnerName).secondary}`,
          }}
        >
          <Trophy size={18} /> {competitionLabel} Champions: {winnerName}
        </div>
      )}

      {winsByTeam.length > 0 && (
        <div className="archive-series-wins">
          <h3>Series wins</h3>
          <div className="archive-series-wins-grid">
            {winsByTeam
              .slice()
              .sort((a, b) => b.wins - a.wins)
              .map((row) => (
                <div key={row.teamId || row.teamName} className="archive-series-win-chip">
                  <strong>{row.teamName}</strong>
                  <span>{row.wins} win{row.wins === 1 ? '' : 's'}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="archive-series-rounds">
        {playedGames.length === 0 ? (
          <p className="archive-empty-inline">No games recorded in this archive.</p>
        ) : (
          playedGames.map((match) => (
            <div key={match._id} className="archive-series-round-card">
              <div className="archive-series-round-label">Round {match.matchweek || '—'}</div>
              <div className="archive-series-match">
                <div className="archive-series-side">
                  {match.homeTeam?.logo && (
                    <img src={match.homeTeam.logo} alt="" className={getTeamLogoClass(match.homeTeam.name)} />
                  )}
                  <span>{match.homeTeam?.name}</span>
                  {showFixtureScores(match) && <strong>{match.homeScore}</strong>}
                </div>
                <span className="archive-series-vs">vs</span>
                <div className="archive-series-side">
                  {match.awayTeam?.logo && (
                    <img src={match.awayTeam.logo} alt="" className={getTeamLogoClass(match.awayTeam.name)} />
                  )}
                  <span>{match.awayTeam?.name}</span>
                  {showFixtureScores(match) && <strong>{match.awayScore}</strong>}
                </div>
              </div>
              <div className="archive-series-meta">
                {formatArchiveDate(match.date)}{match.time ? ` · ${match.time}` : ''}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
