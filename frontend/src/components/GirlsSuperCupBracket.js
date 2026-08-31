import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Star, Trophy, Shield } from 'lucide-react';
import { getTeamLogoClass } from './archive/archiveDisplayUtils';
import {
  userFixturePhase,
  statusBadgeClass,
  statusBadgeLabel,
  showFixtureScores,
  shouldShowMatchPenalties,
} from '../utils/matchDisplayState';
import {
  buildGirlsSuperCupSeries,
  gscTeamIsMatchWinner,
  GSC_WINS_TO_CLINCH,
  GSC_TEAMS,
} from '../utils/girlsSuperCupSeries';

function WinPips({ wins, clinched }) {
  return (
    <div className="gsc-bracket__pips" aria-hidden="true">
      {Array.from({ length: GSC_WINS_TO_CLINCH }, (_, i) => (
        <span
          key={i}
          className={`gsc-bracket__pip${i < wins ? ' gsc-bracket__pip--won' : ''}${clinched && i < wins ? ' gsc-bracket__pip--clinched' : ''}`}
        />
      ))}
    </div>
  );
}

function RoundCard({ round, match, champion, formatDate }) {
  if (!match) {
    return (
      <article className="gsc-bracket__round gsc-bracket__round--empty">
        <header className="gsc-bracket__round-head">
          <span className="gsc-bracket__round-label">Round {round}</span>
        </header>
        <p className="gsc-bracket__round-placeholder">Not scheduled</p>
      </article>
    );
  }

  const phase = userFixturePhase(match);
  const roundWinner = gscTeamIsMatchWinner(match, match.homeTeam.name)
    ? match.homeTeam.name
    : gscTeamIsMatchWinner(match, match.awayTeam.name)
      ? match.awayTeam.name
      : null;

  return (
    <article
      className={`gsc-bracket__round gsc-bracket__round--${phase}${champion && phase === 'void' ? ' gsc-bracket__round--voided' : ''}`}
    >
      <header className="gsc-bracket__round-head">
        <span className="gsc-bracket__round-label">Round {round}</span>
        <span className={statusBadgeClass(phase)}>{statusBadgeLabel(phase)}</span>
      </header>

      <div className="gsc-bracket__round-match">
        <div
          className={`gsc-bracket__round-team${roundWinner === match.homeTeam.name ? ' gsc-bracket__round-team--winner' : ''}`}
        >
          {match.homeTeam.logo && (
            <img
              src={match.homeTeam.logo}
              alt=""
              className={getTeamLogoClass(match.homeTeam.name)}
            />
          )}
          <span className="gsc-bracket__round-name">{match.homeTeam.name}</span>
          {showFixtureScores(match) && (
            <span className="gsc-bracket__round-score">{match.homeScore}</span>
          )}
        </div>

        <span className="gsc-bracket__round-vs" aria-hidden="true">vs</span>

        <div
          className={`gsc-bracket__round-team${roundWinner === match.awayTeam.name ? ' gsc-bracket__round-team--winner' : ''}`}
        >
          {match.awayTeam.logo && (
            <img
              src={match.awayTeam.logo}
              alt=""
              className={getTeamLogoClass(match.awayTeam.name)}
            />
          )}
          <span className="gsc-bracket__round-name">{match.awayTeam.name}</span>
          {showFixtureScores(match) && (
            <span className="gsc-bracket__round-score">{match.awayScore}</span>
          )}
        </div>
      </div>

      <footer className="gsc-bracket__round-meta">
        {match.date && formatDate && (
          <span>{formatDate(match.date)}{match.time ? ` · ${match.time}` : ''}</span>
        )}
        {shouldShowMatchPenalties(match) && (
          <span className="gsc-bracket__round-pens">
            Pens {match.homePenalties}–{match.awayPenalties}
          </span>
        )}
        {phase === 'void' && match.voidReason && (
          <span className="gsc-bracket__round-void-note">Series decided — not required</span>
        )}
      </footer>
    </article>
  );
}

RoundCard.propTypes = {
  round: PropTypes.number.isRequired,
  match: PropTypes.object,
  champion: PropTypes.string,
  formatDate: PropTypes.func,
};

