import React, { useState, useEffect } from 'react';
import { LogOut, Plus, RefreshCw, Users, Settings } from 'lucide-react';
import CreateClassicLeagueForm from './CreateClassicLeagueForm';
import LeagueSettingsPage from './LeagueSettingsPage';
import './ConfigureLeaguesPage.css';
import { fetchUserLeagues, createLeague } from '../utils/api';

export default function ConfigureLeaguesPage({ onBack }) {
  const [showCreate, setShowCreate] = useState(false);
  const [leagues, setLeagues] = useState([]);
  const [settingsLeague, setSettingsLeague] = useState(null);

  // Fetch leagues from backend on mount
  useEffect(() => {
    fetchUserLeagues().then(setLeagues).catch(console.error);
  }, []);

  // Create league using backend
  const handleCreateLeague = async ({ leagueName }) => {
    if (leagues.length >= 15) return;
    await createLeague(leagueName);
    fetchUserLeagues().then(setLeagues);
    setShowCreate(false);
  };

  if (showCreate) {
    return <CreateClassicLeagueForm
      onBack={() => setShowCreate(false)}
      onCreate={handleCreateLeague}
      leagueLimit={15}
      leaguesCount={leagues.length}
    />;
  }
  if (settingsLeague) {
    return <LeagueSettingsPage
      league={settingsLeague}
      onBack={() => setSettingsLeague(null)}
      onUpdate={updated => {
        setLeagues(leagues.map(l => l.id === updated.id ? { ...l, ...updated } : l));
        setSettingsLeague(null);
      }}
      onDelete={id => {
        setLeagues(leagues.filter(l => l.id !== id));
        setSettingsLeague(null);
      }}
    />;
  }
  return (
    <div className="configure-leagues-container">
      <div className="configure-leagues-header">
        <button className="back-btn" onClick={onBack} aria-label="Back">&#8592;</button>
        <h2>Configure Leagues</h2>
      </div>
      <div className="configure-leagues-actions">
        <button className="league-action join"><Users size={22} /> Join a League</button>
        <button className="league-action create" onClick={() => setShowCreate(true)}><Plus size={22} /> Create a League</button>
        <button className="league-action renew"><RefreshCw size={22} /> Renew Your Leagues</button>
      </div>
      <div className="classic-leagues-section">
        <h3>Invitational Classic Leagues</h3>
        <div style={{fontSize: '0.92rem', color: '#64748b', marginBottom: 6}}>
          You can create or join up to 15 leagues. All your leagues will appear here.
        </div>
        <div className="classic-leagues-table">
          <div className="classic-leagues-header">
            <span>League</span>
            <span>Current Rank</span>
            <span>Last Rank</span>
            <span></span>
          </div>
          {leagues.map(league => (
            <div className="classic-leagues-row" key={league.id}>
              <span className="league-name">{league.name}</span>
              <span className="league-rank">{league.currentRank}</span>
              <span className="league-rank">{league.lastRank}</span>
              {league.createdByUser ? (
                <button className="exit-league-btn" title="League Settings" onClick={() => setSettingsLeague(league)}><Settings size={22} /></button>
              ) : (
                <button className="exit-league-btn" title="Leave League"><LogOut size={20} /></button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
