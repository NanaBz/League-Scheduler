import React, { useState } from 'react';
import { Copy } from 'lucide-react';
import './LeagueSettingsPage.css';

const GAMEWEEK_OPTIONS = Array.from({ length: 10 }, (_, i) => `Gameweek ${i + 1}`);

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function LeagueSettingsPage({ league, onBack, onUpdate, onDelete }) {
  const [code, setCode] = useState(league.code || generateCode());
  const [name, setName] = useState(league.name);
  const [gameweek, setGameweek] = useState(league.gameweek || GAMEWEEK_OPTIONS[0]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [changed, setChanged] = useState(false);

  const handleRegenerate = () => setCode(generateCode());
  const handleUpdate = () => {
    onUpdate && onUpdate({ ...league, name, gameweek, code });
    setChanged(false);
  };
  const handleDelete = () => {
    setShowDeleteConfirm(false);
    onDelete && onDelete(league.id);
  };

  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="league-settings-container">
      <button className="ls-back-btn" onClick={onBack} aria-label="Back">&#8592;</button>
      <h2 className="ls-title">League Settings</h2>
      <div className="ls-section">
        <div className="ls-label">Code to join league:</div>
        <div className="ls-code-row">
          <span className="ls-code">{code}</span>
          <button className="ls-copy-btn" onClick={handleCopy} title="Copy Code" style={{background: copied ? '#a78bfa' : '#ede9fe'}}>
            <Copy size={18} style={{color: copied ? '#fff' : '#6d28d9'}} />
          </button>
          <button className="ls-regenerate-btn" onClick={handleRegenerate}>Regenerate</button>
        </div>
      </div>
      <div className="ls-section">
        <div className="ls-label">League Details</div>
        <div className="ls-field-group">
          <label className="ls-field-label">League Name</label>
          <input
            className="ls-input"
            type="text"
            maxLength={30}
            value={name}
            onChange={e => { setName(e.target.value); setChanged(true); }}
          />
        </div>
        <div className="ls-field-group">
          <label className="ls-field-label">Scoring starts</label>
          <div className="ls-dropdown-wrapper">
            <button
              className="ls-dropdown-btn"
              onClick={() => setShowDropdown(v => !v)}
              aria-haspopup="listbox"
              aria-expanded={showDropdown}
            >
              {gameweek}
              <span className="ls-dropdown-arrow">▼</span>
            </button>
            {showDropdown && (
              <ul className="ls-dropdown-list" role="listbox">
                {GAMEWEEK_OPTIONS.map(opt => (
                  <li
                    key={opt}
                    className={opt === gameweek ? 'selected' : ''}
                    onClick={() => { setGameweek(opt); setShowDropdown(false); setChanged(true); }}
                    role="option"
                    aria-selected={opt === gameweek}
                  >
                    {opt}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <button
          className="ls-update-btn"
          onClick={handleUpdate}
          disabled={!changed}
          style={{ opacity: changed ? 1 : 0.5, pointerEvents: changed ? 'auto' : 'none' }}
        >
          Update League
        </button>
      </div>
      <div className="ls-section">
        <div className="ls-label">Delete League</div>
        <div className="ls-delete-desc">
          To delete the league, click on the button below. The players entered in the league will still exist and can enter other leagues if desired.
        </div>
        <button className="ls-delete-btn" onClick={() => setShowDeleteConfirm(true)}>Delete League</button>
      </div>
      {showDeleteConfirm && (
        <div className="ls-modal-overlay">
          <div className="ls-modal">
            <div className="ls-modal-title">Delete League?</div>
            <div className="ls-modal-desc">Are you sure you want to delete this league? This action cannot be undone.</div>
            <div className="ls-modal-actions">
              <button className="ls-modal-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="ls-modal-confirm" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