/**
 * Girls Super Cup series bracket — best-of-3, first to 2 wins (Orion vs Firestorm).
 * Shown above Fixtures & Results; scores also appear in the fixture list below.
 */
export default function GirlsSuperCupBracket({ matches, formatDate }) {
  const series = useMemo(() => buildGirlsSuperCupSeries(matches), [matches]);
  const { winsByTeam, champion, rounds } = series;

  if (rounds.every((r) => !r.match)) return null;

  const teamMeta = GSC_TEAMS.map((name) => {
    const fromMatch = rounds.map((r) => r.match).find(
      (m) => m?.homeTeam?.name === name || m?.awayTeam?.name === name
    );
    const teamDoc =
      fromMatch?.homeTeam?.name === name ? fromMatch.homeTeam : fromMatch?.awayTeam;
    return { name, logo: teamDoc?.logo, wins: winsByTeam[name] || 0 };
  });

  return (
    <section className="gsc-bracket" aria-label="Girls Super Cup series">
      <header className="gsc-bracket__hero">
        <div className="gsc-bracket__hero-icon" aria-hidden="true">
          <Star size={24} strokeWidth={1.75} />
        </div>
        <div className="gsc-bracket__hero-text">
          <p className="gsc-bracket__eyebrow">Girls competition</p>
          <h2 className="gsc-bracket__title">Girls Super Cup</h2>
          <p className="gsc-bracket__tagline">Best of 3 · First to {GSC_WINS_TO_CLINCH} wins</p>
        </div>
        <div className="gsc-bracket__rule-badge">
          <Shield size={14} aria-hidden="true" />
          <span>Draws → penalties</span>
        </div>
      </header>

      <div className="gsc-bracket__scoreboard">
        <div
          className={`gsc-bracket__score-team${champion === teamMeta[0].name ? ' gsc-bracket__score-team--champion' : ''}`}
        >
          <div className="gsc-bracket__score-main">
            {teamMeta[0].logo && (
              <img src={teamMeta[0].logo} alt="" className={getTeamLogoClass(teamMeta[0].name)} />
            )}
            <span className="gsc-bracket__score-name">{teamMeta[0].name}</span>
          </div>
          <WinPips wins={teamMeta[0].wins} clinched={Boolean(champion)} />
        </div>

        <div className="gsc-bracket__score-center" aria-label="Series wins">
          <span className="gsc-bracket__score-digit">{winsByTeam.Orion || 0}</span>
          <span className="gsc-bracket__score-sep">–</span>
          <span className="gsc-bracket__score-digit">{winsByTeam.Firestorm || 0}</span>
        </div>

        <div
          className={`gsc-bracket__score-team${champion === teamMeta[1].name ? ' gsc-bracket__score-team--champion' : ''}`}
        >
          <div className="gsc-bracket__score-main">
            {teamMeta[1].logo && (
              <img src={teamMeta[1].logo} alt="" className={getTeamLogoClass(teamMeta[1].name)} />
            )}
            <span className="gsc-bracket__score-name">{teamMeta[1].name}</span>
          </div>
          <WinPips wins={teamMeta[1].wins} clinched={Boolean(champion)} />
        </div>
      </div>

      {champion && (
        <div className="gsc-bracket__clinch">
          <Trophy size={16} aria-hidden="true" />
          <span>
            <strong>{champion}</strong> wins the series — remaining rounds are void
          </span>
        </div>
      )}

      {!champion && (winsByTeam.Orion > 0 || winsByTeam.Firestorm > 0) && (
        <p className="gsc-bracket__progress">
          {GSC_WINS_TO_CLINCH - Math.max(winsByTeam.Orion, winsByTeam.Firestorm)} win
          {GSC_WINS_TO_CLINCH - Math.max(winsByTeam.Orion, winsByTeam.Firestorm) === 1 ? '' : 's'}{' '}
          needed to clinch the trophy
        </p>
      )}

      <div className="gsc-bracket__rounds">
        {rounds.map(({ round, match }) => (
          <RoundCard
            key={round}
            round={round}
            match={match}
            champion={champion}
            formatDate={formatDate}
          />
        ))}
      </div>
    </section>
  );
}

GirlsSuperCupBracket.propTypes = {
  matches: PropTypes.arrayOf(PropTypes.object).isRequired,
  formatDate: PropTypes.func,
};
