import React from 'react';
import { Trophy, Medal } from 'lucide-react';
import './FantasySeasonPodium.css';

export const FANTASY_MAX_MATCHWEEK = 10;

function formatPoints(total) {
  if (total == null) return '—';
  return Number(total).toLocaleString();
}

function isCurrentUser(result, user) {
  if (!result || !user) return false;
  if (result.fantasyUserId && user.id && String(result.fantasyUserId) === String(user.id)) {
    return true;
  }
  const team = String(result.teamName || '').trim().toLowerCase();
  const userTeam = String(user.teamName || '').trim().toLowerCase();
  return Boolean(team && userTeam && team === userTeam);
}

function PodiumCard({ kind, result, user }) {
  if (!result) return null;

  const isMe = isCurrentUser(result, user);
  const isChampion = kind === 'champion';
  const Icon = isChampion ? Trophy : Medal;
  const title = isChampion ? 'ACFPL CHAMPION' : 'ACFPL RUNNER-UP';
  const congrats = isMe
    ? isChampion
      ? `Congratulations, ${result.teamName}! You are the ACFPL Champion!`
      : `Congratulations, ${result.teamName}! You finished 2nd in the ACFPL!`
    : isChampion
      ? `${result.teamName} wins the Overall Acity League.`
      : `${result.teamName} finishes second in the Overall Acity League.`;

  return (
    <article
      className={[
        'fpl-season-podium__card',
        isChampion ? 'fpl-season-podium__card--champion' : 'fpl-season-podium__card--runner-up',
        isMe ? 'fpl-season-podium__card--yours' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="fpl-season-podium__icon-wrap">
        <Icon size={isChampion ? 28 : 24} aria-hidden />
      </div>
      <p className="fpl-season-podium__badge">{isChampion ? '🏆' : '🥈'} {title}</p>
      <h3 className="fpl-season-podium__team">{result.teamName}</h3>
      <p className="fpl-season-podium__points">{formatPoints(result.totalPoints)} FPL POINTS</p>
      <p className="fpl-season-podium__message">{congrats}</p>
    </article>
  );
}

export default function FantasySeasonPodium({
  seasonComplete,
  champion,
  runnerUp,
  user,
  latestCompletedGameweek,
  maxMatchweek = FANTASY_MAX_MATCHWEEK,
  compact = false,
}) {
  if (seasonComplete && champion) {
    return (
      <section
        className={`fpl-season-podium${compact ? ' fpl-season-podium--compact' : ''}`}
        aria-label="ACFPL season results"
      >
        <PodiumCard kind="champion" result={champion} user={user} />
        {runnerUp ? <PodiumCard kind="runner-up" result={runnerUp} user={user} /> : null}
      </section>
    );
  }

  if (preseasonPending(latestCompletedGameweek, maxMatchweek)) {
    return (
      <p className="fpl-season-podium__pending">
        🏆 FPL Champion and Runner-Up will be decided after Matchweek {maxMatchweek}.
      </p>
    );
  }

  return null;
}

function preseasonPending(latestCompletedGameweek, maxMatchweek) {
  return (latestCompletedGameweek || 0) < maxMatchweek;
}
