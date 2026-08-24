import React from 'react';
import { Trophy, Medal } from 'lucide-react';

function formatPoints(total) {
  if (total == null) return null;
  return Number(total).toLocaleString();
}

export default function FantasyLeagueUserStatus({ status }) {
  if (!status || status.type === 'guest' || status.type === 'preseason' || status.type === 'active') {
    return null;
  }

  if (status.type === 'champion') {
    const pts = formatPoints(status.result?.totalPoints);
    return (
      <div className="fpl-league-status fpl-league-status--champion">
        <Trophy size={24} className="fpl-league-status__icon" aria-hidden />
        <div>
          <p className="fpl-league-status__title">ACFPL Champion</p>
          <p className="fpl-league-status__text">
            Congratulations — <strong>{status.result?.teamName || 'your team'}</strong> are the
            Overall Acity League FPL Champions
            {pts ? (
              <>
                {' '}
                with <strong>{pts} FPL points</strong>
              </>
            ) : null}
            !
          </p>
        </div>
      </div>
    );
  }

  if (status.type === 'runner_up') {
    const pts = formatPoints(status.result?.totalPoints);
    return (
      <div className="fpl-league-status fpl-league-status--runner-up">
        <Medal size={22} className="fpl-league-status__icon" aria-hidden />
        <div>
          <p className="fpl-league-status__title">ACFPL Runner-Up</p>
          <p className="fpl-league-status__text">
            Congratulations — <strong>{status.result?.teamName || 'your team'}</strong> finished
            2nd in the Overall Acity League
            {pts ? (
              <>
                {' '}
                with <strong>{pts} FPL points</strong>
              </>
            ) : null}
            !
          </p>
        </div>
      </div>
    );
  }

  if (status.type === 'finished') {
    return (
      <div className="fpl-league-status fpl-league-status--finished">
        <Medal size={20} className="fpl-league-status__icon" aria-hidden />
        <div>
          <p className="fpl-league-status__title">Overall Acity League — Season complete</p>
          <p className="fpl-league-status__text">
            You finished{' '}
            <strong>{status.rank != null ? `#${status.rank}` : 'the season'}</strong>
            {status.totalPoints != null ? (
              <>
                {' '}
                with <strong>{formatPoints(status.totalPoints)} FPL points</strong>
              </>
            ) : null}
            .
          </p>
        </div>
      </div>
    );
  }

  return null;
}
