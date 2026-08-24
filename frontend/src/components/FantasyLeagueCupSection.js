import React, { useState } from 'react';
import FantasyOverallLeagueStrip from './FantasyOverallLeagueEntry';
import AcityCupBracket from './AcityCupBracket';
import './FantasyDashboard.css';

export default function FantasyLeagueCupSection({ user }) {
  const [tab, setTab] = useState('league');

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
      {tab === 'cup' ? (
        <div className="fantasy-lc-cup-embed">
          <AcityCupBracket variant="embed" user={user} />
        </div>
      ) : null}
    </section>
  );
}
