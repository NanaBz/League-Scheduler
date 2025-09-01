import React, { useState, useEffect } from 'react';

import UserView from './components/UserView';
import AdminPanel from './components/AdminPanel';
import AdminAuth from './components/AdminAuth';
import Footer from './components/Footer';
import axios from 'axios';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('user');
  const [selectedCompetition, setSelectedCompetition] = useState('league');
  // Expose setSelectedCompetition globally for Footer quick links
  React.useEffect(() => {
    window.setSelectedCompetition = (comp) => {
      setActiveTab('user');
      setSelectedCompetition(comp);
    };
    return () => { delete window.setSelectedCompetition; };
  }, []);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminToken, setAdminToken] = useState(null);
  const [adminData, setAdminData] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
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

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h2>⚽ Acity League Scheduler</h2>
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
            <h1>⚽ Acity League Scheduler</h1>
            <p>Football League Management System</p>
          </div>
          
          {/* Center Section: Competition Navigation (only when in user view) */}
          {activeTab === 'user' && (
            <div className="nav-competitions">
              <button
                className={`comp-nav-btn ${selectedCompetition === 'league' ? 'active' : ''}`}
                onClick={() => setSelectedCompetition('league')}
              >
                <span className="comp-icon">🏆</span>
                <span className="comp-text">League</span>
              </button>
              <button
                className={`comp-nav-btn ${selectedCompetition === 'cup' ? 'active' : ''}`}
                onClick={() => setSelectedCompetition('cup')}
              >
                <span className="comp-icon">🏅</span>
                <span className="comp-text">Agha Cup</span>
              </button>
              <button
                className={`comp-nav-btn ${selectedCompetition === 'super-cup' ? 'active' : ''}`}
                onClick={() => setSelectedCompetition('super-cup')}
              >
                <span className="comp-icon">⭐</span>
                <span className="comp-text">Super Cup</span>
              </button>
              <button
                className={`comp-nav-btn ${selectedCompetition === 'acwpl' ? 'active' : ''}`}
                onClick={() => setSelectedCompetition('acwpl')}
              >
                <span className="comp-icon">👧</span>
                <span className="comp-text">Girls League</span>
              </button>
            </div>
          )}
        </nav>

        {/* Mobile Bottom Navigation */}
        <nav className="mobile-nav">
          {/* League Sub-Navigation when on user tab */}
          {activeTab === 'user' && (
            <>
              <button
                className={`mobile-nav-item ${selectedCompetition === 'league' ? 'active' : ''}`}
                onClick={() => setSelectedCompetition('league')}
              >
                <div className="mobile-nav-icon">🏆</div>
                <div>League</div>
              </button>
              <button
                className={`mobile-nav-item ${selectedCompetition === 'cup' ? 'active' : ''}`}
                onClick={() => setSelectedCompetition('cup')}
              >
                <div className="mobile-nav-icon">🏅</div>
                <div>Cup</div>
              </button>
              <button
                className={`mobile-nav-item ${selectedCompetition === 'super-cup' ? 'active' : ''}`}
                onClick={() => setSelectedCompetition('super-cup')}
              >
                <div className="mobile-nav-icon">⭐</div>
                <div>Super</div>
              </button>
              <button
                className={`mobile-nav-item ${selectedCompetition === 'acwpl' ? 'active' : ''}`}
                onClick={() => setSelectedCompetition('acwpl')}
              >
                <div className="mobile-nav-icon">👧</div>
                <div>Girls</div>
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
                <div className="mobile-nav-icon">🏆</div>
                <div>League</div>
              </button>
              <button
                className="mobile-nav-item active"
              >
                <div className="mobile-nav-icon">⚙️</div>
                <div>Admin</div>
              </button>
              <button
                className="mobile-nav-item"
                onClick={handleLogout}
              >
                <div className="mobile-nav-icon">🚪</div>
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

        {/* Competition Info Banner */}
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
        </div>

        {/* Main Content */}
        {activeTab === 'user' ? (
          <UserView 
            competitions={competitions}
            selectedCompetition={selectedCompetition}
            refreshKey={dataRefreshKey}
            isAdmin={isAdmin}
          />
        ) : isAdmin ? (
          <AdminPanel onDataChange={handleDataChange} />
        ) : null}

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
