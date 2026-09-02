import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { clearFantasyUserCache } from '../utils/fantasySquadStorage';
import './FantasyAccountSettings.css';

export default function FantasyAccountSettings({ user, onClose, onUserUpdated, onLogout }) {
  const [managerName, setManagerName] = useState('');
  const [teamName, setTeamName] = useState('');

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');

  useEffect(() => {
    if (!user) return;
    setManagerName(user.managerName || '');
    setTeamName(user.teamName || '');
  }, [user]);

  const dirty = useMemo(() => {
    if (!user) return false;
    return (
      managerName.trim() !== (user.managerName || '') ||
      teamName.trim() !== (user.teamName || '')
    );
  }, [user, managerName, teamName]);

  const handleCancel = () => {
    if (!user) return;
    setManagerName(user.managerName || '');
    setTeamName(user.teamName || '');
    setError('');
    setMessage('');
    onClose?.();
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const { data } = await api.patch('/fantasy/auth/profile', {
        managerName: managerName.trim(),
        teamName: teamName.trim(),
      });
      if (!data?.success) throw new Error(data?.message || 'Profile update failed.');

      onUserUpdated?.(data.user);
      setMessage('Account updated.');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not save account.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    if (!user) return;
    setDeleting(true);
    setError('');
    setMessage('');

    try {
      const { data } = await api.delete('/fantasy/auth/account', {
        data: { password: deletePassword, confirmation: deleteConfirm },
      });
      if (!data?.success) throw new Error(data?.message || 'Account deletion failed.');

      clearFantasyUserCache(user.id);
      onLogout?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not delete account.');
    } finally {
      setDeleting(false);
    }
  };

  if (!user) return null;

  const deleteEnabled = deleteConfirm === 'DELETE' && deletePassword.length > 0;

  return (
    <div className="fas-overlay" onClick={handleCancel} role="presentation">
      <div
        className="fas-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="fas-title"
      >
        <header className="fas-header">
          <h2 id="fas-title">Fantasy account</h2>
          <button type="button" className="fas-close" onClick={handleCancel} aria-label="Close">
            ×
          </button>
        </header>

        {message ? <p className="fas-message fas-message--ok">{message}</p> : null}
        {error ? <p className="fas-message fas-message--error">{error}</p> : null}

        <form className="fas-form" onSubmit={handleSave}>
          <section className="fas-section">
            <h3>Account</h3>
            <label className="fas-field">
              <span>Manager name</span>
              <input
                type="text"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                maxLength={50}
                required
              />
            </label>
            <label className="fas-field">
              <span>Fantasy team name</span>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                maxLength={50}
                required
              />
            </label>
            <label className="fas-field">
              <span>Email</span>
              <input type="email" value={user.email} readOnly disabled className="fas-readonly" />
            </label>
          </section>

          <div className="fas-actions">
            <button type="button" className="fantasy-btn fantasy-btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button type="submit" className="fantasy-btn fantasy-btn-primary" disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save account'}
            </button>
          </div>
        </form>

        <section className="fas-section fas-danger">
          <h3>Danger zone</h3>
          <p className="fas-hint">
            Deleting your account removes your squad and login. Historical season archives keep recorded names and points.
          </p>
          <form onSubmit={handleDelete} className="fas-delete-form">
            <label className="fas-field">
              <span>Current password</span>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <label className="fas-field">
              <span>Type DELETE to confirm</span>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
              />
            </label>
            <button
              type="submit"
              className="fas-delete-btn"
              disabled={deleting || !deleteEnabled}
            >
              {deleting ? 'Deleting…' : 'Delete account'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
