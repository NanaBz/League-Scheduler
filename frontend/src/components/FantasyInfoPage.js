import React from 'react';
import { ArrowLeft } from 'lucide-react';
import './FantasyInfoPage.css';

function ScoringTable({ rows }) {
  return (
    <table className="fpl-info-table">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td>{row.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChipCard({ name, summary, detail }) {
  return (
    <article className="fpl-info-chip">
      <h4>{name}</h4>
      <p>{summary}</p>
      {detail ? <p className="fpl-info-chip-detail">{detail}</p> : null}
    </article>
  );
}

export default function FantasyInfoPage({ onBack }) {
  return (
    <div className="fpl-info">
      <header className="fpl-info-header">
        {onBack ? (
          <button type="button" className="fpl-info-back" onClick={onBack}>
            <ArrowLeft size={18} aria-hidden />
            <span>Back</span>
          </button>
        ) : null}
        <div>
          <p className="fpl-info-eyebrow">ACFPL</p>
          <h1 className="fpl-info-title">Rules &amp; Scoring</h1>
          <p className="fpl-info-lead">
            How the Acity Fantasy Premier League works — squad building, points, transfers, chips, and cup competition.
          </p>
        </div>
      </header>

      <nav className="fpl-info-nav" aria-label="Rules sections">
        <a href="#getting-started">Getting started</a>
        <a href="#squad">Your squad</a>
        <a href="#pick-team">Pick Team</a>
        <a href="#scoring">Scoring</a>
        <a href="#transfers">Transfers</a>
        <a href="#chips">Chips</a>
        <a href="#league">Overall league</a>
        <a href="#cup">Acity Cup</a>
      </nav>

      <section id="getting-started" className="fpl-info-section">
        <h2>Getting started</h2>
        <ol className="fpl-info-steps">
          <li>Register with your email, password, fantasy team name, and manager name.</li>
          <li>
            Open <strong>Transfers</strong> to pick your 13-player squad. You start with{' '}
            <strong>AC 100.0m</strong> in the bank.
          </li>
          <li>
            Open <strong>Pick Team</strong> to choose your starting 9, bench order, captain, and vice-captain before each deadline.
          </li>
          <li>Earn fantasy points from real ACFPL matchweek fixtures across 10 gameweeks.</li>
        </ol>
      </section>

      <section id="squad" className="fpl-info-section">
        <h2>Your squad</h2>
        <ul className="fpl-info-list">
          <li>
            <strong>13 players</strong> — 2 goalkeepers, 4 defenders, 4 midfielders, 3 attackers.
          </li>
          <li>
            <strong>Bank</strong> — spendable Acity Coins remaining for transfers. Shown as{' '}
            <strong>AC Xm</strong> (millions).
          </li>
          <li>
            <strong>Squad Value</strong> — total current market price of your 13 players.
          </li>
          <li>
            <strong>Team Value</strong> — bank plus squad value. This can exceed AC 100.0m when player
            prices rise — that is expected, not an error.
          </li>
          <li>
            <strong>Club limit</strong> — no more than 3 players from the same real-world club.
          </li>
          <li>
            <strong>Gameweek 1</strong> — unlimited free transfers while you build your initial squad.
          </li>
        </ul>
        <p className="fpl-info-note">
          Player prices can change during the season. Transfers buy and sell at the current market price.
          Your bank is what you have left to spend; squad and team value reflect current prices, not what you
          originally paid.
        </p>
      </section>

      <section id="pick-team" className="fpl-info-section">
        <h2>Pick Team</h2>
        <ul className="fpl-info-list">
          <li>
            <strong>Starting 9</strong> — 1 goalkeeper plus 8 outfield players each gameweek.
          </li>
          <li>
            <strong>Valid formations</strong> — at least 2 defenders, 2 midfielders, and 1 attacker in your starting XI
            (e.g. 3-3-2, 4-3-1, 2-4-2).
          </li>
          <li>
            <strong>Bench</strong> — 4 substitutes in priority order (SUB 1 first). Only your starting 9 score by default
            (unless Bench Boost is played).
          </li>
          <li>
            <strong>Automatic substitutions</strong> — after a gameweek finishes, any starting player with 0 minutes may be
            replaced by the first eligible bench player (in bench order) who has scored points, respects formation rules, and
            matches goalkeeper/outfield restrictions. Bench players with 0 points are skipped.
          </li>
          <li>
            <strong>Captain</strong> — earns double points. If your captain plays 0 minutes and scores 0 points, your
            vice-captain takes over as captain for that gameweek.
          </li>
          <li>
            <strong>Deadline</strong> — save your team before the gameweek deadline. After that, your squad and lineup lock
            for that gameweek.
          </li>
        </ul>
      </section>

      <section id="scoring" className="fpl-info-section">
        <h2>Scoring</h2>
        <p>Points come from ACFPL league fixtures. Only actions listed below count — there are no goalkeeper save points.</p>

        <h3>Match actions</h3>
        <ScoringTable
          rows={[
            { label: 'Goal — attacker', points: '+4' },
            { label: 'Goal — midfielder', points: '+5' },
            { label: 'Goal — defender', points: '+6' },
            { label: 'Goal — goalkeeper', points: '+10' },
            { label: 'Assist', points: '+3 each' },
            { label: 'Minutes — 1 to 44', points: '+1' },
            { label: 'Minutes — 45 or more', points: '+2' },
            { label: 'Clean sheet — GK or DEF', points: '+4' },
            { label: 'Clean sheet — MF', points: '+1' },
            { label: 'Clean sheet — ATT', points: '0' },
            { label: 'Own goal', points: '−2 each' },
            { label: 'Yellow card', points: '−1' },
            { label: 'Red card', points: '−3' },
          ]}
        />

        <h3>Bonus &amp; special points</h3>
        <ul className="fpl-info-list">
          <li>
            <strong>Bonus points</strong> — up to 3, 2, or 1 point for the top performers in a fixture (assigned by league
            admins after the match).
          </li>
          <li>
            <strong>Special points</strong> — rare admin-assigned adjustments with a stated reason (e.g. exceptional
            circumstances).
          </li>
        </ul>

        <h3>Captain &amp; multipliers</h3>
        <ScoringTable
          rows={[
            { label: 'Captain (default)', points: '2× player points' },
            { label: 'Triple Captain chip', points: '3× captain points' },
            { label: 'Duo Captain chip', points: 'Captain and vice-captain each 2×' },
            { label: 'Bench Boost chip', points: 'All 13 squad members score' },
          ]}
        />

        <h3>Transfer hits</h3>
        <p>
          Extra transfers beyond your free allowance cost <strong>−4 points</strong> each for that gameweek (deducted from your
          gameweek total after chip multipliers).
        </p>
      </section>

      <section id="transfers" className="fpl-info-section">
        <h2>Transfers</h2>
        <ul className="fpl-info-list">
          <li>
            <strong>From Gameweek 2</strong> — you receive 1 free transfer each gameweek.
          </li>
          <li>
            <strong>Banking</strong> — unused free transfers roll over, up to a maximum of 2 banked at once.
          </li>
          <li>
            <strong>Extra transfers</strong> — each transfer beyond your free allowance costs 4 points that gameweek.
          </li>
          <li>
            <strong>Wildcard or Free Hit weeks</strong> — unlimited transfers with no point hits, but you do not bank free
            transfers that week; the following gameweek starts with 1 free transfer again.
          </li>
        </ul>
      </section>

      <section id="chips" className="fpl-info-section">
        <h2>Chips</h2>
        <p>Each chip can be used once per season. Only one chip may be active at a time. Wildcard and Free Hit unlock from Gameweek 2.</p>
        <div className="fpl-info-chips">
          <ChipCard
            name="Wildcard"
            summary="Unlimited transfers for one gameweek with no point deductions."
            detail="Squad changes are permanent. Resets your free-transfer bank the following gameweek."
          />
          <ChipCard
            name="Free Hit"
            summary="Unlimited transfers for one gameweek only."
            detail="Your squad reverts to what it was before the Free Hit once that gameweek finishes."
          />
          <ChipCard
            name="Bench Boost"
            summary="All 13 players in your squad score points, including the bench."
          />
          <ChipCard
            name="Triple Captain"
            summary="Your captain earns triple points instead of double."
            detail="If your captain blanks, vice-captain promotion rules still apply before the multiplier."
          />
          <ChipCard
            name="Duo Captain"
            summary="Both your captain and vice-captain earn double points."
          />
        </div>
      </section>

      <section id="league" className="fpl-info-section">
        <h2>Overall Acity League</h2>
        <p>
          Every manager competes in a single overall league. Standings are ranked by total fantasy points across all 10
          gameweeks. Gameweek points include chip effects minus any transfer hits for that week.
        </p>
      </section>

      <section id="cup" className="fpl-info-section">
        <h2>Acity Cup</h2>
        <ul className="fpl-info-list">
          <li>
            After <strong>Matchweek 5</strong>, the top <strong>32</strong> managers by total points qualify.
          </li>
          <li>Qualified managers are placed into a knockout bracket (random draw).</li>
          <li>
            Cup ties run from Gameweek 6 through Gameweek 10 — Round of 32, Round of 16, quarter-finals, semi-finals, and
            final.
          </li>
          <li>The manager with more fantasy points in the tie gameweek advances. The overall league continues in parallel.</li>
        </ul>
      </section>

      <footer className="fpl-info-footer">
        <p>Rules reflect the live ACFPL scoring engine. If anything here differs from your gameweek points breakdown, the breakdown wins.</p>
      </footer>
    </div>
  );
}
