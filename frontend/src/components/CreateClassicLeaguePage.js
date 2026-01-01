import React from 'react';
import './CreateClassicLeaguePage.css';

export default function CreateClassicLeaguePage({ onBack, onCreate }) {
  return (
    <div className="create-league-container">
      <button className="back-btn" onClick={onBack} aria-label="Back">&#8592;</button>
      <h2>Create a Classic League</h2>
      <div className="classic-league-desc">
        <h3>Classic Scoring</h3>
        <p>
          In a league with classic scoring, teams are ranked based on their total points in the game.<br/>
          You can join or leave a league with classic scoring at any point during the season.
        </p>
      </div>
      <button className="create-league-btn" onClick={onCreate}>Create League</button>
    </div>
  );
}
