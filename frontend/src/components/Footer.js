import React from 'react';
import {
  Trophy,
  Star,
  BarChart3,
  Calendar,
  Users,
  Lock,
  Cog,
  LogOut,
  Archive,
  Circle,
} from 'lucide-react';
import './Footer.css';
import { ACITY_SPORTS_LOGO, ACITY_SPORTS_NAME, APP_TITLE } from '../constants/branding';

const GITHUB_REPO_URL = 'https://github.com/NanaBz/League-Scheduler';
const GITHUB_REPO_NAME = 'League-Scheduler';

const QUICK_LINKS = [
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'teams', label: 'Teams', icon: Users },
  { id: 'fixtures', label: 'Fixtures & Results', icon: Calendar },
  { id: 'fantasy', label: 'FPL', icon: Star },
];

const Footer = ({
  isAdmin,
  activeTab,
  onLoginClick,
  onAdminClick,
  onLogoutClick,
  onBackToLeagueClick,
  onNavigateSection,
}) => {
  const currentYear = new Date().getFullYear();

  const go = (sectionId) => {
    if (onNavigateSection) onNavigateSection(sectionId);
  };

  return (
    <footer className="app-footer">
      <div className="app-footer__main">
        <div className="app-footer__brand">
          <div className="app-footer__brand-icon">
            <img src={ACITY_SPORTS_LOGO} alt="" className="app-footer__brand-logo" aria-hidden="true" />
          </div>
          <div className="app-footer__brand-copy">
            <p className="app-footer__eyebrow">{ACITY_SPORTS_NAME}</p>
            <h2 className="app-footer__title">{APP_TITLE}</h2>
            <p className="app-footer__desc">
              Modern football league management for Academic City — fixtures, stats, teams, and fantasy.
            </p>
          </div>
        </div>

        <div className="app-footer__panels">
          <section className="app-footer__panel" aria-labelledby="footer-quick-heading">
            <h3 id="footer-quick-heading" className="app-footer__panel-title">
              Quick access
            </h3>
            <nav className="app-footer__quick-grid" aria-label="Quick access">
              {QUICK_LINKS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className="app-footer__quick-link"
                  onClick={() => go(id)}
                >
                  <span className="app-footer__quick-icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={2} />
                  </span>
                  <span>{label}</span>
                </button>
              ))}
              <button
                type="button"
                className="app-footer__quick-link"
                onClick={() => go('archived')}
              >
                <span className="app-footer__quick-icon" aria-hidden="true">
                  <Archive size={18} strokeWidth={2} />
                </span>
                <span>Archived</span>
              </button>
            </nav>
          </section>

          <section className="app-footer__panel" aria-labelledby="footer-status-heading">
            <h3 id="footer-status-heading" className="app-footer__panel-title">
              System
            </h3>
            <div className="app-footer__status-list">
              <div className="app-footer__status">
                <span className="app-footer__status-dot app-footer__status-dot--online" aria-hidden="true" />
                <span>System online</span>
              </div>
              <div className="app-footer__status">
                <Circle size={8} className="app-footer__status-icon-muted" aria-hidden="true" />
                <span>{activeTab === 'admin' ? 'Admin view active' : 'Public view active'}</span>
              </div>
            </div>
          </section>
        </div>

        <div className="app-footer__admin">
          {!isAdmin ? (
            <button type="button" className="app-footer__btn app-footer__btn--primary" onClick={onLoginClick}>
              <Lock size={16} aria-hidden="true" />
              Admin login
            </button>
          ) : (
            <div className="app-footer__admin-row">
              {activeTab === 'admin' ? (
                <button type="button" className="app-footer__btn app-footer__btn--primary" onClick={onBackToLeagueClick}>
                  <Trophy size={16} aria-hidden="true" />
                  Back to league
                </button>
              ) : (
                <button type="button" className="app-footer__btn app-footer__btn--primary" onClick={onAdminClick}>
                  <Cog size={16} aria-hidden="true" />
                  Admin panel
                </button>
              )}
              <button type="button" className="app-footer__btn app-footer__btn--muted" onClick={onLogoutClick}>
                <LogOut size={16} aria-hidden="true" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="app-footer__bar">
        <div className="app-footer__bar-copy-block">
          <p className="app-footer__copy">&copy; {currentYear} Acity Premier League (ACPL). All rights reserved.</p>
          <p className="app-footer__credit">
            Developed by Nanakwaku Boakye-Akyeampong —{' '}
            <a
              href={GITHUB_REPO_URL}
              className="app-footer__credit-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              {GITHUB_REPO_NAME}
            </a>
          </p>
        </div>
        <div className="app-footer__meta">
          <span>Version 2.0</span>
          <span className="app-footer__meta-sep" aria-hidden="true">·</span>
          <span>React</span>
          <span className="app-footer__meta-sep" aria-hidden="true">·</span>
          <span>Node.js</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
