import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Crown, Star, Target, Zap } from 'lucide-react';
import './OverallTeamPitchModal.css';
import JerseyIcon from './JerseyIcon';
import { getTeamCode, kitColors } from '../utils/fantasyKitColors';
import { formationFromLineup } from '../utils/fantasyLineup';
import api from '../utils/api';

const CHIP_META = {
  WC: { name: 'Wildcard', Icon: Zap },
  FH: { name: 'Free Hit', Icon: Target },
  BB: { name: 'Bench Boost', Icon: BarChart3 },
  TC: { name: 'Triple Captain', Icon: Crown },
  DC: { name: 'Duo Captain', Icon: Star },
};

function displayToLineupShape(display) {
  if (!display) return null;
  return {
    starters: {
      gk: display.gk || [],
      df: display.def || [],
      mf: display.mid || [],
      att: display.fwd || [],
    },
    bench: display.bench || [],
  };
}

function PitchPlayer({ player, showPoints = true }) {
  if (!player) return null;
  const pid = player._id || player.id;
  return (
    <div
      className="pv-player-slot"
      data-captain={player.isCaptain ? 'true' : undefined}
      data-vice={player.isViceCaptain ? 'true' : undefined}
    >
      {player.isCaptain ? <span className="pv-role-chip">C</span> : null}
      {player.isViceCaptain && !player.isCaptain ? (
        <span className="pv-role-chip pv-role-chip-vc">V</span>
      ) : null}
      <JerseyIcon size={40} {...kitColors(getTeamCode(player), player.position)} />
      <div className="pv-player-info">
        <span className="pv-player-name">{player.name || '—'}</span>
        {showPoints ? (
          <span className="pv-player-points">{player.points ?? 0} pts</span>
        ) : null}
      </div>
    </div>
  );
}

function BenchPlayer({ player, benchBoost }) {
  if (!player) {
    return (
      <div className="pv-bench-card pv-bench-card--empty">
        <span className="pv-bench-name">—</span>
      </div>
    );
  }
  return (
    <div className={`pv-bench-card${benchBoost ? ' pv-bench-card--boost' : ''}`}>
      <JerseyIcon size={32} {...kitColors(getTeamCode(player), player.position)} />
      <div className="pv-bench-info">
        <span className="pv-bench-name">{player.name || '—'}</span>
        <span className="pv-bench-points">{(player.rawPoints ?? player.points ?? 0)} pts</span>
      </div>
    </div>
  );
}

export default function OverallTeamPitchModal({ team, onClose, latestCompletedGameweek }) {
  const [loading, setLoading] = useState(true);
  const [viewData, setViewData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!team?.fantasyUserId) {
      setLoading(false);
      setError('Manager not found.');
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = latestCompletedGameweek ? { gameweek: latestCompletedGameweek } : {};
        const { data } = await api.get(`/fantasy/managers/${team.fantasyUserId}/team-view`, { params });
        if (cancelled) return;
        if (!data?.success) {
          setError(data?.message || 'Could not load team.');
          return;
        }
        setViewData(data);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Could not load team.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [team?.fantasyUserId, latestCompletedGameweek]);

  const displayLineup = viewData?.lineup;
  const gw = viewData?.gameweek ?? latestCompletedGameweek ?? '—';
  const chipUsed = viewData?.chipUsed;
  const benchBoost = chipUsed === 'BB';

  const formation = useMemo(() => {
    const shape = displayToLineupShape(displayLineup);
    return shape ? formationFromLineup(shape) : { label: '—', def: 0, mid: 0, att: 0 };
  }, [displayLineup]);

  const benchPlayers = useMemo(() => {
    const bench = displayLineup?.bench || [];
    return Array.from({ length: 4 }, (_, i) => bench[i] || null);
  }, [displayLineup]);

  const benchTotal = viewData?.benchPoints ?? (displayLineup?.bench || []).reduce(
    (s, p) => s + ((p?.rawPoints ?? p?.points) || 0),
    0
  );

  if (!team) return null;

  const chipMeta = chipUsed ? CHIP_META[chipUsed] : null;

  return (
    <div className="modal-overlay pv-overlay" onClick={onClose}>
      <div className="modal pv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pv-header">
          <div className="pv-header-main">
            <h3>{team.team}</h3>
            <button type="button" className="pv-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
          <p className="pv-sub">
            {team.user} · GW {gw} · {formation.label}
            {viewData?.points != null ? ` · ${viewData.points} pts total` : ''}
          </p>
        </div>

        {chipMeta ? (
          <div className="pv-chip-banner" data-chip={chipUsed}>
            <chipMeta.Icon size={20} strokeWidth={2.2} aria-hidden />
            <span className="pv-chip-banner__name">{chipMeta.name} played</span>
            {chipUsed === 'BB' ? (
              <span className="pv-chip-banner__detail">Bench scores count · {benchTotal} bench pts</span>
            ) : null}
            {chipUsed === 'TC' ? (
              <span className="pv-chip-banner__detail">Captain points tripled</span>
            ) : null}
            {chipUsed === 'DC' ? (
              <span className="pv-chip-banner__detail">Captain & vice-captain doubled</span>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <p className="pv-message">Loading team…</p>
        ) : error ? (
          <p className="pv-message pv-message--error">{error}</p>
        ) : !viewData?.viewable ? (
          <p className="pv-message">
            {viewData?.message ||
              "This manager's team is hidden until the gameweek has finished."}
          </p>
        ) : (
          <>
            <div className="pv-formation-display">
              <span className="pv-formation-label">Formation</span>
              <span className="pv-formation-value">{formation.label}</span>
            </div>

            <div className="pv-formation-pitch" aria-label="Starting 9">
              <div className="pv-formation-row">
                {(displayLineup?.gk || []).map((p, idx) => (
                  <PitchPlayer key={p._id || idx} player={p} />
                ))}
              </div>
              <div className={`pv-formation-row df-row-${formation.def}`}>
                {(displayLineup?.def || []).map((p, idx) => (
                  <PitchPlayer key={p._id || idx} player={p} />
                ))}
              </div>
              <div className={`pv-formation-row mf-row-${formation.mid}`}>
                {(displayLineup?.mid || []).map((p, idx) => (
                  <PitchPlayer key={p._id || idx} player={p} />
                ))}
              </div>
              <div className={`pv-formation-row att-row-${formation.att}`}>
                {(displayLineup?.fwd || []).map((p, idx) => (
                  <PitchPlayer key={p._id || idx} player={p} />
                ))}
              </div>
            </div>

            <section className="pv-bench-section" aria-label="Bench">
              <div className="pv-bench-header">
                <h4>Bench</h4>
                <span className="pv-bench-total">{benchTotal} pts</span>
              </div>
              <div className="pv-bench-players">
                {benchPlayers.map((p, idx) => (
                  <BenchPlayer key={p?._id || `bench-${idx}`} player={p} benchBoost={benchBoost} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
