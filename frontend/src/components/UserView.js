import React, { useState, useEffect } from 'react';
import { Trophy, Star, BarChart3, Calendar, ChevronsDown, Goal, Footprints, Square, ChevronDown } from 'lucide-react';
import api from '../utils/api';
import SeasonSelector from './SeasonSelector';
import ArchivedSeasonView from './ArchivedSeasonView';

// Helper function to get team logo CSS class
const getTeamLogoClass = (teamName) => {
  const baseClass = 'team-logo';
  const teamClass = `${teamName.toLowerCase()}-logo`;
  return `${baseClass} ${teamClass}`;
};

const renderForm = (form) => {
  console.log('Rendering form:', form); // Debug log
  if (!form || form.length === 0) return <span className="no-form">-</span>;
  
  return (
    <div className="form-display">
      {form.map((result, index) => (
        <span
          key={index}
          className={`form-result ${result.toLowerCase()}`}
          title={result === 'W' ? 'Win' : result === 'D' ? 'Draw' : 'Loss'}
        >
          {result}
        </span>
      ))}
    </div>
  );
};

const getTeamColors = (teamName) => {
  const teamColors = {
    'Dragons': { primary: '#007bff', secondary: '#ffffff' }, // Blue and white
    'Vikings': { primary: '#dc3545', secondary: '#ffffff' }, // Red and white
    'Warriors': { primary: '#ffc107', secondary: '#000000' }, // Yellow and black
    'Falcons': { primary: '#ffffff', secondary: '#000000' }, // White and black
    'Elites': { primary: '#000000', secondary: '#ffffff' }, // Black and white
    'Lions': { primary: '#28a745', secondary: '#ffffff' }   // Green and white
  };
  
  return teamColors[teamName] || { primary: '#6c757d', secondary: '#ffffff' };
};

