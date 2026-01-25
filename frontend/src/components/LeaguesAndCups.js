import React, { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';
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

  // User's joined/created leagues removed (no longer needed)

  const getRankIndicator = (change) => {
    if (change > 0) {
      return { icon: <TrendingUp size={20} />, color: '#10b981', text: `+${change}` };
    } else if (change < 0) {
      return { icon: <TrendingDown size={20} />, color: '#ef4444', text: change };
    } else {
      return { icon: <Minus size={20} />, color: '#9ca3af', text: '—' };
    }
  };
  // User leagues rendering removed. Only Acity League and Cup logic remains.

  // Cup status logic moved to its own function
  function cupStatus() {
    if (currentGameweek === 9) {
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
  }

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
