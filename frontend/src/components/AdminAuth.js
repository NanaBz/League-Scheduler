import React, { useState, useEffect } from 'react';
import { Lock, Shield } from 'lucide-react';
import axios from 'axios';

const AdminAuth = ({ onLoginSuccess, onCancel, initialResetToken = '' }) => {
  const [step, setStep] = useState(() => (initialResetToken ? 'reset' : 'email')); // email, setup, login, forgot, reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ isValid: false, errors: [] });
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');

  useEffect(() => {
    if (initialResetToken) {
      setResetToken(initialResetToken);
      setStep('reset');
    }
  }, [initialResetToken]);

  // Force production API URL
    const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://league-scheduler.onrender.com/api'
    : process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

  // Password strength validation
  const validatePasswordStrength = (pwd) => {
    const minLength = 8;
    const hasUppercase = /[A-Z]/.test(pwd);
    const hasLowercase = /[a-z]/.test(pwd);
    const hasNumbers = /\d/.test(pwd);
    const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd);
    
    const errors = [];
    
    if (pwd.length < minLength) {
      errors.push(`At least ${minLength} characters`);
    }
    if (!hasUppercase) {
      errors.push('One uppercase letter');
    }
    if (!hasLowercase) {
      errors.push('One lowercase letter');
    }
    if (!hasNumbers) {
      errors.push('One number');
    }
    if (!hasSpecialChar) {
      errors.push('One special character');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      strength: errors.length === 0 ? 'Strong' : 
               errors.length <= 2 ? 'Medium' : 'Weak'
    };
  };

  // Handle email check
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/check-email`, { email });
      
      if (response.data.success) {
        setStep(response.data.exists && !response.data.isFirstLogin ? 'login' : 'setup');
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error checking email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle password setup
  const handlePasswordSetup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (!passwordStrength.isValid) {
      setError('Please create a stronger password');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/setup-password`, {
        email,
        password,
        confirmPassword
      });

      if (response.data.success) {
        localStorage.setItem('adminToken', response.data.token);
        onLoginSuccess(response.data.admin, response.data.token);
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error setting up password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password
      });

      if (response.data.success) {
        localStorage.setItem('adminToken', response.data.token);
        onLoginSuccess(response.data.admin, response.data.token);
      }
    } catch (error) {
      if (error.response?.data?.requiresSetup) {
        setStep('setup');
      } else {
        setError(error.response?.data?.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle password input change for strength validation
  const handlePasswordChange = (e) => {
    const pwd = e.target.value;
    setPassword(pwd);
    if (step === 'setup' || step === 'reset') {
      setPasswordStrength(validatePasswordStrength(pwd));
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await axios.post(`${API_BASE_URL}/auth/forgot-password`, { email });
      setStep('forgot-sent');
    } catch (error) {
      setError(error.response?.data?.message || 'Could not send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (resetNewPassword !== resetConfirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (!passwordStrength.isValid) {
      setError('Please create a stronger password');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/reset-password`, {
        token: resetToken,
        password: resetNewPassword,
        confirmPassword: resetConfirmPassword,
      });
      if (response.data.success) {
        setStep('reset-success');
        setPassword('');
        setResetNewPassword('');
        setResetConfirmPassword('');
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Could not reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal admin-auth-modal">
        <div className="admin-auth-header">
          <h3>
            <Lock size={18} aria-hidden="true" style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Admin Access
          </h3>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>

        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="admin-auth-form">
            <div className="form-group">
              <label htmlFor="email">Admin Email Address:</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@domain.com"
                className="input"
                required
                autoFocus
              />
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Checking...' : 'Continue'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {step === 'setup' && (
          <form onSubmit={handlePasswordSetup} className="admin-auth-form">
            <div className="setup-welcome">
              <h4>Welcome! Set up your admin password</h4>
              <p>Email: <strong>{email}</strong></p>
            </div>

            <div className="form-group">
              <label htmlFor="password">Create Password:</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={handlePasswordChange}
                placeholder="Create a strong password"
                className="input"
                required
                autoFocus
              />
              
              {password && (
                <div className={`password-strength ${passwordStrength.strength.toLowerCase()}`}>
                  <div className="strength-indicator">
                    <span>Strength: {passwordStrength.strength}</span>
                  </div>
                  {passwordStrength.errors.length > 0 && (
                    <ul className="strength-requirements">
                      {passwordStrength.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password:</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="input"
                required
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading || !passwordStrength.isValid}>
                {loading ? 'Setting up...' : 'Set Password & Login'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setStep('email')}>
                Back
              </button>
            </div>
          </form>
        )}

        {step === 'login' && (
          <form onSubmit={handleLogin} className="admin-auth-form">
            <div className="login-welcome">
              <h4>Welcome back!</h4>
              <p>Email: <strong>{email}</strong></p>
            </div>

            <div className="form-group">
              <label htmlFor="loginPassword">Password:</label>
              <input
                type="password"
                id="loginPassword"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="input"
                required
                autoFocus
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </button>
              <button type="button" className="btn btn-link" onClick={() => { setStep('forgot'); setError(''); }}>
                Forgot password?
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setStep('email')}>
                Back
              </button>
            </div>
          </form>
        )}

        {step === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="admin-auth-form">
            <div className="login-welcome">
              <h4>Reset admin password</h4>
              <p>Enter your authorized admin email. If an account exists, a reset link will be sent.</p>
            </div>
            <div className="form-group">
              <label htmlFor="forgotEmail">Admin Email:</label>
              <input
                type="email"
                id="forgotEmail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                required
                autoFocus
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => { setStep('login'); setError(''); }}>
                Back to login
              </button>
            </div>
          </form>
        )}

        {step === 'forgot-sent' && (
          <div className="admin-auth-form">
            <div className="login-welcome">
              <h4>Check your email</h4>
              <p>If an account exists for that email, a password reset link has been sent.</p>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-primary" onClick={() => setStep('login')}>
                Back to login
              </button>
            </div>
          </div>
        )}

        {step === 'reset' && (
          <form onSubmit={handleResetPassword} className="admin-auth-form">
            <div className="setup-welcome">
              <h4>Choose a new admin password</h4>
            </div>
            <div className="form-group">
              <label htmlFor="resetNewPassword">New Password:</label>
              <input
                type="password"
                id="resetNewPassword"
                value={resetNewPassword}
                onChange={(e) => {
                  setResetNewPassword(e.target.value);
                  setPasswordStrength(validatePasswordStrength(e.target.value));
                }}
                className="input"
                required
                autoFocus
              />
              {resetNewPassword && (
                <div className={`password-strength ${passwordStrength.strength.toLowerCase()}`}>
                  <div className="strength-indicator">
                    <span>Strength: {passwordStrength.strength}</span>
                  </div>
                  {passwordStrength.errors.length > 0 && (
                    <ul className="strength-requirements">
                      {passwordStrength.errors.map((err, index) => (
                        <li key={index}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="resetConfirmPassword">Confirm New Password:</label>
              <input
                type="password"
                id="resetConfirmPassword"
                value={resetConfirmPassword}
                onChange={(e) => setResetConfirmPassword(e.target.value)}
                className="input"
                required
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading || !passwordStrength.isValid}>
                {loading ? 'Updating...' : 'Update password'}
              </button>
            </div>
          </form>
        )}

        {step === 'reset-success' && (
          <div className="admin-auth-form">
            <div className="login-welcome">
              <h4>Password updated</h4>
              <p>Your admin password has been updated. You can sign in now.</p>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-primary" onClick={() => setStep('login')}>
                Back to login
              </button>
            </div>
          </div>
        )}

        <div className="auth-info">
          <small>
            <Shield size={14} aria-hidden="true" style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Only authorized admin emails can access this system
          </small>
        </div>
      </div>
    </div>
  );
};

export default AdminAuth;
