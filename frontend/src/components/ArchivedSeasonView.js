import React, { useState } from 'react';

const ArchivedSeasonView = ({ season, onBackToLive }) => {
  const [selectedCompetition, setSelectedCompetition] = useState('league');

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const getTeamLogoClass = (teamName) => {
    if (!teamName) return 'team-logo';
    const lowerName = teamName.toLowerCase();
    if (lowerName.includes('warriors')) return 'team-logo warriors-logo';
    if (lowerName.includes('falcons')) return 'team-logo falcons-logo';
    if (lowerName.includes('lions')) return 'team-logo lions-logo';
    if (lowerName.includes('vikings')) return 'team-logo vikings-logo';
    if (lowerName.includes('elites')) return 'team-logo elites-logo';
    if (lowerName.includes('dragons')) return 'team-logo dragons-logo';
    return 'team-logo';
  };

  // Helper function to get team display name
  const getTeamDisplayName = (standing) => {
    // Check if the team reference is populated (new format)
    if (standing.team?.name) {
      return standing.team.name;
    }
    
    // If team is just an ObjectId, try to find it in the teams array
    if (typeof standing.team === 'string' || standing.team?._id) {
      const teamId = typeof standing.team === 'string' ? standing.team : standing.team._id;
      const teamData = season.teams?.find(t => t._id === teamId);
      if (teamData) {
        return teamData.name;
      }
    }
    
    // Debug logging for troubleshooting
    console.log('⚠️ Could not find team name for standing:', {
      teamData: standing.team,
      teamType: typeof standing.team,
      position: standing.position,
      availableTeams: season.teams?.map(t => ({ id: t._id, name: t.name }))
    });
    
    // Fallback for missing data
    return `Team ${standing.position}`;
  };

  // Helper function to get team logo
  const getTeamLogo = (standing) => {
    // Check if the team reference is populated (new format)
    if (standing.team?.logo) {
      return standing.team.logo;
    }
    
    // If team is just an ObjectId, try to find it in the teams array
    if (typeof standing.team === 'string' || standing.team?._id) {
      const teamId = typeof standing.team === 'string' ? standing.team : standing.team._id;
      const teamData = season.teams?.find(t => t._id === teamId);
      if (teamData?.logo) {
        return teamData.logo;
      }
    }
    
    // Fallback to default local logos based on team name
    const teamName = getTeamDisplayName(standing);
    const defaultLogos = {
      'Warriors': '/logos/warriors-logo.png',
      'Falcons': '/logos/falcons-logo.png',
      'Lions': '/logos/lions-logo.png',
      'Vikings': '/logos/vikings-logo.png',
      'Elites': '/logos/elites-logo.png',
      'Dragons': '/logos/dragons-logo.png'
    };
    
    return defaultLogos[teamName] || `https://via.placeholder.com/32x32/667eea/ffffff?text=${teamName.charAt(0)}`;
  };

  const renderArchivedLeagueTable = () => {
    return (
      <div className="table-container responsive-table">
        <div className="archived-badge">📊 Archived Season {season.seasonNumber}</div>
        <div className="table-wrapper">
          <table className="league-table">
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
            {season.finalStandings.map((standing, index) => {
              const teamName = getTeamDisplayName(standing);
              const teamLogo = getTeamLogo(standing);
              
              return (
                <tr 
                  key={standing.team?._id || standing.team || `team-${index}`}
                  className={index < 2 ? 'agha-cup-position' : ''}
                >
                  <td className="position">{standing.position}</td>
                  <td className="team-cell">
                    <div className="team-info">
                      {teamLogo && (
                        <img 
                          src={teamLogo} 
                          alt={teamName} 
                          className={getTeamLogoClass(teamName)}
                        />
                      )}
                      <span className="team-name">
                        {teamName}
                      </span>
                    </div>
                  </td>
                  <td>{standing.played}</td>
                  <td>{standing.won}</td>
                  <td>{standing.drawn}</td>
                  <td>{standing.lost}</td>
                  <td>{standing.goalsFor}</td>
                  <td>{standing.goalsAgainst}</td>
                  <td className={standing.goalDifference >= 0 ? 'positive' : 'negative'}>
                    {standing.goalDifference >= 0 ? '+' : ''}{standing.goalDifference}
                  </td>
                  <td className="points">{standing.points}</td>
                  <td>
                    {standing.form && standing.form.length > 0 ? (
                      <div className="form-display">
                        {standing.form.map((result, idx) => (
                          <span
                            key={idx}
                            className={`form-result ${result.toLowerCase()}`}
                            title={result === 'W' ? 'Win' : result === 'D' ? 'Draw' : 'Loss'}
                          >
                            {result}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="no-form">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    );
  };

  // Helper function to get team display name for matches
  const getMatchTeamName = (team) => {
    // Check if the team reference is populated
    if (team?.name) {
      return team.name;
    }
    
    // If team is just an ObjectId, try to find it in the teams array
    if (typeof team === 'string' || team?._id) {
      const teamId = typeof team === 'string' ? team : team._id;
      const teamData = season.teams?.find(t => t._id === teamId);
      if (teamData) {
        return teamData.name;
      }
    }
    
    // Debug logging for troubleshooting
    console.log('⚠️ Could not find match team name:', {
      teamData: team,
      teamType: typeof team,
      availableTeams: season.teams?.map(t => ({ id: t._id, name: t.name }))
    });
    
    // Fallback
    return 'Unknown Team';
  };

  // Helper function to get team logo for matches
  const getMatchTeamLogo = (team) => {
    // Check if the team reference is populated
    if (team?.logo) {
      return team.logo;
    }
    
    // If team is just an ObjectId, try to find it in the teams array
    if (typeof team === 'string' || team?._id) {
      const teamId = typeof team === 'string' ? team : team._id;
      const teamData = season.teams?.find(t => t._id === teamId);
      if (teamData?.logo) {
        return teamData.logo;
      }
    }
    
    // Fallback to default logos based on team name
    const teamName = getMatchTeamName(team);
    const defaultLogos = {
      'Warriors': '/logos/warriors-logo.png',
      'Falcons': '/logos/falcons-logo.png',
      'Lions': '/logos/lions-logo.png',
      'Vikings': '/logos/vikings-logo.png',
      'Elites': '/logos/elites-logo.png',
      'Dragons': '/logos/dragons-logo.png'
    };
    
    return defaultLogos[teamName] || `https://via.placeholder.com/32x32/667eea/ffffff?text=${teamName.charAt(0)}`;
  };

  const renderArchivedMatches = (competition) => {
    const competitionMatches = season.matches.filter(m => m.competition === competition);
    
    if (competitionMatches.length === 0) {
      return <div className="no-matches">No matches found for this competition.</div>;
    }

    if (competition === 'league') {
      // Group by matchweek
      const matchweeks = {};
      competitionMatches.forEach(match => {
        if (!matchweeks[match.matchweek]) {
          matchweeks[match.matchweek] = [];
        }
        matchweeks[match.matchweek].push(match);
      });

      return Object.keys(matchweeks).sort((a, b) => parseInt(a) - parseInt(b)).map(mw => (
        <div key={mw} className="matchweek-section">
          <h3>Matchweek {mw}</h3>
          <div className="matches-list">
            {matchweeks[mw].map((match, matchIndex) => {
              const homeTeamName = getMatchTeamName(match.homeTeam);
              const awayTeamName = getMatchTeamName(match.awayTeam);
              const homeTeamLogo = getMatchTeamLogo(match.homeTeam);
              const awayTeamLogo = getMatchTeamLogo(match.awayTeam);
              
              return (
                <div key={match._id} className="match-item archived">
                  <div className="match-teams">
                    <div className="team home-team">
                      {homeTeamLogo && (
                        <img 
                          src={homeTeamLogo} 
                          alt={homeTeamName} 
                          className={getTeamLogoClass(homeTeamName)}
                        />
                      )}
                      <span className="team-name">{homeTeamName}</span>
                    </div>
                    <div className="match-score">
                      {match.isPlayed ? (
                        <span className="score">{match.homeScore} - {match.awayScore}</span>
                      ) : (
                        <span className="vs">vs</span>
                      )}
                    </div>
                    <div className="team away-team">
                      <span className="team-name">{awayTeamName}</span>
                      {awayTeamLogo && (
                        <img 
                          src={awayTeamLogo} 
                          alt={awayTeamName} 
                          className={getTeamLogoClass(awayTeamName)}
                        />
                      )}
                    </div>
                  </div>
                  <div className="match-info">
                    <div>{formatDate(match.date)}</div>
                    <div>{match.time}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ));
    } else {
      // Cup and Super Cup matches
      const stages = ['semi-final', 'final'];
      return stages.map(stage => {
        const stageMatches = competitionMatches.filter(m => m.stage === stage);
        if (stageMatches.length === 0) return null;

        return (
          <div key={stage} className="cup-stage">
            <h3>{stage === 'semi-final' ? 'Semi-Finals' : 'Final'}</h3>
            <div className="matches-list">
              {stageMatches.map((match, matchIndex) => {
                const homeTeamName = getMatchTeamName(match.homeTeam);
                const awayTeamName = getMatchTeamName(match.awayTeam);
                const homeTeamLogo = getMatchTeamLogo(match.homeTeam);
                const awayTeamLogo = getMatchTeamLogo(match.awayTeam);
                
                return (
                  <div key={match._id} className="match-item archived">
                    <div className="match-teams">
                      <div className="team home-team">
                        {homeTeamLogo && (
                          <img 
                            src={homeTeamLogo} 
                            alt={homeTeamName} 
                            className={getTeamLogoClass(homeTeamName)}
                          />
                        )}
                        <span className="team-name">{homeTeamName}</span>
                      </div>
                      <div className="match-score">
                        {match.isPlayed ? (
                          <div>
                            <span className="score">{match.homeScore} - {match.awayScore}</span>
                            {match.homePenalties !== null && match.awayPenalties !== null && (
                              <div className="penalties">
                                ({match.homePenalties} - {match.awayPenalties} pens)
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="vs">vs</span>
                        )}
                      </div>
                      <div className="team away-team">
                        <span className="team-name">{awayTeamName}</span>
                        {awayTeamLogo && (
                          <img 
                            src={awayTeamLogo} 
                            alt={awayTeamName} 
                            className={getTeamLogoClass(awayTeamName)}
                          />
                        )}
                      </div>
                    </div>
                    <div className="match-info">
                      <div>{formatDate(match.date)}</div>
                      <div>{match.time}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      });
    }
  };

  return (
    <div className="archived-season-view">
      <div className="season-header">
        {/* Back Button */}
        <button className="back-to-live-btn" onClick={onBackToLive}>
          ← Back to Live Season
        </button>
        
        <h1>📊 Season {season.seasonNumber} Archive</h1>
        <div className="season-info">
          <span>📅 {formatDate(season.startDate)} - {formatDate(season.endDate)}</span>
        </div>
        
        {/* Winners Summary */}
        <div className="winners-summary">
          {season.winners.league && (
            <div className="winner-badge league-winner">
              🏆 League Champion: {season.winners.league.name}
            </div>
          )}
          {season.winners.cup && (
            <div className="winner-badge cup-winner">
              🏆 Cup Winner: {season.winners.cup.name}
            </div>
          )}
          {season.winners.superCup && (
            <div className="winner-badge supercup-winner">
              🏆 Super Cup Winner: {season.winners.superCup.name}
            </div>
          )}
        </div>
      </div>

      {/* Competition Selector */}
      <div className="competition-selector">
        <button 
          className={selectedCompetition === 'league' ? 'active' : ''}
          onClick={() => setSelectedCompetition('league')}
        >
          🏆 League
        </button>
        <button 
          className={selectedCompetition === 'cup' ? 'active' : ''}
          onClick={() => setSelectedCompetition('cup')}
        >
          🏆 Cup
        </button>
        <button 
          className={selectedCompetition === 'super-cup' ? 'active' : ''}
          onClick={() => setSelectedCompetition('super-cup')}
        >
          ⭐ Super Cup
        </button>
      </div>

      {/* Competition Content */}
      <div className="competition-content">
        {selectedCompetition === 'league' && (
          <div className="league-section">
            <h2>📊 Final League Table</h2>
            {renderArchivedLeagueTable()}
            <h2>📋 League Fixtures & Results</h2>
            {renderArchivedMatches('league')}
          </div>
        )}

        {selectedCompetition === 'cup' && (
          <div className="cup-section">
            <h2>🏆 Cup Tournament</h2>
            {renderArchivedMatches('cup')}
          </div>
        )}

        {selectedCompetition === 'super-cup' && (
          <div className="super-cup-section">
            <h2>⭐ Super Cup</h2>
            {renderArchivedMatches('super-cup')}
          </div>
        )}
      </div>
    </div>
  );
};

export default ArchivedSeasonView;
