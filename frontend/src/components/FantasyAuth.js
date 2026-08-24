import React, { useCallback, useEffect, useState } from 'react';
import api from '../utils/api';
import FantasyDashboardCard from './FantasyDashboardCard';
import FantasyLeagueCupSection from './FantasyLeagueCupSection';
import FantasyTransfers from './FantasyTransfers';
import PickTeam from './PickTeam';
import LeaguesAndCups from './LeaguesAndCups';
import './FantasyAuth.css';

const TOKEN_KEY = 'fantasyToken';

export default function FantasyAuth() {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch {
      return '';
    }
  });
  const [user, setUser] = useState(null);
  const [loadingMe, setLoadingMe] = useState(!!localStorage.getItem(TOKEN_KEY));
  const [tab, setTab] = useState('login'); // login | register | verify
  const [subView, setSubView] = useState(null); // null | pick | transfers | leagues
  const [managerProfileOpen, setManagerProfileOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regTeam, setRegTeam] = useState('');
  const [regManager, setRegManager] = useState('');

  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');

  const persistSession = useCallback((t, u) => {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
    setTab('login');
    setSubView(null);
    setVerifyCode('');
    setError('');
    setMessage('');
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
    setUser(null);
    setSubView(null);
    setError('');
    setMessage('Signed out.');
  }, []);

  const loadMe = useCallback(async () => {
    if (!token) {
      setUser(null);
      setLoadingMe(false);
      return;
    }
    setLoadingMe(true);
    try {
      const { data } = await api.get('/fantasy/auth/me');
      if (data?.success && data.user) setUser(data.user);
      else throw new Error('Invalid session');
    } catch {
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch { /* ignore */ }
      setToken('');
      setUser(null);
    } finally {
      setLoadingMe(false);
    }
  }, [token]);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const { data } = await api.post('/fantasy/auth/login', {
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (data?.success && data.token) {
        persistSession(data.token, data.user);
        setLoginPassword('');
        setMessage(data.message || 'Welcome back!');
      } else {
        setError(data?.message || 'Login failed');
      }
    } catch (err) {
      const d = err.response?.data;
      if (d?.requiresVerification) {
        setVerifyEmail(loginEmail.trim());
        setTab('verify');
        setMessage(d.message || 'Please verify your email.');
      } else {
        setError(d?.message || err.message || 'Login failed');
      }
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const { data } = await api.post('/fantasy/auth/register', {
        email: regEmail.trim(),
        password: regPassword,
        teamName: regTeam.trim(),
        managerName: regManager.trim(),
      });
      if (data?.success && data.token) {
        persistSession(data.token, data.user);
        setRegPassword('');
        setMessage(data.message || 'Welcome!');
      } else if (data?.success) {
        setVerifyEmail(regEmail.trim());
        setTab('verify');
        setMessage(data.message || 'Check your email for the code.');
      } else {
        setError(data?.message || 'Registration failed');
      }
    } catch (err) {
      const d = err.response?.data;
      setError(d?.message || err.message || 'Registration failed');
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const { data } = await api.post('/fantasy/auth/verify', {
        email: verifyEmail.trim(),
        code: verifyCode.trim(),
      });
      if (data?.success && data.token) {
        persistSession(data.token, data.user);
        setMessage(data.message || 'Account verified!');
      } else {
        setError(data?.message || 'Verification failed');
      }
    } catch (err) {
      const d = err.response?.data;
      setError(d?.message || err.message || 'Verification failed');
    }
  };

  const handleResend = async () => {
    setError('');
    try {
      const { data } = await api.post('/fantasy/auth/resend-code', { email: verifyEmail.trim() });
      setMessage(data?.message || 'If the account exists, a code was sent.');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not resend code');
    }
  };

  if (token && loadingMe) {
    return (
      <div className="fantasy-auth-container fantasy-section">
        <p className="fantasy-message fantasy-info">Loading your fantasy profile…</p>
      </div>
    );
  }

  if (token && user) {
    if (subView === 'transfers') {
      return (
        <FantasyTransfers
          user={user}
          onBack={() => setSubView(null)}
          onGoToPickTeam={() => setSubView('pick')}
        />
      );
    }
    if (subView === 'pick') {
      return (
        <PickTeam
          user={user}
          onBack={() => setSubView(null)}
          onGoToTransfers={() => setSubView('transfers')}
        />
      );
    }
    if (subView === 'leagues') {
      return <LeaguesAndCups onBack={() => setSubView(null)} user={user} />;
    }

    return (
      <div className="fantasy-auth-container fantasy-section">
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 12 }}>
          <button type="button" className="fantasy-btn fantasy-btn-secondary" style={{ width: 'auto' }} onClick={clearSession}>
            Sign out
          </button>
        </div>
        {message && <div className="fantasy-message fantasy-info">{message}</div>}
        <FantasyDashboardCard
          user={user}
          onPickTeam={() => setSubView('pick')}
          onTransfers={() => setSubView('transfers')}
          onLeaguesCups={() => setSubView('leagues')}
          onProfileViewChange={setManagerProfileOpen}
        />
        {!managerProfileOpen ? <FantasyLeagueCupSection user={user} /> : null}
      </div>
    );
  }

  return (
    <div className="fantasy-auth-container fantasy-section">
      {tab !== 'verify' && (
        <div className="fantasy-auth-tabs">
          <button type="button" className={`fantasy-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setError(''); setMessage(''); }}>
            Sign in
          </button>
          <button type="button" className={`fantasy-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => { setTab('register'); setError(''); setMessage(''); }}>
            Register
          </button>
        </div>
      )}

      {message && <div className="fantasy-message fantasy-info">{message}</div>}
      {error && <div className="fantasy-message fantasy-error">{error}</div>}

      {tab === 'login' && (
        <form className="fantasy-form" onSubmit={handleLogin}>
          <div className="fantasy-form-group">
            <label className="fantasy-label" htmlFor="fa-login-email">Email</label>
            <input id="fa-login-email" className="fantasy-input" type="email" autoComplete="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
          </div>
          <div className="fantasy-form-group">
            <label className="fantasy-label" htmlFor="fa-login-pass">Password</label>
            <input id="fa-login-pass" className="fantasy-input" type="password" autoComplete="current-password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
          </div>
          <div className="fantasy-actions">
            <button type="submit" className="fantasy-btn fantasy-btn-primary">Sign in</button>
          </div>
        </form>
      )}

      {tab === 'register' && (
        <form className="fantasy-form" onSubmit={handleRegister}>
          <div className="fantasy-form-group">
            <label className="fantasy-label" htmlFor="fa-reg-email">Email</label>
            <input id="fa-reg-email" className="fantasy-input" type="email" autoComplete="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required />
          </div>
          <div className="fantasy-form-group">
            <label className="fantasy-label" htmlFor="fa-reg-pass">Password</label>
            <input id="fa-reg-pass" className="fantasy-input" type="password" autoComplete="new-password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required minLength={8} />
          </div>
          <div className="fantasy-form-group">
            <label className="fantasy-label" htmlFor="fa-reg-team">Fantasy team name</label>
            <input id="fa-reg-team" className="fantasy-input" type="text" value={regTeam} onChange={(e) => setRegTeam(e.target.value)} required />
          </div>
          <div className="fantasy-form-group">
            <label className="fantasy-label" htmlFor="fa-reg-mgr">Manager name</label>
            <input id="fa-reg-mgr" className="fantasy-input" type="text" value={regManager} onChange={(e) => setRegManager(e.target.value)} required />
          </div>
          <div className="fantasy-actions">
            <button type="submit" className="fantasy-btn fantasy-btn-primary">Create account</button>
          </div>
        </form>
      )}

      {tab === 'verify' && (
        <form className="fantasy-form" onSubmit={handleVerify}>
          <div className="fantasy-form-group">
            <label className="fantasy-label" htmlFor="fa-verify-email">Email</label>
            <input id="fa-verify-email" className="fantasy-input" type="email" value={verifyEmail} onChange={(e) => setVerifyEmail(e.target.value)} required />
          </div>
          <div className="fantasy-form-group">
            <label className="fantasy-label" htmlFor="fa-verify-code">6-digit code</label>
            <input id="fa-verify-code" className="fantasy-input fantasy-code-input" inputMode="numeric" maxLength={6} value={verifyCode} onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          </div>
          <div className="fantasy-actions">
            <button type="submit" className="fantasy-btn fantasy-btn-primary">Verify & continue</button>
            <button type="button" className="fantasy-btn fantasy-btn-text" onClick={handleResend}>Resend code</button>
            <button type="button" className="fantasy-btn fantasy-btn-secondary" onClick={() => { setTab('login'); setError(''); setMessage(''); }}>Back to sign in</button>
          </div>
        </form>
      )}
    </div>
  );
}
