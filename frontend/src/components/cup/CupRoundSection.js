import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Check, Circle, Trophy } from 'lucide-react';
import CupFixtureCard from './CupFixtureCard';
import { filterTiesForUser, isUserInTie } from './cupUtils';

function RoundIcon({ phase, isFinal }) {
  if (isFinal) return <Trophy size={18} aria-hidden />;
  if (phase === 'completed') return <Check size={18} aria-hidden />;
  if (phase === 'current') return <span className="acfpl-cup-round__live-dot" aria-hidden />;
  return <Circle size={16} aria-hidden />;
}

function collapsedSummary({ round, phase, tieCount, ties, myUserId }) {
  if (phase === 'upcoming' && !tieCount) {
    return 'Pairings appear when the previous round completes';
  }
  if (tieCount === 0) return 'No fixtures yet';

  const userTie = myUserId
    ? ties.find((t) => isUserInTie(t, myUserId))
    : null;

  if (userTie && phase !== 'upcoming') {
    const opp =
      String(userTie.home.fantasyUserId) === String(myUserId)
        ? userTie.away.teamName
        : userTie.home.teamName;
    return `${tieCount} fixtures · yours vs ${opp}`;
  }

  if (phase === 'completed') {
    return `${tieCount} fixtures · completed`;
  }
  if (phase === 'current') {
    return `${tieCount} fixtures · in progress`;
  }
  return `${tieCount} fixtures`;
}

export default function CupRoundSection({
  round,
  phase,
  myUserId,
  defaultOpen,
  mineOnly,
  featuredTieId,
  compactFixtures,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isFinal = round.round === 'F';
  const allTies = round.ties || [];
  const visibleTies = filterTiesForUser(allTies, myUserId, mineOnly);
  const tieCount = allTies.length;
  const managersIn = round.managersIn;
  const managersOut = round.managersOut;

  const advanceText =
    managersIn && managersOut
      ? `${managersIn} managers → ${managersOut} manager${managersOut === 1 ? '' : 's'}`
      : null;

  const toggleLabel = open
    ? `Collapse ${round.label}`
    : `Expand ${round.label}, ${collapsedSummary({ round, phase, tieCount, ties: allTies, myUserId })}`;

  return (
    <section
      className={`acfpl-cup-round acfpl-cup-round--${phase}${isFinal ? ' acfpl-cup-round--final' : ''}`}
    >
      <button
        type="button"
        className="acfpl-cup-round__header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={toggleLabel}
      >
        <div className="acfpl-cup-round__heading">
          <span className={`acfpl-cup-round__icon acfpl-cup-round__icon--${phase}`}>
            <RoundIcon phase={phase} isFinal={isFinal} />
          </span>
          <div className="acfpl-cup-round__titles">
            <span className="acfpl-cup-round__name">{round.label.toUpperCase()}</span>
            <span className="acfpl-cup-round__meta">
              Matchweek {round.gameweek}
              {advanceText ? ` · ${advanceText}` : ''}
            </span>
            {!open ? (
              <span className="acfpl-cup-round__sub">
                {collapsedSummary({ round, phase, tieCount, ties: allTies, myUserId })}
              </span>
            ) : null}
            {open && phase === 'completed' && tieCount > 0 ? (
              <span className="acfpl-cup-round__sub">{managersOut} managers advanced</span>
            ) : null}
            {open && phase === 'current' && tieCount > 0 ? (
              <span className="acfpl-cup-round__sub">{tieCount} fixtures · in progress</span>
            ) : null}
            {open && phase === 'upcoming' && !tieCount ? (
              <span className="acfpl-cup-round__sub">
                Pairings appear when the previous round completes
              </span>
            ) : null}
          </div>
        </div>
        <span className="acfpl-cup-round__chevron" aria-hidden>
          {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </span>
      </button>

      {open ? (
        <div className="acfpl-cup-round__body">
          {mineOnly && visibleTies.length === 0 && tieCount > 0 ? (
            <p className="acfpl-cup-round__empty">You have no fixture in this round.</p>
          ) : null}
          {visibleTies.length > 0 ? (
            <div
              className={[
                'acfpl-cup-round__fixtures',
                compactFixtures ? 'acfpl-cup-round__fixtures--compact' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {visibleTies.map((tie) => (
                <CupFixtureCard
                  key={tie.id}
                  tie={tie}
                  round={round}
                  myUserId={myUserId}
                  hideBadge={featuredTieId === tie.id}
                  compact={compactFixtures && featuredTieId !== tie.id}
                />
              ))}
            </div>
          ) : tieCount === 0 ? (
            <p className="acfpl-cup-round__empty">
              {phase === 'upcoming'
                ? 'Fixtures will be drawn after the previous round.'
                : 'No fixtures for this round yet.'}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
