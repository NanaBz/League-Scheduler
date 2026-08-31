import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, Award, RefreshCcw, Edit3, Save, FileDown, FileBarChart2, ClipboardList, Settings, ListChecks, Target, BarChart3 } from 'lucide-react';
import PropTypes from 'prop-types';
import api, { parseApiErrorMessage } from '../utils/api';
import './AdminPanel.css';
import '../styles/adminFixtureMgmt.css';
import { matchEventsToGoalscorerForm, resizeGoalsToScores } from '../utils/matchEventsForm';
import GoalScorerSelector from './GoalScorerSelector';
import FixtureFilterControl, { AdminStaticFilter } from './FixtureFilterControl';
import TeamSelection from './TeamSelection';
import { userFixturePhase, desktopFixtureBadgeClass, desktopFixtureBadgeLabel } from '../utils/matchDisplayState';
import { clearFantasyClientSeasonKeys } from '../utils/fantasyGameweek';
import SeasonResetWorkflow from './SeasonResetWorkflow';
import { sortLeagueTeams } from '../utils/teamTablePosition';

const ADMIN_GETTING_STARTED_STEPS = [
  'Initialize Teams to create the six league teams.',
  'Set League Fixtures to generate 10 matchweeks (home and away).',
  'Use Publish & Reset and click "Save League Fixtures" to publish them to users.',
  'Edit Matches to enter scores; add goals, assists, cards, and clean sheets under "Select Goalscorers & Events".',
  'Use Refresh Fixtures to sync the admin and user views.',
];

const ADMIN_COMPETITION_OPTIONS = [
  { value: 'league', label: 'League' },
  { value: 'cup', label: 'Cup' },
  { value: 'super-cup', label: 'Super Cup' },
  { value: 'acwpl', label: 'ACWPL' },
  { value: 'girls-super-cup', label: 'Girls Super Cup' },
];

function renderPenaltyShootoutInput(match, side, getMatchValue, handleMatchEdit, disabled) {
  const field = side === 'home' ? 'homePenalties' : 'awayPenalties';
  const raw = getMatchValue(match, field);
  const value = raw === null || raw === undefined || raw === '' ? '' : String(raw);

  return (
    <div className="admin-penalty-shootout">
      <span className="admin-penalty-shootout__label">Pens</span>
      <input
        type="number"
        min="0"
        max="10"
        value={value}
        onChange={(e) => handleMatchEdit(match._id, field, e.target.value)}
        className="admin-penalty-shootout__input"
        placeholder="–"
        title="Penalty shootout score"
        disabled={disabled}
        aria-label={`${side === 'home' ? 'Home' : 'Away'} penalty shootout score`}
      />
    </div>
  );
}

const COMPETITION_LABELS = Object.fromEntries(
  ADMIN_COMPETITION_OPTIONS.map((option) => [option.value, option.label])
);

function buildServerFormSnapshot(match, homeScore, awayScore) {
  const h = parseInt(homeScore, 10) || 0;
  const a = parseInt(awayScore, 10) || 0;
  const raw = matchEventsToGoalscorerForm(match?.events || []);
  return {
    goals: resizeGoalsToScores(raw.goals, h, a),
    cards: raw.cards,
    cleanSheets: raw.cleanSheets,
  };
}

