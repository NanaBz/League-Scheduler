import React, { useState, useEffect } from 'react';
import { Trophy, Award, Star, Users, Zap, Cog, LogOut } from 'lucide-react';

import UserView from './components/UserView';
import AdminPanel from './components/AdminPanel';
import PlayerManagement from './components/PlayerManagement';
import AdminAuth from './components/AdminAuth';
import Footer from './components/Footer';
import Sidebar from './components/Sidebar';
import AdminSidebar from './components/AdminSidebar';
import StatsPage from './components/StatsPage';
import TeamsPage from './components/TeamsPage';
import GirlsTeamsPage from './components/GirlsTeamsPage';
import FantasyManagement from './components/FantasyManagement';
import axios from 'axios';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('user');
  const [activeSection, setActiveSection] = useState('fixtures'); // fixtures | stats | teams | acwpl | fantasy
  const [selectedCompetition, setSelectedCompetition] = useState('league');
  // Expose setSelectedCompetition globally for Footer quick links
  React.useEffect(() => {
    window.setSelectedCompetition = (comp) => {
      setActiveTab('user');
      setActiveSection('fixtures');
      setSelectedCompetition(comp);
    };
    return () => { delete window.setSelectedCompetition; };
  }, []);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminToken, setAdminToken] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [adminData, setAdminData] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const [adminSection, setAdminSection] = useState('fixtures-mgmt'); // fixtures-mgmt | players-mgmt | fantasy-mgmt
  const [competitions] = useState({
    league: { name: 'League', description: 'Circle Method league' },
    cup: { name: 'Agha Cup', description: 'Knockout cup for top 4 teams' },
    'super-cup': { name: 'Super Cup', description: 'League winner vs Cup winner' }
  });

  // Force production API URL
    const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://league-scheduler.onrender.com/api'
    : process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

  // App initialization and token verification
  useEffect(() => {
    const initializeApp = async () => {
      const token = localStorage.getItem('adminToken');
      
      if (token) {
        try {
          const response = await axios.get(`${API_BASE_URL}/auth/verify`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (response.data.success) {
            setIsAdmin(true);
            setAdminData(response.data.admin);
            setAdminToken(token);
          } else {
            localStorage.removeItem('adminToken');
          }
        } catch (error) {
          console.log('Token verification failed:', error);
          localStorage.removeItem('adminToken');
        }
      }
      
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    };

    initializeApp();
  }, [API_BASE_URL]);

  const handleAdminLogin = (admin, token) => {
    setIsAdmin(true);
    setAdminData(admin);
    setAdminToken(token);
    setShowLogin(false);
    setActiveTab('admin');
  };

  const handleLogout = async () => {
    try {
      if (adminToken) {
        await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
      }
    } catch (error) {
      console.log('Logout error:', error);
    } finally {
      localStorage.removeItem('adminToken');
      setIsAdmin(false);
      setAdminData(null);
      setAdminToken(null);
      setActiveTab('user');
    }
  };

  const handleDataChange = () => {
    setDataRefreshKey(prev => prev + 1);
    console.log('Data changed - triggering UserView refresh');
  };

  const [girlsTeamsActive, setGirlsTeamsActive] = useState(false);

  if (isLoading) {
    return (
      <div className="loading-screen">
          <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>Acity Premier League</h2>
          <p>Loading your football management system...</p>
          <div className="loading-bar">
            <div className="loading-progress"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="container">
        {/* Unified Top Navigation Bar */}
        <nav className="unified-top-nav">
          {/* Left Section: Brand */}
          <div className="nav-brand">
            <img src="/logos/acity-sports-logo.jpg" alt="Acity Sports" className="nav-logo" style={{ borderRadius: '50%' }} />
            <h1>Acity Premier League</h1>
          </div>
          
          {/* Center Section: Competition Navigation (only when on Fixtures section) */}
          {activeTab === 'user' && activeSection === 'fixtures' && (
            <div className="nav-competitions">
              <button
                className={`comp-nav-btn ${selectedCompetition === 'league' ? 'active' : ''}`}
                onClick={() => setSelectedCompetition('league')}
              >
                <Trophy size={16} />
                <span className="comp-text">League</span>
              </button>
              <button
                className={`comp-nav-btn ${selectedCompetition === 'cup' ? 'active' : ''}`}
                onClick={() => setSelectedCompetition('cup')}
              >
                <Award size={16} />
                <span className="comp-text">Agha Cup</span>
              </button>
              <button
                className={`comp-nav-btn ${selectedCompetition === 'super-cup' ? 'active' : ''}`}
                onClick={() => setSelectedCompetition('super-cup')}
              >
                <Star size={16} />
                <span className="comp-text">Super Cup</span>
              </button>
              <button
                className={`comp-nav-btn ${selectedCompetition === 'acwpl' ? 'active' : ''}`}
                onClick={() => setSelectedCompetition('acwpl')}
              >
                <Users size={16} />
                <span className="comp-text">ACWPL</span>
              </button>
            </div>
          )}
        </nav>

        {/* Desktop Sidebar */}
        <div className="layout-with-sidebar">
          <div className="desktop-only">
            {activeTab === 'user' ? (
              <Sidebar
                activeSection={activeSection}
                onSelect={(id) => {
                  setActiveTab('user');
                  if (id === 'acwpl') { setActiveSection('fixtures'); setSelectedCompetition('acwpl'); }
                  else setActiveSection(id);
                }}
              />
            ) : isAdmin ? (
              <AdminSidebar
                activeSection={adminSection}
                onSelect={(id) => setAdminSection(id)}
                onSwitchToUser={() => setActiveTab('user')}
                isAdmin={isAdmin}
              />
            ) : null}
          </div>

          {/* Content Area */}
          <div className="content-area">

        {/* Mobile Bottom Navigation */}
        <nav className="mobile-nav">
          {/* App Sections on mobile */}
          {activeTab === 'user' && (
            <>
              <button
                className={`mobile-nav-item ${activeSection === 'fixtures' ? 'active' : ''}`}
                onClick={() => setActiveSection('fixtures')}
              >
                <div className="mobile-nav-icon"><Trophy size={20} /></div>
                <div>Fixtures</div>
              </button>
              <button
                className={`mobile-nav-item ${activeSection === 'stats' ? 'active' : ''}`}
                onClick={() => setActiveSection('stats')}
              >
                <div className="mobile-nav-icon"><Zap size={20} /></div>
                <div>Stats</div>
              </button>
              <button
                className={`mobile-nav-item ${activeSection === 'teams' ? 'active' : ''}`}
                onClick={() => setActiveSection('teams')}
              >
                <div className="mobile-nav-icon"><Users size={20} /></div>
                <div>Teams</div>
              </button>
              <button
                className={`mobile-nav-item ${activeSection === 'fantasy' ? 'active' : ''}`}
                onClick={() => setActiveSection('fantasy')}
              >
                <div className="mobile-nav-icon"><Star size={20} /></div>
                <div>Fantasy</div>
              </button>
            </>
          )}
          
          {/* Admin Panel Navigation */}
          {activeTab === 'admin' && isAdmin && (
            <>
              <button
                className="mobile-nav-item"
                onClick={() => setActiveTab('user')}
              >
                <Trophy size={18} />
                <div>League</div>
              </button>
              <button
                className="mobile-nav-item active"
              >
                <Cog size={18} />
                <div>Admin</div>
              </button>
              <button
                className="mobile-nav-item"
                onClick={handleLogout}
              >
                <LogOut size={18} />
                <div>Logout</div>
              </button>
            </>
          )}
        </nav>

        {/* Admin Authentication */}
        {showLogin && (
          <AdminAuth
            onLoginSuccess={handleAdminLogin}
            onCancel={() => setShowLogin(false)}
          />
        )}

        {/* Competition Info Banner (only fixtures) */}
        {activeTab === 'user' && activeSection === 'fixtures' && (
        <div className="competition-info">
          <h3>{competitions[selectedCompetition]?.name}</h3>
          <p>
            {selectedCompetition === 'league' && 
              'Circle Method format: Advanced mathematical scheduling ensuring each team plays every other team twice (home and away). 30 total matches across 10 matchweeks with randomized match order. Top 4 teams qualify for Agha Cup, bottom 2 miss out.'
            }
            {selectedCompetition === 'cup' && 
              'Knockout tournament for the top 4 teams from the previous league season. Semi-finals and final format with randomized draw.'
            }
            {selectedCompetition === 'super-cup' && 
              'Single match between the League champion and Cup winner. If the same team wins both, the runner-up plays instead.'
            }
          </p>
        </div>) }

        {/* Main Content */}
        {activeTab === 'user' ? (
          activeSection === 'fixtures' ? (
            <UserView 
              competitions={competitions}
              selectedCompetition={selectedCompetition}
              refreshKey={dataRefreshKey}
              isAdmin={isAdmin}
            />
          ) : activeSection === 'stats' ? (
            <StatsPage />
          ) : activeSection === 'teams' ? (
            <>
              {/* Toggle navigation for teams (always visible on teams page) */}
              <div className="toggle-bar" style={{ display: 'inline-flex', gap: 0, background: '#f3f4f6', borderRadius: 999, margin: '0 auto 18px', justifyContent: 'center', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <button
                  className="toggle-btn"
                  aria-current={!girlsTeamsActive ? 'page' : undefined}
                  style={{
                    fontWeight: 600,
                    padding: '8px 18px',
                    borderRadius: 999,
                    background: !girlsTeamsActive ? '#fff' : 'transparent',
                    color: '#1e293b',
                    border: 'none',
                    boxShadow: !girlsTeamsActive ? '0 0 0 2px #e5e7eb' : 'none',
                    cursor: !girlsTeamsActive ? 'default' : 'pointer',
                    transition: 'background 0.2s, color 0.2s',
                  }}
                  onClick={() => setGirlsTeamsActive(false)}
                  disabled={!girlsTeamsActive}
                >
                  Boys Teams
                </button>
                <button
                  className="toggle-btn"
                  aria-current={girlsTeamsActive ? 'page' : undefined}
                  style={{
                    fontWeight: 600,
                    padding: '8px 18px',
                    borderRadius: 999,
                    background: girlsTeamsActive ? '#fff' : 'transparent',
                    color: '#1e293b',
                    border: 'none',
                    boxShadow: girlsTeamsActive ? '0 0 0 2px #e5e7eb' : 'none',
                    cursor: girlsTeamsActive ? 'default' : 'pointer',
                    transition: 'background 0.2s, color 0.2s',
                  }}
                  onClick={() => setGirlsTeamsActive(true)}
                  disabled={girlsTeamsActive}
                >
                  Girls Teams
                </button>
              </div>
              {girlsTeamsActive ? (
                <GirlsTeamsPage />
              ) : (
                <TeamsPage refreshKey={dataRefreshKey} onNavigateToGirlsTeams={() => setGirlsTeamsActive(true)} />
              )}
            </>
          ) : activeSection === 'fantasy' ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minHeight: '40vh', textAlign: 'center', color: '#64748b', padding: '2rem'
            }}>
              <Star size={48} color="#fbbf24" style={{ marginBottom: 16 }} />
              <h2 style={{ fontWeight: 700, fontSize: '2rem', marginBottom: 8 }}>Fantasy Premier League</h2>
              <p style={{ fontSize: '1.2rem', marginBottom: 16 }}>Coming Soon!</p>
              <p style={{ fontSize: '1rem', color: '#94a3b8' }}>The Fantasy feature will be available in a future update. Stay tuned!</p>
            </div>
          ) : null
        ) : isAdmin ? (
          adminSection === 'fixtures-mgmt' ? (
            <AdminPanel onDataChange={handleDataChange} isAdmin={isAdmin} />
          ) : adminSection === 'players-mgmt' ? (
            <PlayerManagement onDataChange={handleDataChange} isAdmin={isAdmin} />
          ) : adminSection === 'fantasy-mgmt' ? (
            <FantasyManagement isAdmin={isAdmin} />
          ) : null
        ) : null}



        </div>{/* content-area */}
        </div>{/* layout-with-sidebar */}

        {/* Footer */}
        <Footer 
          isAdmin={isAdmin} 
          onLoginClick={() => setShowLogin(true)}
          onAdminClick={() => setActiveTab('admin')}
          onLogoutClick={handleLogout}
          onBackToLeagueClick={() => setActiveTab('user')}
          activeTab={activeTab}
        />
      </div>
    </div>
  );
}
export default App;
