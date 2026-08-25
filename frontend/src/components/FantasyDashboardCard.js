import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Medal } from 'lucide-react';
import api from '../utils/api';
import {
  userFixturePhase,
  statusBadgeClass,
  statusBadgeLabel,
  showFixtureScores,
} from '../utils/matchDisplayState';
import { deriveCurrentGameweek, deriveGameweekInfo } from '../utils/fantasyGameweek';
import { useFantasyDeadlineNotifications } from '../utils/fantasyDeadlineNotifications';
import { canExpandFixtureDetails, FixtureMatchStatsExpanded } from './FixtureMatchStatsPanel';
import OverallTeamPitchModal from './OverallTeamPitchModal';
import FantasyManagerProfile from './FantasyManagerProfile';
import './FantasyDashboard.css';

const FANTASY_MIN_MATCHWEEK = 1;
const FANTASY_MAX_MATCHWEEK = 10;

function formatDeadline(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const day = days[d.getDay()];
  const date = d.getDate();
  const month = months[d.getMonth()];
  const hours = d.getHours().toString().padStart(2,'0');
  const mins = d.getMinutes().toString().padStart(2,'0');
  return `${day} ${date} ${month} at ${hours}:${mins}`;
}

function toDate(dateStr, timeStr) {
  try {
    const d = new Date(dateStr);
    if (timeStr) {
      const [h, m] = timeStr.split(':').map(Number);
      d.setHours(h || 0, m || 0, 0, 0);
    }
    return d;
  } catch {
    return null;
  }
}

function formatFixtureWhen(dateStr, timeStr) {
  const d = toDate(dateStr, timeStr);
  if (!d || Number.isNaN(d.getTime())) return 'TBC';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = days[d.getDay()];
  const date = d.getDate();
  const month = months[d.getMonth()];
  if (timeStr) {
    const [h, m] = String(timeStr).split(':').map(Number);
    const hh = (h || 0).toString().padStart(2, '0');
    const mm = (m || 0).toString().padStart(2, '0');
    return `${day} ${date} ${month}, ${hh}:${mm}`;
  }
  return `${day} ${date} ${month}`;
}

function teamLabel(t) {
  if (!t) return 'TBC';
  if (typeof t === 'string') return t;
  return t.name || 'TBC';
}

function getTeamLogoClass(teamName) {
  if (!teamName) return 'team-logo';
  const baseClass = 'team-logo';
  const teamClass = `${String(teamName).toLowerCase()}-logo`;
  return `${baseClass} ${teamClass}`;
}

