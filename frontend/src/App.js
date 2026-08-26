import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Trophy, Award, Star, Users, Zap, Cog, LogOut, Archive } from 'lucide-react';

import UserView from './components/UserView';
import AdminPanel from './components/AdminPanel';
import PlayerManagement from './components/PlayerManagement';
import AdminAuth from './components/AdminAuth';
import Footer from './components/Footer';
import Sidebar from './components/Sidebar';
import AdminSidebar from './components/AdminSidebar';
import AdminNav from './components/AdminNav';
import StatsPage from './components/StatsPage';
import TeamsPage from './components/TeamsPage';
import GirlsTeamsPage from './components/GirlsTeamsPage';
import FantasyManagement from './components/FantasyManagement';
import FantasyAuth from './components/FantasyAuth';
import ArchivedSeasonsPage from './pages/ArchivedSeasonsPage';
import ArchivedCompetitionPage from './pages/ArchivedCompetitionPage';
import ArchivedTeamsPage from './pages/ArchivedTeamsPage';
import ArchivedTeamDetailPage from './pages/ArchivedTeamDetailPage';
import axios from 'axios';
import {
  pathToSection,
  SECTION_TO_PATH,
  savedSectionPath,
} from './utils/userRoutes';
import './styles/designFoundation.css';
import './styles/fixtures.css';
import './styles/aghaCup.css';
import './styles/superCup.css';
import './index.css';
import './styles/schoolGirlsCompetitions.css';
import './styles/statsPage.css';
import './styles/teamsPage.css';
import './styles/fantasyUiRefresh.css';
import './styles/adminUi.css';

const COMPETITION_IDS = ['league', 'cup', 'super-cup', 'acwpl', 'girls-super-cup'];

function HomeRedirect() {
  return <Navigate to={savedSectionPath()} replace />;
}