function stableAdminFormString(form) {
  if (!form || !form.goals) return '';
  return JSON.stringify({
    goals: form.goals,
    cards: form.cards,
    cleanSheets: form.cleanSheets,
  });
}

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
  /** Client-side filters only (all matches for the competition are loaded; API is not filtered by round). */
  const [leagueMwFilter, setLeagueMwFilter] = useState('1');
  const [cupStageFilter, setCupStageFilter] = useState('');
  const [acwplMwFilter, setAcwplMwFilter] = useState('1');
  const [girlsSuperCupMwFilter, setGirlsSuperCupMwFilter] = useState('1');
  const [loading, setLoading] = useState(false);
  const [showSeasonResetWorkflow, setShowSeasonResetWorkflow] = useState(false);
  const [cupTeams, setCupTeams] = useState([]);
  const [leagueWinnerId, setLeagueWinnerId] = useState('');
  const [cupWinnerId, setCupWinnerId] = useState('');
  const [showRunnerUpSelection, setShowRunnerUpSelection] = useState(false);
  const [runnerUpId, setRunnerUpId] = useState('');
  const [showCupSelection, setShowCupSelection] = useState(false);
  const [showSuperCupSelection, setShowSuperCupSelection] = useState(false);
  const [editedMatches, setEditedMatches] = useState({}); // Store local edits
  const [savingMatches, setSavingMatches] = useState(new Set()); // Track which matches are being saved
  const [fixtureStatus, setFixtureStatus] = useState({}); // Track fixture publication status
  const [goalscorerData, setGoalscorerData] = useState({}); // Track goalscorer + cards/clean sheets per match
  const [liveUpdatesByMatch, setLiveUpdatesByMatch] = useState({}); // matchId -> enable live workflow before start
  

  // Fetch and set match events for editing (auto-populate goalscorer/assist fields)
  const fetchMatchEvents = async (matchId) => {
    try {
      const response = await api.get(`/matches/${matchId}`);
      const match = response.data;
      const { goals, cards, cleanSheets } = matchEventsToGoalscorerForm(match.events || []);
      setGoalscorerData((prev) => ({ ...prev, [matchId]: { goals, cards, cleanSheets } }));
    } catch (error) {
      console.error('fetchMatchEvents failed:', error.response?.data || error.message);
    }
  };
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
  }, [isAdmin, selectedCompetition]);

  useEffect(() => {
    if (selectedCompetition === 'league') setLeagueMwFilter('1');
    else if (selectedCompetition === 'cup') setCupStageFilter('');
    else if (selectedCompetition === 'acwpl') setAcwplMwFilter('1');
    else if (selectedCompetition === 'girls-super-cup') setGirlsSuperCupMwFilter('1');
  }, [selectedCompetition]);

  useEffect(() => {
    setLiveUpdatesByMatch((prev) => {
      const next = { ...prev };
      for (const m of matches) {
        if (m && userFixturePhase(m) === 'live') next[m._id] = true;
      }
      return next;
    });
  }, [matches]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    const hasLive = matches.some((m) => m && m.matchState === 'live' && !m.isVoided);
    if (!hasLive) return undefined;
    const id = setInterval(() => {
      fetchMatches();
      fetchTeams();
    }, 12000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, matches, selectedCompetition]);

  const matchesForEditList = useMemo(() => {
    const list = matches.filter((match) => {
      if (!match || !match.homeTeam || !match.awayTeam) return false;
      if (selectedCompetition === 'league') {
        if (!leagueMwFilter) return true;
        return String(match.matchweek) === String(leagueMwFilter);
      }
      if (selectedCompetition === 'cup') {
        if (!cupStageFilter) return true;
        return match.stage === cupStageFilter;
      }
      if (selectedCompetition === 'acwpl') {
        if (!acwplMwFilter) return true;
        return String(match.matchweek) === String(acwplMwFilter);
      }
      if (selectedCompetition === 'girls-super-cup') {
        if (!girlsSuperCupMwFilter) return true;
        return String(match.matchweek) === String(girlsSuperCupMwFilter);
      }
      return true;
    });
    if (selectedCompetition !== 'league') return list;
    return [...list].sort((a, b) => {
      const da = new Date(a.date).getTime() || 0;
      const db = new Date(b.date).getTime() || 0;
      if (da !== db) return da - db;
      const ta = String(a.time || '');
      const tb = String(b.time || '');
      if (ta !== tb) return ta.localeCompare(tb);
      return String(a._id).localeCompare(String(b._id));
    });
  }, [matches, selectedCompetition, leagueMwFilter, cupStageFilter, acwplMwFilter, girlsSuperCupMwFilter]);

  useEffect(() => {
    if (selectedCompetition !== 'league') return;
    const weeks = [...new Set(matches.map((m) => m.matchweek).filter((w) => w != null && w !== ''))]
      .map((w) => Number(w))
      .filter((w) => !Number.isNaN(w))
      .sort((a, b) => a - b);
    if (weeks.length === 0) return;
    setLeagueMwFilter((prev) => {
      if (prev === '' || prev == null) return prev;
      if (!weeks.includes(Number(prev))) return weeks.includes(1) ? '1' : String(weeks[0]);
      return prev;
    });
  }, [selectedCompetition, matches]);

  useEffect(() => {
    if (selectedCompetition !== 'acwpl') return;
    const weeks = [...new Set(matches.map((m) => m.matchweek).filter((w) => w != null && w !== ''))]
      .map((w) => Number(w))
      .filter((w) => !Number.isNaN(w))
      .sort((a, b) => a - b);
    if (weeks.length === 0) return;
    setAcwplMwFilter((prev) => {
      if (prev === '' || prev == null) return prev;
      if (!weeks.includes(Number(prev))) return weeks.includes(1) ? '1' : String(weeks[0]);
      return prev;
    });
  }, [selectedCompetition, matches]);

  useEffect(() => {
    if (selectedCompetition !== 'girls-super-cup') return;
    const weeks = [...new Set(matches.map((m) => m.matchweek).filter((w) => w != null && w !== ''))]
      .map((w) => Number(w))
      .filter((w) => !Number.isNaN(w))
      .sort((a, b) => a - b);
    if (weeks.length === 0) return;
    setGirlsSuperCupMwFilter((prev) => {
      if (prev === '' || prev == null) return prev;
      if (!weeks.includes(Number(prev))) return weeks.includes(1) ? '1' : String(weeks[0]);
      return prev;
    });
  }, [selectedCompetition, matches]);

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

  
  

  const generateGirlsSuperCupFixtures = async () => {
    setLoading(true);
    try {
      await api.post('/matches/generate-girls-super-cup');
      await fetchMatches();
      alert('Girls Super Cup fixtures generated successfully!');
    } catch (error) {
      alert('Error generating Girls Super Cup fixtures: ' + (error.response?.data?.message || error.message));
    }
    setLoading(false);
  };

  const boysLeagueTeamCount = useMemo(
    () => teams.filter((t) => t.category === 'boys' || !t.category).length,
    [teams]
  );
  const leagueTeamsReady = boysLeagueTeamCount >= 6;

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
      const { data } = await api.post('/teams/initialize');
      await fetchTeams();
      alert(data?.message || 'Teams initialized successfully!');
    } catch (error) {
      alert('Error initializing teams: ' + parseApiErrorMessage(error, 'Could not initialize teams.'));
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
      alert('Error generating league fixtures: ' + parseApiErrorMessage(error, 'Could not generate league fixtures.'));
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

  const handleSeasonResetComplete = async ({ fplSeasonReset = false } = {}) => {
    if (fplSeasonReset) {
      clearFantasyClientSeasonKeys();
    }
    await fetchTeams();
    await fetchMatches();
    onDataChange();
  };

  const buildMatchEventsFromGoalscorerForm = (matchId) => {
    const events = [];
    const scorerData = goalscorerData[matchId];
    const goals = scorerData?.goals || scorerData || { home: [], away: [] };
    const cards = scorerData?.cards || { home: [], away: [] };
    const cleanSheets = scorerData?.cleanSheets || { home: { enabled: false, playerId: '' }, away: { enabled: false, playerId: '' } };

    if (goals) {
      for (const goal of goals.home) {
        if (goal.scorerId) {
          events.push({
            type: 'GOAL',
            side: 'home',
            player: goal.scorerId,
            ownGoal: goal.isOwnGoal,
            ...(goal.assistId && !goal.isOwnGoal && { assistPlayer: goal.assistId }),
          });
        }
      }
      for (const goal of goals.away) {
        if (goal.scorerId) {
          events.push({
            type: 'GOAL',
            side: 'away',
            player: goal.scorerId,
            ownGoal: goal.isOwnGoal,
            ...(goal.assistId && !goal.isOwnGoal && { assistPlayer: goal.assistId }),
          });
        }
      }
    }

    ['home', 'away'].forEach((side) => {
      (cards[side] || []).forEach((card) => {
        if (card.playerId) {
          events.push({
            type: card.type,
            side,
            player: card.playerId,
          });
        }
      });
    });

    ['home', 'away'].forEach((side) => {
      if (cleanSheets[side]?.enabled && cleanSheets[side].playerId) {
        events.push({
          type: 'CLEAN_SHEET',
          side,
          player: cleanSheets[side].playerId,
        });
      }
    });

    return events;
  };

  const saveMatch = async (matchId) => {
    const matchRow = matches.find((m) => m._id === matchId);
    if (matchRow && userFixturePhase(matchRow) === 'live') {
      alert('This fixture is live. Use Save live / Full time, or Abandon live.');
      return;
    }
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
      const events = buildMatchEventsFromGoalscorerForm(matchId);

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

      // Reload saved events into admin form so selections are not wiped after save
      await fetchMatchEvents(matchId);

      // Trigger UserView refresh without page reload
      onDataChange();

      setEditedMatches((prev) => {
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
    const match = matches.find((m) => m._id === matchId);
    const hasEdits = editedMatches[matchId] && Object.keys(editedMatches[matchId]).length > 0;
    if (!match) return hasEdits;
    const data = goalscorerData[matchId];
    const hs = getMatchValue(match, 'homeScore');
    const as = getMatchValue(match, 'awayScore');
    const serverSnap = buildServerFormSnapshot(match, hs, as);
    const serverStr = stableAdminFormString(serverSnap);
    if (!data) {
      // No local form payload yet — unsaved only if score line edits or server expects nothing but UI would differ
      return hasEdits;
    }
    const differsFromServer = stableAdminFormString(data) !== serverStr;
    return hasEdits || differsFromServer;
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
      ((selectedCompetition === 'cup' || selectedCompetition === 'super-cup' || selectedCompetition === 'girls-super-cup') &&
        isMatchDrawn(match)) ||
      penaltiesEntered || penaltiesEntered2
    );
  };

  // --- Matchweek Deadline Manager UI ---
  // deadline UI moved to FantasyManagement

  const isLockedVoidedAcwplMatch = (match) => (
    (selectedCompetition === 'acwpl' || selectedCompetition === 'girls-super-cup') && Boolean(match?.isVoided)
  );

  const startMatchLive = async (matchId) => {
    setSavingMatches((prev) => new Set([...prev, matchId]));
    try {
      await api.post(`/matches/${matchId}/start-live`);
      setLiveUpdatesByMatch((prev) => ({ ...prev, [matchId]: true }));
      await Promise.all([fetchMatches(), fetchTeams()]);
      await fetchMatchEvents(matchId);
      onDataChange();
    } catch (error) {
      alert(error.response?.data?.message || error.message);
    } finally {
      setSavingMatches((prev) => {
        const next = new Set(prev);
        next.delete(matchId);
        return next;
      });
    }
  };

  const abandonLive = async (matchId) => {
    if (!window.confirm('Abandon this live run? Scores and events for this fixture will be cleared and the match returned to scheduled.')) {
      return;
    }
    setSavingMatches((prev) => new Set([...prev, matchId]));
    try {
      await api.post(`/matches/${matchId}/abandon-live`);
      setLiveUpdatesByMatch((prev) => ({ ...prev, [matchId]: false }));
      setEditedMatches((prev) => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
      await Promise.all([fetchMatches(), fetchTeams()]);
      await fetchMatchEvents(matchId);
      onDataChange();
    } catch (error) {
      alert(error.response?.data?.message || error.message);
    } finally {
      setSavingMatches((prev) => {
        const next = new Set(prev);
        next.delete(matchId);
        return next;
      });
    }
  };

  const saveLiveScores = async (matchId) => {
    const matchRow = matches.find((m) => m._id === matchId);
    if (!matchRow || userFixturePhase(matchRow) !== 'live') return;

    const scorerDataForValidation = goalscorerData[matchId];
    const goalData = scorerDataForValidation?.goals || scorerDataForValidation || { home: [], away: [] };
    const hs = getMatchValue(matchRow, 'homeScore');
    const as = getMatchValue(matchRow, 'awayScore');
    const totalGoalsFromScores = (parseInt(hs, 10) || 0) + (parseInt(as, 10) || 0);
    const totalGoalsFromSelectors = goalData ? goalData.home.length + goalData.away.length : 0;
    const totalGoals = Math.max(totalGoalsFromScores, totalGoalsFromSelectors);

    if (totalGoals > 0) {
      if (!scorerDataForValidation) {
        alert('Please select goalscorers for all goals before saving live (or set the score to 0–0).');
        return;
      }
      const homeGoalsFilled = goalData.home.every((g) => g.scorerId !== '');
      const awayGoalsFilled = goalData.away.every((g) => g.scorerId !== '');
      if (!homeGoalsFilled || !awayGoalsFilled) {
        alert('Please select a goalscorer for each goal before saving live.');
        return;
      }
    }

    if (hs === '' || hs === null || as === '' || as === null || Number.isNaN(Number(hs)) || Number.isNaN(Number(as))) {
      alert('Enter both scores for the live update.');
      return;
    }
    const payload = { homeScore: Number(hs), awayScore: Number(as) };
    if (shouldShowPenalties(matchRow)) {
      const hp = getMatchValue(matchRow, 'homePenalties');
      const ap = getMatchValue(matchRow, 'awayPenalties');
      if (hp !== '' && hp !== null && ap !== '' && ap !== null && !Number.isNaN(Number(hp)) && !Number.isNaN(Number(ap))) {
        payload.homePenalties = Number(hp);
        payload.awayPenalties = Number(ap);
      }
    }
    const liveEvents = buildMatchEventsFromGoalscorerForm(matchId);
    setSavingMatches((prev) => new Set([...prev, matchId]));
    try {
      await api.put(`/matches/${matchId}`, payload);
      await api.post(`/matches/${matchId}/events`, { events: liveEvents });
      await Promise.all([fetchMatches(), fetchTeams()]);
      await fetchMatchEvents(matchId);
      onDataChange();
      setEditedMatches((prev) => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
    } catch (error) {
      alert(error.response?.data?.message || error.message);
    } finally {
      setSavingMatches((prev) => {
        const next = new Set(prev);
        next.delete(matchId);
        return next;
      });
    }
  };

  const fullTimeMatch = async (matchId) => {
    const matchRow = matches.find((m) => m._id === matchId);
    if (!matchRow || userFixturePhase(matchRow) !== 'live') return;

    const scorerDataForValidation = goalscorerData[matchId];
    const goalData = scorerDataForValidation?.goals || scorerDataForValidation || { home: [], away: [] };
    const hs = getMatchValue(matchRow, 'homeScore');
    const as = getMatchValue(matchRow, 'awayScore');
    const totalGoalsFromScores = (parseInt(hs, 10) || 0) + (parseInt(as, 10) || 0);
    const totalGoalsFromSelectors = goalData ? goalData.home.length + goalData.away.length : 0;
    const totalGoals = Math.max(totalGoalsFromScores, totalGoalsFromSelectors);

    if (totalGoals > 0) {
      if (!scorerDataForValidation) {
        alert('Please select goalscorers for all goals before full time');
        return;
      }
      const homeGoalsFilled = goalData.home.every((g) => g.scorerId !== '');
      const awayGoalsFilled = goalData.away.every((g) => g.scorerId !== '');
      if (!homeGoalsFilled || !awayGoalsFilled) {
        alert('Please select a goalscorer for each goal before full time');
        return;
      }
    }

    if (hs === '' || hs === null || as === '' || as === null || Number.isNaN(Number(hs)) || Number.isNaN(Number(as))) {
      alert('Enter both final scores before full time.');
      return;
    }

    const payload = {
      homeScore: Number(hs),
      awayScore: Number(as),
    };

    if (shouldShowPenalties(matchRow)) {
      const hp = getMatchValue(matchRow, 'homePenalties');
      const ap = getMatchValue(matchRow, 'awayPenalties');
      if (hp === '' || hp === null || ap === '' || ap === null || Number.isNaN(Number(hp)) || Number.isNaN(Number(ap))) {
        alert('Enter penalty shootout scores before full time.');
        return;
      }
      payload.homePenalties = Number(hp);
      payload.awayPenalties = Number(ap);
    }

    const events = buildMatchEventsFromGoalscorerForm(matchId);
    setSavingMatches((prev) => new Set([...prev, matchId]));
    try {
      await api.post(`/matches/${matchId}/full-time`, payload);
      await api.post(`/matches/${matchId}/events`, { events });
      await Promise.all([fetchMatches(), fetchTeams()]);
      await fetchMatchEvents(matchId);
      onDataChange();
      setEditedMatches((prev) => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
      setLiveUpdatesByMatch((prev) => ({ ...prev, [matchId]: false }));
    } catch (error) {
      alert(error.response?.data?.message || error.message);
    } finally {
      setSavingMatches((prev) => {
        const next = new Set(prev);
        next.delete(matchId);
        return next;
      });
    }
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
      if (competition === 'league') {
        await fetchTeams();
        clearFantasyClientSeasonKeys();
      }
      if (onDataChange) onDataChange(); // Trigger refresh in UserView
      alert(`${competition} fixtures have been reset successfully!`);
    } catch (error) {
      alert('Error resetting fixtures: ' + error.message);
    }
    setLoading(false);
  };

  const recalculateLeagueTable = async () => {
    setLoading(true);
    try {
      await api.post('/matches/recalculate-league-table');
      await fetchTeams();
      if (onDataChange) onDataChange();
      alert('League table recalculated from finished fixtures.');
    } catch (error) {
      alert('Error recalculating league table: ' + (error.response?.data?.message || error.message));
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
            match.matchState === 'live' ? 'Live' : match.isPlayed ? 'Played' : 'Scheduled',
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

  const formatDate = (dateString) => {
    return new Date(dateString).toISOString().split('T')[0];
  };

  if (!isAdmin) return null;

  return (
    <>
    <div className="admin-panel-root admin-fixture-mgmt">
      <header className="admin-page-header">
        <div className="admin-page-header__main">
          <div className="admin-page-header__icon" aria-hidden="true">
            <ListChecks size={20} />
          </div>
          <div className="admin-page-header__text">
            <p className="admin-page-header__eyebrow">Admin · Fixtures</p>
            <h1 className="admin-page-header__title">Fixture Management</h1>
            <p className="admin-page-header__subtitle">
              Generate fixtures, publish to users, and edit match results across all competitions.
            </p>
          </div>
        </div>
        <div className="admin-page-header__actions">
          <button
            type="button"
            className="btn btn-ghost btn-compact"
            onClick={handleRefreshFixtures}
            disabled={loading}
            title="Refresh fixtures data without page reload"
          >
            <RefreshCcw size={15} aria-hidden="true" />
            Refresh Fixtures
          </button>
        </div>
      </header>

      <section className="admin-fixture-ops" aria-label="Generate and publish fixtures">
      <details className="admin-guide-details">
        <summary>
          <ClipboardList size={16} aria-hidden="true" />
          Getting Started
        </summary>
        <ol className="admin-guide-steps">
          {ADMIN_GETTING_STARTED_STEPS.map((step, index) => (
            <li key={step} className="admin-guide-step">
              <span className="admin-guide-step-num" aria-hidden="true">{index + 1}</span>
              <span className="admin-guide-step-text">{step}</span>
            </li>
          ))}
        </ol>
      </details>
      {/* Admin Controls */}
      <div className="card admin-controls-card">
        <h2 className="admin-fixture-section-title">
          <Settings size={18} className="admin-fixture-section-icon" aria-hidden="true" />
          Generate Fixtures
        </h2>
        <div className="admin-controls-stack">
          <button 
            type="button"
            className="btn btn-primary admin-controls-btn" 
            onClick={initializeTeams}
            disabled={loading || leagueTeamsReady}
            title={leagueTeamsReady ? 'Six boys league teams are already set up' : undefined}
          >
            {leagueTeamsReady ? 'Teams Ready' : 'Initialize Teams'}
          </button>
          <button 
            type="button"
            className="btn btn-success admin-controls-btn" 
            onClick={generateLeagueFixtures}
            disabled={loading || !leagueTeamsReady}
            title={!leagueTeamsReady ? 'Initialize six boys league teams first' : undefined}
          >
            Set League Fixtures
          </button>
          <button 
            type="button"
            className="btn btn-warning admin-controls-btn" 
            onClick={() => setShowCupSelection(true)}
            disabled={loading}
          >
            Set Cup Fixtures
          </button>
          <button 
            type="button"
            className="btn btn-info admin-controls-btn" 
            onClick={() => setShowSuperCupSelection(true)}
            disabled={loading}
          >
            Set Super Cup Fixtures
          </button>
          <button 
            type="button"
            className="btn btn-acwpl admin-controls-btn admin-controls-btn--dark" 
            onClick={generateACWPLFixtures}
            disabled={loading}
          >
            Set ACWPL Fixtures
          </button>
          <button
            type="button"
            className="btn btn-acwpl admin-controls-btn admin-controls-btn--maroon"
            onClick={generateGirlsSuperCupFixtures}
            disabled={loading}
          >
            Set Girls Super Cup Fixtures
          </button>
          <button 
            type="button"
            className="btn btn-danger admin-controls-btn admin-controls-btn--wide" 
            onClick={() => setShowSeasonResetWorkflow(true)}
            disabled={loading}
          >
            Reset Season
          </button>
        </div>
      </div>

      <div className="admin-publish-block">
        <h2 className="admin-section__title">
          <Target size={18} aria-hidden="true" />
          Publish & Reset
        </h2>
        <p className="admin-publish-lead">Save fixtures to make them visible to users, or reset to regenerate them.</p>

        <div className="admin-fixture-mgmt-grid">
          {/* League Fixtures */}
          <div className="fixture-management-card">
            <h3><Trophy size={18} aria-hidden="true" />League Fixtures</h3>
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
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={recalculateLeagueTable}
                disabled={loading}
                title="Rebuild P/W/D/L/pts/form from finished league matches"
              >
                Recalculate table
              </button>
            </div>
          </div>

          {/* Cup Fixtures */}
          <div className="fixture-management-card">
            <h3><Award size={18} aria-hidden="true" />Cup Fixtures</h3>
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
            <h3><Award size={18} aria-hidden="true" />Super Cup Fixtures</h3>
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
            <h3><Trophy size={18} aria-hidden="true" />ACWPL Fixtures</h3>
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

          <div className="fixture-management-card">
            <h3><Trophy size={18} aria-hidden="true" />Girls Super Cup</h3>
            <div className="status-info">
              <p>Status: <span className={`status-badge ${getFixtureStatusForCompetition('girls-super-cup').isPublished ? 'published' : 'draft'}`}>
                {getFixtureStatusForCompetition('girls-super-cup').isPublished ? 'Published' : getFixtureStatusForCompetition('girls-super-cup').hasFixtures ? 'Draft' : 'Not Generated'}
              </span></p>
              <p>Matches: {getFixtureStatusForCompetition('girls-super-cup').totalMatches}/3</p>
            </div>
            <div className="fixture-actions">
              {getFixtureStatusForCompetition('girls-super-cup').hasFixtures && !getFixtureStatusForCompetition('girls-super-cup').isPublished && (
                <button
                  className="btn btn-success btn-small"
                  onClick={() => saveFixtures('girls-super-cup')}
                  disabled={loading}
                >
                  Save Girls Super Cup Fixtures
                </button>
              )}
              {getFixtureStatusForCompetition('girls-super-cup').hasFixtures && (
                <button
                  className="btn btn-danger btn-small"
                  onClick={() => resetFixtures('girls-super-cup')}
                  disabled={loading}
                >
                  Reset Girls Super Cup
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      </section>
        {/* Matchweek Deadline Manager */}
        

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
                <label htmlFor="league-winner"><Trophy size={16} style={{ marginRight: 4, verticalAlign: 'middle' }} aria-hidden="true" />League Winner:</label>
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
              <div className="admin-modal-inline-panel">
                <h4><Trophy size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />Double Winner Detected</h4>
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
            ) : (
              leagueWinnerId && cupWinnerId && (
                <div className="super-cup-preview">
                  <h4>Super Cup Final Preview:</h4>
                  <div className="super-cup-preview__matchup">
                    <span className="super-cup-preview__team">
                      {teams.find(t => t._id === leagueWinnerId)?.name} (League Winner)
                    </span>
                    <span className="super-cup-preview__vs" aria-hidden="true">VS</span>
                    <span className="super-cup-preview__team">
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
      <div className={`card admin-edit-matches${selectedCompetition === 'league' ? ' admin-league-numbered' : ''}${['cup', 'super-cup', 'girls-super-cup'].includes(selectedCompetition) ? ' admin-edit-matches--knockout' : ''}`}>
        <h2><Edit3 size={20} aria-hidden="true" />Edit Matches</h2>
        <p className="admin-edit-context">
          Editing <strong>{COMPETITION_LABELS[selectedCompetition] || selectedCompetition}</strong>
          {' · '}
          {matchesForEditList.length} fixture{matchesForEditList.length === 1 ? '' : 's'}
          {getFixtureStatusForCompetition(selectedCompetition).isPublished ? ' · Published' : getFixtureStatusForCompetition(selectedCompetition).hasFixtures ? ' · Draft' : ''}
        </p>
        
          <div className="admin-backup-banner">
            <h3 className="admin-backup-title">
              <Save size={18} className="admin-backup-title-icon" style={{ verticalAlign: 'middle' }} />
              Backup & Export
            </h3>
            <p className="admin-backup-desc">
              Download all fixtures as a backup. JSON format can be re-imported, CSV can be opened in Excel.
            </p>
            <div className="admin-backup-actions">
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
        
        <div className="filter-section admin-filter-section">
          <AdminStaticFilter
            options={ADMIN_COMPETITION_OPTIONS}
            value={selectedCompetition}
            onChange={setSelectedCompetition}
            sheetTitle="Competition"
            className="admin-competition-filter"
          />
          
          {selectedCompetition === 'league' && (
            <FixtureFilterControl mode="league" matches={matches} value={leagueMwFilter} onChange={setLeagueMwFilter} />
          )}
          {selectedCompetition === 'cup' && (
            <FixtureFilterControl mode="cup" matches={matches} value={cupStageFilter} onChange={setCupStageFilter} />
          )}
          {selectedCompetition === 'acwpl' && (
            <FixtureFilterControl mode="acwpl" matches={matches} value={acwplMwFilter} onChange={setAcwplMwFilter} />
          )}
          {selectedCompetition === 'girls-super-cup' && (
            <FixtureFilterControl
              mode="girls-super-cup"
              matches={matches}
              value={girlsSuperCupMwFilter}
              onChange={setGirlsSuperCupMwFilter}
            />
          )}
        </div>

        <div className="admin-edit-matches-scroll">
        <div className="admin-edit-matches-scroll-inner">
        <div className="match-header admin-match-header">
          {selectedCompetition === 'league' && <div>#</div>}
          <div>Date</div>
          <div>Time</div>
          <div>Home Team</div>
          <div>Home Score</div>
          <div>Away Score</div>
          <div>Away Team</div>
          <div>{selectedCompetition === 'girls-super-cup' ? 'Round' : 'MW'}</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {matchesForEditList.map((match, leagueFixtureIdx) => (
          <div className="admin-fixture-wrap" key={match._id}>
            <div className={`match-row admin-match-row ${hasUnsavedChanges(match._id) ? 'match-row-edited' : ''}${shouldShowPenalties(match) ? ' admin-match-row--has-penalties' : ''}`}>
            {selectedCompetition === 'league' && (
              <div data-label="Fixture #">
                <span className="admin-league-fixture-num">{leagueFixtureIdx + 1}</span>
              </div>
            )}
            <div data-label="Date">
              <input
                type="date"
                value={getMatchValue(match, 'date') ? new Date(getMatchValue(match, 'date')).toISOString().split('T')[0] : formatDate(match.date)}
                onChange={(e) => handleMatchEdit(match._id, 'date', e.target.value)}
                className="input admin-match-input-date"
                disabled={isLockedVoidedAcwplMatch(match) || userFixturePhase(match) === 'live'}
              />
            </div>
            <div data-label="Time">
              <input
                type="time"
                value={getMatchValue(match, 'time')}
                onChange={(e) => handleMatchEdit(match._id, 'time', e.target.value)}
                className="input admin-match-input-time"
                disabled={isLockedVoidedAcwplMatch(match) || userFixturePhase(match) === 'live'}
              />
            </div>
            <div data-label="Home"><strong>{match.homeTeam.name}</strong></div>
            <div data-label="Home score" className="admin-score-cell">
              <input
                type="number"
                min="0"
                max="20"
                value={getMatchValue(match, 'homeScore') === null ? '' : getMatchValue(match, 'homeScore')}
                onChange={(e) => handleMatchEdit(match._id, 'homeScore', e.target.value)}
                className="input"
                placeholder="Enter score"
                disabled={isLockedVoidedAcwplMatch(match)}
              />
              {shouldShowPenalties(match) &&
                renderPenaltyShootoutInput(
                  match,
                  'home',
                  getMatchValue,
                  handleMatchEdit,
                  isLockedVoidedAcwplMatch(match)
                )}
            </div>
            <div data-label="Away score" className="admin-score-cell">
              <input
                type="number"
                min="0"
                max="20"
                value={getMatchValue(match, 'awayScore') === null ? '' : getMatchValue(match, 'awayScore')}
                onChange={(e) => handleMatchEdit(match._id, 'awayScore', e.target.value)}
                className="input"
                placeholder="Enter score"
                disabled={isLockedVoidedAcwplMatch(match)}
              />
              {shouldShowPenalties(match) &&
                renderPenaltyShootoutInput(
                  match,
                  'away',
                  getMatchValue,
                  handleMatchEdit,
                  isLockedVoidedAcwplMatch(match)
                )}
            </div>
            <div data-label="Away"><strong>{match.awayTeam.name}</strong></div>
            <div data-label={selectedCompetition === 'girls-super-cup' ? 'Round' : 'MW'}>{match.matchweek}</div>
            <div data-label="Status">
              <span className={`badge ${desktopFixtureBadgeClass(match)}`}>
                {desktopFixtureBadgeLabel(match)}
              </span>
              {isLockedVoidedAcwplMatch(match) && match.voidReason && (
                <div style={{ marginTop: '4px', fontSize: '11px', color: '#666' }}>{match.voidReason}</div>
              )}

            </div>
            <div data-label="Actions" className="admin-match-actions">
              {!isLockedVoidedAcwplMatch(match) && userFixturePhase(match) === 'scheduled' && !match.isVoided && (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', marginRight: 6, whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={!!liveUpdatesByMatch[match._id]}
                    onChange={(e) => setLiveUpdatesByMatch((p) => ({ ...p, [match._id]: e.target.checked }))}
                  />
                  Live updates
                </label>
              )}
              {!isLockedVoidedAcwplMatch(match) && userFixturePhase(match) === 'live' && (
                <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 700, marginRight: 6 }}>LIVE</span>
              )}
              {!isLockedVoidedAcwplMatch(match) && userFixturePhase(match) === 'scheduled' && liveUpdatesByMatch[match._id] && (
                <button
                  type="button"
                  onClick={() => startMatchLive(match._id)}
                  disabled={savingMatches.has(match._id)}
                  className="btn btn-primary btn-small"
                  style={{ marginRight: 4 }}
                >
                  Start match
                </button>
              )}
              {!isLockedVoidedAcwplMatch(match) && userFixturePhase(match) === 'live' && (
                <>
                  {hasUnsavedChanges(match._id) && (
                    <button
                      type="button"
                      onClick={() => saveLiveScores(match._id)}
                      disabled={savingMatches.has(match._id)}
                      className="btn btn-success btn-small"
                      style={{ marginRight: 4 }}
                    >
                      Save live
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => fullTimeMatch(match._id)}
                    disabled={savingMatches.has(match._id)}
                    className="btn btn-success btn-small"
                    style={{ marginRight: 4 }}
                  >
                    Full time
                  </button>
                  <button
                    type="button"
                    onClick={() => abandonLive(match._id)}
                    disabled={savingMatches.has(match._id)}
                    className="btn btn-secondary btn-small"
                    style={{ marginRight: 4 }}
                  >
                    Abandon live
                  </button>
                </>
              )}
              {hasUnsavedChanges(match._id) && !isLockedVoidedAcwplMatch(match) && userFixturePhase(match) !== 'live' && (
                <button
                  onClick={() => saveMatch(match._id)}
                  disabled={savingMatches.has(match._id)}
                  className="btn btn-success btn-small"
                  style={{ marginRight: '5px' }}
                >
                  {savingMatches.has(match._id) ? 'Saving...' : 'Save'}
                </button>
              )}
              {hasUnsavedChanges(match._id) && !isLockedVoidedAcwplMatch(match) && userFixturePhase(match) !== 'live' && (
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
              {userFixturePhase(match) !== 'live' && (
              <button
                onClick={async () => {
                  if(window.confirm('Reset this match score?')) {
                    try {
                      await api.post(`/matches/${match._id}/reset-score`);
                      await fetchMatches();
                      if (match.competition === 'league') await fetchTeams();
                      if (onDataChange) onDataChange();
                      alert('Match score reset!');
                    } catch (err) {
                      alert('Failed to reset match score.');
                    }
                  }
                }}
                className="btn btn-danger btn-small"
                style={{ marginLeft: '5px' }}
                title="Reset this match's score to blank"
                disabled={isLockedVoidedAcwplMatch(match)}
              >
                Reset
              </button>
              )}
              {/* Team Selection feature temporarily disabled - will be implemented in fantasy section */}
            </div>
          </div>

          {/* Goalscorer Selection - appears below the match row when scores are set */}
          {/* Auto-populate goalscorer/assist fields when editing a match */}
          {!isLockedVoidedAcwplMatch(match) && (
            <GoalScorerSelector
              match={match}
              homeScore={getMatchValue(match, 'homeScore')}
              awayScore={getMatchValue(match, 'awayScore')}
              onGoalscorerData={(data) => setGoalscorerData((prev) => ({ ...prev, [match._id]: data }))}
            />
          )}
          </div>
        ))}

        </div>
        </div>

        {matches.length === 0 && (
          <div className="admin-edit-empty">
            No matches found. Generate fixtures first.
          </div>
        )}
        {matches.length > 0 && matchesForEditList.length === 0 && (
          <div className="admin-edit-empty">
            No fixtures in this filter. Choose a different round or &quot;All&quot;.
          </div>
        )}
      </div>
      <div className="card admin-league-table-card">
        <h2><BarChart3 size={20} aria-hidden="true" />Current League Table</h2>
        <div className="admin-table-scroll">
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
            {sortLeagueTeams(teams).map((team, index) => (
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

      <SeasonResetWorkflow
        open={showSeasonResetWorkflow}
        onClose={() => setShowSeasonResetWorkflow(false)}
        onComplete={handleSeasonResetComplete}
        busy={loading}
        setBusy={setLoading}
      />
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
