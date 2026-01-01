import React, { useState, useEffect } from 'react';
import { Trophy, Award, RefreshCcw, Edit3, Save, FileDown, FileBarChart2 } from 'lucide-react';
import PropTypes from 'prop-types';
import api from '../utils/api';
import GoalScorerSelector from './GoalScorerSelector';
import TeamSelection from './TeamSelection';
import PlayerPriceEditor from './PlayerPriceEditor';

// Helper function to get team logo CSS class
const getTeamLogoClass = (teamName) => {
  const baseClass = 'team-logo';
  const teamClass = `${teamName.toLowerCase()}-logo`;
  return `${baseClass} ${teamClass}`;
};

const AdminPanel = ({ onDataChange, isAdmin }) => {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedCompetition, setSelectedCompetition] = useState('league');
  const [selectedMatchweek, setSelectedMatchweek] = useState('');
  const [loading, setLoading] = useState(false);
  const [cupTeams, setCupTeams] = useState([]);
  const [leagueWinnerId, setLeagueWinnerId] = useState('');
  const [cupWinnerId, setCupWinnerId] = useState('');
  const [showRunnerUpSelection, setShowRunnerUpSelection] = useState(false);
  const [runnerUpId, setRunnerUpId] = useState('');
  const [showCupSelection, setShowCupSelection] = useState(false);
  const [showSuperCupSelection, setShowSuperCupSelection] = useState(false);
  const [showPriceEditor, setShowPriceEditor] = useState(false);
  const [editedMatches, setEditedMatches] = useState({}); // Store local edits
  const [savingMatches, setSavingMatches] = useState(new Set()); // Track which matches are being saved
  const [fixtureStatus, setFixtureStatus] = useState({}); // Track fixture publication status
  const [goalscorerData, setGoalscorerData] = useState({}); // Track goalscorer + cards/clean sheets per match
  const [selectedMatchForLineup, setSelectedMatchForLineup] = useState(null); // Track match being edited for lineups

  useEffect(() => {
    if (isAdmin) {
      fetchTeams();
      fetchMatches();
      fetchFixtureStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchMatches();
      fetchFixtureStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, selectedCompetition, selectedMatchweek]);

  if (!isAdmin) return null;
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
      
      // Filter out null teams and log
      const validTeams = response.data.filter(team => {
        if (!team || !team.name) {
          console.warn('⚠️ Invalid team detected in AdminPanel:', team);
          return false;
        }
        return true;
      });
      
      console.log(`✅ Fetched ${validTeams.length}/${response.data.length} valid teams for admin`);
      setTeams(validTeams);
    } catch (error) {
      console.error('Error fetching teams:', error);
      setTeams([]);
    }
  };

  const fetchMatches = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCompetition) params.append('competition', selectedCompetition);
      if (selectedMatchweek) params.append('matchweek', selectedMatchweek);
      params.append('includeUnpublished', 'true'); // Admin sees all fixtures
      const response = await api.get(`/matches?${params}`);
      
      // Filter out null matches
      const validMatches = response.data.filter(match => {
        if (!match || !match.homeTeam || !match.awayTeam) {
          console.warn('⚠️ Invalid match detected in AdminPanel:', match);
          return false;
        }
        return true;
      });
      
      console.log(`✅ Fetched ${validMatches.length}/${response.data.length} valid matches for admin`);
      setMatches(validMatches);
    } catch (error) {
      console.error('Error fetching matches:', error);
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

  // (No unconditional useEffect hooks)

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
    // If same team selected for both, prompt for runner-up selection
    if (leagueWinnerId === cupWinnerId) {
      setShowRunnerUpSelection(true);
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

  const handleRunnerUpConfirm = async () => {
    if (!runnerUpId) {
      alert('Please select a runner-up team.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/matches/generate-super-cup', { 
        leagueWinnerId, 
        cupWinnerId: runnerUpId,
        originalDoubleWinnerId: leagueWinnerId // for backend record
      });
      await fetchMatches();
      alert('Super Cup fixture generated successfully!');
      setShowSuperCupSelection(false);
      setShowRunnerUpSelection(false);
      setLeagueWinnerId('');
      setCupWinnerId('');
      setRunnerUpId('');
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
    // Allow saving even if only goalscorers/assisters were edited
    const edits = editedMatches[matchId] || {};

    // Validate goalscorers if there are goals either from scores or selectors
    const scorerDataForValidation = goalscorerData[matchId];
    const goalData = scorerDataForValidation?.goals || scorerDataForValidation || { home: [], away: [] };
    const totalGoalsFromScores = (parseInt(edits.homeScore) || 0) + (parseInt(edits.awayScore) || 0);
    const totalGoalsFromSelectors = goalData
      ? (goalData.home.length + goalData.away.length)
      : 0;
    const totalGoals = Math.max(totalGoalsFromScores, totalGoalsFromSelectors);

    if (totalGoals > 0) {
      if (!scorerDataForValidation) {
        alert('Please select goalscorers for all goals before saving');
        return;
      }

      const homeGoalsFilled = goalData.home.every(g => g.scorerId !== '');
      const awayGoalsFilled = goalData.away.every(g => g.scorerId !== '');

      if (!homeGoalsFilled || !awayGoalsFilled) {
        alert('Please select a goalscorer for each goal before saving');
        return;
      }
    }

    console.log('💾 Saving match with edits:', edits);
    setSavingMatches(prev => new Set([...prev, matchId]));
    try {
      // Build events array from goalscorer data
      const events = [];
      const scorerData = goalscorerData[matchId];
      const goals = scorerData?.goals || scorerData || { home: [], away: [] };
      const cards = scorerData?.cards || { home: [], away: [] };
      const cleanSheets = scorerData?.cleanSheets || { home: { enabled: false, playerId: '' }, away: { enabled: false, playerId: '' } };
      
      if (goals) {
        // Add home team goals
        for (const goal of goals.home) {
          if (goal.scorerId) {
            events.push({
              type: 'GOAL',
              side: 'home',
              player: goal.scorerId,
              ownGoal: goal.isOwnGoal,
              ...(goal.assistId && !goal.isOwnGoal && { assistPlayer: goal.assistId })
            });
          }
        }

        // Add away team goals
        for (const goal of goals.away) {
          if (goal.scorerId) {
            events.push({
              type: 'GOAL',
              side: 'away',
              player: goal.scorerId,
              ownGoal: goal.isOwnGoal,
              ...(goal.assistId && !goal.isOwnGoal && { assistPlayer: goal.assistId })
            });
          }
        }
      }

      // Cards
      ['home', 'away'].forEach(side => {
        (cards[side] || []).forEach(card => {
          if (card.playerId) {
            events.push({
              type: card.type,
              side,
              player: card.playerId
            });
          }
        });
      });

      // Clean sheets
      ['home', 'away'].forEach(side => {
        if (cleanSheets[side]?.enabled && cleanSheets[side].playerId) {
          events.push({
            type: 'CLEAN_SHEET',
            side,
            player: cleanSheets[side].playerId
          });
        }
      });

      // First save the match with scores
      const response = await api.put(`/matches/${matchId}`, edits);
      console.log('✅ Match saved successfully:', response.data);

      // Then save events if there are any
      if (events.length > 0) {
        await api.post(`/matches/${matchId}/events`, { events });
        console.log('✅ Match events saved successfully');
      }
      
      // Refresh data in parallel for better performance
      await Promise.all([
        fetchMatches(),
        fetchTeams()
      ]);
      
      // Trigger UserView refresh without page reload
      onDataChange();
      
      // Clear goalscorer data and edited matches
      setGoalscorerData(prev => {
        const newData = { ...prev };
        delete newData[matchId];
        return newData;
      });

      setEditedMatches(prev => {
        const newEdited = { ...prev };
        delete newEdited[matchId];
        return newEdited;
      });
      
      console.log('✅ Match data refreshed successfully');
      
    } catch (error) {
      console.error('❌ Error saving match:', error.response?.data || error.message);
      const msg = error.response?.data?.message || error.message;
      alert('Error saving match: ' + msg);
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
    if (editedMatch && Object.prototype.hasOwnProperty.call(editedMatch, field)) {
      return editedMatch[field];
    }
    // Return the original match value, or null if it doesn't exist
    return match[field] !== undefined ? match[field] : null;
  };

  const hasUnsavedChanges = (matchId) => {
    const hasEdits = editedMatches[matchId] && Object.keys(editedMatches[matchId]).length > 0;
    const data = goalscorerData[matchId];
    const goals = data?.goals || data;
    const cards = data?.cards;
    const cleanSheets = data?.cleanSheets;
    const hasGoalscorers = goals && ((goals.home && goals.home.length > 0) || (goals.away && goals.away.length > 0));
    const hasCards = cards && ((cards.home && cards.home.length > 0) || (cards.away && cards.away.length > 0));
    const hasCleanSheets = cleanSheets && ((cleanSheets.home?.enabled && cleanSheets.home.playerId) || (cleanSheets.away?.enabled && cleanSheets.away.playerId));
    return hasEdits || hasGoalscorers || hasCards || hasCleanSheets;
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

  // Export fixtures to JSON
  const exportFixturesToJSON = async () => {
    try {
          const response = await api.get('/matches?includeUnpublished=true');
          const allMatches = response.data;
      
          const dataStr = JSON.stringify(allMatches, null, 2);
          const dataBlob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(dataBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `fixtures-backup-${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
      
          alert('Fixtures exported successfully as JSON!');
        } catch (error) {
          alert('Error exporting fixtures: ' + error.message);
        }
  };

  // Export fixtures to CSV
  const exportFixturesToCSV = async () => {
      try {
          const response = await api.get('/matches?includeUnpublished=true');
          const allMatches = response.data;
      
          // CSV headers
          const headers = [
            'Competition',
            'Matchweek',
            'Date',
            'Time',
            'Home Team',
            'Away Team',
            'Home Score',
            'Away Score',
            'Home Penalties',
            'Away Penalties',
            'Stage',
            'Status',
            'Published'
          ];
      
          // CSV rows
          const rows = allMatches.map(match => [
            match.competition || '',
            match.matchweek || '',
            new Date(match.date).toLocaleDateString() || '',
            match.time || '',
            match.homeTeam?.name || '',
            match.awayTeam?.name || '',
            match.homeScore !== null ? match.homeScore : '',
            match.awayScore !== null ? match.awayScore : '',
            match.homePenalties !== null ? match.homePenalties : '',
            match.awayPenalties !== null ? match.awayPenalties : '',
            match.stage || '',
            match.isPlayed ? 'Played' : 'Scheduled',
            match.isPublished ? 'Yes' : 'No'
          ]);
      
          // Combine headers and rows
          const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
          ].join('\n');
      
          const dataBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(dataBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `fixtures-backup-${new Date().toISOString().split('T')[0]}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
      
          alert('Fixtures exported successfully as CSV!');
        } catch (error) {
          alert('Error exporting fixtures: ' + error.message);
        }
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
    <>
    <div>
      {/* Admin Getting Started Guide */}
      <div className="card" style={{ marginBottom: '12px' }}>
        <h2>📘 Getting Started</h2>
        <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
          <li>Initialize Teams to create the six league teams.</li>
          <li>Set League Fixtures to generate 10 matchweeks (home and away).
          </li>
          <li>Open Fixture Management below and click &quot;Save League Fixtures&quot; to publish them to users.</li>
          <li>Edit Matches to enter scores; add goals, assists, cards, and clean sheets under &quot;Select Goalscorers &amp; Events&quot;.</li>
          <li>Use Refresh Fixtures to sync the admin and user views.</li>
        </ol>
      </div>
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
          {/* Removed Player Prices button as requested */}
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
            <RefreshCcw size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Refresh Fixtures
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
              {teams?.filter(team => team && team._id && team.name && team.name !== 'Orion' && team.name !== 'Firestorm').map(team => (
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
                        alt={team?.name || 'Team'} 
                        className={getTeamLogoClass(team?.name || 'Unknown')}
                        style={{ width: '20px', height: '20px' }}
                      />
                    )}
                    {team?.name || 'Unknown Team'}
                  </div>
                </button>
              ))}
            </div>
            <div className="selected-teams">
              <strong>Selected: {cupTeams.length}/4</strong>
              {cupTeams.length > 0 && (
                <div>{cupTeams.filter(t => t && t.name).map(t => t?.name).join(', ')}</div>
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
            <h3><Trophy size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />Configure Super Cup Final</h3>
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
                  {teams?.filter(team => team && team._id && team.name && team.name !== 'Orion' && team.name !== 'Firestorm').map(team => (
                    <option 
                      key={team._id} 
                      value={team._id}
                    >
                      {team?.name || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="winner-selection">
                <label htmlFor="cup-winner"><Award size={16} style={{ marginRight: 4, verticalAlign: 'middle' }} />Cup Winner:</label>
                <select
                  id="cup-winner"
                  value={cupWinnerId}
                  onChange={(e) => setCupWinnerId(e.target.value)}
                  className="team-dropdown"
                >
                  <option value="">Select Cup Winner</option>
                  {teams?.filter(team => team && team._id && team.name && team.name !== 'Orion' && team.name !== 'Firestorm').map(team => (
                    <option 
                      key={team._id} 
                      value={team._id}
                    >
                      {team?.name || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {/* Show runner-up modal immediately if both winners are the same */}
            {leagueWinnerId && cupWinnerId && leagueWinnerId === cupWinnerId ? (
              <>
                <div className="modal-overlay">
                  <div className="modal">
                    <h3><Trophy size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />Double Winner Detected</h3>
                    <p>The same team was selected as both League Winner and Cup Winner. Please select a runner-up team to play in the Super Cup:</p>
                    <select
                      value={runnerUpId}
                      onChange={e => setRunnerUpId(e.target.value)}
                      className="team-dropdown"
                    >
                      <option value="">Select Runner-up</option>
                      {teams?.filter(team => team && team._id && team.name && team._id !== leagueWinnerId && team.name !== 'Orion' && team.name !== 'Firestorm').map(team => (
                        <option key={team._id} value={team._id}>{team.name}</option>
                      ))}
                    </select>
                    <div className="modal-actions">
                      <button 
                        className="btn btn-success" 
                        onClick={handleRunnerUpConfirm}
                        disabled={!runnerUpId || loading}
                      >
                        Confirm Runner-up
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => {
                          setShowSuperCupSelection(false);
                          setShowRunnerUpSelection(false);
                          setLeagueWinnerId('');
                          setCupWinnerId('');
                          setRunnerUpId('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              leagueWinnerId && cupWinnerId && (
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
              )
            )}
            <div className="modal-actions">
              <button 
                className="btn btn-success" 
                onClick={generateSuperCupFixtures}
                disabled={!leagueWinnerId || !cupWinnerId || (leagueWinnerId === cupWinnerId && !runnerUpId) || loading}
              >
                Generate Super Cup Fixture
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowSuperCupSelection(false);
                  setLeagueWinnerId('');
                  setCupWinnerId('');
                  setRunnerUpId('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Runner-up Selection Modal */}
      {showRunnerUpSelection && (
        <div className="modal-overlay">
          <div className="modal">
            <h3><Trophy size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />Double Winner Detected</h3>
            <p>The same team was selected as both League Winner and Cup Winner. Please select a runner-up team to play in the Super Cup:</p>
            <select
              value={runnerUpId}
              onChange={e => setRunnerUpId(e.target.value)}
              className="team-dropdown"
            >
              <option value="">Select Runner-up</option>
              {teams?.filter(team => team && team._id && team.name && team._id !== leagueWinnerId && team.name !== 'Orion' && team.name !== 'Firestorm').map(team => (
                <option key={team._id} value={team._id}>{team.name}</option>
              ))}
            </select>
            <div className="modal-actions">
              <button 
                className="btn btn-success" 
                onClick={handleRunnerUpConfirm}
                disabled={!runnerUpId || loading}
              >
                Confirm Runner-up
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowRunnerUpSelection(false);
                  setRunnerUpId('');
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
        <h2><Edit3 size={22} style={{ marginRight: 8, verticalAlign: 'middle' }} />Edit Matches</h2>
        
          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6' }}>
            <h3 style={{ marginBottom: '10px', fontSize: '16px', fontWeight: 600 }}><Save size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />Backup & Export</h3>
            <p style={{ marginBottom: '12px', fontSize: '13px', color: '#666' }}>
              Download all fixtures as a backup. JSON format can be re-imported, CSV can be opened in Excel.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={exportFixturesToJSON}
                  className="btn btn-primary btn-small"
                  title="Export all fixtures as JSON file"
                >
                  <FileDown size={16} style={{ marginRight: 4, verticalAlign: 'middle' }} />Export JSON
                </button>
                <button 
                  onClick={exportFixturesToCSV}
                  className="btn btn-success btn-small"
                  title="Export all fixtures as CSV file"
                >
                  <FileBarChart2 size={16} style={{ marginRight: 4, verticalAlign: 'middle' }} />Export CSV
                </button>
            </div>
          </div>
        
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
          <>
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
              <button
                onClick={async () => {
                  if(window.confirm('Reset this match score?')) {
                    try {
                      await api.post(`/matches/${match._id}/reset-score`);
                      await fetchMatches();
                      alert('Match score reset!');
                    } catch (err) {
                      alert('Failed to reset match score.');
                    }
                  }
                }}
                className="btn btn-danger btn-small"
                style={{ marginLeft: '5px' }}
                title="Reset this match's score to blank"
              >
                Reset
              </button>
              {/* Team Selection feature temporarily disabled - will be implemented in fantasy section */}
            </div>
          </div>

          {/* Goalscorer Selection - appears below the match row when scores are set */}
          <GoalScorerSelector
            match={match}
            homeScore={getMatchValue(match, 'homeScore')}
            awayScore={getMatchValue(match, 'awayScore')}
            onGoalscorerData={(data) => setGoalscorerData(prev => ({ ...prev, [match._id]: data }))}
          />
          </>
        ))}

        {matches.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            No matches found. Generate fixtures first.
          </div>
        )}
      </div>
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
            {teams?.filter(team => team && team.competition === 'league').map((team, index) => (
              <tr key={team?._id}>
                <td>{index + 1}</td>
                <td><strong>{team?.name || 'Unknown'}</strong></td>
                <td>{team?.played || 0}</td>
                <td>{team?.won || 0}</td>
                <td>{team?.drawn || 0}</td>
                <td>{team?.lost || 0}</td>
                <td>{team?.goalsFor || 0}</td>
                <td>{team?.goalsAgainst || 0}</td>
                <td>{team?.goalDifference || 0}</td>
                <td><strong>{team?.points || 0}</strong></td>
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
            <h3><Trophy size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />League Fixtures</h3>
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
            <h3><Award size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />Cup Fixtures</h3>
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
            <h3><Award size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />Super Cup Fixtures</h3>
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
            <h3><Trophy size={18} style={{ marginRight: 6, verticalAlign: 'middle' }} />ACWPL Fixtures</h3>
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

      {/* Team Selection Modal */}
      {selectedMatchForLineup && (
        <div style={styles.modalOverlay} onClick={() => setSelectedMatchForLineup(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <TeamSelection
              match={selectedMatchForLineup}
              onSave={() => {
                setSelectedMatchForLineup(null);
                fetchMatches();
              }}
              onClose={() => setSelectedMatchForLineup(null)}
            />
          </div>
        </div>
      )}

      {/* Player Price Editor Modal */}
      {showPriceEditor && (
        <div style={styles.modalOverlay} onClick={() => setShowPriceEditor(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <PlayerPriceEditor onBack={() => setShowPriceEditor(false)} />
          </div>
        </div>
      )}
    </div>
  </>
  );
};

const styles = {
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    maxWidth: '90%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
  }
};

AdminPanel.propTypes = {
  onDataChange: PropTypes.func.isRequired,
  isAdmin: PropTypes.bool.isRequired
};

export default AdminPanel;
