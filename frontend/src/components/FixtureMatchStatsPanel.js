import React from 'react';
import { Goal, Footprints, Square } from 'lucide-react';
import { userFixturePhase } from '../utils/matchDisplayState';

export function hasMatchEvents(match) {
  if (!match?.events || match.events.length === 0) return false;
  return match.events.some(
    (e) =>
      ['GOAL', 'YELLOW_CARD', 'RED_CARD'].includes(e.type) &&
      (e.player?._id || e.player?.name || e.player)
  );
}

export function hasStartingLineup(match) {
  return (
    match?.startingLineup &&
    ((match.startingLineup.homeTeam &&
      Object.values(match.startingLineup.homeTeam).some((arr) => arr && arr.length > 0)) ||
      (match.startingLineup.awayTeam &&
        Object.values(match.startingLineup.awayTeam).some((arr) => arr && arr.length > 0)))
  );
}

export function canExpandFixtureDetails(match) {
  return (
    match &&
    !match.isVoided &&
    (userFixturePhase(match) === 'ft' || userFixturePhase(match) === 'live') &&
    (hasMatchEvents(match) || hasStartingLineup(match))
  );
}

function formatGoalscorers(match, side) {
  if (!match.events || match.events.length === 0) return null;

  const goals = match.events.filter(
    (e) => e.type === 'GOAL' && e.side === side && (e.player?._id || e.player?.name || e.player)
  );

  if (goals.length === 0) return null;

  const playerLabel = (p) => (typeof p === 'object' && p && p.name ? p.name : 'Player');
  const assistLabel = (p) => (typeof p === 'object' && p && p.name ? p.name : null);

  return (
    <div style={{ fontSize: '0.85em', color: '#666', marginTop: '4px' }}>
      {goals.map((goal, idx) => (
        <div key={idx} style={{ marginBottom: '2px' }}>
          {goal.ownGoal ? (
            <span style={{ color: '#dc3545', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Goal size={14} />
              <span>{playerLabel(goal.player)} (OG)</span>
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Goal size={14} />
              <span>{playerLabel(goal.player)}</span>
              {goal.assistPlayer && assistLabel(goal.assistPlayer) && (
                <sub
                  style={{
                    marginLeft: '4px',
                    fontSize: '0.9em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Footprints size={12} />
                  <span>{assistLabel(goal.assistPlayer)}</span>
                </sub>
              )}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function formatCards(match, side, type) {
  if (!match.events || match.events.length === 0) return null;
  const evs = match.events.filter(
    (e) => e.type === type && e.side === side && (e.player?._id || e.player?.name || e.player)
  );
  if (evs.length === 0) return null;
  const color = type === 'YELLOW_CARD' ? '#f1c40f' : '#e74c3c';
  const label = type === 'YELLOW_CARD' ? 'Yellow Cards' : 'Red Cards';
  const cardPlayerLabel = (p) => (typeof p === 'object' && p && p.name ? p.name : 'Player');
  return (
    <div style={{ fontSize: '0.85em', color: '#666', marginTop: '6px' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {evs.map((ev, idx) => (
        <div key={`${type}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Square size={12} color={color} />
          <span>
            {cardPlayerLabel(ev.player)}
            {typeof ev.minute === 'number' && !Number.isNaN(ev.minute) ? ` (${ev.minute}')` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

function renderStartingLineup(match) {
  if (!hasStartingLineup(match)) return null;

  const positionConfig = {
    gk: { label: 'Goalkeeper', abbr: 'GK' },
    df: { label: 'Defenders', abbr: 'DF' },
    mf: { label: 'Midfielders', abbr: 'MF' },
    att: { label: 'Attackers', abbr: 'ATT' },
  };

  const renderTeamLineup = (lineup, teamName) => {
    if (!lineup) return null;

    return (
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#333' }}>{teamName}</h4>
        {Object.entries(positionConfig).map(([pos, config]) => {
          const players = lineup[pos] || [];
          if (players.length === 0) return null;

          return (
            <div key={pos} style={{ marginBottom: '8px' }}>
              <span
                style={{
                  display: 'inline-block',
                  backgroundColor: '#e7f3ff',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '11px',
                  fontWeight: 600,
                  marginRight: '6px',
                  color: '#0066cc',
                }}
              >
                {config.abbr}
              </span>
              <span style={{ fontSize: '12px', color: '#555' }}>
                {players.map((p, idx) => {
                  const name = typeof p === 'object' ? p.name : p;
                  const number = typeof p === 'object' && p.number ? ` (#${p.number})` : '';
                  return (
                    <span key={idx}>
                      {idx > 0 && ', '}
                      {name}
                      {number}
                    </span>
                  );
                })}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixture-stats-lineup">
      <h3 className="fixture-stats-lineup-title">⚽ Starting Lineup</h3>
      {match.startingLineup && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {match.startingLineup.homeTeam &&
            renderTeamLineup(match.startingLineup.homeTeam, match.homeTeam?.name || 'Home')}
          {match.startingLineup.awayTeam &&
            renderTeamLineup(match.startingLineup.awayTeam, match.awayTeam?.name || 'Away')}
        </div>
      )}
    </div>
  );
}

function renderEventsDesktop(match) {
  if (!hasMatchEvents(match)) return null;
  return (
    <div className="fixture-stats-events">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <strong>{match.homeTeam?.name}</strong>
          {formatGoalscorers(match, 'home')}
          {formatCards(match, 'home', 'YELLOW_CARD')}
          {formatCards(match, 'home', 'RED_CARD')}
        </div>
        <div>
          <strong>{match.awayTeam?.name}</strong>
          {formatGoalscorers(match, 'away')}
          {formatCards(match, 'away', 'YELLOW_CARD')}
          {formatCards(match, 'away', 'RED_CARD')}
        </div>
      </div>
    </div>
  );
}

function renderEventsMobileStacked(match) {
  return (
    <>
      <div style={{ marginBottom: '8px' }}>
        <strong>{match.homeTeam?.name}</strong>
        {formatGoalscorers(match, 'home')}
        {formatCards(match, 'home', 'YELLOW_CARD')}
        {formatCards(match, 'home', 'RED_CARD')}
      </div>
      <div>
        <strong>{match.awayTeam?.name}</strong>
        {formatGoalscorers(match, 'away')}
        {formatCards(match, 'away', 'YELLOW_CARD')}
        {formatCards(match, 'away', 'RED_CARD')}
      </div>
    </>
  );
}

/**
 * Expanded lineup + events (fixtures & results). Matches UserView desktop vs mobile layouts.
 * @param {{ match: object, variant?: 'desktop'|'mobile' }} props
 */
export function FixtureMatchStatsExpanded({ match, variant = 'desktop' }) {
  if (variant === 'mobile') {
    return (
      <div className="fixture-stats-expanded fixture-stats-expanded--mobile">
        {renderStartingLineup(match)}
        {renderEventsMobileStacked(match)}
      </div>
    );
  }

  return (
    <div className="fixture-stats-expanded fixture-stats-expanded--desktop">
      {renderStartingLineup(match)}
      {renderEventsDesktop(match)}
    </div>
  );
}
