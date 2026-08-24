import React from 'react';
import {
  formatFplPoints,
  isUserInTie,
  tieResultLabel,
} from './cupUtils';

function ManagerRow({ manager, isWinner, isMe, resolved, showHeader }) {
  const pending = !resolved && manager.points == null;
  const pointsText = formatFplPoints(manager.points, { pending });

  return (
    <div
      className={[
        'acfpl-cup-fixture__manager',
        isWinner && resolved ? 'acfpl-cup-fixture__manager--winner' : '',
        isMe ? 'acfpl-cup-fixture__manager--you' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="acfpl-cup-fixture__name">{manager.teamName}</span>
      <span className="acfpl-cup-fixture__points-col">
        {showHeader ? (
          <span className="acfpl-cup-fixture__col-label">FPL pts</span>
        ) : null}
        <span className="acfpl-cup-fixture__points">
          {pointsText}
          {!pending && manager.points != null ? (
            <span className="acfpl-cup-fixture__pts-suffix"> pts</span>
          ) : null}
        </span>
      </span>
    </div>
  );
}

export default function CupFixtureCard({
  tie,
  round,
  myUserId,
  pinned,
  hideBadge,
  compact,
  scrollId,
}) {
  const isMine = isUserInTie(tie, myUserId);
  const result = tieResultLabel(tie, myUserId);
  const id = myUserId ? String(myUserId) : null;
  const showBadge = (isMine || pinned) && !hideBadge;

  return (
    <article
      id={scrollId || (isMine ? `cup-tie-${tie.id}` : undefined)}
      className={[
        'acfpl-cup-fixture',
        compact ? 'acfpl-cup-fixture--compact' : '',
        isMine || pinned ? 'acfpl-cup-fixture--yours' : '',
        tie.resolved ? 'acfpl-cup-fixture--resolved' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {showBadge ? (
        <div className="acfpl-cup-fixture__badge">
          {pinned ? 'Your match' : 'Your fixture'} · {round.label} · MW{round.gameweek}
        </div>
      ) : null}

      <ManagerRow
        manager={tie.home}
        isWinner={tie.home.isWinner}
        isMe={id && String(tie.home.fantasyUserId) === id}
        resolved={tie.resolved}
        showHeader={!compact}
      />
      <div className="acfpl-cup-fixture__divider" aria-hidden />
      <ManagerRow
        manager={tie.away}
        isWinner={tie.away.isWinner}
        isMe={id && String(tie.away.fantasyUserId) === id}
        resolved={tie.resolved}
        showHeader={false}
      />

      <p
        className={[
          'acfpl-cup-fixture__result',
          `acfpl-cup-fixture__result--${result.kind}`,
          result.tiebreak ? 'acfpl-cup-fixture__result--tiebreak' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {result.text}
      </p>
    </article>
  );
}
