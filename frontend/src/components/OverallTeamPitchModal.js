import React from 'react';
import './OverallTeamPitchModal.css';
import JerseyIcon from './JerseyIcon';

function getTeamCode(player) {
  if (!player) return 'DEF';
  const teamName = player.team?.name || player.teamName || '';
  const mapping = {
    'Warriors': 'KWF',
    'Dragons': 'DRA',
    'Vikings': 'VIK',
    'Lions': 'LIO',
    'Elites': 'ELI',
    'Falcons': 'FAL'
  };
  return player.teamCode || mapping[teamName] || 'DEF';
}

function kitColors(teamCode, pos) {
  if (pos === 'GK') return { primary: '#8b5cf6', stroke: '#2f1e64' };
  switch (teamCode) {
    case 'KWF': return { primary: '#ffd233', stroke: '#7a5b00' };
    case 'DRA': return { primary: '#2563eb', stroke: '#0b3b9d' };
    case 'VIK': return { primary: '#dc2626', stroke: '#7a1010' };
    case 'LIO': return { primary: '#16a34a', stroke: '#0a5928' };
    case 'ELI': return { primary: '#111111', stroke: '#e5e5e5' };
    case 'FAL': return { primary: '#ffffff', stroke: '#000000' };
    default: return { primary: '#444', stroke: '#111' };
  }
}

export default function OverallTeamPitchModal({ team, onClose }) {
  if (!team) return null;
  
  // Fallback builder if lineup is missing
  const buildFallbackLineup = (players, gwNum = 1) => {
    if (!players || !players.length) return { gk: [], def: [], mid: [], fwd: [], bench: [], formation: '3-3-2', gameweek: gwNum };
    const norm = (pos) => {
      const m = { GK: 'GK', DEF: 'DEF', DF: 'DEF', MID: 'MID', MF: 'MID', FWD: 'FWD', ATT: 'FWD' };
      const key = String(pos || 'MID').toUpperCase();
      return m[key] || key;
    };
    const normalized = players.map(p => ({ ...p, position: norm(p.position) }));
    const byPos = {
      GK: normalized.filter(p => p.position === 'GK'),
      DEF: normalized.filter(p => p.position === 'DEF'),
      MID: normalized.filter(p => p.position === 'MID'),
      FWD: normalized.filter(p => p.position === 'FWD'),
    };
    const splits = [ { def:3, mid:3, fwd:2, name:'3-3-2' }, { def:4, mid:2, fwd:2, name:'4-2-2' }, { def:3, mid:2, fwd:3, name:'3-2-3' } ];
    const pick = splits[Math.floor(Math.random()*splits.length)];
    const randPts = () => Math.floor(Math.random()*13);
    const take = (list, n, pool) => {
      const picked = list.slice(0,n);
      if (picked.length < n) {
        const need = n - picked.length;
        const fallback = pool.filter(p => !picked.includes(p));
        picked.push(...fallback.slice(0,need));
      }
      return picked.map(p => ({ ...p, points: (p.gwPoints && p.gwPoints[gwNum]) ?? randPts() }));
    };
    const outfieldPool = [...byPos.DEF, ...byPos.MID, ...byPos.FWD];
    const gk = take(byPos.GK, 1, players);
    const def = take(byPos.DEF, pick.def, outfieldPool);
    const mid = take(byPos.MID, pick.mid, outfieldPool);
    const fwd = take(byPos.FWD, pick.fwd, outfieldPool);
    const starterIds = new Set([...gk, ...def, ...mid, ...fwd].map(p => p._id || p.id));
    const remaining = normalized.filter(p => !starterIds.has(p._id || p.id));
    const bench = remaining.slice(0,4).map(p => ({ ...p, points: (p.gwPoints && p.gwPoints[gwNum]) ?? randPts() }));
    return { gk, def, mid, fwd, bench, formation: pick.name, gameweek: gwNum };
  };

  const gwDerived = team.lineup?.gameweek ?? team.currentGw ?? 1;
  
  // Lineup should already have gk/def/mid/fwd arrays from generator
  let displayLineup = team.lineup;
  if (team.lineup && !team.lineup.gk && team.lineup.starters) {
    // Legacy fallback: if only starters array exists, filter by position
    displayLineup = {
      ...team.lineup,
      gk: team.lineup.starters.filter(p => p.position === 'GK'),
      def: team.lineup.starters.filter(p => p.position === 'DEF'),
      mid: team.lineup.starters.filter(p => p.position === 'MID'),
      fwd: team.lineup.starters.filter(p => p.position === 'FWD'),
      bench: team.lineup.bench,
      formation: team.lineup.formation,
      gameweek: team.lineup.gameweek
    };
  } else if (!team.lineup) {
    displayLineup = buildFallbackLineup(team.players, gwDerived);
  }
  
  const gw = displayLineup?.gameweek ?? gwDerived;

  const chipBadgeText = {
    WC: 'Wildcard',
    FH: 'Free Hit',
    BB: 'Bench Boost',
    TC: 'Triple Captain',
    DGW: 'Dual Captain'
  };

  const Row = ({ players }) => (
    <div className="pv-row">
      {players.map((p, idx) => (
        <div className="pv-player" key={`${p._id || p.id || idx}`} data-captain={p.isCaptain ? 'true' : undefined}>
          <div className="pv-jersey-wrapper">
            <JerseyIcon size={22} {...kitColors(getTeamCode(p), p.position)} />
            {p.isCaptain && <span className="pv-captain-badge">C</span>}
            {!p.isCaptain && p.isViceCaptain && <span className="pv-vice-badge">VC</span>}
          </div>
          <div className="pv-name">{p.name}</div>
          <div className="pv-points">{p.points ?? 0} pts</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal pv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pv-header">
          <h3>{team.team}</h3>
          <span className="pv-sub">
            {team.user} • GW {gw} • {displayLineup?.formation || '—'}
            {displayLineup?.chipUsed && <span className="pv-chip-badge">{chipBadgeText[displayLineup.chipUsed] || displayLineup.chipUsed}</span>}
          </span>
        </div>
        <div className="pv-pitch">
          <Row players={displayLineup?.gk ?? []} />
          <Row players={displayLineup?.def ?? []} />
          <Row players={displayLineup?.mid ?? []} />
          <Row players={displayLineup?.fwd ?? []} />
          {displayLineup?.bench?.length ? (
            <div className="pv-bench">
              <div className="pv-bench-label">Bench</div>
              <Row players={displayLineup.bench} />
            </div>
          ) : null}
        </div>
        <div className="pv-actions">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
