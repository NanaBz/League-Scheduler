import React, { useMemo, useState } from 'react';
import { Calendar } from 'lucide-react';
import FixtureFilterControl from '../FixtureFilterControl';
import FixtureDesktopMatchup, { FixtureDesktopTableHeader } from '../FixtureDesktopMatchup';
import {
  showFixtureScores,
  statusBadgeClass,
  statusBadgeLabel,
  userFixturePhase,
  fixtureCardClassName,
  desktopFixtureBadgeClass,
  desktopFixtureBadgeLabel,
} from '../../utils/matchDisplayState';
import { formatArchiveDate, formatArchiveStage, getTeamLogoClass } from './archiveDisplayUtils';

function defaultFilter(competitionId) {
  if (competitionId === 'league' || competitionId === 'acwpl' || competitionId === 'girls-super-cup') {
    return '1';
  }
  return '';
}

export default function ArchiveFixtureList({ fixtures = [], competitionId, title = 'Fixtures & Results' }) {
  const [filter, setFilter] = useState(() => defaultFilter(competitionId));
  const played = useMemo(
    () => (fixtures || []).filter((m) => m?.homeTeam && m?.awayTeam && m.isPlayed),
    [fixtures]
  );

  const filtered = useMemo(() => {
    if (!filter) return played;
    if (competitionId === 'cup') {
      return played.filter((m) => m.stage === filter);
    }
    return played.filter((m) => String(m.matchweek) === String(filter));
  }, [played, filter, competitionId]);

  const filterMode =
    competitionId === 'cup'
      ? 'cup'
      : competitionId === 'acwpl'
      ? 'acwpl'
      : competitionId === 'girls-super-cup'
      ? 'girls-super-cup'
      : 'league';

  const grouped = useMemo(() => {
    if (competitionId === 'cup') {
      const stages = ['semi-final', 'final'];
      return stages
        .map((stage) => ({
          key: stage,
          label: stage === 'semi-final' ? 'Semi-Finals' : 'Final',
          matches: filtered.filter((m) => m.stage === stage),
        }))
        .filter((g) => g.matches.length > 0);
    }
    if (competitionId === 'league' || competitionId === 'acwpl' || competitionId === 'girls-super-cup') {
      const weeks = [...new Set(filtered.map((m) => m.matchweek).filter(Boolean))].sort((a, b) => a - b);
      return weeks.map((week) => ({
        key: week,
        label: competitionId === 'girls-super-cup' ? `Round ${week}` : `Matchweek ${week}`,
        matches: filtered.filter((m) => m.matchweek === week),
      }));
    }
    return [{ key: 'all', label: 'Matches', matches: filtered }];
  }, [filtered, competitionId]);

  return (
    <div className="card archive-section" id="fixtures">
      <h2><Calendar size={18} /> {title}</h2>

      {played.length > 0 && (
        <div className="filter-section">
          <FixtureFilterControl
            mode={filterMode}
            matches={played}
            value={filter}
            onChange={setFilter}
          />
        </div>
      )}

      {played.length === 0 ? (
        <p className="archive-empty-inline">No results recorded in this archive.</p>
      ) : (
        <>
          <div className="desktop-only">
            <FixtureDesktopTableHeader />
            <div className="fixtures-container">
              {grouped.map((group) => (
                <div key={group.key} className="matchweek-group">
                  <div className="matchweek-header">
                    <h3>{group.label}</h3>
                  </div>
                  {group.matches.map((match) => (
                    <div key={match._id} className="match-row">
                      <div>{formatArchiveDate(match.date)}</div>
                      <div>{match.time || '—'}</div>
                      <FixtureDesktopMatchup match={match} getTeamLogoClass={getTeamLogoClass} />
                      <div>{formatArchiveStage(match.stage, competitionId) || (competitionId === 'girls-super-cup' ? `Round ${match.matchweek}` : 'Regular')}</div>
                      <div>
                        <span className={`badge ${desktopFixtureBadgeClass(match)}`}>
                          {desktopFixtureBadgeLabel(match)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="mobile-only">
            <div className={`matches-cards${competitionId === 'acwpl' || competitionId === 'girls-super-cup' ? ' acwpl-fixtures-bg' : ''}`}>
              {filtered.map((match) => (
                <div key={match._id} className={fixtureCardClassName(match)}>
                  <div className="fixture-header">
                    <div className="fixture-datetime">
                      <span className="fixture-date">{formatArchiveDate(match.date)}</span>
                      <span className="fixture-time">{match.time}</span>
                    </div>
                    <div className="fixture-status">
                      <span className={statusBadgeClass(userFixturePhase(match))}>
                        {statusBadgeLabel(userFixturePhase(match))}
                      </span>
                    </div>
                  </div>
                  <div className="fixture-teams">
                    <div className="team-section home">
                      <div className="team-info">
                        {match.homeTeam.logo && (
                          <img src={match.homeTeam.logo} alt="" className={getTeamLogoClass(match.homeTeam.name)} />
                        )}
                        <span className="team-name">{match.homeTeam.name}</span>
                      </div>
                      {showFixtureScores(match) && <div className="team-score">{match.homeScore}</div>}
                    </div>
                    <div className="vs-section">
                      {showFixtureScores(match) ? (
                        <div className="final-score">
                          <span className="score-display">{match.homeScore} - {match.awayScore}</span>
                        </div>
                      ) : (
                        <div className="vs-display">VS</div>
                      )}
                    </div>
                    <div className="team-section away">
                      <div className="team-info">
                        {match.awayTeam.logo && (
                          <img src={match.awayTeam.logo} alt="" className={getTeamLogoClass(match.awayTeam.name)} />
                        )}
                        <span className="team-name">{match.awayTeam.name}</span>
                      </div>
                      {showFixtureScores(match) && <div className="team-score">{match.awayScore}</div>}
                    </div>
                  </div>
                  {match.stage && (
                    <div className="fixture-stage">
                      {formatArchiveStage(match.stage, competitionId) || `Round ${match.matchweek}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
