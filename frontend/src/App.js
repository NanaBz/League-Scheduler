import React, { useState, useEffect } from 'react';
import UserView from './components/UserView';
import AdminPanel from './components/AdminPanel';
import Footer from './components/Footer';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('user');
  const [selectedCompetition, setSelectedCompetition] = useState('league');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [dataRefreshKey, setDataRefreshKey] = useState(0); // Add refresh trigger
  const [competitions] = useState({
    league: { name: 'League', description: 'Circle Method league' },
    cup: { name: 'Agha Cup', description: 'Knockout cup for top 4 teams' },
    'super-cup': { name: 'Super Cup', description: 'League winner vs Cup winner' }
  });

  // Admin password
  const ADMIN_PASSWORD = 'admin123';

  // App initialization
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500); // Reduced to 500ms for faster testing
    return () => clearTimeout(timer);
  }, []);

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setShowLogin(false);
      setActiveTab('admin');
      setPassword('');
      setLoginError('');
    } else {
      setLoginError('Invalid password. Try again.');
      setPassword('');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setActiveTab('user');
    setPassword('');
    setLoginError('');
  };

  const handleDataChange = () => {
    // Trigger refresh of data when admin makes changes
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
        <header className="header">
          <h1>⚽ Acity League Scheduler</h1>
          <p>Football League Management System</p>
        </header>

        <nav className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === 'user' ? 'active' : ''}`}
            onClick={() => setActiveTab('user')}
          >
            📊 League View
          </button>
          {!isAdmin ? (
            <button
              className="nav-tab admin-login-btn"
              onClick={() => setShowLogin(true)}
            >
              🔐 Admin Login
            </button>
          ) : (
            <>
              <button
                className={`nav-tab ${activeTab === 'admin' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin')}
              >
                ⚙️ Admin Panel
              </button>
              <button
                className="nav-tab logout-btn"
                onClick={handleLogout}
              >
                🚪 Logout
              </button>
            </>
          )}
        </nav>

        {/* Login Modal */}
        {showLogin && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>🔐 Admin Login</h3>
              <form onSubmit={handleAdminLogin}>
                <div className="form-group">
                  <label htmlFor="password">Enter Admin Password:</label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="input"
                    autoFocus
                  />
                </div>
                {loginError && (
                  <div className="error-message">{loginError}</div>
                )}
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">
                    Login
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowLogin(false);
                      setPassword('');
                      setLoginError('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
              <div className="login-hint">
                <small>💡 Hint: Try "admin123"</small>
              </div>
            </div>
          </div>
        )}

        {/* Competition Navigation */}
        {activeTab === 'user' && (
          <div className="nav-tabs">
            <button
              className={`nav-tab ${selectedCompetition === 'league' ? 'active' : ''}`}
              data-competition="league"
              onClick={() => setSelectedCompetition('league')}
            >
              🏆 League
            </button>
            <button
              className={`nav-tab ${selectedCompetition === 'cup' ? 'active' : ''}`}
              data-competition="cup"
              onClick={() => setSelectedCompetition('cup')}
            >
              🏅 Agha Cup
            </button>
            <button
              className={`nav-tab ${selectedCompetition === 'super-cup' ? 'active' : ''}`}
              data-competition="super-cup"
              onClick={() => setSelectedCompetition('super-cup')}
            >
              ⭐ Super Cup
            </button>
          </div>
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
        <Footer isAdmin={isAdmin} />
      </div>
    </div>
  );
}

export default App;