function TeamsSection({ girlsTeamsActive, setGirlsTeamsActive, dataRefreshKey }) {
  return (
    <>
      <div className="apl-segmented-wrap">
        <div className="apl-segmented">
        <button
          type="button"
          className="apl-segmented-btn"
          aria-current={!girlsTeamsActive ? 'page' : undefined}
          onClick={() => setGirlsTeamsActive(false)}
          disabled={!girlsTeamsActive}
        >
          Boys Teams
        </button>
        <button
          type="button"
          className="apl-segmented-btn"
          aria-current={girlsTeamsActive ? 'page' : undefined}
          onClick={() => setGirlsTeamsActive(true)}
          disabled={girlsTeamsActive}
        >
          Girls Teams
        </button>
      </div>
      </div>
      {girlsTeamsActive ? (
        <GirlsTeamsPage />
      ) : (
        <TeamsPage refreshKey={dataRefreshKey} onNavigateToGirlsTeams={() => setGirlsTeamsActive(true)} />
      )}
    </>
  );
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeSection = pathToSection(location.pathname) || 'fixtures';

  // Restore from localStorage if available
  const getInitial = (key, fallback) => {
    try {
      const v = localStorage.getItem(key);
      if (v === null) return fallback;
      if (v === 'true') return true;
      if (v === 'false') return false;
      return v;
    } catch { return fallback; }
  };

  const [activeTab, setActiveTab] = useState(() => {
    const t = getInitial('activeTab', 'user');
    return t === 'admin' || t === 'user' ? t : 'user';
  });
  const [selectedCompetition, setSelectedCompetition] = useState(() => {
    const c = getInitial('selectedCompetition', 'league');
    return COMPETITION_IDS.includes(c) ? c : 'league';
  });
  // Expose setSelectedCompetition globally for Footer quick links
  React.useEffect(() => {
    window.setSelectedCompetition = (comp, section) => {
      setActiveTab('user');
      navigate(SECTION_TO_PATH[section || 'fixtures'] || '/fixtures');
      setSelectedCompetition(comp);
    };
    return () => { delete window.setSelectedCompetition; };
  }, [navigate]);

  const goToSection = (id) => {
    setActiveTab('user');
    navigate(SECTION_TO_PATH[id] || '/fixtures');
  };
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
    'super-cup': { name: 'Super Cup', description: 'League winner vs Cup winner' },
    acwpl: { name: 'ACWPL', description: 'Girls best-of-5 league (Orion vs Firestorm)' },
    'girls-super-cup': {
      name: 'Girls Super Cup',
      description: 'Best-of-3 between Orion and Firestorm; first to two wins. Draws can go to penalties; remaining games are void once a side clinches.',
    },
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
      navigate('/fixtures');
    }
  };

  const handleDataChange = () => {
    setDataRefreshKey(prev => prev + 1);
    console.log('Data changed - triggering UserView refresh');
  };

  const [girlsTeamsActive, setGirlsTeamsActive] = useState(() => getInitial('girlsTeamsActive', false));
  // Persist navigation state to localStorage
  React.useEffect(() => { localStorage.setItem('activeTab', activeTab); }, [activeTab]);
  React.useEffect(() => {
    const section = pathToSection(location.pathname);
    if (section) localStorage.setItem('activeSection', section);
  }, [location.pathname]);
  React.useEffect(() => { localStorage.setItem('selectedCompetition', selectedCompetition); }, [selectedCompetition]);
  React.useEffect(() => { localStorage.setItem('girlsTeamsActive', girlsTeamsActive); }, [girlsTeamsActive]);

  // Direct URL / browser navigation to a user section shows the user shell
  const prevPathRef = useRef(null);
  useEffect(() => {
    if (isLoading) return;
    const section = pathToSection(location.pathname);
    const isInitial = prevPathRef.current === null;
    const pathChanged = prevPathRef.current !== location.pathname;
    prevPathRef.current = location.pathname;
    if (section && (isInitial || pathChanged)) {
      setActiveTab('user');
    }
  }, [location.pathname, isLoading]);

  /**
   * Stale localStorage (e.g. activeTab=admin after logout) makes the main branch render null
   * while the shell still shows. useLayoutEffect runs before paint so the user does not see a white flash.
   */
  useLayoutEffect(() => {
    if (isLoading) return;
    if (activeTab === 'admin' && !isAdmin) {
      setActiveTab('user');
    }
    if (!COMPETITION_IDS.includes(selectedCompetition)) {
      setSelectedCompetition('league');
    }
  }, [isLoading, activeTab, isAdmin, selectedCompetition]);

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
              <button
                className={`comp-nav-btn ${selectedCompetition === 'girls-super-cup' ? 'active' : ''}`}
                onClick={() => setSelectedCompetition('girls-super-cup')}
              >
                <Star size={16} />
                <span className="comp-text">Girls Super Cup</span>
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
                onSelect={goToSection}
              />
            ) : isAdmin ? (
              <AdminSidebar
                activeSection={adminSection}
                onSelect={(id) => setAdminSection(id)}
                onSwitchToUser={() => {
                  setActiveTab('user');
                  navigate(savedSectionPath());
                }}
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
                onClick={() => goToSection('fixtures')}
              >
                <div className="mobile-nav-icon"><Trophy size={20} /></div>
                <div>Fixtures</div>
              </button>
              <button
                className={`mobile-nav-item ${activeSection === 'stats' ? 'active' : ''}`}
                onClick={() => goToSection('stats')}
              >
                <div className="mobile-nav-icon"><Zap size={20} /></div>
                <div>Stats</div>
              </button>
              <button
                className={`mobile-nav-item ${activeSection === 'teams' ? 'active' : ''}`}
                onClick={() => goToSection('teams')}
              >
                <div className="mobile-nav-icon"><Users size={20} /></div>
                <div>Teams</div>
              </button>
              <button
                className={`mobile-nav-item ${activeSection === 'fantasy' ? 'active' : ''}`}
                onClick={() => goToSection('fantasy')}
              >
                <div className="mobile-nav-icon"><Star size={20} /></div>
                <div>Fantasy</div>
              </button>
              <button
                className={`mobile-nav-item ${activeSection === 'archived' ? 'active' : ''}`}
                onClick={() => goToSection('archived')}
              >
                <div className="mobile-nav-icon"><Archive size={20} /></div>
                <div>Archived</div>
              </button>
            </>
          )}
          
          {/* Admin Panel Navigation */}
          {activeTab === 'admin' && isAdmin && (
            <>
              <button
                className="mobile-nav-item"
                onClick={() => {
                  setActiveTab('user');
                  navigate(savedSectionPath());
                }}
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
            {selectedCompetition === 'acwpl' && competitions.acwpl?.description}
            {selectedCompetition === 'girls-super-cup' && competitions['girls-super-cup']?.description}
          </p>
        </div>) }

        {/* Main Content */}
        {activeTab === 'user' ? (
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route
              path="/fixtures"
              element={(
                <UserView
                  competitions={competitions}
                  selectedCompetition={selectedCompetition}
                  onCompetitionChange={setSelectedCompetition}
                  refreshKey={dataRefreshKey}
                />
              )}
            />
            <Route path="/stats" element={<StatsPage />} />
            <Route
              path="/teams"
              element={(
                <TeamsSection
                  girlsTeamsActive={girlsTeamsActive}
                  setGirlsTeamsActive={setGirlsTeamsActive}
                  dataRefreshKey={dataRefreshKey}
                />
              )}
            />
            <Route path="/fantasy" element={<FantasyAuth />} />
            <Route path="/archived" element={<ArchivedSeasonsPage isAdmin={isAdmin} />} />
            <Route path="/archived/:seasonNumber/teams" element={<ArchivedTeamsPage />} />
            <Route path="/archived/:seasonNumber/teams/:teamId" element={<ArchivedTeamDetailPage />} />
            <Route path="/archived/:seasonNumber/:competitionSlug" element={<ArchivedCompetitionPage />} />
            <Route path="*" element={<Navigate to="/fixtures" replace />} />
          </Routes>
        ) : isAdmin ? (
          <div className="admin-shell">
            <AdminNav
              activeSection={adminSection}
              onSelect={(id) => setAdminSection(id)}
              onSwitchToUser={() => {
                setActiveTab('user');
                navigate(savedSectionPath());
              }}
            />
            <div
              role="tabpanel"
              id={`admin-panel-${adminSection}`}
              aria-labelledby={`admin-nav-tab-${adminSection}`}
            >
              {adminSection === 'fixtures-mgmt' ? (
                <AdminPanel onDataChange={handleDataChange} isAdmin={isAdmin} />
              ) : adminSection === 'players-mgmt' ? (
                <PlayerManagement onDataChange={handleDataChange} isAdmin={isAdmin} />
              ) : adminSection === 'fantasy-mgmt' ? (
                <FantasyManagement isAdmin={isAdmin} />
              ) : null}
            </div>
          </div>
        ) : null}



        </div>{/* content-area */}
        </div>{/* layout-with-sidebar */}

        {/* Footer */}
        <Footer 
          isAdmin={isAdmin} 
          onLoginClick={() => setShowLogin(true)}
          onAdminClick={() => setActiveTab('admin')}
          onLogoutClick={handleLogout}
          onBackToLeagueClick={() => {
            setActiveTab('user');
            navigate(savedSectionPath());
          }}
          activeTab={activeTab}
        />
      </div>
    </div>
  );
}
export default App;
