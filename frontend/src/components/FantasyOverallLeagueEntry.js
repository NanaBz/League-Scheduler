import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Minus } from 'lucide-react';
import api from '../utils/api';
import OverallLeague from './OverallLeague';
import OverallTeamPitchModal from './OverallTeamPitchModal';
import './FantasyDashboard.css';

function sameManager(row, user) {
  if (!user || !row) return false;
  if (row.fantasyUserId && user.id && String(row.fantasyUserId) === String(user.id)) return true;
  const a = String(row.user || '').trim().toLowerCase();
  const b = String(user.managerName || '').trim().toLowerCase();
  if (a && b && a === b) return true;
  const t = String(row.team || '').trim().toLowerCase();
  const ut = String(user.teamName || '').trim().toLowerCase();
  return Boolean(t && ut && t === ut);
}

export default function FantasyOverallLeagueEntry({ user }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showStandings, setShowStandings] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [preseason, setPreseason] = useState(true);
  const [latestCompletedGameweek, setLatestCompletedGameweek] = useState(0);

  const loadStandings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await api.get('/fantasy/overall-league');
      if (data?.success) {
        setEntries(Array.isArray(data.entries) ? data.entries : []);
        setPreseason(data.preseason !== false);
        setLatestCompletedGameweek(data.latestCompletedGameweek || 0);
      } else {
        setEntries([]);
        setLoadError(data?.message || 'Could not load standings.');
      }
    } catch (err) {
      setEntries([]);
      const status = err.response?.status;
      if (status === 404) {
        setLoadError(
          'Standings API not found — restart your local backend (npm run dev) so the latest fantasy routes are loaded.'
        );
      } else {
        setLoadError(err.response?.data?.message || err.message || 'Could not load standings.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStandings();
  }, [loadStandings]);

  const rankingLive = !preseason;

  const { displayRank, delta } = useMemo(() => {
    if (!rankingLive || !entries.length) {
      return { displayRank: null, delta: 'same' };
    }
    const sorted = [...entries].sort((a, b) => {
      const td = (b.total ?? 0) - (a.total ?? 0);
      if (td !== 0) return td;
      return (b.gw ?? 0) - (a.gw ?? 0);
    });
    const idx = sorted.findIndex((r) => sameManager(r, user));
    if (idx < 0) return { displayRank: null, delta: 'same' };
    const row = sorted[idx];
    return { displayRank: row.pos ?? idx + 1, delta: row.delta || 'same' };
  }, [entries, user, rankingLive]);

  const openStandings = useCallback(() => {
    setShowStandings(true);
    loadStandings();
  }, [loadStandings]);

  const closeStandings = useCallback(() => {
    setShowStandings(false);
    setSelectedTeam(null);
  }, []);

  if (showStandings) {
    return (
      <div className="fantasy-oal-full">
        <div className="fantasy-oal-full-head">
          <button type="button" className="fantasy-oal-back" onClick={closeStandings}>
            <ArrowLeft size={18} aria-hidden />
            <span>Back</span>
          </button>
          <h3 className="fantasy-oal-full-title">Overall Acity League</h3>
        </div>
        {loading ? (
          <p className="fantasy-oal-loading">Loading standings…</p>
        ) : loadError ? (
          <p className="fantasy-oal-loading fantasy-oal-error">{loadError}</p>
        ) : (
          <OverallLeague entries={entries} onRowClick={setSelectedTeam} hideLastUpdated />
        )}
        {selectedTeam ? (
          <OverallTeamPitchModal
            team={selectedTeam}
            latestCompletedGameweek={latestCompletedGameweek}
            onClose={() => setSelectedTeam(null)}
          />
        ) : null}
      </div>
    );
  }

  const rankNum = displayRank != null ? String(displayRank) : '—';
  const showColoredDelta = rankingLive && displayRank != null;

  return (
    <div className="fantasy-oal-block">
      <button
        type="button"
        className="fantasy-oal-strip"
        onClick={openStandings}
        aria-label="Open Overall Acity League standings"
      >
        <span className="fantasy-oal-strip-title">Overall Acity League</span>
        <span className="fantasy-oal-strip-right">
          <span className="fantasy-oal-strip-rank">{rankNum}</span>
          {showColoredDelta ? (
            <span
              className={`fantasy-oal-strip-icon fantasy-oal-strip-icon--${delta === 'up' ? 'up' : delta === 'down' ? 'down' : 'same'}`}
              aria-hidden
            >
              {delta === 'up' ? <ChevronUp size={16} strokeWidth={3} /> : null}
              {delta === 'down' ? <ChevronDown size={16} strokeWidth={3} /> : null}
              {delta === 'same' ? <Minus size={14} strokeWidth={3} /> : null}
            </span>
          ) : (
            <span className="fantasy-oal-strip-icon fantasy-oal-strip-icon--pending" aria-hidden>
              <Minus size={14} strokeWidth={3} />
            </span>
          )}
        </span>
      </button>
    </div>
  );
}
