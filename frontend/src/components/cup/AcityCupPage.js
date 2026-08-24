import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Trophy, Loader2 } from 'lucide-react';
import api from '../../utils/api';
import CupProgressIndicator from './CupProgressIndicator';
import CupUserStatus from './CupUserStatus';
import CupFixtureCard from './CupFixtureCard';
import CupRoundSection from './CupRoundSection';
import CupScoringLegend from './CupScoringLegend';
import {
  deriveUserCupStatus,
  findUserFeaturedMatch,
  getRoundPhase,
  mergeAllRounds,
  resolveMyUserId,
} from './cupUtils';
import './AcityCupPage.css';

function CupPendingView({ cup }) {
  return (
    <div className="acfpl-cup-pending">
      <Trophy size={40} className="acfpl-cup-pending__icon" aria-hidden />
      <h3 className="acfpl-cup-pending__title">ACFPL Cup</h3>
      <p className="acfpl-cup-pending__text">
        After Matchweek 5, the top 32 FPL managers from the Overall ACFPL League qualify for a
        knockout tournament. Managers are randomly paired — highest FPL points in the matchweek
        advances.
      </p>
      {cup?.schedule?.length ? (
        <ul className="acfpl-cup-pending__schedule">
          {cup.schedule.map((item) => (
            <li key={item.round}>
              <span>{item.label}</span>
              <span>Matchweek {item.gameweek}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function AcityCupPage({ user, embedded = false }) {
  const [cup, setCup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mineOnly, setMineOnly] = useState(false);

  const myUserId = resolveMyUserId(user);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/fantasy/cup');
        if (!cancelled) setCup(data?.success ? data : null);
      } catch (err) {
        if (!cancelled) {
          setCup(null);
          setError(err?.response?.data?.message || 'Could not load ACFPL Cup.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const allRounds = useMemo(() => (cup ? mergeAllRounds(cup) : []), [cup]);
  const userStatus = useMemo(() => deriveUserCupStatus(cup, myUserId), [cup, myUserId]);

  const currentRoundKey =
    cup?.currentRound?.round || (cup?.bracketGenerated ? 'R32' : null);

  const featured = useMemo(
    () => findUserFeaturedMatch(allRounds, myUserId, userStatus, currentRoundKey),
    [allRounds, myUserId, userStatus, currentRoundKey]
  );

  const currentRound = useMemo(
    () => allRounds.find((r) => r.round === currentRoundKey) || null,
    [allRounds, currentRoundKey]
  );

  const showMineToggle =
    Boolean(myUserId) &&
    currentRound &&
    (currentRound.ties?.length || 0) > 6 &&
    (userStatus?.type === 'active' || userStatus?.type === 'eliminated');

  const scrollToFeatured = useCallback(() => {
    const el = document.getElementById('acfpl-cup-featured-match');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (loading) {
    return (
      <div className="acfpl-cup-page acfpl-cup-page--loading">
        <Loader2 size={28} className="acfpl-cup-page__spinner" aria-hidden />
        <p>Loading ACFPL Cup…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="acfpl-cup-page acfpl-cup-page--error">
        <p className="acfpl-cup-page__error">{error}</p>
      </div>
    );
  }

  if (!cup) {
    return (
      <div className="acfpl-cup-page acfpl-cup-page--error">
        <p className="acfpl-cup-page__error">ACFPL Cup data unavailable.</p>
      </div>
    );
  }

  if (cup.status === 'pending' && !cup.mw5Complete) {
    return (
      <div className={`acfpl-cup-page${embedded ? ' acfpl-cup-page--embed' : ''}`}>
        <CupPendingView cup={cup} />
      </div>
    );
  }

  return (
    <div className={`acfpl-cup-page${embedded ? ' acfpl-cup-page--embed' : ''}`}>
      <header className="acfpl-cup-page__hero">
        <div className="acfpl-cup-page__hero-text">
          <p className="acfpl-cup-page__eyebrow">Knockout · FPL Managers</p>
          <h2 className="acfpl-cup-page__title">ACFPL Cup</h2>
          {cup.status === 'completed' && cup.winner ? (
            <p className="acfpl-cup-page__champion">
              <Trophy size={18} aria-hidden /> Champion:{' '}
              <strong>{cup.winner.teamName}</strong>
            </p>
          ) : (
            <p className="acfpl-cup-page__subtitle">
              Head-to-head by matchweek FPL points · Top 32 after GW5
            </p>
          )}
        </div>
      </header>

      <CupProgressIndicator cup={cup} />
      <CupScoringLegend />
      <CupUserStatus
        status={userStatus}
        cup={cup}
        onJumpToMatch={scrollToFeatured}
        hasFeaturedMatch={Boolean(featured.tie)}
      />

      {featured.tie && featured.round ? (
        <section
          id="acfpl-cup-featured-match"
          className="acfpl-cup-page__your-match"
          aria-label={featured.mode === 'eliminated' ? 'Your last cup result' : 'Your current cup match'}
        >
          <h3 className="acfpl-cup-page__your-match-title">
            {featured.mode === 'eliminated' ? 'Your last result' : 'Your current match'}
          </h3>
          <CupFixtureCard
            tie={featured.tie}
            round={featured.round}
            myUserId={myUserId}
            pinned
            scrollId={`cup-tie-${featured.tie.id}`}
          />
        </section>
      ) : null}

      <div className="acfpl-cup-page__bracket-head">
        <h3 className="acfpl-cup-page__bracket-title">Full bracket</h3>
        {showMineToggle ? (
          <label className="acfpl-cup-page__mine-toggle">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => setMineOnly(e.target.checked)}
            />
            <span>My fixtures only (current round)</span>
          </label>
        ) : null}
      </div>

      <div className="acfpl-cup-page__timeline">
        {allRounds.map((round) => {
          const phase = getRoundPhase(round, cup);
          const isCurrent = phase === 'current';
          const defaultOpen = isCurrent || (phase === 'completed' && round.ties?.length <= 4);
          const compactFixtures = round.round === 'R32' && (round.ties?.length || 0) > 8;

          return (
            <CupRoundSection
              key={round.round}
              round={round}
              phase={phase}
              myUserId={myUserId}
              defaultOpen={defaultOpen}
              mineOnly={isCurrent && mineOnly}
              featuredTieId={featured.tie?.id}
              compactFixtures={compactFixtures}
            />
          );
        })}
      </div>

      {cup.status === 'qualifying' && !cup.rounds?.length ? (
        <p className="acfpl-cup-page__qualifying">
          Qualifiers confirmed — bracket generating…
        </p>
      ) : null}
    </div>
  );
}
