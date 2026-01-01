import React, { useState, useEffect } from 'react';
import { ArrowLeft, Settings, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import './LeaguesAndCups.css';
import OverallLeague from './OverallLeague';
// import OverallTeamModal from './OverallTeamModal';
import OverallTeamPitchModal from './OverallTeamPitchModal';
import ConfigureLeaguesPage from './ConfigureLeaguesPage';
import generateMockLeague from '../utils/fantasyMockData';

export default function LeaguesAndCups({ onBack }) {
  const [activeTab, setActiveTab] = useState('leagues'); // 'leagues' | 'cups'
  const [showConfigure, setShowConfigure] = useState(false);
  const [currentGameweek] = useState(() => {
    const saved = localStorage.getItem('fantasyCurrentGameweek');
    return saved ? parseInt(saved) : 1;
  });

  // Mock data - replace with real backend data
  const overallLeague = {
    name: 'Overall Acity League',
    rank: 39,
    rankChange: 1, // positive = up, negative = down, 0 = same
    totalPlayers: 150
  };

  // User's joined/created leagues (should be set from backend or parent props)
  const [userLeagues] = useState([]);

  const getRankIndicator = (change) => {
    if (change > 0) {
      return { icon: <TrendingUp size={20} />, color: '#10b981', text: `+${change}` };
    } else if (change < 0) {
      return { icon: <TrendingDown size={20} />, color: '#ef4444', text: change };
    } else {
      return { icon: <Minus size={20} />, color: '#9ca3af', text: '—' };
    }
  };

  const cupStatus = () => {
    if (currentGameweek < 6) {
      return {
        status: 'upcoming',
        message: `Cup will commence after Gameweek 6. Top 32 players will qualify.`,
        details: 'Qualify by being in the top 32 before MW6'
      };
    } else if (currentGameweek === 6) {
      return {
        status: 'active',
        round: 'Round of 32',
        message: 'Cup Round of 32 is live!'
      };
    } else if (currentGameweek === 7) {
      return {
        status: 'active',
        round: 'Round of 16',
        message: 'Cup Round of 16 is live!'
      };
    } else if (currentGameweek === 8) {
      return {
        status: 'active',
        round: 'Quarter Finals',
        message: 'Cup Quarter Finals are live!'
      };
    } else if (currentGameweek === 9) {
      return {
        status: 'active',
        round: 'Semi Finals',
        message: 'Cup Semi Finals are live!'
      };
    } else if (currentGameweek === 10) {
      return {
        status: 'active',
        round: 'Final',
        message: 'Cup Final is live!'
      };
    } else {
      return {
        status: 'completed',
        message: 'Cup has concluded. Check back next season!'
      };
    }
  };

  const rankIndicator = getRankIndicator(overallLeague.rankChange);
  const cup = cupStatus();

  const [showOverallTable, setShowOverallTable] = useState(false);
  const [leagueEntries, setLeagueEntries] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);

  // Load mock league data with async API call
  useEffect(() => {
    generateMockLeague(currentGameweek).then(setLeagueEntries).catch(err => {
      console.error('Failed to load league:', err);
      setLeagueEntries([]);
    });
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
              <div className="league-overall-card" onClick={openOverall} role="button" aria-label="Open Overall Acity League">
                <div className="league-overall-card-header">
                  <h3>Overall Acity League</h3>
                  <div className="rank-indicator" style={{ color: rankIndicator.color }}>
                    {rankIndicator.icon}
                    <span style={{ marginLeft: 6 }}>{rankIndicator.text}</span>
                  </div>
                </div>
                <p className="league-overall-sub">Tap to view full standings</p>
              </div>

              {/* Configure Leagues Button (only this has settings icon) */}
              <div className="league-configure-card" role="button" aria-label="Configure Leagues" tabIndex={0} style={{marginTop: 8, padding: '8px 10px', borderRadius: 10, background: '#f3f4f6', boxShadow: '0 1px 4px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', minHeight: 0}}
                onClick={() => setShowConfigure(true)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setShowConfigure(true); }}
              >
                <Settings size={18} style={{color: '#6d28d9', minWidth: 18}} />
                <div>
                  <div style={{fontWeight: 700, fontSize: '0.98rem', color: '#1e293b', lineHeight: 1}}>Configure Leagues</div>
                  <div style={{fontSize: '0.85rem', color: '#475569', lineHeight: 1.1}}>Manage your league settings</div>
                </div>
              </div>

              {/* Heading for Invitational Classic Leagues */}
              <div style={{marginTop: 18, marginBottom: 2, fontWeight: 700, fontSize: '1.08rem', color: '#1e293b', letterSpacing: 0.2}}>
                Invitational Classic Leagues
              </div>
              {/* User Leagues List (alphabetical, no settings, rank at far right) - now below Configure Leagues */}
              <div className="user-leagues-list">
                {userLeagues && userLeagues.length > 0 &&
                  userLeagues
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(league => (
                      <div className="user-league-tab" key={league.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#4f267b',
                        color: '#fff',
                        borderRadius: 14,
                        margin: '10px 0 0 0',
                        padding: '16px 18px',
                        fontWeight: 600,
                        fontSize: '1.08rem',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                        cursor: 'pointer',
                        minHeight: 0
                      }}>
                        <span>{league.name}</span>
                        <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '1.05rem', color: '#10b981' }}>
                          {league.rank !== undefined ? `#${league.rank}` : '-'}
                        </span>
                      </div>
                    ))
                }
              </div>
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
              <OverallLeague entries={leagueEntries} onRowClick={onRowClick} />
            </div>
          )}

          {/* Invitational Leagues Section removed as requested */}
          {selectedTeam && (
            <OverallTeamPitchModal team={selectedTeam} onClose={closeTeamModal} />
          )}
        </div>
      ) : (
        <div className="cups-content">
          {cup.status === 'upcoming' ? (
            <div className="cup-upcoming">
              <div className="cup-icon">🏆</div>
              <h3>Acity Cup</h3>
              <p className="cup-message">{cup.message}</p>
              <div className="cup-details">
                <p>{cup.details}</p>
              </div>
              <div className="cup-schedule">
                <h4>Cup Schedule</h4>
                <div className="schedule-list">
                  <div className="schedule-item">
                    <span className="schedule-round">Round of 32</span>
                    <span className="schedule-gw">Gameweek 6</span>
                  </div>
                  <div className="schedule-item">
                    <span className="schedule-round">Round of 16</span>
                    <span className="schedule-gw">Gameweek 7</span>
                  </div>
                  <div className="schedule-item">
                    <span className="schedule-round">Quarter Finals</span>
                    <span className="schedule-gw">Gameweek 8</span>
                  </div>
                  <div className="schedule-item">
                    <span className="schedule-round">Semi Finals</span>
                    <span className="schedule-gw">Gameweek 9</span>
                  </div>
                  <div className="schedule-item">
                    <span className="schedule-round">Final</span>
                    <span className="schedule-gw">Gameweek 10</span>
                  </div>
                </div>
              </div>
            </div>
          ) : cup.status === 'active' ? (
            <div className="cup-active">
              <div className="cup-round-header">
                <div className="cup-icon">🏆</div>
                <h3>{cup.round}</h3>
                <p className="cup-message">{cup.message}</p>
              </div>
              <div className="cup-bracket">
                <p className="bracket-placeholder">Cup bracket will be displayed here</p>
              </div>
            </div>
          ) : (
            <div className="cup-completed">
              <div className="cup-icon">🏆</div>
              <h3>Cup Completed</h3>
              <p className="cup-message">{cup.message}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
