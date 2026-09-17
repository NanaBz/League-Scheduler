import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import FantasyDashboardCard from './FantasyDashboardCard';
import FantasyLeagueCupSection from './FantasyLeagueCupSection';
import FantasyTransfers from './FantasyTransfers';
import PickTeam from './PickTeam';
import LeaguesAndCups from './LeaguesAndCups';
import FantasyInfoPage from './FantasyInfoPage';
import FantasyAccountSettings from './FantasyAccountSettings';
import FantasyGoogleSignIn from './FantasyGoogleSignIn';
import './FantasyAuth.css';

const TOKEN_KEY = 'fantasyToken';

export default function FantasyAuth() {
  const [searchParams, setSearchParams] = useSearchParams();
  const resetTokenFromUrl = searchParams.get('reset') || '';
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch {
      return '';
    }
  });
  const [user, setUser] = useState(null);
  const [loadingMe, setLoadingMe] = useState(!!localStorage.getItem(TOKEN_KEY));
  const [tab, setTab] = useState(() => (resetTokenFromUrl ? 'reset' : 'login')); // login | register | verify | forgot | reset | google-profile
  const [subView, setSubView] = useState(null); // null | pick | transfers | leagues | info
  const [authConfig, setAuthConfig] = useState(null);
  const [googleCredential, setGoogleCredential] = useState('');
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleTeam, setGoogleTeam] = useState('');
  const [googleManager, setGoogleManager] = useState('');
  const [managerProfileOpen, setManagerProfileOpen] = useState(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regTeam, setRegTeam] = useState('');
  const [regManager, setRegManager] = useState('');

  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resetToken, setResetToken] = useState(resetTokenFromUrl);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (resetTokenFromUrl) {
      setResetToken(resetTokenFromUrl);
      setTab('reset');
    }
  }, [resetTokenFromUrl]);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/fantasy/auth/config');
        if (!cancelled && data?.config) setAuthConfig(data.config);
      } catch {
        if (!cancelled) setAuthConfig(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      } else if (d?.useGoogleSignIn) {
        setError(`${d?.message || 'Login failed.'} Use Continue with Google below.`);
      } else {
        setError(d?.message || err.message || 'Login failed');
      }
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    try {
      const { data } = await api.post('/fantasy/auth/register', {
        email: regEmail.trim(),
        password: regPassword,
        confirmPassword: regConfirmPassword,
        teamName: regTeam.trim(),
        managerName: regManager.trim(),
      });
      if (data?.success && data.token) {
        persistSession(data.token, data.user);
        setRegPassword('');
        setRegConfirmPassword('');
        setMessage(data.message || 'Welcome!');
      } else if (data?.success) {
        setVerifyEmail(regEmail.trim());
        setRegPassword('');
        setRegConfirmPassword('');
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

  const handleGoogleCredential = async (credential, profile = {}) => {
    setError('');
    setMessage('');
    try {
      const { data } = await api.post('/fantasy/auth/google', {
        credential,
        teamName: profile.teamName,
        managerName: profile.managerName,
      });
      if (data?.success && data.token) {
        persistSession(data.token, data.user);
        setGoogleCredential('');
        setGoogleEmail('');
        setGoogleTeam('');
        setGoogleManager('');
        setMessage(data.message || 'Signed in with Google.');
        return;
      }
      setError(data?.message || 'Google Sign-In failed.');
    } catch (err) {
      const d = err.response?.data;
      if (d?.needsProfile) {
        setGoogleCredential(credential);
        setGoogleEmail(d.email || '');
        setGoogleManager(d.suggestedManagerName || '');
        setGoogleTeam('');
        setTab('google-profile');
        setMessage(d.message || 'Finish setting up your fantasy account.');
        return;
      }
      setError(d?.message || err.message || 'Google Sign-In failed.');
    }
  };

  const handleGoogleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!googleCredential) {
      setError('Google sign-in expired. Please try again.');
      setTab('register');
      return;
    }
    await handleGoogleCredential(googleCredential, {
      teamName: googleTeam.trim(),
      managerName: googleManager.trim(),
    });
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setForgotLoading(true);
    try {
      const { data } = await api.post('/fantasy/auth/forgot-password', { email: forgotEmail.trim() });
      const parts = [data?.message || 'If an account exists for that email, a password reset link has been sent.'];
      if (data?.alternatives?.googleSignIn) {
        parts.push('You can also sign in with Google if you used it when registering.');
      }
      if (data?.alternatives?.adminContactEmail) {
        parts.push(`Or contact the league admin at ${data.alternatives.adminContactEmail}.`);
      }
      setMessage(parts.join(' '));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not process password reset request.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (resetPassword !== resetConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setResetLoading(true);
    try {
      const { data } = await api.post('/fantasy/auth/reset-password', {
        token: resetToken.trim(),
        password: resetPassword,
        confirmPassword: resetConfirmPassword,
      });
      if (data?.success) {
        setMessage(data.message || 'Password updated. You can sign in now.');
        setResetPassword('');
        setResetConfirmPassword('');
        setResetToken('');
        setSearchParams({});
        setTab('login');
      } else {
        setError(data?.message || 'Could not reset password.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not reset password.');
    } finally {
      setResetLoading(false);
    }
  };

  if (subView === 'info') {
    return (
      <div className="fantasy-auth-container fantasy-section">
        <FantasyInfoPage onBack={() => setSubView(null)} />
      </div>
    );
  }

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
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            className="fantasy-btn fantasy-btn-secondary"
            style={{ width: 'auto' }}
            onClick={() => setAccountSettingsOpen(true)}
          >
            Account
          </button>
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
          onRules={() => setSubView('info')}
          onProfileViewChange={setManagerProfileOpen}
        />
        {!managerProfileOpen ? <FantasyLeagueCupSection user={user} /> : null}
        {accountSettingsOpen ? (
          <FantasyAccountSettings
            user={user}
            onClose={() => setAccountSettingsOpen(false)}
            onUserUpdated={setUser}
            onLogout={clearSession}
          />
        ) : null}
      </div>
    );
  }

  const showGoogleSignIn = authConfig?.googleSignInEnabled && process.env.REACT_APP_GOOGLE_CLIENT_ID;

  return (
    <div className="fantasy-auth-container fantasy-section">
      {tab !== 'verify' && tab !== 'forgot' && tab !== 'reset' && tab !== 'google-profile' && (
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
        <>
          {showGoogleSignIn ? (
            <>
              <FantasyGoogleSignIn
                onCredential={(credential) => handleGoogleCredential(credential)}
                onError={setError}
              />
              <div className="fantasy-auth-divider"><span>or sign in with email</span></div>
            </>
          ) : null}
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
              <button type="button" className="fantasy-btn fantasy-btn-text" onClick={() => { setTab('forgot'); setError(''); setMessage(''); }}>
                Forgot password?
              </button>
            </div>
          </form>
        </>
      )}

      {tab === 'forgot' && (
        <form className="fantasy-form" onSubmit={handleForgotPassword}>
          <p className="fantasy-form-lead">
            {authConfig?.passwordResetViaEmail
              ? 'Enter your registered email and we will send a reset link if the account uses a password.'
              : 'Password reset emails are not available on this site. Use Google Sign-In if you registered that way, or contact the league admin for help.'}
          </p>
          {showGoogleSignIn ? (
            <>
              <FantasyGoogleSignIn
                onCredential={(credential) => handleGoogleCredential(credential)}
                onError={setError}
              />
              <div className="fantasy-auth-divider"><span>or request admin help by email</span></div>
            </>
          ) : null}
          {authConfig?.adminContactEmail ? (
            <p className="fantasy-form-note">League admin: <a href={`mailto:${authConfig.adminContactEmail}`}>{authConfig.adminContactEmail}</a></p>
          ) : null}
          <div className="fantasy-form-group">
            <label className="fantasy-label" htmlFor="fa-forgot-email">Email</label>
            <input id="fa-forgot-email" className="fantasy-input" type="email" autoComplete="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
          </div>
          <div className="fantasy-actions">
            <button type="submit" className="fantasy-btn fantasy-btn-primary" disabled={forgotLoading}>
              {forgotLoading ? 'Checking…' : authConfig?.passwordResetViaEmail ? 'Send reset link' : 'Continue'}
            </button>
            <button type="button" className="fantasy-btn fantasy-btn-secondary" onClick={() => { setTab('login'); setError(''); setMessage(''); }}>
              Back to sign in
            </button>
          </div>
        </form>
      )}

      {tab === 'reset' && (
        <form className="fantasy-form" onSubmit={handleResetPassword}>
          <p className="fantasy-form-lead">Choose a new password for your fantasy account.</p>
          <div className="fantasy-form-group">
            <label className="fantasy-label" htmlFor="fa-reset-pass">New password</label>
            <input id="fa-reset-pass" className="fantasy-input" type="password" autoComplete="new-password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} required minLength={8} />
          </div>
          <div className="fantasy-form-group">
            <label className="fantasy-label" htmlFor="fa-reset-confirm">Confirm new password</label>
            <input id="fa-reset-confirm" className="fantasy-input" type="password" autoComplete="new-password" value={resetConfirmPassword} onChange={(e) => setResetConfirmPassword(e.target.value)} required minLength={8} />
          </div>
          <div className="fantasy-actions">
            <button type="submit" className="fantasy-btn fantasy-btn-primary" disabled={resetLoading || !resetToken}>
              {resetLoading ? 'Updating…' : 'Update password'}
            </button>
            <button type="button" className="fantasy-btn fantasy-btn-secondary" onClick={() => { setTab('login'); setSearchParams({}); setError(''); setMessage(''); }}>
              Back to sign in
            </button>
          </div>
        </form>
      )}

      {tab === 'google-profile' && (
        <form className="fantasy-form" onSubmit={handleGoogleProfileSubmit}>
          <p className="fantasy-form-lead">Finish creating your fantasy account for <strong>{googleEmail}</strong>.</p>
          <div className="fantasy-form-group">
            <label className="fantasy-label" htmlFor="fa-google-team">Fantasy team name</label>
            <input id="fa-google-team" className="fantasy-input" type="text" value={googleTeam} onChange={(e) => setGoogleTeam(e.target.value)} required />
          </div>
          <div className="fantasy-form-group">
            <label className="fantasy-label" htmlFor="fa-google-mgr">Manager name</label>
            <input id="fa-google-mgr" className="fantasy-input" type="text" value={googleManager} onChange={(e) => setGoogleManager(e.target.value)} required />
          </div>
          <div className="fantasy-actions">
            <button type="submit" className="fantasy-btn fantasy-btn-primary">Create account</button>
            <button type="button" className="fantasy-btn fantasy-btn-secondary" onClick={() => { setTab('register'); setError(''); setMessage(''); }}>
              Back
            </button>
          </div>
        </form>
      )}

      {tab === 'register' && (
        <>
          {showGoogleSignIn ? (
            <>
              <FantasyGoogleSignIn
                onCredential={(credential) => handleGoogleCredential(credential)}
                onError={setError}
              />
              <div className="fantasy-auth-divider"><span>or register with email</span></div>
            </>
          ) : null}
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
            <label className="fantasy-label" htmlFor="fa-reg-confirm-pass">Confirm password</label>
            <input id="fa-reg-confirm-pass" className="fantasy-input" type="password" autoComplete="new-password" value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} required minLength={8} />
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
        </>
      )}

      {tab === 'verify' && !authConfig?.skipEmailVerify && (
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
