import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import api from '../utils/api';
import './LeaguesAndCups.css';
import OverallLeague from './OverallLeague';
import OverallTeamPitchModal from './OverallTeamPitchModal';
import ConfigureLeaguesPage from './ConfigureLeaguesPage';
import AcityCupBracket from './AcityCupBracket';
import FantasySeasonPodium, { FANTASY_MAX_MATCHWEEK } from './FantasySeasonPodium';
import FantasyLeagueUserStatus from './FantasyLeagueUserStatus';
import { deriveUserLeagueStatus, isSameFantasyUser, normalizeSeasonResults } from '../utils/fantasyLeagueStatus';

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

export default function LeaguesAndCups({ onBack, user }) {
  const [activeTab, setActiveTab] = useState('leagues'); // 'leagues' | 'cups'
  const [showConfigure, setShowConfigure] = useState(false);
  const [currentGameweek, setCurrentGameweek] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/fantasy/season');
        if (!cancelled && data?.success) {
          setCurrentGameweek(data.currentGameweek || 1);
        }
      } catch {
        /* keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Mock data - replace with real backend data
  const [leagueEntries, setLeagueEntries] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [latestCompletedGameweek, setLatestCompletedGameweek] = useState(0);
  const [seasonComplete, setSeasonComplete] = useState(false);
  const [champion, setChampion] = useState(null);
  const [runnerUp, setRunnerUp] = useState(null);
  const [preseason, setPreseason] = useState(true);

  const userRank = useMemo(() => {
    if (preseason || !leagueEntries.length || !user) return null;
    const row = leagueEntries.find((r) => sameManager(r, user));
    return row?.pos ?? null;
  }, [leagueEntries, user, preseason]);

  const seasonResults = useMemo(
    () =>
      normalizeSeasonResults({
        seasonComplete,
        latestCompletedGameweek,
        preseason,
        champion,
        runnerUp,
        entries: leagueEntries,
        maxMatchweek: FANTASY_MAX_MATCHWEEK,
      }),
    [seasonComplete, latestCompletedGameweek, preseason, champion, runnerUp, leagueEntries]
  );

  const leagueStatus = useMemo(
    () =>
      deriveUserLeagueStatus({
        seasonComplete: seasonResults.seasonComplete,
        champion: seasonResults.champion,
        runnerUp: seasonResults.runnerUp,
        user,
        displayRank: userRank,
        userEntry: leagueEntries.find((r) => isSameFantasyUser(r, user)) || null,
      }),
    [seasonResults, user, userRank, leagueEntries]
  );

  const overallLeague = useMemo(
    () => ({
      name: 'Overall Acity League',
      rank: userRank ?? '—',
      rankChange: 0,
      totalPlayers: leagueEntries.length,
    }),
    [userRank, leagueEntries.length]
  );

  const getRankIndicator = (change) => {
    if (change > 0) {
      return { icon: <TrendingUp size={20} />, color: '#10b981', text: `+${change}` };
    } else if (change < 0) {
      return { icon: <TrendingDown size={20} />, color: '#ef4444', text: change };
    }
    return { icon: <Minus size={20} />, color: '#9ca3af', text: '—' };
  };

  const rankIndicator = getRankIndicator(overallLeague.rankChange);

  const [showOverallTable, setShowOverallTable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/fantasy/overall-league');
        if (!cancelled && data?.success) {
          setLeagueEntries(Array.isArray(data.entries) ? data.entries : []);
          setLatestCompletedGameweek(data.latestCompletedGameweek || 0);
          setSeasonComplete(Boolean(data.seasonComplete));
          setChampion(data.champion || null);
          setRunnerUp(data.runnerUp || null);
          setPreseason(data.preseason !== false);
        }
      } catch (err) {
        console.error('Failed to load overall league:', err);
        if (!cancelled) setLeagueEntries([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentGameweek]);

  const openOverall = () => setShowOverallTable(true);
  const closeOverall = () => setShowOverallTable(false);
  const onRowClick = (team) => setSelectedTeam(team);
  const closeTeamModal = () => setSelectedTeam(null);

  return (
    <div className="leagues-cups-container">
      {/* Hide header and tabs when ConfigureLeaguesPage is shown */}
      {!showConfigure && (
        <>
          <div className="leagues-cups-header">
            {!showOverallTable && (
              <button className="back-link" onClick={onBack}>
                <ArrowLeft size={18} />
                <span>Back</span>
              </button>
            )}
            <h2>Leagues & Cups</h2>
          </div>
          {/* Tabs */}
          {!showOverallTable && (
            <div className="lc-tabs">
              <button
                className={`lc-tab ${activeTab === 'leagues' ? 'active' : ''}`}
                onClick={() => setActiveTab('leagues')}
              >
                Leagues
              </button>
              <button
                className={`lc-tab ${activeTab === 'cups' ? 'active' : ''}`}
                onClick={() => setActiveTab('cups')}
              >
                Cups
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === 'leagues' ? (
        <div className="leagues-content">
          {/* Show ConfigureLeaguesPage if triggered */}
          {showConfigure ? (
            <ConfigureLeaguesPage onBack={() => setShowConfigure(false)} />
          ) : !showOverallTable ? (
            <>
              <FantasyLeagueUserStatus status={leagueStatus} />
              <FantasySeasonPodium
                seasonComplete={seasonResults.seasonComplete}
                champion={seasonResults.champion}
                runnerUp={seasonResults.runnerUp}
                user={user}
                latestCompletedGameweek={latestCompletedGameweek}
                maxMatchweek={FANTASY_MAX_MATCHWEEK}
                compact
              />
              <div className="league-overall-card" onClick={openOverall} role="button" aria-label="Open Overall Acity League">
                <div className="league-overall-card-header">
                  <h3>Overall Acity League</h3>
                  <div className="rank-indicator" style={{ color: rankIndicator.color }}>
                    {typeof overallLeague.rank === 'number' ? (
                      <>
                        <span className="league-overall-rank">{overallLeague.rank}</span>
                        {rankIndicator.icon}
                      </>
                    ) : (
                      rankIndicator.icon
                    )}
                    <span style={{ marginLeft: 6 }}>{rankIndicator.text}</span>
                  </div>
                </div>
                <p className="league-overall-sub">
                  {seasonResults.seasonComplete && seasonResults.champion
                    ? `Season complete · Champion: ${seasonResults.champion.teamName}`
                    : 'Tap to view full standings'}
                </p>
              </div>

              {/* Removed Configure Leagues and Invitational Classic Leagues logic as requested */}
            </>
          ) : (
            <div>
              <div className="leagues-cups-subheader">
                <button className="back-link" onClick={closeOverall}>
                  <ArrowLeft size={16} />
                  <span>Back to Leagues</span>
                </button>
                <h3>Overall Acity League Standings</h3>
              </div>
              <FantasyLeagueUserStatus status={leagueStatus} />
              <FantasySeasonPodium
                seasonComplete={seasonResults.seasonComplete}
                champion={seasonResults.champion}
                runnerUp={seasonResults.runnerUp}
                user={user}
                latestCompletedGameweek={latestCompletedGameweek}
                maxMatchweek={FANTASY_MAX_MATCHWEEK}
              />
              <OverallLeague
                entries={leagueEntries}
                onRowClick={onRowClick}
                seasonComplete={seasonResults.seasonComplete}
              />
            </div>
          )}

          {/* Invitational Leagues Section removed as requested */}
          {selectedTeam && (
            <OverallTeamPitchModal
              team={selectedTeam}
              latestCompletedGameweek={latestCompletedGameweek}
              onClose={closeTeamModal}
            />
          )}
        </div>
      ) : (
        <div className="cups-content cups-content--acfpl">
          <AcityCupBracket variant="full" user={user} />
        </div>
      )}
    </div>
  );
}
