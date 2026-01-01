import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import './FantasyAuth.css';
import FantasyDashboardCard from './FantasyDashboardCard';
import FantasyTransfers from './FantasyTransfers';
import PickTeam from './PickTeam';
import LeaguesAndCups from './LeaguesAndCups';

const initialForm = { email: '', password: '', confirmPassword: '', teamName: '', managerName: '' };

export default function FantasyAuth() {
  const [mode, setMode] = useState('register'); // register | login
  const [view, setView] = useState('form'); // form | verify
  const [form, setForm] = useState(initialForm);
  const [verifyCode, setVerifyCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [fantasyUser, setFantasyUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [panel, setPanel] = useState('dashboard'); // dashboard | transfers | pick-team | leagues-cups

  // Attempt to hydrate session from stored token
  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem('fantasyToken');
      if (!token) return;
      try {
        const { data } = await api.get('/fantasy/auth/me');
        if (data?.success) {
          setFantasyUser(data.user);
          setView('authed');
        } else {
          localStorage.removeItem('fantasyToken');
        }
      } catch (err) {
        localStorage.removeItem('fantasyToken');
      }
    };
    bootstrap();
  }, []);

  const resetMessaging = () => { setError(''); setMessage(''); };

  const handleRegister = async () => {
    resetMessaging();
    if (!form.email || !form.password || !form.teamName || !form.managerName) {
      setError('Email, password, team name, and manager name are required.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/fantasy/auth/register', {
        email: form.email,
        password: form.password,
        teamName: form.teamName,
        managerName: form.managerName
      });
      setPendingEmail(form.email);
      setView('verify');
      setMessage('We sent a 6-digit code to your email. Enter it below to verify.');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    resetMessaging();
    if (!form.email || !form.password) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/fantasy/auth/login', {
        email: form.email,
        password: form.password
      });
      localStorage.setItem('fantasyToken', data.token);
      setFantasyUser(data.user);
      setView('authed');
      setMessage('Signed in successfully.');
    } catch (err) {
      const status = err.response?.status;
      if (status === 403 && err.response?.data?.requiresVerification) {
        setPendingEmail(form.email);
        setView('verify');
        setMessage('Please verify your email. We just sent you a new code.');
      } else {
        setError(err.response?.data?.message || 'Login failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    resetMessaging();
    const emailToUse = pendingEmail || form.email;
    if (!emailToUse || !verifyCode) {
      setError('Email and verification code are required.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/fantasy/auth/verify', {
        email: emailToUse,
        code: verifyCode
      });
      localStorage.setItem('fantasyToken', data.token);
      setFantasyUser(data.user);
      setView('authed');
      setMessage('Email verified. You are signed in.');
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    resetMessaging();
    const emailToUse = pendingEmail || form.email;
    if (!emailToUse) { setError('Enter your email to resend the code.'); return; }
    setLoading(true);
    try {
      await api.post('/fantasy/auth/resend-code', { email: emailToUse });
      setMessage('Verification code resent. Check your inbox.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend code.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('fantasyToken');
    setFantasyUser(null);
    setForm(initialForm);
    setVerifyCode('');
    setPendingEmail('');
    setView('form');
    setMessage('');
    setError('');
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setView('form');
    setForm(initialForm);
    setVerifyCode('');
    setPendingEmail('');
    setMessage('');
    setError('');
  };

  if (fantasyUser && view === 'authed') {
    return (
      <div className="fantasy-auth-container">
        {panel === 'dashboard' ? (
          <>
            <FantasyDashboardCard
              user={fantasyUser}
              onPickTeam={() => setPanel('pick-team')}
              onTransfers={() => setPanel('transfers')}
              onLeaguesCups={() => setPanel('leagues-cups')}
            />
            
            {/* Leagues & Cups Card */}
            <div className="fantasy-card" style={{ marginTop: 12, cursor: 'pointer' }} onClick={() => setPanel('leagues-cups')}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Leagues & Cups</h3>
                <div style={{ fontWeight: 900, fontSize: 18, opacity: 0.9 }}>→</div>
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: '#666' }}>
                View your league standings and cup progress
              </p>
            </div>

            <div style={{ marginTop: 12 }}>
              <button className="fantasy-btn fantasy-btn-secondary" onClick={handleLogout} style={{ width: '100%' }}>
                Sign out
              </button>
            </div>
          </>
        ) : panel === 'transfers' ? (
          <>
            <FantasyTransfers onBack={() => setPanel('dashboard')} />
            {/* Sign out is available on the main fantasy dashboard only */}
          </>
        ) : panel === 'pick-team' ? (
          <>
            <PickTeam onBack={() => setPanel('dashboard')} />
          </>
        ) : panel === 'leagues-cups' ? (
          <>
            <LeaguesAndCups onBack={() => setPanel('dashboard')} />
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="fantasy-auth-container">
      <div className="fantasy-auth-tabs">
        <button
          className={`fantasy-tab ${mode === 'register' ? 'active' : ''}`}
          onClick={() => switchMode('register')}
        >
          Create Account
        </button>
        <button
          className={`fantasy-tab ${mode === 'login' ? 'active' : ''}`}
          onClick={() => switchMode('login')}
        >
          Sign In
        </button>
      </div>

      {error && <div className="fantasy-message fantasy-error">{error}</div>}
      {message && <div className="fantasy-message fantasy-info">{message}</div>}

      {view === 'verify' ? (
        <div className="fantasy-form">
          <div className="fantasy-form-group">
            <label className="fantasy-label">Email</label>
            <input
              className="fantasy-input"
              type="email"
              value={pendingEmail || form.email}
              onChange={(e) => setPendingEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="fantasy-form-group">
            <label className="fantasy-label">6-Digit Code</label>
            <input
              className="fantasy-input fantasy-code-input"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              placeholder="000000"
              maxLength={6}
              inputMode="numeric"
            />
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 6, marginBottom: 0 }}>
              Check your email for the verification code
            </p>
          </div>
          <div className="fantasy-actions">
            <button className="fantasy-btn fantasy-btn-primary" onClick={handleVerify} disabled={loading}>
              {loading ? 'Verifying…' : 'Verify & Sign In'}
            </button>
            <button className="fantasy-btn fantasy-btn-secondary" onClick={handleResend} disabled={loading}>
              Resend Code
            </button>
            <button className="fantasy-btn fantasy-btn-text" onClick={() => setView('form')} disabled={loading}>
              ← Back
            </button>
          </div>
        </div>
      ) : (
        <div className="fantasy-form">
          <div className="fantasy-form-group">
            <label className="fantasy-label">Email</label>
            <input
              className="fantasy-input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
            />
          </div>
          <div className="fantasy-form-group">
            <label className="fantasy-label">Password</label>
            <input
              className="fantasy-input"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="At least 8 characters"
            />
          </div>
          {mode === 'register' && (
            <>
              <div className="fantasy-form-group">
                <label className="fantasy-label">Confirm Password</label>
                <input
                  className="fantasy-input"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="Re-enter password"
                />
              </div>
              <div className="fantasy-form-group">
                <label className="fantasy-label">FPL Team Name</label>
                <input
                  className="fantasy-input"
                  value={form.teamName}
                  onChange={(e) => setForm({ ...form, teamName: e.target.value })}
                  placeholder="Your fantasy team"
                />
              </div>
              <div className="fantasy-form-group">
                <label className="fantasy-label">Manager Name (Username)</label>
                <input
                  className="fantasy-input"
                  value={form.managerName}
                  onChange={(e) => setForm({ ...form, managerName: e.target.value })}
                  placeholder="Display name"
                />
              </div>
            </>
          )}

          <div className="fantasy-actions">
            {mode === 'register' ? (
              <button className="fantasy-btn fantasy-btn-primary" onClick={handleRegister} disabled={loading}>
                {loading ? 'Submitting…' : 'Register'}
              </button>
            ) : (
              <>
                <button className="fantasy-btn fantasy-btn-primary" onClick={handleLogin} disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
                <button className="fantasy-btn fantasy-btn-text" onClick={() => setView('verify')} disabled={loading}>
                  I have a code →
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
