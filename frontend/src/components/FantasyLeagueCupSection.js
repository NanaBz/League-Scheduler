import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { userFixturePhase } from '../utils/matchDisplayState';
import FantasyOverallLeagueStrip from './FantasyOverallLeagueEntry';
import './FantasyDashboard.css';

/** True when every published league match in matchweek 5 is finished (FT) or voided. */
function leagueMatchweek5Complete(matches) {
  const list = (matches || []).filter(
    (m) => m && m.competition === 'league' && Number(m.matchweek) === 5
  );
  if (list.length === 0) return false;
  return list.every((m) => {
    const ph = userFixturePhase(m);
    return ph === 'ft' || ph === 'void';
  });
}

function AcityCupPanel({ loading, mw5Complete }) {
  if (loading) {
    return (
      <div className="fantasy-cup-panel">
        <p className="fantasy-cup-panel-text fantasy-cup-panel-text--muted">Loading cup status…</p>
      </div>
    );
  }

  if (!mw5Complete) {
    return (
      <div className="fantasy-cup-panel">
        <h4 className="fantasy-cup-panel-title">Acity Cup</h4>
        <p className="fantasy-cup-panel-text">
          The Acity Cup is the knockout tournament after the league phase. When Matchweek 5 is fully
          finished, the top 32 teams from the Overall Acity League qualify. Pairings, kickoff times,
          and results will appear here once the cup starts.
        </p>
      </div>
    );
  }

  return (
    <div className="fantasy-cup-panel">
      <h4 className="fantasy-cup-panel-title">Acity Cup</h4>
      <p className="fantasy-cup-panel-text">
        Matchweek 5 is complete. The top 32 from the Overall Acity League are confirmed as Acity Cup
        qualifiers. The bracket and fixtures will be shown here soon.
      </p>
    </div>
  );
}

export default function FantasyLeagueCupSection({ user }) {
  const [tab, setTab] = useState('league');
  const [matches, setMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMatches(true);
      try {
        const { data } = await api.get('/matches', { params: { competition: 'league' } });
        if (!cancelled) setMatches(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setMatches([]);
      } finally {
        if (!cancelled) setLoadingMatches(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const mw5Complete = useMemo(() => leagueMatchweek5Complete(matches), [matches]);

  return (
    <section className="fantasy-lc-section" aria-labelledby="fantasy-lc-heading">
      <h3 id="fantasy-lc-heading" className="fantasy-lc-heading">
        League <span className="fantasy-lc-heading-amp">&amp;</span> Cup
      </h3>
      <div className="fantasy-lc-toggle" role="tablist" aria-label="League or Acity Cup">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'league'}
          onClick={() => setTab('league')}
        >
          League
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'cup'}
          onClick={() => setTab('cup')}
        >
          Cup
        </button>
      </div>

      {tab === 'league' ? <FantasyOverallLeagueStrip user={user} /> : null}
      {tab === 'cup' ? <AcityCupPanel loading={loadingMatches} mw5Complete={mw5Complete} /> : null}
    </section>
  );
}
