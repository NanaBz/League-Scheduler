import React, { useState } from 'react';
import './CreateClassicLeagueForm.css';

const GAMEWEEK_OPTIONS = Array.from({ length: 10 }, (_, i) => `Gameweek ${i + 1}`);


export default function CreateClassicLeagueForm({ onBack, onCreate, leagueLimit = 15, leaguesCount = 0 }) {
  const [leagueName, setLeagueName] = useState('');
  const [gameweek, setGameweek] = useState(GAMEWEEK_OPTIONS[0]);
  const [showDropdown, setShowDropdown] = useState(false);

  const canCreate = leagueName.trim().length > 0 && leaguesCount < leagueLimit;

  return (
    <div className="create-league-form-container">
      <div className="clf-header">
        <button className="clf-back-btn" onClick={onBack} aria-label="Back">&#8592;</button>
        <span className="clf-title">Configure leagues</span>
      </div>
      <div className="clf-card">
        <h2 className="clf-main-title">Create an Invitational League</h2>
        <div className="clf-field-group">
          <label className="clf-label">League Name</label>
          <div className="clf-subscript">Maximum 30 characters</div>
          <input
            className="clf-input"
            type="text"
            maxLength={30}
            placeholder="Enter Name Here"
            value={leagueName}
            onChange={e => setLeagueName(e.target.value)}
          />
          <div className="clf-desc" style={{marginTop: 2}}>
            Enter a name for your invitational league. This will be visible to all participants.
          </div>
        </div>
        <hr className="clf-divider" />
        <div className="clf-field-group">
          <label className="clf-label">Scoring starts</label>
          <div className="clf-dropdown-wrapper">
            <button
              className="clf-dropdown-btn"
              onClick={() => setShowDropdown(v => !v)}
              aria-haspopup="listbox"
              aria-expanded={showDropdown}
            >
              {gameweek}
              <span className="clf-dropdown-arrow">▼</span>
            </button>
            {showDropdown && (
              <ul className="clf-dropdown-list" role="listbox">
                {GAMEWEEK_OPTIONS.map(opt => (
                  <li
                    key={opt}
                    className={opt === gameweek ? 'selected' : ''}
                    onClick={() => { setGameweek(opt); setShowDropdown(false); }}
                    role="option"
                    aria-selected={opt === gameweek}
                  >
                    {opt}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="clf-desc">
            In a league with classic scoring, teams are ranked based on their total points in the game. You can join or leave a league a league with classic scoring at any point during the season.
          </div>
        </div>
      </div>
      <button
        className="clf-create-btn"
        onClick={() => canCreate && onCreate({ leagueName, gameweek })}
        disabled={!canCreate}
        style={{ opacity: canCreate ? 1 : 0.5, pointerEvents: canCreate ? 'auto' : 'none' }}
      >
        {leaguesCount >= leagueLimit ? 'League Limit Reached' : 'Create League'}
      </button>
      {leaguesCount >= leagueLimit && (
        <div style={{color: '#f87171', fontSize: '0.93rem', textAlign: 'center', marginTop: 8}}>
          You have reached the maximum of {leagueLimit} leagues.
        </div>
      )}
    </div>
  );
}
