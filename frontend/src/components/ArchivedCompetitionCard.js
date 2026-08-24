import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, ChevronRight, Star, Trophy, Users } from 'lucide-react';
import {
  archivedCompetitionPath,
  getArchivedCompetitionSummary,
} from '../utils/archiveSeasonModel';

const ICONS = {
  league: Trophy,
  cup: Award,
  'super-cup': Star,
  acwpl: Users,
  'girls-super-cup': Star,
};

function TeamChip({ team, role }) {
  if (!team) return null;
  return (
    <div className={`archived-comp-team archived-comp-team--${role}`}>
      {team.logo ? (
        <img src={team.logo} alt="" className="archived-comp-team-logo" />
      ) : (
        <span className="archived-comp-team-fallback" aria-hidden="true" />
      )}
      <div className="archived-comp-team-text">
        <span className="archived-comp-team-role">{role === 'winner' ? 'Champion' : 'Runner-up'}</span>
        <span className="archived-comp-team-name">{team.name}</span>
      </div>
    </div>
  );
}

export default function ArchivedCompetitionCard({ season, competition }) {
  const navigate = useNavigate();
  const Icon = ICONS[competition.id] || Trophy;
  const { winner, runnerUp } = getArchivedCompetitionSummary(season, competition);

  const handleClick = () => {
    navigate(archivedCompetitionPath(season.seasonNumber, competition.id));
  };

  return (
    <button
      type="button"
      className={`archived-comp-card archived-comp-card--${competition.id}`}
      onClick={handleClick}
    >
      <div className="archived-comp-card-top">
        <div className="archived-comp-card-icon" aria-hidden="true">
          <Icon size={26} strokeWidth={1.75} />
        </div>
        <div className="archived-comp-card-titles">
          <h3>{competition.label}</h3>
          <p>{competition.tagline}</p>
        </div>
        <ChevronRight size={20} className="archived-comp-card-arrow" aria-hidden="true" />
      </div>

      <div className="archived-comp-card-body">
        {winner ? (
          <>
            <TeamChip team={winner} role="winner" />
            {runnerUp && <TeamChip team={runnerUp} role="runner-up" />}
          </>
        ) : (
          <p className="archived-comp-card-empty">No champion recorded for this archive</p>
        )}
      </div>

      <span className="archived-comp-card-hint">View archive</span>
    </button>
  );
}