// Helper function to format goalscorers with assists
const formatGoalscorers = (match, side) => {
  if (!match.events || match.events.length === 0) return null;
  
  const goals = match.events.filter(e => 
    e.type === 'GOAL' && 
    e.side === side && 
    e.player
  );
  
  if (goals.length === 0) return null;
  
  return (
    <div style={{ fontSize: '0.85em', color: '#666', marginTop: '4px' }}>
      {goals.map((goal, idx) => (
        <div key={idx} style={{ marginBottom: '2px' }}>
          {goal.ownGoal ? (
            <span style={{ color: '#dc3545', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Goal size={14} />
              <span>{goal.player.name} (OG)</span>
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Goal size={14} />
              <span>{goal.player.name}</span>
              {goal.assistPlayer && (
                <sub style={{ marginLeft: '4px', fontSize: '0.9em', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Footprints size={12} />
                  <span>{goal.assistPlayer.name}</span>
                </sub>
              )}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

// Helper function to format cards (yellow/red)
const formatCards = (match, side, type) => {
  if (!match.events || match.events.length === 0) return null;
  const evs = match.events.filter(e => e.type === type && e.side === side && e.player);
  if (evs.length === 0) return null;
  const color = type === 'YELLOW_CARD' ? '#f1c40f' : '#e74c3c';
  const label = type === 'YELLOW_CARD' ? 'Yellow Cards' : 'Red Cards';
  return (
    <div style={{ fontSize: '0.85em', color: '#666', marginTop: '6px' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {evs.map((ev, idx) => (
        <div key={`${type}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '6', marginBottom: 2 }}>
          <Square size={12} color={color} />
          <span>
            {ev.player.name}
            {typeof ev.minute === 'number' && !Number.isNaN(ev.minute) ? ` (${ev.minute}')` : ''}
          </span>
        </div>
      ))}
    </div>
  );
};

const UserView = ({ competitions, selectedCompetition, refreshKey, isAdmin }) => {

  // Mobile competition tabs (mirrors StatsPage)
  const COMP_TABS = [
    { id: 'league', label: 'League' },
    { id: 'cup', label: 'Agha Cup' },
    { id: 'super-cup', label: 'Super Cup' },
    { id: 'acwpl', label: 'ACWPL' }
  ];

  // React state/hooks FIRST
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedMatchweek, setSelectedMatchweek] = useState('');
  const [winners, setWinners] = useState({});
  const [selectedSeason, setSelectedSeason] = useState(null); // null = current season
  const [loading, setLoading] = useState(true);
  const [expandedMatches, setExpandedMatches] = useState(new Set()); // Track expanded matches for goalscorer details

  // ACWPL description and helpers AFTER hooks
  // Note: ACWPL description JSX removed (unused)
  // ACWPL standings calculation (Orion & Firestorm only)
  // ACWPL team colors
  const acwplTeamColors = {
    'Orion': { primary: '#000', secondary: '#b0b3b8' }, // Black, ash/grey
    'Firestorm': { primary: '#2563eb', secondary: '#ec4899' } // Blue, pink
  };
  // ACWPL teams and strict filter
  const acwplTeams = teams.filter(team => team && team.competition === 'acwpl');
  // If teams are not tagged, fallback to name check
  const acwplTeamsStrict = acwplTeams.length === 2 ? acwplTeams : teams.filter(team => team && ['Orion','Firestorm'].includes(team.name));
  // Calculate stats from matches
  function getAcwplTable() {
    // Start with base stats
    const base = acwplTeamsStrict.filter(team => team).map(team => ({
      ...team,
      played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, form: []
    }));
    // Only use ACWPL matches
    const acwplMatches = matches.filter(m => m && m.homeTeam && m.awayTeam && ['Orion','Firestorm'].includes(m.homeTeam.name) && ['Orion','Firestorm'].includes(m.awayTeam.name));
    for (const match of acwplMatches) {
      if (!match.isPlayed) continue;
      const home = base.find(t => t.name === match.homeTeam.name);
      const away = base.find(t => t.name === match.awayTeam.name);
      if (!home || !away) continue;
      home.played++;
      away.played++;
      home.goalsFor += match.homeScore;
      home.goalsAgainst += match.awayScore;
      away.goalsFor += match.awayScore;
      away.goalsAgainst += match.homeScore;
      home.goalDifference = home.goalsFor - home.goalsAgainst;
      away.goalDifference = away.goalsFor - away.goalsAgainst;
      if (match.homeScore > match.awayScore) {
        home.won++; home.points += 3; home.form.unshift('W');
        away.lost++; away.form.unshift('L');
      } else if (match.homeScore < match.awayScore) {
        away.won++; away.points += 3; away.form.unshift('W');
        home.lost++; home.form.unshift('L');
      } else {
        home.drawn++; away.drawn++;
        home.points += 1; away.points += 1;
        home.form.unshift('D'); away.form.unshift('D');
      }
    }
    // Sort by points, then GD, then GF
    return base.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor);
  }
  // ACWPL winner detection (most points after 5 games)
  const acwplTable = getAcwplTable();
  let acwplWinner = null;
  if (acwplTable.length === 2 && acwplTable[0].played === 5 && acwplTable[1].played === 5) {
    if (acwplTable[0].points > acwplTable[1].points) {
      acwplWinner = acwplTable[0].name;
    } else if (acwplTable[1].points > acwplTable[0].points) {
      acwplWinner = acwplTable[1].name;
    } else {
      // If tied on points, use goal difference, then goals for
      if (acwplTable[0].goalDifference > acwplTable[1].goalDifference) {
        acwplWinner = acwplTable[0].name;
      } else if (acwplTable[1].goalDifference > acwplTable[0].goalDifference) {
        acwplWinner = acwplTable[1].name;
      } else if (acwplTable[0].goalsFor > acwplTable[1].goalsFor) {
        acwplWinner = acwplTable[0].name;
      } else if (acwplTable[1].goalsFor > acwplTable[0].goalsFor) {
        acwplWinner = acwplTable[1].name;
      } else {
        acwplWinner = null; // True tie
      }
    }
  }

  const handleSeasonSelect = (season) => {
    setSelectedSeason(season);
  };

  const handleBackToLive = () => {
    setSelectedSeason(null);
  };

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const response = await api.get('/teams');
      
      // Log and filter out null teams
      const validTeams = response.data.filter(t => {
        if (!t || !t.name) {
          console.warn('⚠️ Invalid team detected:', t);
          return false;
        }
        return true;
      });
      
      console.log(`✅ Fetched ${validTeams.length}/${response.data.length} valid teams`);
      setTeams(validTeams);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching teams:', error);
      setTeams([]);
      setLoading(false);
    }
  };

  const fetchMatches = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCompetition) params.append('competition', selectedCompetition);
      if (selectedMatchweek) params.append('matchweek', selectedMatchweek);
      const response = await api.get(`/matches?${params}`);
      
      // Log and filter out null matches
      const validMatches = response.data.filter(m => {
        if (!m || !m.homeTeam || !m.awayTeam) {
          console.warn('⚠️ Invalid match detected:', m);
          return false;
        }
        return true;
      });
      
      console.log(`✅ Fetched ${validMatches.length}/${response.data.length} valid matches`);
      setMatches(validMatches);
    } catch (error) {
      console.error('Error fetching matches:', error);
      setMatches([]);
    }
  };

  const checkWinners = async () => {
    try {
      const response = await api.post('/competitions/check-winners');
      setWinners(response.data.results || {});
    } catch (error) {
      console.error('Error checking winners:', error);
      setWinners({});
    }
  };

  useEffect(() => {
    fetchTeams();
    fetchMatches();
    checkWinners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]); // Add refreshKey dependency

  useEffect(() => {
    fetchMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompetition, selectedMatchweek, refreshKey]); // Add refreshKey dependency

  // If a season is selected, show the archived view (MUST be after all hooks)
  if (selectedSeason) {
    return <ArchivedSeasonView season={selectedSeason} onBackToLive={handleBackToLive} />;
  }

  const getMatchweeks = () => {
    const matchweeks = [...new Set(matches.map(match => match.matchweek))].sort((a, b) => a - b);
    return matchweeks;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatStage = (stage, competition) => {
    if (!stage || stage === 'regular') return '';
    
    // Special handling for Super Cup
    if (competition === 'super-cup') {
      return 'FINAL';
    }
    
    switch (stage.toLowerCase()) {
      case 'group':
        return competition === 'league' ? 'LEAGUE' : 'GROUP';
      case 'final':
        return 'FINAL';
      case 'semi-final':
      case 'semifinal':
        return 'SEMI-FINAL';
      case 'quarter-final':
      case 'quarterfinal':
        return 'QUARTER-FINAL';
      default:
        return stage.toUpperCase();
    }
  };

  const toggleMatchDetails = (matchId) => {
    setExpandedMatches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(matchId)) {
        newSet.delete(matchId);
      } else {
        newSet.add(matchId);
      }
      return newSet;
    });
  };

  const hasMatchEvents = (match) => {
    return match.events && match.events.some(e => ['GOAL','YELLOW_CARD','RED_CARD'].includes(e.type) && e.player);
  };

  const hasStartingLineup = (match) => {
    return match.startingLineup && (
      (match.startingLineup.homeTeam && Object.values(match.startingLineup.homeTeam).some(arr => arr && arr.length > 0)) ||
      (match.startingLineup.awayTeam && Object.values(match.startingLineup.awayTeam).some(arr => arr && arr.length > 0))
    );
  };

  const renderStartingLineup = (match) => {
    if (!hasStartingLineup(match)) return null;

    const positionConfig = {
      gk: { label: 'Goalkeeper', abbr: 'GK' },
      df: { label: 'Defenders', abbr: 'DF' },
      mf: { label: 'Midfielders', abbr: 'MF' },
      att: { label: 'Attackers', abbr: 'ATT' }
    };

    const renderTeamLineup = (lineup, teamName) => {
      if (!lineup) return null;

      return (
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#333' }}>
            {teamName}
          </h4>
          {Object.entries(positionConfig).map(([pos, config]) => {
            const players = lineup[pos] || [];
            if (players.length === 0) return null;

            return (
              <div key={pos} style={{ marginBottom: '8px' }}>
                <span style={{ 
                  display: 'inline-block',
                  backgroundColor: '#e7f3ff',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '11px',
                  fontWeight: 600,
                  marginRight: '6px',
                  color: '#0066cc'
                }}>
                  {config.abbr}
                </span>
                <span style={{ fontSize: '12px', color: '#555' }}>
                  {players.map((p, idx) => {
                    const name = typeof p === 'object' ? p.name : p;
                    const number = typeof p === 'object' && p.number ? ` (#${p.number})` : '';
                    return (
                      <span key={idx}>
                        {idx > 0 && ', '}
                        {name}{number}
                      </span>
                    );
                  }).join(', ')}
                </span>
              </div>
            );
          })}
        </div>
      );
    };

    return (
      <div style={{
        backgroundColor: '#f0f7ff',
        padding: '12px',
        borderRadius: '4px',
        marginBottom: '8px',
        borderLeft: '3px solid #0066cc'
      }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#0066cc' }}>
          ⚽ Starting Lineup
        </h3>
        {match.startingLineup && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {match.startingLineup.homeTeam && renderTeamLineup(match.startingLineup.homeTeam, match.homeTeam.name)}
            {match.startingLineup.awayTeam && renderTeamLineup(match.startingLineup.awayTeam, match.awayTeam.name)}
          </div>
        )}
      </div>
    );
  };

  return (
  <div>
      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', fontSize: '1.1em', color: '#666' }}>
          ⏳ Loading league data...
        </div>
      )}
      
      {!loading && (!teams || teams.length === 0) && (
        <div style={{ textAlign: 'center', padding: '3rem', fontSize: '1.1em', color: '#dc3545' }}>
          ❌ No teams found. Please check the database connection.
        </div>
      )}

      {!loading && teams && teams.length > 0 && (
      <>
      {/* Only render the empty bar for non-ACWPL competitions */}
      {selectedCompetition !== 'acwpl' && (
        <div style={{height: 48, background: 'rgba(255,255,255,0.95)', borderRadius: 16, margin: '0 0 18px 0'}}></div>
      )}
      {selectedCompetition === 'acwpl' && (
        <div style={{
          background: 'rgba(231,76,60,0.08)',
          borderRadius: '15px',
          padding: '18px 18px 10px 18px',
          margin: '0 0 18px 0',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(231,76,60,0.08)'
        }}>
          <div style={{
            color: '#e74c3c',
            fontWeight: 700,
            fontSize: '1.35rem',
            marginBottom: 6
          }}>
            ACWPL (Girls League)
          </div>
          <div style={{
            color: '#222',
            fontSize: '1.05rem',
            fontWeight: 400
          }}>
            The ACWPL is a 5-game series between Orion and Firestorm. The team with the most points after all 5 games is crowned champion. All matches are played as regular fixtures, and the table below updates live as results are entered.
          </div>
        </div>
  )}
      {/* Mobile competition navigation (fixtures only) */}
      <div className="mobile-only" style={{ marginBottom: 12 }}>
        <div className="comp-tabs">
          {COMP_TABS.map(ct => (
            <button
              key={ct.id}
              className={`comp-tab ${selectedCompetition === ct.id ? 'active' : ''}`}
              onClick={() => {
                if (window.setSelectedCompetition) {
                  window.setSelectedCompetition(ct.id);
                }
              }}
              aria-label={`Show ${ct.label} fixtures`}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      {/* Season Selector */}
      <SeasonSelector 
        onSeasonSelect={handleSeasonSelect} 
        currentSeason={selectedSeason}
        showArchived={true}
        isAdmin={isAdmin}
      />
      
  {/* Winner Banners - Only show for current competition */}
      {selectedCompetition === 'acwpl' && acwplWinner && (
        <div
          className="banner"
          style={{
            backgroundColor: acwplTeamColors[acwplWinner]?.primary || '#000',
            color: acwplTeamColors[acwplWinner]?.secondary || '#fff',
            border: `3px solid ${acwplTeamColors[acwplWinner]?.secondary || '#fff'}`,
            fontWeight: 'bold',
            textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
          }}
        >
          <Trophy size={18} /> ACWPL Champions: {acwplWinner}! Congratulations!
        </div>
      )}
      {selectedCompetition === 'league' && winners.league && (
        <div 
          className="banner" 
          style={{
            backgroundColor: getTeamColors(winners.league).primary,
            color: getTeamColors(winners.league).secondary,
            border: `3px solid ${getTeamColors(winners.league).secondary}`,
            fontWeight: 'bold',
            textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
          }}
        >
          <Trophy size={18} /> League Champions: {winners.league}! Congratulations!
        </div>
      )}

      {selectedCompetition === 'cup' && winners.cup && (
        <div 
          className="banner" 
          style={{
            backgroundColor: getTeamColors(winners.cup).primary,
            color: getTeamColors(winners.cup).secondary,
            border: `3px solid ${getTeamColors(winners.cup).secondary}`,
            fontWeight: 'bold',
            textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
          }}
        >
          <Trophy size={18} /> Cup Winners: {winners.cup}! Amazing performance!
        </div>
      )}

      {selectedCompetition === 'super-cup' && winners.superCup && (
        <div 
          className="banner" 
          style={{
            backgroundColor: getTeamColors(winners.superCup).primary,
            color: getTeamColors(winners.superCup).secondary,
            border: `3px solid ${getTeamColors(winners.superCup).secondary}`,
            fontWeight: 'bold',
            textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
          }}
        >
          <Star size={18} /> Super Cup Champions: {winners.superCup}! Ultimate glory!
        </div>
      )}

      {/* Competition-specific displays */}
  {selectedCompetition === 'league' && (
        <>
          {/* League Table */}
          <div className="card" id="standings">
            <h2><BarChart3 size={18} /> League Table</h2>
            
            {/* Position Legend */}
            <div className="table-legend" style={{ 
              display: 'flex', 
              gap: '1rem', 
              marginBottom: '1rem', 
              fontSize: '0.9rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ 
                  width: '20px', 
                  height: '15px', 
                  backgroundColor: 'rgba(40, 167, 69, 0.2)', 
                  border: '1px solid #28a745',
                  borderRadius: '3px'
                }}></div>
                <span>Agha Cup Qualification (Top 4)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ 
                  width: '20px', 
                  height: '15px', 
                  backgroundColor: 'rgba(220, 53, 69, 0.2)', 
                  border: '1px solid #dc3545',
                  borderRadius: '3px'
                }}></div>
                <span>Miss Agha Cup (Bottom 2)</span>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="desktop-only">
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
                    <th>Form</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.filter(team => team && team.competition === 'league').map((team, index) => {
                    const position = index + 1;
                    let rowClass = '';
                    // Add position-based styling
                    if (position <= 4) {
                      rowClass = 'champions-league-qualification'; // Top 4 - Green (Agha Cup)
                    } else if (position >= 5) {
                      rowClass = 'relegation-zone'; // Bottom 2 (positions 5-6) - Red (Miss Agha Cup)
                    }
                    return (
                      <tr key={team._id} className={rowClass}>
                        <td>{position}</td>
                        <td>
                          <div className="team-info">
                            {team.logo && (
                              <img 
                                src={team.logo} 
                                alt={team.name} 
                                className={getTeamLogoClass(team.name)}
                              />
                            )}
                            <strong>{team.name}</strong>
                          </div>
                        </td>
                        <td>{team.played}</td>
                        <td>{team.won}</td>
                        <td>{team.drawn}</td>
                        <td>{team.lost}</td>
                        <td>{team.goalsFor}</td>
                        <td>{team.goalsAgainst}</td>
                        <td>{team.goalDifference}</td>
                        <td><strong>{team.points}</strong></td>
                        <td>{renderForm(team.form)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="mobile-only">
              <div className="league-cards">
                {teams.filter(team => team && team.competition === 'league').map((team, index) => {
                  const position = index + 1;
                  let cardClass = 'league-card';
                  // Add position-based styling
                  if (position <= 4) {
                    cardClass += ' qualified'; // Top 4 - Green (Agha Cup)
                  } else if (position >= 5) {
                    cardClass += ' not-qualified'; // Bottom 2 (positions 5-6) - Red (Miss Agha Cup)
                  }
                  return (
                    <div key={team._id} className={cardClass}>
                      <div className="league-card-header">
                        <div className="position-badge">{position}</div>
                        <div className="team-info">
                          {team.logo && (
                            <img 
                              src={team.logo} 
                              alt={team.name} 
                              className={getTeamLogoClass(team.name)}
                            />
                          )}
                          <div className="team-details">
                            <h3>{team.name}</h3>
                          </div>
                        </div>
                        <div className="points-display">
                          <div className="points">{team.points}</div>
                          <div className="points-label">PTS</div>
                        </div>
                      </div>
                      <div className="league-card-stats">
                        <div className="stat-group">
                          <div className="stat-item">
                            <span className="stat-label">P</span>
                            <span className="stat-value">{team.played}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">W</span>
                            <span className="stat-value">{team.won}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">D</span>
                            <span className="stat-value">{team.drawn}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">L</span>
                            <span className="stat-value">{team.lost}</span>
                          </div>
                        </div>
                        <div className="stat-group">
                          <div className="stat-item">
                            <span className="stat-label">GF</span>
                            <span className="stat-value">{team.goalsFor}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">GA</span>
                            <span className="stat-value">{team.goalsAgainst}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">GD</span>
                            <span className="stat-value">{team.goalDifference > 0 ? '+' : ''}{team.goalDifference}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">Form</span>
                            <span className="stat-value form-display">{renderForm(team.form)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

  {selectedCompetition === 'cup' && (
        <>
          {/* Cup Tournament Bracket */}
          <div className="card" id="cup">
            <h2><BarChart3 size={18} /> Agha Cup Tournament</h2>
            <div className="cup-bracket">
              <div className="bracket-round">
                <h3>Semi-Finals</h3>
                <div className="bracket-matches">
                  {matches.filter(m => m && m.homeTeam && m.awayTeam && m.stage === 'semi-final').map(match => (
                    <div key={match._id} className="bracket-match">
                      <div className="bracket-team">
                        <div className="team-info">
                          {match.homeTeam.logo && (
                            <img 
                              src={match.homeTeam.logo} 
                              alt={match.homeTeam.name} 
                              className={getTeamLogoClass(match.homeTeam.name)}
                            />
                          )}
                          <span className="team-name">{match.homeTeam.name}</span>
                        </div>
                        {match.isPlayed && <span className="team-score">{match.homeScore}</span>}
                      </div>
                      <div className="bracket-vs">vs</div>
                      <div className="bracket-team">
                        <div className="team-info">
                          {match.awayTeam.logo && (
                            <img 
                              src={match.awayTeam.logo} 
                              alt={match.awayTeam.name} 
                              className={getTeamLogoClass(match.awayTeam.name)}
                            />
                          )}
                          <span className="team-name">{match.awayTeam.name}</span>
                        </div>
                        {match.isPlayed && <span className="team-score">{match.awayScore}</span>}
                      </div>
                      <div className="match-info">
                        <small>{formatDate(match.date)} at {match.time}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bracket-arrow"><ChevronsDown size={18} /></div>
              
              <div className="bracket-round">
                <h3>Final</h3>
                <div className="bracket-matches">
                  {matches.filter(m => m && m.homeTeam && m.awayTeam && m.stage === 'final').length > 0 ? (
                    matches.filter(m => m && m.homeTeam && m.awayTeam && m.stage === 'final').map(match => (
                      <div key={match._id} className="bracket-match final-match">
                        <div className="bracket-team">
                          <div className="team-info">
                            {match.homeTeam.logo && (
                              <img 
                                src={match.homeTeam.logo} 
                                alt={match.homeTeam.name} 
                                className={getTeamLogoClass(match.homeTeam.name)}
                              />
                            )}
                            <span className="team-name">{match.homeTeam.name}</span>
                          </div>
                          {match.isPlayed && <span className="team-score">{match.homeScore}</span>}
                        </div>
                        <div className="bracket-vs">vs</div>
                        <div className="bracket-team">
                          <div className="team-info">
                            {match.awayTeam.logo && (
                              <img 
                                src={match.awayTeam.logo} 
                                alt={match.awayTeam.name} 
                                className={getTeamLogoClass(match.awayTeam.name)}
                              />
                            )}
                            <span className="team-name">{match.awayTeam.name}</span>
                          </div>
                          {match.isPlayed && <span className="team-score">{match.awayScore}</span>}
                        </div>
                        <div className="match-info">
                          <small>{formatDate(match.date)} at {match.time}</small>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="bracket-match final-match placeholder">
                      <div className="bracket-team">
                        <span className="team-name">Winner of Semi-Final 1</span>
                      </div>
                      <div className="bracket-vs">vs</div>
                      <div className="bracket-team">
                        <span className="team-name">Winner of Semi-Final 2</span>
                      </div>
                      <div className="match-info">
                        <small>Final will be scheduled after semi-finals</small>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

  {selectedCompetition === 'super-cup' && matches.length > 0 && matches.filter(m => m && m.homeTeam && m.awayTeam).map(match => (
    <div key={match._id} className="super-cup-responsive">
      <div className="super-cup-header-responsive">
        <div className="trophy-icon"><Trophy size={18} /></div>
        <h3>The Ultimate Showdown</h3>
        <p>League Champion vs Cup Winner</p>
        {match.originalDoubleWinnerId && (
          <div style={{color:'#dc3545',fontWeight:'bold',marginTop:'8px'}}>
            Note: {match.homeTeam._id === match.originalDoubleWinnerId
              ? `${match.homeTeam.name} won both League and Cup. ${match.awayTeam.name} (League Runner-up) plays as runner-up in Super Cup.`
              : `${match.awayTeam.name} won both League and Cup. ${match.homeTeam.name} (League Runner-up) plays as runner-up in Super Cup.`}
          </div>
        )}
      </div>
      <div className="super-cup-match-responsive">
        <div className="super-cup-team-responsive">
          {match.homeTeam.logo && (
            <img 
              src={match.homeTeam.logo} 
              alt={match.homeTeam.name} 
              className={getTeamLogoClass(match.homeTeam.name)}
            />
          )}
          <h4>{match.homeTeam.name}</h4>
          <small>{match.originalDoubleWinnerId && match.homeTeam._id === match.originalDoubleWinnerId ? 'LEAGUE CHAMPION (Double Winner)' : 'LEAGUE CHAMPION'}</small>
          {match.isPlayed && (
            <div className="super-cup-score-responsive">{match.homeScore}</div>
          )}
        </div>
        <div className="super-cup-vs-responsive">
          {match.isPlayed && (
            <div className="match-result">
              {match.homeScore > match.awayScore 
                ? `${match.homeTeam.name} Wins!` 
                : match.awayScore > match.homeScore 
                ? `${match.awayTeam.name} Wins!` 
                : 'Draw!'}
            </div>
          )}
        </div>
        <div className="super-cup-team-responsive">
          {match.awayTeam.logo && (
            <img 
              src={match.awayTeam.logo} 
              alt={match.awayTeam.name} 
              className={getTeamLogoClass(match.awayTeam.name)}
            />
          )}
          <h4>{match.awayTeam.name}</h4>
          <small>{match.originalDoubleWinnerId && match.awayTeam._id !== match.originalDoubleWinnerId ? 'LEAGUE RUNNER-UP' : 'CUP WINNER'}</small>
          {match.isPlayed && (
            <div className="super-cup-score-responsive">{match.awayScore}</div>
          )}
        </div>
      </div>
    </div>
  ))}
      {/* Fixtures/Results */}
  <div className="card" id="fixtures">
  <h2><Calendar size={18} /> Fixtures & Results</h2>
        
        <div className="filter-section">
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

        {/* ACWPL Table & Description (Desktop) */}
        {/* ACWPL Table (Desktop & Mobile) */}
        {selectedCompetition === 'acwpl' && (
          <div className="card" id="acwpl-standings">
            <h2><BarChart3 size={18} /> ACWPL Table</h2>
            <div className="desktop-only">
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
                    <th>Form</th>
                  </tr>
                </thead>
                <tbody>
                  {getAcwplTable().map((team, idx) => (
                    <tr key={team._id || team.name}
                      style={idx === 0 ? { background: '#f0fdf4' } : idx === 1 ? { background: '#fef2f2' } : {}}>
                      <td>{idx+1}</td>
                      <td>
                        <div className="team-info">
                          {team.logo && (
                            <img src={team.logo} alt={team.name} className={getTeamLogoClass(team.name)} />
                          )}
                          <strong>{team.name}</strong>
                        </div>
                      </td>
                      <td>{team.played}</td>
                      <td>{team.won}</td>
                      <td>{team.drawn}</td>
                      <td>{team.lost}</td>
                      <td>{team.goalsFor}</td>
                      <td>{team.goalsAgainst}</td>
                      <td>{team.goalDifference > 0 ? '+' : ''}{team.goalDifference}</td>
                      <td><strong>{team.points}</strong></td>
                      <td>{renderForm(team.form)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile Card View */}
            <div className="mobile-only">
              <div className="league-cards">
                {getAcwplTable().map((team, idx) => (
                  <div
                    key={team._id || team.name}
                    className="league-card"
                    style={
                      idx === 0
                        ? { border: '2.5px solid #22c55e', boxShadow: '0 0 0 2px #bbf7d0', background: '#f0fdf4' }
                        : idx === 1
                        ? { border: '2.5px solid #dc2626', boxShadow: '0 0 0 2px #fee2e2', background: '#fef2f2' }
                        : {}
                    }
                  >
                    <div className="league-card-header">
                      <div className="position-badge" style={{
                        background: idx === 0 ? '#22c55e' : '#dc2626',
                        color: '#fff',
                        fontWeight: 700
                      }}>{idx+1}</div>
                      <div className="team-info">
                        {team.logo && (
                          <img src={team.logo} alt={team.name} className={getTeamLogoClass(team.name)} />
                        )}
                        <div className="team-details">
                          <h3>{team.name}</h3>
                        </div>
                      </div>
                      <div className="points-display">
                        <div className="points">{team.points}</div>
                        <div className="points-label">PTS</div>
                      </div>
                    </div>
                    <div className="league-card-stats">
                      <div className="stat-group">
                        <div className="stat-item"><span className="stat-label">P</span><span className="stat-value">{team.played}</span></div>
                        <div className="stat-item"><span className="stat-label">W</span><span className="stat-value">{team.won}</span></div>
                        <div className="stat-item"><span className="stat-label">D</span><span className="stat-value">{team.drawn}</span></div>
                        <div className="stat-item"><span className="stat-label">L</span><span className="stat-value">{team.lost}</span></div>
                      </div>
                      <div className="stat-group">
                        <div className="stat-item"><span className="stat-label">GF</span><span className="stat-value">{team.goalsFor}</span></div>
                        <div className="stat-item"><span className="stat-label">GA</span><span className="stat-value">{team.goalsAgainst}</span></div>
                        <div className="stat-item"><span className="stat-label">GD</span><span className="stat-value">{team.goalDifference > 0 ? '+' : ''}{team.goalDifference}</span></div>
                        {/* Show only last 3 form results for mobile */}
                        <div className="stat-item"><span className="stat-label">Form</span><span className="stat-value form-display">{renderForm(team.form.slice(0, 3))}</span></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="desktop-only">
          {/* Table header */}
          <div className="match-header">
            <div>Date</div>
            <div>Time</div>
            <div>Home Team</div>
            <div>Score</div>
            <div>Away Team</div>
            <div>Stage</div>
            <div>Status</div>
          </div>

        <div className="fixtures-container">
          {selectedCompetition === 'league' ? (
            // Group matches by matchweek for league
            <>
              {getMatchweeks()
                .filter(week => !selectedMatchweek || week === parseInt(selectedMatchweek))
                .map(week => (
                  <div key={week} className="matchweek-group">
                    <div className="matchweek-header">
                      <h3>Matchweek {week}</h3>
                    </div>
                    {matches
                      .filter(match => match && match.homeTeam && match.awayTeam && match.matchweek === week)
                      .map(match => (
                        <div key={match._id}>
                          <div 
                            className="match-row" 
                            onClick={() => (match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match))) && toggleMatchDetails(match._id)}
                            style={{ cursor: (match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match))) ? 'pointer' : 'default' }}
                          >
                            <div>{formatDate(match.date)}</div>
                            <div>{match.time}</div>
                            <div>
                              <div className="team-info">
                                {match.homeTeam.logo && (
                                  <img 
                                    src={match.homeTeam.logo} 
                                    alt={match.homeTeam.name} 
                                    className={getTeamLogoClass(match.homeTeam.name)}
                                    style={{ width: '20px', height: '20px' }}
                                  />
                                )}
                                <strong>{match.homeTeam.name}</strong>
                              </div>
                            </div>
                            <div className="score-display">
                              {match.isPlayed ? (
                                <span><strong>{match.homeScore} - {match.awayScore}</strong></span>
                              ) : (
                                <span>vs</span>
                              )}
                            </div>
                            <div>
                              <div className="team-info">
                                {match.awayTeam.logo && (
                                  <img 
                                    src={match.awayTeam.logo} 
                                    alt={match.awayTeam.name} 
                                    className={getTeamLogoClass(match.awayTeam.name)}
                                    style={{ width: '20px', height: '20px' }}
                                  />
                                )}
                                <strong>{match.awayTeam.name}</strong>
                              </div>
                            </div>
                            <div>{formatStage(match.stage, selectedCompetition) || 'Regular'}</div>
                            <div>
                              <span className={`badge ${match.isPlayed ? 'badge-success' : 'badge-warning'}`}>
                                {match.isPlayed ? 'Played' : 'Scheduled'}
                              </span>
                            </div>
                          </div>
                          {/* Expandable goalscorer details and lineups */}
                          {match.isPlayed && expandedMatches.has(match._id) && (
                            <div style={{ 
                              backgroundColor: '#f8f9fa', 
                              padding: '12px 20px', 
                              borderLeft: '3px solid #0066cc',
                              marginBottom: '8px'
                            }}>
                              {/* Starting Lineup */}
                              {renderStartingLineup(match)}

                              {/* Match Events */}
                              {hasMatchEvents(match) && (
                                <div style={{
                                  backgroundColor: '#fff',
                                  padding: '8px',
                                  borderRadius: '4px',
                                  marginTop: '8px'
                                }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <div>
                                      <strong>{match.homeTeam.name}</strong>
                                      {formatGoalscorers(match, 'home')}
                                      {formatCards(match, 'home', 'YELLOW_CARD')}
                                      {formatCards(match, 'home', 'RED_CARD')}
                                    </div>
                                    <div>
                                      <strong>{match.awayTeam.name}</strong>
                                      {formatGoalscorers(match, 'away')}
                                      {formatCards(match, 'away', 'YELLOW_CARD')}
                                      {formatCards(match, 'away', 'RED_CARD')}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Click hint */}
                          {match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match)) && (
                            <div style={{
                              fontSize: '11px',
                              color: '#999',
                              paddingLeft: '20px',
                              paddingTop: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              {expandedMatches.has(match._id) ? (
                                <>
                                  <span>^</span>
                                  <span>collapse</span>
                                </>
                              ) : (
                                <>
                                  <ChevronDown size={14} />
                                  <span>expand</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                ))}
            </>
          ) : selectedCompetition === 'cup' ? (
          // Group Cup matches by stage
          <>
            {['semi-final', 'final'].map(stage => {
              const stageMatches = matches.filter(match => match && match.homeTeam && match.awayTeam && match.stage === stage);
              if (stageMatches.length === 0) return null;
              
              return (
                <div key={stage} className="matchweek-group">
                  <div className="matchweek-header">
                    <h3>{stage === 'semi-final' ? 'Semi-Finals' : 'Final'}</h3>
                  </div>
                  {stageMatches.map(match => (
                    <div key={match._id}>
                      <div 
                        className="match-row"
                        onClick={() => (match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match))) && toggleMatchDetails(match._id)}
                        style={{ cursor: (match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match))) ? 'pointer' : 'default' }}
                      >
                        <div>{formatDate(match.date)}</div>
                        <div>{match.time}</div>
                        <div>
                          <div className="team-info">
                            {match.homeTeam.logo && (
                              <img 
                                src={match.homeTeam.logo} 
                                alt={match.homeTeam.name} 
                                className={getTeamLogoClass(match.homeTeam.name)}
                                style={{ width: '20px', height: '20px' }}
                              />
                            )}
                            <strong>{match.homeTeam.name}</strong>
                          </div>
                        </div>
                        <div className="score-display">
                          {match.isPlayed ? (
                            <div>
                              <span><strong>{match.homeScore} - {match.awayScore}</strong></span>
                              {match.homePenalties !== undefined && match.awayPenalties !== undefined && (
                                <div style={{ fontSize: '0.8em', color: '#666' }}>
                                  ({match.homePenalties} - {match.awayPenalties} pens)
                                </div>
                              )}
                            </div>
                          ) : (
                            <span>vs</span>
                          )}
                        </div>
                        <div>
                          <div className="team-info">
                            {match.awayTeam.logo && (
                              <img 
                                src={match.awayTeam.logo} 
                                alt={match.awayTeam.name} 
                                className={getTeamLogoClass(match.awayTeam.name)}
                                style={{ width: '20px', height: '20px' }}
                              />
                            )}
                            <strong>{match.awayTeam.name}</strong>
                          </div>
                        </div>
                        <div>{formatStage(match.stage, selectedCompetition) || 'Regular'}</div>
                        <div>
                          <span className={`badge ${match.isPlayed ? 'badge-success' : 'badge-warning'}`}>
                            {match.isPlayed ? 'Played' : 'Scheduled'}
                          </span>
                        </div>
                      </div>

                      {/* Expandable details for cup matches */}
                      {match.isPlayed && expandedMatches.has(match._id) && (
                        <div style={{ 
                          backgroundColor: '#f8f9fa', 
                          padding: '12px 20px', 
                          borderLeft: '3px solid #0066cc',
                          marginBottom: '8px'
                        }}>
                          {renderStartingLineup(match)}
                          
                          {hasMatchEvents(match) && (
                            <div style={{
                              backgroundColor: '#fff',
                              padding: '8px',
                              borderRadius: '4px',
                              marginTop: '8px'
                            }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                  <strong>{match.homeTeam.name}</strong>
                                  {formatGoalscorers(match, 'home')}
                                  {formatCards(match, 'home', 'YELLOW_CARD')}
                                  {formatCards(match, 'home', 'RED_CARD')}
                                </div>
                                <div>
                                  <strong>{match.awayTeam.name}</strong>
                                  {formatGoalscorers(match, 'away')}
                                  {formatCards(match, 'away', 'YELLOW_CARD')}
                                  {formatCards(match, 'away', 'RED_CARD')}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Click hint */}
                      {match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match)) && (
                        <div style={{
                          fontSize: '11px',
                          color: '#999',
                          paddingLeft: '20px',
                          paddingTop: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {expandedMatches.has(match._id) ? (
                            <>
                              <span>^</span>
                              <span>collapse</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown size={14} />
                              <span>expand</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </>
  ) : selectedCompetition === 'super-cup' ? (
          // Group Super Cup match by final
          <>
            {matches.length > 0 && (
              <div className="matchweek-group">
                <div className="matchweek-header">
                  <h3>Super Cup Final</h3>
                </div>
                {matches.filter(m => m && m.homeTeam && m.awayTeam).map(match => (
                  <div key={match._id}>
                    <div 
                      className="match-row"
                      onClick={() => (match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match))) && toggleMatchDetails(match._id)}
                      style={{ cursor: (match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match))) ? 'pointer' : 'default' }}
                    >
                      <div>{formatDate(match.date)}</div>
                      <div>{match.time}</div>
                      <div>
                        <div className="team-info">
                          {match.homeTeam.logo && (
                            <img 
                              src={match.homeTeam.logo} 
                              alt={match.homeTeam.name} 
                              className={getTeamLogoClass(match.homeTeam.name)}
                              style={{ width: '20px', height: '20px' }}
                            />
                          )}
                          <strong>{match.homeTeam.name}</strong>
                        </div>
                      </div>
                      <div className="score-display">
                        {match.isPlayed ? (
                          <div>
                            <span><strong>{match.homeScore} - {match.awayScore}</strong></span>
                            {match.homePenalties !== undefined && match.awayPenalties !== undefined && (
                              <div style={{ fontSize: '0.8em', color: '#666' }}>
                                ({match.homePenalties} - {match.awayPenalties} pens)
                              </div>
                            )}
                          </div>
                        ) : (
                          <span>vs</span>
                        )}
                      </div>
                      <div>
                        <div className="team-info">
                          {match.awayTeam.logo && (
                            <img 
                              src={match.awayTeam.logo} 
                              alt={match.awayTeam.name} 
                              className={getTeamLogoClass(match.awayTeam.name)}
                              style={{ width: '20px', height: '20px' }}
                            />
                          )}
                          <strong>{match.awayTeam.name}</strong>
                        </div>
                      </div>
                      <div>{formatStage(match.stage, selectedCompetition) || 'Final'}</div>
                      <div>
                        <span className={`badge ${match.isPlayed ? 'badge-success' : 'badge-warning'}`}>
                          {match.isPlayed ? 'Played' : 'Scheduled'}
                        </span>
                      </div>
                    </div>

                    {/* Expandable details for super cup matches */}
                    {match.isPlayed && expandedMatches.has(match._id) && (
                      <div style={{ 
                        backgroundColor: '#f8f9fa', 
                        padding: '12px 20px', 
                        borderLeft: '3px solid #0066cc',
                        marginBottom: '8px'
                      }}>
                        {renderStartingLineup(match)}
                        
                        {hasMatchEvents(match) && (
                          <div style={{
                            backgroundColor: '#fff',
                            padding: '8px',
                            borderRadius: '4px',
                            marginTop: '8px'
                          }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                              <div>
                                <strong>{match.homeTeam.name}</strong>
                                {formatGoalscorers(match, 'home')}
                                {formatCards(match, 'home', 'YELLOW_CARD')}
                                {formatCards(match, 'home', 'RED_CARD')}
                              </div>
                              <div>
                                <strong>{match.awayTeam.name}</strong>
                                {formatGoalscorers(match, 'away')}
                                {formatCards(match, 'away', 'YELLOW_CARD')}
                                {formatCards(match, 'away', 'RED_CARD')}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Click hint */}
                    {match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match)) && (
                      <div style={{
                        fontSize: '11px',
                        color: '#999',
                        paddingLeft: '20px',
                        paddingTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {expandedMatches.has(match._id) ? (
                          <>
                            <span>^</span>
                            <span>collapse</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown size={14} />
                            <span>expand</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : selectedCompetition === 'acwpl' ? (
          // ACWPL: Show all 5 fixtures as a simple list (desktop)
          <>
            <div className="matchweek-group acwpl-fixtures-bg">
              <div className="matchweek-header">
                <h3>ACWPL Fixtures</h3>
              </div>
              {matches.filter(m => m && m.homeTeam && m.awayTeam).map(match => (
                <div key={match._id}>
                  <div 
                    className="match-row"
                    onClick={() => (match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match))) && toggleMatchDetails(match._id)}
                    style={{ cursor: (match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match))) ? 'pointer' : 'default' }}
                  >
                    <div>{formatDate(match.date)}</div>
                    <div>{match.time}</div>
                    <div>
                      <div className="team-info">
                        {match.homeTeam.logo && (
                          <img 
                            src={match.homeTeam.logo} 
                            alt={match.homeTeam.name} 
                            className={getTeamLogoClass(match.homeTeam.name)}
                            style={{ width: '20px', height: '20px' }}
                          />
                        )}
                        <strong>{match.homeTeam.name}</strong>
                      </div>
                    </div>
                    <div className="score-display">
                      {match.isPlayed ? (
                        <span><strong>{match.homeScore} - {match.awayScore}</strong></span>
                      ) : (
                        <span>vs</span>
                      )}
                    </div>
                    <div>
                      <div className="team-info">
                        {match.awayTeam.logo && (
                          <img 
                            src={match.awayTeam.logo} 
                            alt={match.awayTeam.name} 
                            className={getTeamLogoClass(match.awayTeam.name)}
                            style={{ width: '20px', height: '20px' }}
                          />
                        )}
                        <strong>{match.awayTeam.name}</strong>
                      </div>
                    </div>
                    <div>Fixture</div>
                    <div>
                      <span className={`badge ${match.isPlayed ? 'badge-success' : 'badge-warning'}`}>
                        {match.isPlayed ? 'Played' : 'Scheduled'}
                      </span>
                    </div>
                  </div>

                  {/* Expandable details for ACWPL matches */}
                  {match.isPlayed && expandedMatches.has(match._id) && (
                    <div style={{ 
                      backgroundColor: '#f8f9fa', 
                      padding: '12px 20px', 
                      borderLeft: '3px solid #0066cc',
                      marginBottom: '8px'
                    }}>
                      {renderStartingLineup(match)}
                      
                      {hasMatchEvents(match) && (
                        <div style={{
                          backgroundColor: '#fff',
                          padding: '8px',
                          borderRadius: '4px',
                          marginTop: '8px'
                        }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div>
                              <strong>{match.homeTeam.name}</strong>
                              {formatGoalscorers(match, 'home')}
                              {formatCards(match, 'home', 'YELLOW_CARD')}
                              {formatCards(match, 'home', 'RED_CARD')}
                            </div>
                            <div>
                              <strong>{match.awayTeam.name}</strong>
                              {formatGoalscorers(match, 'away')}
                              {formatCards(match, 'away', 'YELLOW_CARD')}
                              {formatCards(match, 'away', 'RED_CARD')}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Click hint */}
                  {match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match)) && (
                    <div style={{
                      fontSize: '11px',
                      color: '#999',
                      paddingLeft: '20px',
                      paddingTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {expandedMatches.has(match._id) ? (
                        <>
                          <span>^</span>
                          <span>collapse</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} />
                          <span>expand</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          // Fallback display for other competitions
          <>
            {matches.filter(m => m && m.homeTeam && m.awayTeam).map(match => (
              <div key={match._id} className="match-row">
                <div>{formatDate(match.date)}</div>
                <div>{match.time}</div>
                <div>
                  <div className="team-info">
                    {match.homeTeam.logo && (
                      <img 
                        src={match.homeTeam.logo} 
                        alt={match.homeTeam.name} 
                        className={getTeamLogoClass(match.homeTeam.name)}
                        style={{ width: '20px', height: '20px' }}
                      />
                    )}
                    <strong>{match.homeTeam.name}</strong>
                  </div>
                </div>
                <div className="score-display">
                  {match.isPlayed ? (
                    <div>
                      <span><strong>{match.homeScore} - {match.awayScore}</strong></span>
                      {match.homePenalties !== undefined && match.awayPenalties !== undefined && (
                        <div style={{ fontSize: '0.8em', color: '#666' }}>
                          ({match.homePenalties} - {match.awayPenalties} pens)
                        </div>
                      )}
                    </div>
                  ) : (
                    <span>vs</span>
                  )}
                </div>
                <div>
                  <div className="team-info">
                    {match.awayTeam.logo && (
                      <img 
                        src={match.awayTeam.logo} 
                        alt={match.awayTeam.name} 
                        className={getTeamLogoClass(match.awayTeam.name)}
                        style={{ width: '20px', height: '20px' }}
                      />
                    )}
                    <strong>{match.awayTeam.name}</strong>
                  </div>
                </div>
                <div>{formatStage(match.stage, selectedCompetition) || 'Regular'}</div>
                <div>
                  <span className={`badge ${match.isPlayed ? 'badge-success' : 'badge-warning'}`}>
                    {match.isPlayed ? 'Played' : 'Scheduled'}
                  </span>
                </div>
              </div>
            ))}
          </>
        )}

        {matches.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            No matches found for the selected criteria.
          </div>
        )}
        </div> {/* Close fixtures-container */}
        </div> {/* Close desktop-only */}

  {/* Mobile Card View */}
        <div className="mobile-only">
          <div className="fixtures-mobile">
            {selectedCompetition === 'league' ? (
              // Group matches by matchweek for league - Mobile Cards
              <>
                {getMatchweeks()
                  .filter(week => !selectedMatchweek || week === parseInt(selectedMatchweek))
                  .map(week => (
                    <div key={week} className="matchweek-section">
                      <div className="matchweek-header-mobile">
                        <h3>Matchweek {week}</h3>
                      </div>
                      <div className="matches-cards">
                        {matches
                          .filter(match => match.matchweek === week)
                          .map(match => (
                            <div 
                              key={match._id} 
                              className={`fixture-card ${match.isPlayed ? 'played' : 'scheduled'}`}
                              onClick={() => (match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match))) && toggleMatchDetails(match._id)}
                              style={{ cursor: (match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match))) ? 'pointer' : 'default' }}
                            >
                              <div className="fixture-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                {/* Date+Time at the left, match status at the right */}
                                <div className="fixture-datetime" style={{ background: '#dc2626', border: '2px solid #dc2626', borderRadius: 14, padding: '1.5px 8px', display: 'inline-block', minWidth: 0 }}>
                                  <span className="fixture-date" style={{ fontSize: '0.82rem', fontWeight: 400, color: '#fff', letterSpacing: '0.2px', textShadow: 'none' }}>{formatDate(match.date)}</span>
                                  <span className="fixture-time" style={{ fontSize: '0.82rem', fontWeight: 400, color: '#fff', marginLeft: 6, textShadow: 'none' }}>{match.time}</span>
                                </div>
                                <div className="fixture-status">
                                  <span className={`status-badge ${match.isPlayed ? 'completed' : 'upcoming'}`}>
                                    {match.isPlayed ? 'FT' : 'Scheduled'}
                                  </span>
                                </div>
                              </div>

                              <div className="fixture-teams">
                                <div className="team-section home">
                                  <div className="team-info">
                                    {match.homeTeam.logo && (
                                      <img 
                                        src={match.homeTeam.logo} 
                                        alt={match.homeTeam.name} 
                                        className={getTeamLogoClass(match.homeTeam.name)}
                                      />
                                    )}
                                    <span className="team-name">{match.homeTeam.name}</span>
                                  </div>
                                  {match.isPlayed && (
                                    <div className="team-score">{match.homeScore}</div>
                                  )}
                                </div>

                                <div className="vs-section">
                                  {match.isPlayed ? (
                                    <div className="final-score">
                                      <span className="score-display">{match.homeScore} - {match.awayScore}</span>
                                      {/* Penalties for all competitions, mobile */}
                                      {match.homePenalties !== undefined && match.awayPenalties !== undefined && match.homePenalties !== null && match.awayPenalties !== null && (
                                        <div className="penalties-display-mobile" style={{ fontSize: '0.85em', color: '#666', marginTop: 2 }}>
                                          ({match.homePenalties} - {match.awayPenalties} pens)
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="vs-display">VS</div>
                                  )}
                                </div>

                                <div className="team-section away">
                                  <div className="team-info">
                                    {match.awayTeam.logo && (
                                      <img 
                                        src={match.awayTeam.logo} 
                                        alt={match.awayTeam.name} 
                                        className={getTeamLogoClass(match.awayTeam.name)}
                                      />
                                    )}
                                    <span className="team-name">{match.awayTeam.name}</span>
                                  </div>
                                  {match.isPlayed && (
                                    <div className="team-score">{match.awayScore}</div>
                                  )}
                                </div>
                              </div>

                              {/* Expandable details - Mobile */}
                              {match.isPlayed && expandedMatches.has(match._id) && (
                                <div style={{ 
                                  backgroundColor: '#e9ecef', 
                                  padding: '12px', 
                                  borderTop: '2px solid #dee2e6',
                                  marginTop: '10px'
                                }}>
                                  {/* Starting Lineup */}
                                  {renderStartingLineup(match)}
                                  <div style={{ marginBottom: '8px' }}>
                                    <strong>{match.homeTeam.name}</strong>
                                    {formatGoalscorers(match, 'home')}
                                    {formatCards(match, 'home', 'YELLOW_CARD')}
                                    {formatCards(match, 'home', 'RED_CARD')}
                                  </div>
                                  <div>
                                    <strong>{match.awayTeam.name}</strong>
                                    {formatGoalscorers(match, 'away')}
                                    {formatCards(match, 'away', 'YELLOW_CARD')}
                                    {formatCards(match, 'away', 'RED_CARD')}
                                  </div>
                                </div>
                              )}

                              {/* Mobile click hint */}
                              {match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match)) && (
                                <div style={{
                                  fontSize: '11px',
                                  color: '#999',
                                  paddingTop: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  {expandedMatches.has(match._id) ? (
                                    <>
                                      <span>^</span>
                                      <span>collapse</span>
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown size={14} />
                                      <span>expand</span>
                                    </>
                                  )}
                                </div>
                              )}

                              {(match.stage && match.stage !== 'regular') && (
                                <div className="fixture-stage">
                                  {formatStage(match.stage, selectedCompetition)}
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
              </>
            ) : selectedCompetition === 'cup' ? (
              // Group Cup matches by stage - Mobile Cards
              <>
                {(() => {
                  const stages = [...new Set(matches.map(match => match.stage))].sort((a, b) => {
                    const order = { 'semi-final': 1, 'final': 2 };
                    return (order[a] || 99) - (order[b] || 99);
                  });
                  
                  return stages.map(stage => {
                    const stageMatches = matches.filter(match => match && match.homeTeam && match.awayTeam && match.stage === stage);
                    const stageDisplayName = formatStage(stage, selectedCompetition);
                    
                    return (
                      <div key={stage} className="matchweek-section">
                        <div className="matchweek-header-mobile">
                          <h3>{stageDisplayName}</h3>
                        </div>
                        <div className="matches-cards">
                          {stageMatches.map(match => (
                            <div 
                              key={match._id} 
                              className={`fixture-card ${match.isPlayed ? 'played' : 'scheduled'}`}
                              onClick={() => (match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match))) && toggleMatchDetails(match._id)}
                              style={{ cursor: (match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match))) ? 'pointer' : 'default' }}
                            >
                              <div className="fixture-header">
                                <div className="fixture-datetime">
                                  <span className="fixture-date">{formatDate(match.date)}</span>
                                  <span className="fixture-time">{match.time}</span>
                                </div>
                                <div className="fixture-status">
                                  <span className={`status-badge ${match.isPlayed ? 'completed' : 'upcoming'}`}>
                                    {match.isPlayed ? 'FT' : 'Scheduled'}
                                  </span>
                                </div>
                              </div>

                              <div className="fixture-teams">
                                <div className="team-section home">
                                  <div className="team-info">
                                    {match.homeTeam.logo && (
                                      <img 
                                        src={match.homeTeam.logo} 
                                        alt={match.homeTeam.name} 
                                        className={getTeamLogoClass(match.homeTeam.name)}
                                      />
                                    )}
                                    <span className="team-name">{match.homeTeam.name}</span>
                                  </div>
                                  {match.isPlayed && (
                                    <div className="team-score">{match.homeScore}</div>
                                  )}
                                </div>

                                <div className="vs-section">
                                  {match.isPlayed ? (
                                    <div className="final-score">
                                      <span className="score-display">{match.homeScore} - {match.awayScore}</span>
                                      {/* Penalties for all competitions, mobile */}
                                      {match.homePenalties !== undefined && match.awayPenalties !== undefined && match.homePenalties !== null && match.awayPenalties !== null && (
                                        <div className="penalties-display-mobile" style={{ fontSize: '0.85em', color: '#666', marginTop: 2 }}>
                                          ({match.homePenalties} - {match.awayPenalties} pens)
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="vs-display">VS</div>
                                  )}
                                </div>

                                <div className="team-section away">
                                  <div className="team-info">
                                    {match.awayTeam.logo && (
                                      <img 
                                        src={match.awayTeam.logo} 
                                        alt={match.awayTeam.name} 
                                        className={getTeamLogoClass(match.awayTeam.name)}
                                      />
                                    )}
                                    <span className="team-name">{match.awayTeam.name}</span>
                                  </div>
                                  {match.isPlayed && (
                                    <div className="team-score">{match.awayScore}</div>
                                  )}
                                </div>
                              </div>

                              {/* Expandable details - Mobile (Cup) */}
                              {match.isPlayed && expandedMatches.has(match._id) && (
                                <div style={{ 
                                  backgroundColor: '#e9ecef', 
                                  padding: '12px', 
                                  borderTop: '2px solid #dee2e6',
                                  marginTop: '10px'
                                }}>
                                  {renderStartingLineup(match)}
                                  <div style={{ marginBottom: '8px' }}>
                                    <strong>{match.homeTeam.name}</strong>
                                    {formatGoalscorers(match, 'home')}
                                    {formatCards(match, 'home', 'YELLOW_CARD')}
                                    {formatCards(match, 'home', 'RED_CARD')}
                                  </div>
                                  <div>
                                    <strong>{match.awayTeam.name}</strong>
                                    {formatGoalscorers(match, 'away')}
                                    {formatCards(match, 'away', 'YELLOW_CARD')}
                                    {formatCards(match, 'away', 'RED_CARD')}
                                  </div>
                                </div>
                              )}

                              {/* Mobile click hint */}
                              {match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match)) && (
                                <div style={{
                                  fontSize: '11px',
                                  color: '#999',
                                  paddingTop: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  {expandedMatches.has(match._id) ? (
                                    <>
                                      <span>^</span>
                                      <span>collapse</span>
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown size={14} />
                                      <span>expand</span>
                                    </>
                                  )}
                                </div>
                              )}

                              {(match.stage && match.stage !== 'regular') && (
                                <div className="fixture-stage">
                                  {formatStage(match.stage, selectedCompetition)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
                })()}
              </>
            ) : selectedCompetition === 'acwpl' ? (
              // ACWPL: Show 5 fixtures as cards (mobile)
              <div className="matches-cards acwpl-fixtures-bg">
                {matches.filter(m => m && m.homeTeam && m.awayTeam).map(match => (
                  <div 
                    key={match._id} 
                    className={`fixture-card ${match.isPlayed ? 'played' : 'scheduled'}`}
                    onClick={() => (match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match))) && toggleMatchDetails(match._id)}
                    style={{ cursor: (match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match))) ? 'pointer' : 'default' }}
                  >
                    <div className="fixture-header">
                      <div className="fixture-datetime">
                        <span className="fixture-date">{formatDate(match.date)}</span>
                        <span className="fixture-time">{match.time}</span>
                      </div>
                      <div className="fixture-status">
                        <span className={`status-badge ${match.isPlayed ? 'completed' : 'upcoming'}`}>
                          {match.isPlayed ? 'FT' : 'Scheduled'}
                        </span>
                      </div>
                    </div>

                    <div className="fixture-teams">
                      <div className="team-section home">
                        <div className="team-info">
                          {match.homeTeam.logo && (
                            <img 
                              src={match.homeTeam.logo} 
                              alt={match.homeTeam.name} 
                              className={getTeamLogoClass(match.homeTeam.name)}
                            />
                          )}
                          <span className="team-name">{match.homeTeam.name}</span>
                        </div>
                        {match.isPlayed && (
                          <div className="team-score">{match.homeScore}</div>
                        )}
                      </div>

                      <div className="vs-section">
                        {match.isPlayed ? (
                          <div className="final-score">
                            <span className="score-display">{match.homeScore} - {match.awayScore}</span>
                          </div>
                        ) : (
                          <div className="vs-display">VS</div>
                        )}
                      </div>

                      <div className="team-section away">
                        <div className="team-info">
                          {match.awayTeam.logo && (
                            <img 
                              src={match.awayTeam.logo} 
                              alt={match.awayTeam.name} 
                              className={getTeamLogoClass(match.awayTeam.name)}
                            />
                          )}
                          <span className="team-name">{match.awayTeam.name}</span>
                        </div>
                        {match.isPlayed && (
                          <div className="team-score">{match.awayScore}</div>
                        )}
                      </div>
                    </div>

                    {/* Expandable details - Mobile (ACWPL) */}
                    {match.isPlayed && expandedMatches.has(match._id) && (
                      <div style={{ 
                        backgroundColor: '#e9ecef', 
                        padding: '12px', 
                        borderTop: '2px solid #dee2e6',
                        marginTop: '10px'
                      }}>
                        {renderStartingLineup(match)}
                        <div style={{ marginBottom: '8px' }}>
                          <strong>{match.homeTeam.name}</strong>
                          {formatGoalscorers(match, 'home')}
                          {formatCards(match, 'home', 'YELLOW_CARD')}
                          {formatCards(match, 'home', 'RED_CARD')}
                        </div>
                        <div>
                          <strong>{match.awayTeam.name}</strong>
                          {formatGoalscorers(match, 'away')}
                          {formatCards(match, 'away', 'YELLOW_CARD')}
                          {formatCards(match, 'away', 'RED_CARD')}
                        </div>
                      </div>
                    )}

                    {/* Mobile click hint */}
                    {match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match)) && (
                      <div style={{
                        fontSize: '11px',
                        color: '#999',
                        paddingTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {expandedMatches.has(match._id) ? (
                          <>
                            <span>^</span>
                            <span>collapse</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown size={14} />
                            <span>expand</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              // For other competitions, show simple cards
              <div className="matches-cards">
                {matches.filter(m => m && m.homeTeam && m.awayTeam).map(match => (
                  <div 
                    key={match._id} 
                    className={`fixture-card ${match.isPlayed ? 'played' : 'scheduled'} ${selectedCompetition === 'super-cup' ? 'super-cup' : ''}`}
                    onClick={() => (match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match))) && toggleMatchDetails(match._id)}
                    style={{ cursor: (match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match))) ? 'pointer' : 'default' }}
                  >
                    <div className="fixture-header">
                      <div className="fixture-datetime">
                        <span className="fixture-date">{formatDate(match.date)}</span>
                        <span className="fixture-time">{match.time}</span>
                      </div>
                      <div className="fixture-status">
                        <span className={`status-badge ${match.isPlayed ? 'completed' : 'upcoming'}`}>
                          {match.isPlayed ? 'FT' : 'Scheduled'}
                        </span>
                      </div>
                    </div>

                    <div className="fixture-teams">
                      <div className="team-section home">
                        <div className="team-info">
                          {match.homeTeam.logo && (
                            <img 
                              src={match.homeTeam.logo} 
                              alt={match.homeTeam.name} 
                              className={getTeamLogoClass(match.homeTeam.name)}
                            />
                          )}
                          <span className="team-name">{match.homeTeam.name}</span>
                        </div>
                        {match.isPlayed && (
                          <div className="team-score">{match.homeScore}</div>
                        )}
                      </div>

                      <div className="vs-section">
                        {match.isPlayed ? (
                          <div className="final-score">
                            <span className="score-display">{match.homeScore} - {match.awayScore}</span>
                            {/* Penalties for all competitions, mobile */}
                            {match.homePenalties !== undefined && match.awayPenalties !== undefined && match.homePenalties !== null && match.awayPenalties !== null && (
                              <div className="penalties-display-mobile" style={{ fontSize: '0.85em', color: '#666', marginTop: 2 }}>
                                ({match.homePenalties} - {match.awayPenalties} pens)
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="vs-display">VS</div>
                        )}
                      </div>

                      <div className="team-section away">
                        <div className="team-info">
                          {match.awayTeam.logo && (
                            <img 
                              src={match.awayTeam.logo} 
                              alt={match.awayTeam.name} 
                              className={getTeamLogoClass(match.awayTeam.name)}
                            />
                          )}
                          <span className="team-name">{match.awayTeam.name}</span>
                        </div>
                        {match.isPlayed && (
                          <div className="team-score">{match.awayScore}</div>
                        )}
                      </div>
                    </div>

                    {/* Expandable details - Mobile (Other comps incl. Super Cup) */}
                    {match.isPlayed && expandedMatches.has(match._id) && (
                      <div style={{ 
                        backgroundColor: '#e9ecef', 
                        padding: '12px', 
                        borderTop: '2px solid #dee2e6',
                        marginTop: '10px'
                      }}>
                        {renderStartingLineup(match)}
                        <div style={{ marginBottom: '8px' }}>
                          <strong>{match.homeTeam.name}</strong>
                          {formatGoalscorers(match, 'home')}
                          {formatCards(match, 'home', 'YELLOW_CARD')}
                          {formatCards(match, 'home', 'RED_CARD')}
                        </div>
                        <div>
                          <strong>{match.awayTeam.name}</strong>
                          {formatGoalscorers(match, 'away')}
                          {formatCards(match, 'away', 'YELLOW_CARD')}
                          {formatCards(match, 'away', 'RED_CARD')}
                        </div>
                      </div>
                    )}

                    {/* Mobile click hint */}
                    {match.isPlayed && (hasMatchEvents(match) || hasStartingLineup(match)) && (
                      <div style={{
                        fontSize: '11px',
                        color: '#999',
                        paddingTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {expandedMatches.has(match._id) ? (
                          <>
                            <span>^</span>
                            <span>collapse</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown size={14} />
                            <span>expand</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>

        {matches.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            No matches found for the selected criteria.
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
};

export default UserView;
