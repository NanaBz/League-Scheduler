import React from 'react';
import { Trophy, XCircle, Medal, ChevronDown } from 'lucide-react';

function PublicBracketNote() {
  return (
    <p className="acfpl-cup-status__footnote">
      The full public bracket is below — all fixtures remain visible to everyone.
    </p>
  );
}

export default function CupUserStatus({ status, cup, onJumpToMatch, hasFeaturedMatch }) {
  if (!status || status.type === 'unknown') return null;

  if (status.type === 'guest') {
    return (
      <div className="acfpl-cup-status acfpl-cup-status--info">
        <p className="acfpl-cup-status__title">Public bracket</p>
        <p className="acfpl-cup-status__text">
          Browse every round below. Sign in to highlight your fixtures and cup status.
        </p>
      </div>
    );
  }

  if (status.type === 'pre_cup') {
    return (
      <div className="acfpl-cup-status acfpl-cup-status--info">
        <p className="acfpl-cup-status__title">ACFPL Cup</p>
        <p className="acfpl-cup-status__text">
          The knockout begins after Matchweek 5. Top 32 managers qualify based on Overall League
          points through GW5.
        </p>
      </div>
    );
  }

  if (status.type === 'not_qualified') {
    return (
      <div className="acfpl-cup-status acfpl-cup-status--muted">
        <XCircle size={22} className="acfpl-cup-status__icon" aria-hidden />
        <div>
          <p className="acfpl-cup-status__title">You did not qualify for the ACFPL Cup</p>
          <p className="acfpl-cup-status__text">
            Only the top 32 managers after Matchweek 5 entered the knockout.
            {status.seed != null ? (
              <>
                {' '}
                You finished <strong>#{status.seed}</strong>
                {status.qualificationPoints != null
                  ? ` with ${status.qualificationPoints} FPL pts through GW5`
                  : ''}
                .
              </>
            ) : (
              ' Your Overall League rank after GW5 was outside the top 32.'
            )}
          </p>
          <PublicBracketNote />
        </div>
      </div>
    );
  }

  if (status.type === 'eliminated') {
    return (
      <div className="acfpl-cup-status acfpl-cup-status--eliminated">
        <XCircle size={22} className="acfpl-cup-status__icon" aria-hidden />
        <div>
          <p className="acfpl-cup-status__title">You have been eliminated</p>
          <p className="acfpl-cup-status__text">
            Eliminated in <strong>{status.roundLabel}</strong>
            {status.gameweek ? (
              <>
                {' '}
                (Matchweek <strong>{status.gameweek}</strong>)
              </>
            ) : null}
            . You can still follow the remaining rounds below.
          </p>
          {onJumpToMatch && hasFeaturedMatch ? (
            <button type="button" className="acfpl-cup-status__jump" onClick={onJumpToMatch}>
              View your last result
              <ChevronDown size={14} aria-hidden />
            </button>
          ) : null}
          <PublicBracketNote />
        </div>
      </div>
    );
  }

  if (status.type === 'champion') {
    return (
      <div className="acfpl-cup-status acfpl-cup-status--champion">
        <Trophy size={24} className="acfpl-cup-status__icon" aria-hidden />
        <div>
          <p className="acfpl-cup-status__title">ACFPL Cup Champion</p>
          <p className="acfpl-cup-status__text">
            Congratulations — <strong>{status.winner?.teamName || 'your team'}</strong> won the
            ACFPL Cup.
          </p>
          <PublicBracketNote />
        </div>
      </div>
    );
  }

  if (status.type === 'active') {
    return (
      <div className="acfpl-cup-status acfpl-cup-status--active">
        <Medal size={22} className="acfpl-cup-status__icon" aria-hidden />
        <div>
          <p className="acfpl-cup-status__title">You are in the ACFPL Cup</p>
          <p className="acfpl-cup-status__text">
            Current round:{' '}
            <strong>{status.currentRound || (cup?.bracketGenerated ? 'Round of 32' : '—')}</strong>
            {hasFeaturedMatch ? ' — your fixture is highlighted below.' : ''}
          </p>
          {onJumpToMatch && hasFeaturedMatch ? (
            <button type="button" className="acfpl-cup-status__jump" onClick={onJumpToMatch}>
              Jump to your match
              <ChevronDown size={14} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return null;
}
