import React from 'react';


const Footer = ({ isAdmin, onLoginClick, onAdminClick, onLogoutClick, onBackToLeagueClick, activeTab }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-content">
        {/* System Info */}
        <div className="footer-section">
          <h4>About League Scheduler</h4>
          <p>Complete league management system built for Acity league management, organizing competitions, tracking results, and managing seasons.</p>
          <div className="footer-features">
            <span className="feature-tag">League Management</span>
            <span className="feature-tag">Cup Competitions</span>
            <span className="feature-tag">Season Archives</span>
          </div>
        </div>

        {/* Quick Links */}
        <div className="footer-section">
          <h4>Quick Access</h4>
          <div className="footer-links">
            <button className="footer-link" onClick={() => window.setSelectedCompetition && window.setSelectedCompetition('cup')}>🏆 Cup Competitions</button>
            <button className="footer-link" onClick={() => window.setSelectedCompetition && window.setSelectedCompetition('super-cup')}>⭐ Super Cup</button>
            <button className="footer-link" onClick={() => window.setSelectedCompetition && window.setSelectedCompetition('league')}>📊 Current Standings</button>
            <button className="footer-link" onClick={() => window.setSelectedCompetition && window.setSelectedCompetition('fixtures')}>📅 Fixtures & Results</button>
            <button className="footer-link" onClick={() => window.setSelectedCompetition && window.setSelectedCompetition('acwpl')}>👧 ACWPL (Girls League)</button>
            {/* Admin Access */}
            <div className="admin-access">
              {!isAdmin ? (
                <button 
                  className="footer-admin-btn"
                  onClick={onLoginClick}
                >
                  🔐 Admin Login
                </button>
              ) : (
                <div className="admin-controls">
                  {activeTab === 'admin' ? (
                    <button 
                      className="footer-admin-btn"
                      onClick={onBackToLeagueClick}
                    >
                      🏆 Back to League
                    </button>
                  ) : (
                    <button 
                      className="footer-admin-btn"
                      onClick={onAdminClick}
                    >
                      ⚙️ Admin Panel
                    </button>
                  )}
                  <button 
                    className="footer-admin-btn logout"
                    onClick={onLogoutClick}
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="footer-section">
          <h4>System Status</h4>
          <div className="system-status">
            <div className="status-item">
              <span className="status-indicator online"></span>
              <span>System Online</span>
            </div>
            <div className="status-item">
              <span className="status-indicator"></span>
              <span>Public View Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="footer-bottom">
        <div className="footer-bottom-content">
          <p>&copy; {currentYear} League Scheduler System. Built for Acity league management.</p>
          <div className="footer-meta">
            <span>Version 2.0</span>
            <span>•</span>
            <span>React Application</span>
            <span>•</span>
            <span>Node.js Backend</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
