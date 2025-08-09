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
            </div>
          )}
          
          {/* Right Section: Admin Access */}
          <div className="nav-admin">
            {!isAdmin ? (
              <button
                className="admin-login-btn"
                onClick={() => setShowLogin(true)}
              >
                🔐 Admin Login
              </button>
            ) : (
              <>
                {activeTab === 'admin' ? (
                  <button
                    className="admin-btn"
                    onClick={() => setActiveTab('user')}
                  >
                    🏆 Back to League
                  </button>
                ) : (
                  <button
                    className="admin-btn"
                    onClick={() => setActiveTab('admin')}
                  >
                    ⚙️ Admin Panel
                  </button>
                )}
                <button
                  className="logout-btn"
                  onClick={handleLogout}
                >
                  🚪 Logout
                </button>
              </>
            )}
          </div>
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
              {/* Menu button for admin access */}
              <button
                className="mobile-nav-item"
                onClick={() => {
                  if (isAdmin) {
                    setActiveTab('admin');
                  } else {
                    setShowLogin(true);
                  }
                }}
              >
                <div className="mobile-nav-icon">{isAdmin ? '⚙️' : '🔐'}</div>
                <div>{isAdmin ? 'Admin' : 'Login'}</div>
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