export default function FantasyDashboardCard({ user, onPickTeam, onTransfers, onLeaguesCups, onProfileViewChange }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [serverSeasonInfo, setServerSeasonInfo] = useState(null);
  const [countdownMs, setCountdownMs] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [gwSummary, setGwSummary] = useState(null);
  const [pointsModalOpen, setPointsModalOpen] = useState(false);
  const [highestModalOpen, setHighestModalOpen] = useState(false);
  const [fixtureWeek, setFixtureWeek] = useState(FANTASY_MIN_MATCHWEEK);
  const [expandedFixtureIds, setExpandedFixtureIds] = useState(() => new Set());
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    onProfileViewChange?.(showProfile);
  }, [showProfile, onProfileViewChange]);

  const toggleFixtureExpand = useCallback((matchId) => {
    const id = String(matchId);
    setExpandedFixtureIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Fetch server-provided season info (deadline/status) and published matches
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const s = await api.get('/fantasy/season');
        if (s?.data?.success) setServerSeasonInfo(s.data);
      } catch (err) {
        setServerSeasonInfo(null);
      }
      try {
        const { data } = await api.get('/matches', { params: { competition: 'league' } });
        setMatches(Array.isArray(data) ? data : []);
      } catch (err) {
        setMatches([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const fetchGwSummary = useCallback(async () => {
    if (!user?._id && !user?.id) return;
    setSummaryLoading(true);
    try {
      const { data } = await api.get('/fantasy/dashboard-summary');
      if (data?.success) setGwSummary(data);
      else setGwSummary(null);
    } catch {
      setGwSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchGwSummary();
  }, [fetchGwSummary]);

  const upcomingInfo = useMemo(() => {
    if (serverSeasonInfo?.deadline) {
      return { week: serverSeasonInfo.currentGameweek, deadline: serverSeasonInfo.deadline };
    }
    return deriveGameweekInfo(matches);
  }, [matches, serverSeasonInfo]);
  useFantasyDeadlineNotifications(upcomingInfo.deadline, upcomingInfo.week);

  // Countdown timer (ms remaining)
  useEffect(() => {
    let id = null;
    const update = () => {
      const dl = serverSeasonInfo?.deadline || upcomingInfo.deadline;
      if (!dl) {
        setCountdownMs(null);
        return;
      }
      const dt = new Date(dl);
      const now = new Date();
      const ms = Math.max(0, dt.getTime() - now.getTime());
      setCountdownMs(ms);
    };
    update();
    id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [serverSeasonInfo, upcomingInfo]);

  useEffect(() => {
    if (loading) return;
    setFixtureWeek(deriveCurrentGameweek(matches));
  }, [loading, matches]);

  const fixturesForWeek = useMemo(() => {
    return matches
      .filter((m) => (m.matchweek || 0) === fixtureWeek)
      .map((m) => ({ ...m, sortDt: toDate(m.date, m.time) }))
      .sort((a, b) => {
        const ta = a.sortDt?.getTime() ?? 0;
        const tb = b.sortDt?.getTime() ?? 0;
        return ta - tb;
      });
  }, [matches, fixtureWeek]);

  useEffect(() => {
    setExpandedFixtureIds(new Set());
  }, [fixtureWeek]);

  const initials = useMemo(() => {
    const name = user?.teamName || 'Team';
    const parts = name.trim().split(/\s+/);
    const letters = parts.slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('');
    return letters || 'TT';
  }, [user]);

  const displayGameweek = gwSummary?.displayGameweek ?? null;
  const averagePoints = gwSummary?.averagePoints ?? 0;
  const userPoints = gwSummary?.userPoints ?? 0;
  const highestPoints = gwSummary?.highestPoints ?? 0;
  const highestEntry = gwSummary?.highestEntry ?? null;
  const hasUserTeam = gwSummary?.hasUserTeam ?? false;
  const isManagerOfTheWeek = gwSummary?.isManagerOfTheWeek ?? false;
  const motwGameweek = gwSummary?.managerOfTheWeekGameweek ?? null;
  const fantasyUserId = user?._id || user?.id;

  const selfTeam = useMemo(() => ({
    fantasyUserId: String(fantasyUserId),
    team: user?.teamName || 'Your Team',
    user: user?.managerName || 'Manager',
  }), [fantasyUserId, user?.teamName, user?.managerName]);

  const canOpenPoints = displayGameweek && hasUserTeam;
  const canOpenHighest = displayGameweek && highestEntry && highestPoints > 0;

  const canPrevMw = fixtureWeek > FANTASY_MIN_MATCHWEEK;
  const canNextMw = fixtureWeek < FANTASY_MAX_MATCHWEEK;

  return (
    <>
    {showProfile ? (
      <FantasyManagerProfile user={user} onClose={() => setShowProfile(false)} />
    ) : (
    <div className="fantasy-card">
      <button
        type="button"
        className="top-row top-row--clickable"
        onClick={() => setShowProfile(true)}
        aria-label="Open manager profile"
      >
        <div className="user-block">
          <div className="avatar">{initials}</div>
          <div className="names">
            <div className="team-row">
              <div className="team">{user?.teamName || 'Your Team'}</div>
              {isManagerOfTheWeek && motwGameweek ? (
                <span
                  className="fantasy-motw-badge"
                  title={`Manager of the Week — Gameweek ${motwGameweek}`}
                >
                  <Medal size={12} aria-hidden="true" />
                  MOTW · GW{motwGameweek}
                </span>
              ) : null}
            </div>
            <div className="manager">{user?.managerName || 'Manager'}</div>
          </div>
        </div>
        <span className="fantasy-card-profile-arrow" aria-hidden>→</span>
      </button>

      <div className="divider" />

      <div className="gw-header">
        {loading ? 'Loading gameweek…' : (
          upcomingInfo.week ? `Gameweek ${upcomingInfo.week}` : 'Gameweek —'
        )}
      </div>

      {displayGameweek && displayGameweek !== upcomingInfo.week ? (
        <div className="gw-stats-note">Gameweek {displayGameweek} scores</div>
      ) : null}

      <div className="metrics">
        <div className="metric">
          <div className="label">Average</div>
          <div className="value">{summaryLoading ? '…' : Math.round(averagePoints)}</div>
        </div>
        <div
          className={`metric${canOpenPoints ? ' clickable' : ''}`}
          role={canOpenPoints ? 'button' : undefined}
          tabIndex={canOpenPoints ? 0 : undefined}
          onClick={() => canOpenPoints && setPointsModalOpen(true)}
          onKeyDown={(e) => {
            if (canOpenPoints && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setPointsModalOpen(true);
            }
          }}
        >
          <div className="label">Points →</div>
          <div className="value">{summaryLoading ? '…' : Math.round(userPoints)}</div>
        </div>
        <div
          className={`metric${canOpenHighest ? ' clickable' : ''}`}
          role={canOpenHighest ? 'button' : undefined}
          tabIndex={canOpenHighest ? 0 : undefined}
          onClick={() => canOpenHighest && setHighestModalOpen(true)}
          onKeyDown={(e) => {
            if (canOpenHighest && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setHighestModalOpen(true);
            }
          }}
        >
          <div className="label">Highest →</div>
          <div className="value">{summaryLoading ? '…' : Math.round(highestPoints)}</div>
        </div>
      </div>

      <div className="deadline">
        <p className="deadline-line">
          {loading
            ? 'Loading deadline…'
            : upcomingInfo.week != null
              ? `Gameweek ${upcomingInfo.week} deadline — ${upcomingInfo.deadline ? formatDeadline(upcomingInfo.deadline) : '—'}`
              : `Gameweek — deadline — ${upcomingInfo.deadline ? formatDeadline(upcomingInfo.deadline) : '—'}`}
        </p>
        {countdownMs != null ? (
          countdownMs > 0 ? (
            <div className="countdown">
              <strong>Transfers Close In</strong>
              <div className="countdown-values">
                {String(Math.floor(countdownMs / (24*60*60*1000))).padStart(2,'0')} Days
                {' '}
                {String(Math.floor((countdownMs % (24*60*60*1000)) / (60*60*1000))).padStart(2,'0')} Hours
                {' '}
                {String(Math.floor((countdownMs % (60*60*1000)) / (60*1000))).padStart(2,'0')} Minutes
                {' '}
                {String(Math.floor((countdownMs % (60*1000)) / 1000)).padStart(2,'0')} Seconds
              </div>
            </div>
          ) : (
            <div className="locked">
              🔒 Matchweek Locked — Transfers and team changes are unavailable.
            </div>
          )
        ) : null}
      </div>

      <div className="actions">
        <button type="button" className="btn-pill" onClick={onPickTeam}>Pick Team</button>
        <button type="button" className="btn-pill" onClick={onTransfers}>Transfers</button>
      </div>
    </div>
    )}

    {!showProfile ? (
    <section className="fantasy-upcoming-fixtures" aria-label="League fixtures by matchweek">
      <h3 className="fantasy-upcoming-title">Upcoming fixtures</h3>
      <div className="fantasy-mw-nav">
        <button
          type="button"
          className="fantasy-mw-arrow"
          disabled={!canPrevMw}
          aria-label="Previous matchweek"
          onClick={() => canPrevMw && setFixtureWeek((w) => Math.max(FANTASY_MIN_MATCHWEEK, w - 1))}
        >
          &lt;
        </button>
        <span className="fantasy-mw-label">Matchweek {fixtureWeek}</span>
        <button
          type="button"
          className="fantasy-mw-arrow"
          disabled={!canNextMw}
          aria-label="Next matchweek"
          onClick={() => canNextMw && setFixtureWeek((w) => Math.min(FANTASY_MAX_MATCHWEEK, w + 1))}
        >
          &gt;
        </button>
      </div>
      <div className="fantasy-fixture-list">
        {loading ? (
          <p className="fantasy-fixture-empty">Loading fixtures…</p>
        ) : fixturesForWeek.length === 0 ? (
          <p className="fantasy-fixture-empty">No published fixtures for this matchweek.</p>
        ) : (
          fixturesForWeek.map((m) => {
            const phase = userFixturePhase(m);
            const showStatus = phase !== 'scheduled';
            const home = m.homeTeam;
            const away = m.awayTeam;
            const homeName = teamLabel(home);
            const awayName = teamLabel(away);
            const mid = String(m._id);
            const expandable = canExpandFixtureDetails(m);
            const expanded = expandedFixtureIds.has(mid);
            const showScores = showFixtureScores(m);

            const rowKeyHandler = (e) => {
              if (!expandable) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleFixtureExpand(mid);
              }
            };

            return (
              <div key={m._id} className="fantasy-fixture-wrap">
                <div
                  className={`fantasy-fixture-row${expandable ? ' fantasy-fixture-row--clickable' : ''}`}
                  role={expandable ? 'button' : undefined}
                  tabIndex={expandable ? 0 : undefined}
                  aria-expanded={expandable ? expanded : undefined}
                  onClick={() => expandable && toggleFixtureExpand(mid)}
                  onKeyDown={rowKeyHandler}
                >
                  <div className="fantasy-fixture-teams">
                    <div className="fantasy-fixture-side fantasy-fixture-home">
                      {home?.logo ? (
                        <img
                          src={home.logo}
                          alt=""
                          className={getTeamLogoClass(home.name)}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : null}
                      <span className="fantasy-fixture-name">{homeName}</span>
                    </div>
                    <div className="fantasy-fixture-scorecol">
                      {showScores ? (
                        <span className="fantasy-fixture-score">
                          {m.homeScore} – {m.awayScore}
                        </span>
                      ) : (
                        <span className="fantasy-fixture-vs">v</span>
                      )}
                    </div>
                    <div className="fantasy-fixture-side fantasy-fixture-away">
                      <span className="fantasy-fixture-name">{awayName}</span>
                      {away?.logo ? (
                        <img
                          src={away.logo}
                          alt=""
                          className={getTeamLogoClass(away.name)}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : null}
                    </div>
                  </div>
                  <div className="fantasy-fixture-meta">
                    <span>{formatFixtureWhen(m.date, m.time)}</span>
                    {showStatus ? (
                      <span className={statusBadgeClass(phase)}>{statusBadgeLabel(phase)}</span>
                    ) : null}
                  </div>
                </div>
                {(phase === 'ft' || phase === 'live') && expanded && (
                  <div className="fantasy-fixture-expanded">
                    <FixtureMatchStatsExpanded match={m} variant="desktop" />
                  </div>
                )}
                {expandable ? (
                  <button
                    type="button"
                    className="fantasy-fixture-expand-hint"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFixtureExpand(mid);
                    }}
                  >
                    {expanded ? (
                      <>
                        <span aria-hidden>^</span> collapse
                      </>
                    ) : (
                      <>
                        <ChevronDown size={14} aria-hidden />
                        <span>expand for stats</span>
                      </>
                    )}
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </section>
    ) : null}

    {pointsModalOpen ? (
      <OverallTeamPitchModal
        team={selfTeam}
        latestCompletedGameweek={displayGameweek}
        onClose={() => setPointsModalOpen(false)}
      />
    ) : null}

    {highestModalOpen && highestEntry ? (
      <OverallTeamPitchModal
        team={highestEntry}
        latestCompletedGameweek={displayGameweek}
        onClose={() => setHighestModalOpen(false)}
      />
    ) : null}
    </>
  );
}
