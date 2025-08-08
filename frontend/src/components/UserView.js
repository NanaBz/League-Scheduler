import React, { useState, useEffect } from 'react';
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

const UserView = ({ competitions, selectedCompetition, refreshKey, isAdmin }) => {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedMatchweek, setSelectedMatchweek] = useState('');
  const [winners, setWinners] = useState({});
  const [selectedSeason, setSelectedSeason] = useState(null); // null = current season

  const handleSeasonSelect = (season) => {
    setSelectedSeason(season);
  };

  const handleBackToLive = () => {
    setSelectedSeason(null);
  };

  const fetchTeams = async () => {
    try {
      const response = await api.get('/teams');
      setTeams(response.data);
    } catch (error) {
      console.error('Error fetching teams:', error);
      // Fallback to mock data if backend is unavailable
      setTeams([
        { _id: '1', name: 'Vikings', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
        { _id: '2', name: 'Warriors', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
        { _id: '3', name: 'Lions', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
        { _id: '4', name: 'Elites', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
        { _id: '5', name: 'Falcons', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
        { _id: '6', name: 'Dragons', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 }
      ]);
    }
  };

  const fetchMatches = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCompetition) params.append('competition', selectedCompetition);
      if (selectedMatchweek) params.append('matchweek', selectedMatchweek);
      const response = await api.get(`/matches?${params}`);
      setMatches(response.data);
    } catch (error) {
      console.error('Error fetching matches:', error);
      // Fallback to empty matches if backend is unavailable
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

  return (
    <div>
      {/* Season Selector */}
      <SeasonSelector 
        onSeasonSelect={handleSeasonSelect} 
        currentSeason={selectedSeason}
        showArchived={true}
        isAdmin={isAdmin}
      />
      
      {/* Winner Banners - Only show for current competition */}
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
          🏆 League Champions: {winners.league}! Congratulations!
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
          🏆 Cup Winners: {winners.cup}! Amazing performance!
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
          🏆 Super Cup Champions: {winners.superCup}! Ultimate glory!
        </div>
      )}

      {/* Competition-specific displays */}
      {selectedCompetition === 'league' && (
        <>
          {/* League Table */}
          <div className="card">
            <h2>📊 League Table</h2>
            
            {/* Mobile scroll hint */}
            <div className="horizontal-scroll-hint mobile-only">
              👈 Swipe left/right to view all stats
            </div>
            
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
                  {teams.map((team, index) => {
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
        </>
      )}

      {selectedCompetition === 'cup' && (
        <>
          {/* Cup Tournament Bracket */}
          <div className="card">
            <h2>🏅 Agha Cup Tournament</h2>
            <div className="cup-bracket">
              <div className="bracket-round">
                <h3>Semi-Finals</h3>
                <div className="bracket-matches">
                  {matches.filter(m => m.stage === 'semi-final').map(match => (
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
              
              <div className="bracket-arrow">⬇️</div>
              
              <div className="bracket-round">
                <h3>Final</h3>
                <div className="bracket-matches">
                  {matches.filter(m => m.stage === 'final').length > 0 ? (
                    matches.filter(m => m.stage === 'final').map(match => (
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

      {selectedCompetition === 'super-cup' && (
        <>
          {/* Super Cup Display */}
          <div className="card">
            <h2>⭐ Super Cup Final</h2>
            <div className="super-cup-display">
              {matches.length > 0 ? (
                <div className="super-cup-match">
                  <div className="super-cup-header">
                    <h3>🏆 The Ultimate Showdown</h3>
                    <p>League Champion vs Cup Winner</p>
                  </div>
                  {matches.map(match => (
                    <div key={match._id} className="super-cup-teams">
                      <div className="super-cup-team">
                        <div className="team-badge">
                          <div className="team-info" style={{ marginBottom: '4px' }}>
                            {match.homeTeam.logo && (
                              <img 
                                src={match.homeTeam.logo} 
                                alt={match.homeTeam.name} 
                                className={getTeamLogoClass(match.homeTeam.name)}
                                style={{ width: '28px', height: '28px' }}
                              />
                            )}
                            <h4>{match.homeTeam.name}</h4>
                          </div>
                          <small>League Champion</small>
                        </div>
                        {match.isPlayed && (
                          <div className="super-cup-score">{match.homeScore}</div>
                        )}
                      </div>
                      
                      <div className="super-cup-center">
                        <div className="super-cup-vs">VS</div>
                        <div className="super-cup-date">
                          {formatDate(match.date)} at {match.time}
                        </div>
                        {match.isPlayed && (
                          <div className="super-cup-result">
                            {match.homeScore > match.awayScore 
                              ? `${match.homeTeam.name} Wins!` 
                              : match.awayScore > match.homeScore 
                              ? `${match.awayTeam.name} Wins!` 
                              : 'Draw!'}
                          </div>
                        )}
                      </div>
                      
                      <div className="super-cup-team">
                        <div className="team-badge">
                          <div className="team-info" style={{ marginBottom: '4px' }}>
                            {match.awayTeam.logo && (
                              <img 
                                src={match.awayTeam.logo} 
                                alt={match.awayTeam.name} 
                                className={getTeamLogoClass(match.awayTeam.name)}
                                style={{ width: '28px', height: '28px' }}
                              />
                            )}
                            <h4>{match.awayTeam.name}</h4>
                          </div>
                          <small>Cup Winner</small>
                        </div>
                        {match.isPlayed && (
                          <div className="super-cup-score">{match.awayScore}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="super-cup-placeholder">
                  <h3>🏆 Super Cup Final</h3>
                  <p>Waiting for League and Cup to complete...</p>
                  <small>The champions will face off here!</small>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Fixtures/Results */}
      <div className="card">
        <h2>📅 Fixtures & Results</h2>
        
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
                      .filter(match => match.matchweek === week)
                      .map(match => (
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
                          <div>{match.stage || 'Regular'}</div>
                          <div>
                            <span className={`badge ${match.isPlayed ? 'badge-success' : 'badge-warning'}`}>
                              {match.isPlayed ? 'Played' : 'Scheduled'}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                ))}
            </>
          ) : selectedCompetition === 'cup' ? (
          // Group Cup matches by stage
          <>
            {['semi-final', 'final'].map(stage => {
              const stageMatches = matches.filter(match => match.stage === stage);
              if (stageMatches.length === 0) return null;
              
              return (
                <div key={stage} className="matchweek-group">
                  <div className="matchweek-header">
                    <h3>{stage === 'semi-final' ? 'Semi-Finals' : 'Final'}</h3>
                  </div>
                  {stageMatches.map(match => (
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
                      <div>{match.stage || 'Regular'}</div>
                      <div>
                        <span className={`badge ${match.isPlayed ? 'badge-success' : 'badge-warning'}`}>
                          {match.isPlayed ? 'Played' : 'Scheduled'}
                        </span>
                      </div>
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
                {matches.map(match => (
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
                    <div>{match.stage || 'Final'}</div>
                    <div>
                      <span className={`badge ${match.isPlayed ? 'badge-success' : 'badge-warning'}`}>
                        {match.isPlayed ? 'Played' : 'Scheduled'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          // Fallback display for other competitions
          <>
            {matches.map(match => (
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
                <div>{match.stage || 'Regular'}</div>
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
      </div>
    </div>
  );
};

export default UserView;
