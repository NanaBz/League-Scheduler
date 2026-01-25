import React from 'react';
import { Trophy, Star, BarChart3, Calendar, Users, Lock, Cog, LogOut } from 'lucide-react';


const Footer = ({ isAdmin, onLoginClick, onAdminClick, onLogoutClick, onBackToLeagueClick, activeTab }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-content">
        {/* Project Info */}
        <div className="footer-section">
          <h4>About Acity Premier League</h4>
          <p>Modern football league management for Academic City. Organize, track, and enjoy the ACPL experience.</p>
          <div className="footer-features">
            <span className="feature-tag">Stats</span>
            <span className="feature-tag">Teams</span>
            <span className="feature-tag">FPL (Coming Soon)</span>
          </div>
        </div>

        {/* Quick Links */}
        <div className="footer-section">
          <h4>Quick Access</h4>
          <div className="footer-links">
            <button className="footer-link" onClick={() => window.setSelectedCompetition && window.setSelectedCompetition('league', 'stats')}><BarChart3 size={16} /> Stats</button>
            <button className="footer-link" onClick={() => window.setSelectedCompetition && window.setSelectedCompetition('league', 'teams')}><Users size={16} /> Teams</button>
            <button className="footer-link" onClick={() => window.setSelectedCompetition && window.setSelectedCompetition('league', 'fixtures')}><Calendar size={16} /> Fixtures & Results</button>
            <button className="footer-link" disabled style={{opacity:0.7}}><Star size={16} /> FPL (Coming Soon)</button>
            {/* Admin Access */}
            <div className="admin-access">
              {!isAdmin ? (
                <button 
                  className="footer-admin-btn"
                  onClick={onLoginClick}
                >
                  <Lock size={16} /> Admin Login
                </button>
              ) : (
                <div className="admin-controls">
                  {activeTab === 'admin' ? (
                    <button 
                      className="footer-admin-btn"
                      onClick={onBackToLeagueClick}
                    >
                      <Trophy size={16} /> Back to League
                    </button>
                  ) : (
                    <button 
                      className="footer-admin-btn"
                      onClick={onAdminClick}
                    >
                      <Cog size={16} /> Admin Panel
                    </button>
                  )}
                  <button 
                    className="footer-admin-btn logout"
                    onClick={onLogoutClick}
                  >
                    <LogOut size={16} /> Logout
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
          <p>&copy; {currentYear} Acity Premier League (ACPL). All rights reserved.</p>
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
