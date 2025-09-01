import React, { useState, useEffect } from 'react';
import api from '../utils/api';

// Helper function to get team logo CSS class
const getTeamLogoClass = (teamName) => {
  const baseClass = 'team-logo';
  const teamClass = `${teamName.toLowerCase()}-logo`;
  return `${baseClass} ${teamClass}`;
};

const AdminPanel = ({ onDataChange }) => {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedCompetition, setSelectedCompetition] = useState('league');
  const [selectedMatchweek, setSelectedMatchweek] = useState('');
  const [loading, setLoading] = useState(false);
  const [cupTeams, setCupTeams] = useState([]);
  const [leagueWinnerId, setLeagueWinnerId] = useState('');
  const [cupWinnerId, setCupWinnerId] = useState('');
  const [showCupSelection, setShowCupSelection] = useState(false);
  const [showSuperCupSelection, setShowSuperCupSelection] = useState(false);
  const [editedMatches, setEditedMatches] = useState({}); // Store local edits
  const [savingMatches, setSavingMatches] = useState(new Set()); // Track which matches are being saved
  const [fixtureStatus, setFixtureStatus] = useState({}); // Track fixture publication status

  // ACWPL fixture generation
  const generateACWPLFixtures = async () => {
    setLoading(true);
    try {
      await api.post('/matches/generate-acwpl');
      await fetchMatches();
      alert('ACWPL fixtures generated successfully!');
    } catch (error) {
      alert('Error generating ACWPL fixtures: ' + error.message);
    }
    setLoading(false);
  };

  const fetchTeams = async () => {
    try {
      const response = await api.get('/teams');
      setTeams(response.data);
    } catch (error) {
      console.error('Error fetching teams:', error);
      // Fallback to mock data if backend is unavailable
      setTeams([
        { _id: '1', name: 'Vikings', logo: '/logos/vikings-logo.png', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
        { _id: '2', name: 'Warriors', logo: '/logos/warriors-logo.png', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
        { _id: '3', name: 'Lions', logo: '/logos/lions-logo.png', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
        { _id: '4', name: 'Elites', logo: '/logos/elites-logo.png', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
        { _id: '5', name: 'Falcons', logo: '/logos/falcons-logo.png', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
        { _id: '6', name: 'Dragons', logo: '/logos/dragons-logo.png', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 }
      ]);
    }
  };

  const fetchMatches = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCompetition) params.append('competition', selectedCompetition);
      if (selectedMatchweek) params.append('matchweek', selectedMatchweek);
      params.append('includeUnpublished', 'true'); // Admin sees all fixtures
      const response = await api.get(`/matches?${params}`);
      setMatches(response.data);
    } catch (error) {
      console.error('Error fetching matches:', error);
      // Fallback to empty matches if backend is unavailable
      setMatches([]);
    }
  };

  const fetchFixtureStatus = async () => {
    try {
      const response = await api.get('/matches/fixture-status');
      setFixtureStatus(response.data);
    } catch (error) {
      console.error('Error fetching fixture status:', error);
      setFixtureStatus({});
    }
  };

  useEffect(() => {
    fetchTeams();
    fetchMatches();
    fetchFixtureStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchMatches();
    fetchFixtureStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompetition, selectedMatchweek]);

  const initializeTeams = async () => {
    setLoading(true);
    try {
      await api.post('/teams/initialize');
      await fetchTeams();
      alert('Teams initialized successfully!');
    } catch (error) {
      alert('Error initializing teams: ' + error.message);
    }
    setLoading(false);
  };

  const generateLeagueFixtures = async () => {
    setLoading(true);
    try {
      await api.post('/matches/generate-league');
      await fetchMatches();
      alert('League fixtures generated successfully!');
    } catch (error) {
      alert('Error generating league fixtures: ' + error.message);
    }
    setLoading(false);
  };

  const generateCupFixtures = async () => {
    if (cupTeams.length !== 4) {
      alert('Please select exactly 4 teams for the Cup');
      return;
    }
    
    setLoading(true);
    try {
      const teamIds = cupTeams.map(team => team._id);
      await api.post('/matches/generate-cup', { teamIds });
      await fetchMatches();
      alert('Cup fixtures generated successfully with selected teams!');
      setShowCupSelection(false);
      setCupTeams([]);
    } catch (error) {
      alert('Error generating cup fixtures: ' + error.message);
    }
    setLoading(false);
  };

  const generateSuperCupFixtures = async () => {
    if (!leagueWinnerId || !cupWinnerId) {
      alert('Please select both League Winner and Cup Winner');
      return;
    }
    
    if (leagueWinnerId === cupWinnerId) {
      alert('League Winner and Cup Winner must be different teams');
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/matches/generate-super-cup', { 
        leagueWinnerId, 
        cupWinnerId 
      });
      await fetchMatches();
      alert('Super Cup fixture generated successfully!');
      setShowSuperCupSelection(false);
      setLeagueWinnerId('');
      setCupWinnerId('');
    } catch (error) {
      alert('Error generating super cup fixtures: ' + error.message);
    }
    setLoading(false);
  };

  const handleCupTeamToggle = (team) => {
    setCupTeams(prev => {
      const isSelected = prev.find(t => t._id === team._id);
      if (isSelected) {
        return prev.filter(t => t._id !== team._id);
      } else if (prev.length < 4) {
        return [...prev, team];
      }
      return prev;
    });
  };

  const resetSeason = async () => {
    if (window.confirm('🏆 Archive current season and start fresh?\n\nThis will:\n✅ Save current season to archives\n✅ Reset all teams to 0 points\n✅ Clear all fixtures\n✅ Start Season ' + (new Date().getFullYear() - 2023) + '\n\nContinue?')) {
      setLoading(true);
      try {
        const response = await api.post('/seasons/reset');
        await fetchTeams();
        await fetchMatches();
        onDataChange();
        alert(`🎉 Season archived successfully!\n\n📊 Previous season saved as: Season ${response.data.archivedSeason}\n🆕 New season started: Season ${response.data.newSeason}\n\nView archived seasons in User View!`);
      } catch (error) {
        alert('Error resetting season: ' + error.message);
      }
      setLoading(false);
    }
  };

  const saveMatch = async (matchId) => {
    const edits = editedMatches[matchId];
    if (!edits) return;

    console.log('💾 Saving match with edits:', edits);
    setSavingMatches(prev => new Set([...prev, matchId]));
    try {
      const response = await api.put(`/matches/${matchId}`, edits);
      console.log('✅ Match saved successfully:', response.data);
      
      // Refresh data in parallel for better performance
      await Promise.all([
        fetchMatches(),
        fetchTeams()
      ]);
      
      // Trigger UserView refresh without page reload
      onDataChange();
      
      // Remove from edited matches after successful save
      setEditedMatches(prev => {
        const newEdited = { ...prev };
        delete newEdited[matchId];
        return newEdited;
      });
      
      console.log('✅ Match data refreshed successfully');
      
    } catch (error) {
      console.error('❌ Error saving match:', error);
      alert('Error saving match: ' + error.message);
    } finally {
      setSavingMatches(prev => {
        const newSaving = new Set(prev);
        newSaving.delete(matchId);
        return newSaving;
      });
    }
  };

  const handleMatchEdit = (matchId, field, value) => {
    setEditedMatches(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [field]: (field.includes('Score') || field.includes('Penalties')) ? (value === '' ? null : parseInt(value)) : value
      }
    }));
  };

  const getMatchValue = (match, field) => {
    const editedMatch = editedMatches[match._id];
    if (editedMatch && editedMatch.hasOwnProperty(field)) {
      return editedMatch[field];
    }
    // Return the original match value, or null if it doesn't exist
    return match[field] !== undefined ? match[field] : null;
  };

  const hasUnsavedChanges = (matchId) => {
    return editedMatches[matchId] && Object.keys(editedMatches[matchId]).length > 0;
  };

  const isMatchDrawn = (match) => {
    const homeScore = getMatchValue(match, 'homeScore');
    const awayScore = getMatchValue(match, 'awayScore');
    return homeScore !== '' && awayScore !== '' && homeScore !== null && awayScore !== null && parseInt(homeScore) === parseInt(awayScore);
  };

  const shouldShowPenalties = (match) => {
    // Show penalties if: (1) it's a cup/super-cup and drawn, OR (2) penalties have already been entered
    const penaltiesEntered = getMatchValue(match, 'homePenalties') !== null && getMatchValue(match, 'homePenalties') !== undefined;
    const penaltiesEntered2 = getMatchValue(match, 'awayPenalties') !== null && getMatchValue(match, 'awayPenalties') !== undefined;
    return (
      ((selectedCompetition === 'cup' || selectedCompetition === 'super-cup') && isMatchDrawn(match)) ||
      penaltiesEntered || penaltiesEntered2
    );
  };

  const saveFixtures = async (competition) => {
    setLoading(true);
    try {
      await api.post('/matches/save-fixtures', { competition });
      await fetchFixtureStatus();
      if (onDataChange) onDataChange(); // Trigger refresh in UserView
      alert(`${competition} fixtures have been saved and are now visible to users!`);
    } catch (error) {
      alert('Error saving fixtures: ' + error.message);
    }
    setLoading(false);
  };

  const resetFixtures = async (competition) => {
    if (!window.confirm(`Are you sure you want to reset all ${competition} fixtures? This will delete all matches for this competition.`)) {
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/matches/reset-fixtures', { competition });
      await fetchMatches();
      await fetchFixtureStatus();
      if (onDataChange) onDataChange(); // Trigger refresh in UserView
      alert(`${competition} fixtures have been reset successfully!`);
    } catch (error) {
      alert('Error resetting fixtures: ' + error.message);
    }
    setLoading(false);
  };

  const handleRefreshFixtures = async () => {
    setLoading(true);
    try {
      await fetchMatches();
      await fetchFixtureStatus();
      if (onDataChange) onDataChange(); // Trigger refresh in UserView
      alert('Fixtures refreshed successfully!');
    } catch (error) {
      alert('Error refreshing fixtures: ' + error.message);
    }
    setLoading(false);
  };

  const getFixtureStatusForCompetition = (competition) => {
    return fixtureStatus[competition] || { hasFixtures: false, isPublished: false, totalMatches: 0 };
  };

  const getMatchweeks = () => {
    const matchweeks = [...new Set(matches.map(match => match.matchweek))].sort((a, b) => a - b);
    return matchweeks;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toISOString().split('T')[0];
  };

  return (
    <div>
      {/* Admin Controls */}
      <div className="card">
        <h2>⚙️ Admin Controls</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-primary" 
            onClick={initializeTeams}
            disabled={loading}
          >
            Initialize Teams
          </button>
          <button 
            className="btn btn-success" 
            onClick={generateLeagueFixtures}
            disabled={loading}
          >
            Set League Fixtures
          </button>
          <button 
            className="btn btn-warning" 
            onClick={() => setShowCupSelection(true)}
            disabled={loading}
          >
            Set Cup Fixtures
          </button>
          <button 
            className="btn btn-info" 
            onClick={() => setShowSuperCupSelection(true)}
            disabled={loading}
          >
            Set Super Cup Fixtures
          </button>
          <button 
            className="btn btn-acwpl" 
            style={{ backgroundColor: '#222', color: '#fff', border: '1px solid #222' }}
            onClick={generateACWPLFixtures}
            disabled={loading}
          >
            Set ACWPL Fixtures
          </button>
          <button 
            className="btn btn-danger" 
            onClick={resetSeason}
            disabled={loading}
          >
            Reset Season
          </button>
          <button 
            className="btn" 
            onClick={handleRefreshFixtures}
            disabled={loading}
            style={{ 
              backgroundColor: '#6c757d', 
              color: 'white',
              border: '1px solid #6c757d'
            }}
            title="Refresh fixtures data without page reload"
          >
            🔄 Refresh Fixtures
          </button>
        </div>
      </div>

      {/* Cup Team Selection Modal */}
      {showCupSelection && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Select 4 Teams for Cup</h3>
            <p>Choose exactly 4 teams to participate in the Cup competition:</p>
            <div className="team-selection">
              {teams.map(team => (
                <button
                  key={team._id}
                  className={`team-select-btn ${cupTeams.find(t => t._id === team._id) ? 'selected' : ''}`}
                  onClick={() => handleCupTeamToggle(team)}
                  disabled={!cupTeams.find(t => t._id === team._id) && cupTeams.length >= 4}
                >
                  <div className="team-info">
                    {team.logo && (
                      <img 
                        src={team.logo} 
                        alt={team.name} 
                        className={getTeamLogoClass(team.name)}
                        style={{ width: '20px', height: '20px' }}
                      />
                    )}
                    {team.name}
                  </div>
                </button>
              ))}
            </div>
            <div className="selected-teams">
              <strong>Selected: {cupTeams.length}/4</strong>
              {cupTeams.length > 0 && (
                <div>{cupTeams.map(t => t.name).join(', ')}</div>
              )}
            </div>
            <div className="modal-actions">
              <button 
                className="btn btn-success" 
                onClick={generateCupFixtures}
                disabled={cupTeams.length !== 4 || loading}
              >
                Generate Cup Fixtures
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowCupSelection(false);
                  setCupTeams([]);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Super Cup Team Selection Modal */}
      {showSuperCupSelection && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>🏆 Configure Super Cup Final</h3>
            <p>Select the League Winner and Cup Winner for the Super Cup:</p>
            
            <div className="super-cup-selection">
              <div className="winner-selection">
                <label htmlFor="league-winner">🥇 League Winner:</label>
                <select
                  id="league-winner"
                  value={leagueWinnerId}
                  onChange={(e) => setLeagueWinnerId(e.target.value)}
                  className="team-dropdown"
                >
                  <option value="">Select League Winner</option>
                  {teams.map(team => (
                    <option 
                      key={team._id} 
                      value={team._id}
                      disabled={team._id === cupWinnerId}
                    >
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="winner-selection">
                <label htmlFor="cup-winner">🏆 Cup Winner:</label>
                <select
                  id="cup-winner"
                  value={cupWinnerId}
                  onChange={(e) => setCupWinnerId(e.target.value)}
                  className="team-dropdown"
                >
                  <option value="">Select Cup Winner</option>
                  {teams.map(team => (
                    <option 
                      key={team._id} 
                      value={team._id}
                      disabled={team._id === leagueWinnerId}
                    >
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {leagueWinnerId && cupWinnerId && (
              <div className="super-cup-preview">
                <h4>Super Cup Final Preview:</h4>
                <div className="fixture-preview">
                  <span className="league-winner">
                    {teams.find(t => t._id === leagueWinnerId)?.name} (League Winner)
                  </span>
                  <span className="vs">VS</span>
                  <span className="cup-winner">
                    {teams.find(t => t._id === cupWinnerId)?.name} (Cup Winner)
                  </span>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button 
                className="btn btn-success" 
                onClick={generateSuperCupFixtures}
                disabled={!leagueWinnerId || !cupWinnerId || loading}
              >
                Generate Super Cup Fixture
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowSuperCupSelection(false);
                  setLeagueWinnerId('');
                  setCupWinnerId('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match Editor */}
      <div className="card">
        <h2>📝 Edit Matches</h2>
        
        <div className="filter-section">
          <select
            value={selectedCompetition}
            onChange={(e) => setSelectedCompetition(e.target.value)}
          >
            <option value="league">League</option>
            <option value="cup">Cup</option>
            <option value="super-cup">Super Cup</option>
            <option value="acwpl">ACWPL</option>
          </select>
          
          {selectedCompetition === 'league' && (
            <select
              value={selectedMatchweek}
              onChange={(e) => setSelectedMatchweek(e.target.value)}
            >
              <option value="">All Matchweeks</option>
              {getMatchweeks().map(week => (
                <option key={week} value={week}>Matchweek {week}</option>
              ))}
            </select>
          )}
        </div>

        <div className="match-header">
          <div>Date</div>
          <div>Time</div>
          <div>Home Team</div>
          <div>Home Score</div>
          <div>Away Score</div>
          <div>Away Team</div>
          <div>MW</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {matches.map(match => (
          <div key={match._id} className={`match-row ${hasUnsavedChanges(match._id) ? 'match-row-edited' : ''}`}>
            <div>
              <input
                type="date"
                value={getMatchValue(match, 'date') ? new Date(getMatchValue(match, 'date')).toISOString().split('T')[0] : formatDate(match.date)}
                onChange={(e) => handleMatchEdit(match._id, 'date', e.target.value)}
                className="input"
                style={{ width: '130px' }}
              />
            </div>
            <div>
              <input
                type="time"
                value={getMatchValue(match, 'time')}
                onChange={(e) => handleMatchEdit(match._id, 'time', e.target.value)}
                className="input"
                style={{ width: '80px' }}
              />
            </div>
            <div><strong>{match.homeTeam.name}</strong></div>
            <div>
              <input
                type="number"
                min="0"
                max="20"
                value={getMatchValue(match, 'homeScore') === null ? '' : getMatchValue(match, 'homeScore')}
                onChange={(e) => handleMatchEdit(match._id, 'homeScore', e.target.value)}
                className="input"
                placeholder="Enter score"
              />
              {shouldShowPenalties(match) && (
                <>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={
                      getMatchValue(match, 'homePenalties') === null || getMatchValue(match, 'homePenalties') === undefined || getMatchValue(match, 'homePenalties') === ''
                        ? ''
                        : String(getMatchValue(match, 'homePenalties'))
                    }
                    onChange={(e) => handleMatchEdit(match._id, 'homePenalties', e.target.value)}
                    className="input penalty-input"
                    placeholder="P"
                    style={{ width: '40px', marginLeft: '5px', border: '2px solid #dc2626', background: '#fff6f6', color: '#222', fontWeight: 600, textAlign: 'center' }}
                    title="Penalty shootout score"
                  />
                  <span style={{ marginLeft: 2, color: '#dc2626', fontWeight: 600, fontSize: '0.95em' }}>P</span>
                </>
              )}
            </div>
            <div>
              <input
                type="number"
                min="0"
                max="20"
                value={getMatchValue(match, 'awayScore') === null ? '' : getMatchValue(match, 'awayScore')}
                onChange={(e) => handleMatchEdit(match._id, 'awayScore', e.target.value)}
                className="input"
                placeholder="Enter score"
              />
              {shouldShowPenalties(match) && (
                <>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={
                      getMatchValue(match, 'awayPenalties') === null || getMatchValue(match, 'awayPenalties') === undefined || getMatchValue(match, 'awayPenalties') === ''
                        ? ''
                        : String(getMatchValue(match, 'awayPenalties'))
                    }
                    onChange={(e) => handleMatchEdit(match._id, 'awayPenalties', e.target.value)}
                    className="input penalty-input"
                    placeholder="P"
                    style={{ width: '40px', marginLeft: '5px', border: '2px solid #dc2626', background: '#fff6f6', color: '#222', fontWeight: 600, textAlign: 'center' }}
                    title="Penalty shootout score"
                  />
                  <span style={{ marginLeft: 2, color: '#dc2626', fontWeight: 600, fontSize: '0.95em' }}>P</span>
                </>
              )}
            </div>
            <div><strong>{match.awayTeam.name}</strong></div>
            <div>{match.matchweek}</div>
            <div>
              <span className={`badge ${match.isPlayed ? 'badge-success' : 'badge-warning'}`}>
                {match.isPlayed ? 'Played' : 'Scheduled'}
              </span>
            </div>
            <div>
              {hasUnsavedChanges(match._id) && (
                <button
                  onClick={() => saveMatch(match._id)}
                  disabled={savingMatches.has(match._id)}
                  className="btn btn-success btn-small"
                  style={{ marginRight: '5px' }}
                >
                  {savingMatches.has(match._id) ? 'Saving...' : 'Save'}
                </button>
              )}
              {hasUnsavedChanges(match._id) && (
                <button
                  onClick={() => {
                    setEditedMatches(prev => {
                      const newEdited = { ...prev };
                      delete newEdited[match._id];
                      return newEdited;
                    });
                  }}
                  className="btn btn-secondary btn-small"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}

        {matches.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            No matches found. Generate fixtures first.
          </div>
        )}
      </div>

      {/* Current League Table */}
      <div className="card">
        <h2>📊 Current League Table</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Team</th>
              <th>P</th>
              <th>W</th>
              <th>D</th>
              <th>L</th>
              <th>GF</th>
              <th>GA</th>
              <th>GD</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {teams.filter(team => team.competition === 'league').map((team, index) => (
              <tr key={team._id}>
                <td>{index + 1}</td>
                <td><strong>{team.name}</strong></td>
                <td>{team.played}</td>
                <td>{team.won}</td>
                <td>{team.drawn}</td>
                <td>{team.lost}</td>
                <td>{team.goalsFor}</td>
                <td>{team.goalsAgainst}</td>
                <td>{team.goalDifference}</td>
                <td><strong>{team.points}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Fixture Management */}
      <div className="card">
        <h2>🎯 Fixture Management</h2>
        <p>Save fixtures to make them visible to users, or reset to regenerate them.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          {/* League Fixtures */}
          <div className="fixture-management-card">
            <h3>🏆 League Fixtures</h3>
            <div className="status-info">
              <p>Status: <span className={`status-badge ${getFixtureStatusForCompetition('league').isPublished ? 'published' : 'draft'}`}>
                {getFixtureStatusForCompetition('league').isPublished ? 'Published' : getFixtureStatusForCompetition('league').hasFixtures ? 'Draft' : 'Not Generated'}
              </span></p>
              <p>Matches: {getFixtureStatusForCompetition('league').totalMatches}/30</p>
            </div>
            <div className="fixture-actions">
              {getFixtureStatusForCompetition('league').hasFixtures && !getFixtureStatusForCompetition('league').isPublished && (
                <button 
                  className="btn btn-success btn-small" 
                  onClick={() => saveFixtures('league')}
                  disabled={loading}
                >
                  Save League Fixtures
                </button>
              )}
              {getFixtureStatusForCompetition('league').hasFixtures && (
                <button 
                  className="btn btn-danger btn-small" 
                  onClick={() => resetFixtures('league')}
                  disabled={loading}
                >
                  Reset League
                </button>
              )}
            </div>
          </div>

          {/* Cup Fixtures */}
          <div className="fixture-management-card">
            <h3>🏅 Cup Fixtures</h3>
            <div className="status-info">
              <p>Status: <span className={`status-badge ${getFixtureStatusForCompetition('cup').isPublished ? 'published' : 'draft'}`}>
                {getFixtureStatusForCompetition('cup').isPublished ? 'Published' : getFixtureStatusForCompetition('cup').hasFixtures ? 'Draft' : 'Not Generated'}
              </span></p>
              <p>Matches: {getFixtureStatusForCompetition('cup').totalMatches}/3</p>
            </div>
            <div className="fixture-actions">
              {getFixtureStatusForCompetition('cup').hasFixtures && !getFixtureStatusForCompetition('cup').isPublished && (
                <button 
                  className="btn btn-success btn-small" 
                  onClick={() => saveFixtures('cup')}
                  disabled={loading}
                >
                  Save Cup Fixtures
                </button>
              )}
              {getFixtureStatusForCompetition('cup').hasFixtures && (
                <button 
                  className="btn btn-danger btn-small" 
                  onClick={() => resetFixtures('cup')}
                  disabled={loading}
                >
                  Reset Cup
                </button>
              )}
            </div>
          </div>

          {/* Super Cup Fixtures */}
          <div className="fixture-management-card">
            <h3>⭐ Super Cup Fixtures</h3>
            <div className="status-info">
              <p>Status: <span className={`status-badge ${getFixtureStatusForCompetition('super-cup').isPublished ? 'published' : 'draft'}`}>
                {getFixtureStatusForCompetition('super-cup').isPublished ? 'Published' : getFixtureStatusForCompetition('super-cup').hasFixtures ? 'Draft' : 'Not Generated'}
              </span></p>
              <p>Matches: {getFixtureStatusForCompetition('super-cup').totalMatches}/1</p>
            </div>
            <div className="fixture-actions">
              {getFixtureStatusForCompetition('super-cup').hasFixtures && !getFixtureStatusForCompetition('super-cup').isPublished && (
                <button 
                  className="btn btn-success btn-small" 
                  onClick={() => saveFixtures('super-cup')}
                  disabled={loading}
                >
                  Save Super Cup Fixtures
                </button>
              )}
              {getFixtureStatusForCompetition('super-cup').hasFixtures && (
                <button 
                  className="btn btn-danger btn-small" 
                  onClick={() => resetFixtures('super-cup')}
                  disabled={loading}
                >
                  Reset Super Cup
                </button>
              )}
            </div>
          </div>

          {/* ACWPL Fixtures */}
          <div className="fixture-management-card">
            <h3>👧 ACWPL Fixtures</h3>
            <div className="status-info">
              <p>Status: <span className={`status-badge ${getFixtureStatusForCompetition('acwpl').isPublished ? 'published' : 'draft'}`}>
                {getFixtureStatusForCompetition('acwpl').isPublished ? 'Published' : getFixtureStatusForCompetition('acwpl').hasFixtures ? 'Draft' : 'Not Generated'}
              </span></p>
              <p>Matches: {getFixtureStatusForCompetition('acwpl').totalMatches}/5</p>
            </div>
            <div className="fixture-actions">
              {getFixtureStatusForCompetition('acwpl').hasFixtures && !getFixtureStatusForCompetition('acwpl').isPublished && (
                <button 
                  className="btn btn-success btn-small" 
                  onClick={() => saveFixtures('acwpl')}
                  disabled={loading}
                >
                  Save ACWPL Fixtures
                </button>
              )}
              {getFixtureStatusForCompetition('acwpl').hasFixtures && (
                <button 
                  className="btn btn-danger btn-small" 
                  onClick={() => resetFixtures('acwpl')}
                  disabled={loading}
                >
                  Reset ACWPL
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
