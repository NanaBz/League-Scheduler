import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../utils/api';

const TeamSelection = ({ match, onSave, onClose }) => {
  const [homeLineup, setHomeLineup] = useState({
    gk: [],
    df: [],
    mf: [],
    att: []
  });

  const [awayLineup, setAwayLineup] = useState({
    gk: [],
    df: [],
    mf: [],
    att: []
  });

  const [homePlayers, setHomePlayers] = useState([]);
  const [awayPlayers, setAwayPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load existing lineup and fetch players
  useEffect(() => {
    const loadData = async () => {
      try {
        // Debug: Log match data
        console.log('TeamSelection received match:', match);
        console.log('Home Team ID:', match?.homeTeam?._id);
        console.log('Away Team ID:', match?.awayTeam?._id);

        if (!match?.homeTeam?._id || !match?.awayTeam?._id) {
          console.error('❌ Match or team IDs not available!', {
            homeTeamId: match?.homeTeam?._id,
            awayTeamId: match?.awayTeam?._id
          });
          alert('Error: Team IDs not found. Make sure teams are properly linked to the match.');
          setLoading(false);
          return;
        }

        // Fetch players for both teams
        console.log('Fetching players for home team:', match.homeTeam._id);
        console.log('Fetching players for away team:', match.awayTeam._id);
        
        const homeUrl = `/players?teamId=${match.homeTeam._id}`;
        const awayUrl = `/players?teamId=${match.awayTeam._id}`;
        
        console.log('Home URL:', homeUrl);
        console.log('Away URL:', awayUrl);
        
        const homePlayersRes = await api.get(homeUrl);
        const awayPlayersRes = await api.get(awayUrl);

        console.log('Home API response:', homePlayersRes.data);
        console.log('Away API response:', awayPlayersRes.data);

        setHomePlayers(homePlayersRes.data || []);
        setAwayPlayers(awayPlayersRes.data || []);

        // Load existing lineup if available
        if (match.startingLineup && match.startingLineup.homeTeam) {
          setHomeLineup({
            gk: match.startingLineup.homeTeam.gk || [],
            df: match.startingLineup.homeTeam.df || [],
            mf: match.startingLineup.homeTeam.mf || [],
            att: match.startingLineup.homeTeam.att || []
          });
        }

        if (match.startingLineup && match.startingLineup.awayTeam) {
          setAwayLineup({
            gk: match.startingLineup.awayTeam.gk || [],
            df: match.startingLineup.awayTeam.df || [],
            mf: match.startingLineup.awayTeam.mf || [],
            att: match.startingLineup.awayTeam.att || []
          });
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        alert('Error loading players: ' + (error.response?.data?.message || error.message));
        setLoading(false);
      }
    };

    loadData();
  }, [match]);

  // Get selected player IDs
  const getSelectedHomePlayerIds = () => {
    return [
      ...homeLineup.gk.map(p => (typeof p === 'object' ? p._id : p)),
      ...homeLineup.df.map(p => (typeof p === 'object' ? p._id : p)),
      ...homeLineup.mf.map(p => (typeof p === 'object' ? p._id : p)),
      ...homeLineup.att.map(p => (typeof p === 'object' ? p._id : p))
    ];
  };

  const getSelectedAwayPlayerIds = () => {
    return [
      ...awayLineup.gk.map(p => (typeof p === 'object' ? p._id : p)),
      ...awayLineup.df.map(p => (typeof p === 'object' ? p._id : p)),
      ...awayLineup.mf.map(p => (typeof p === 'object' ? p._id : p)),
      ...awayLineup.att.map(p => (typeof p === 'object' ? p._id : p))
    ];
  };

  // Add player to position
  const addPlayerToTeam = (team, position, player) => {
    const constraints = { gk: 1, df: 4, mf: 4, att: 3 };
    const currentCount = team === 'home' ? homeLineup[position].length : awayLineup[position].length;

    if (currentCount >= constraints[position]) {
      alert(`Maximum ${constraints[position]} ${position.toUpperCase()} players allowed`);
      return;
    }

    const setLineup = team === 'home' ? setHomeLineup : setAwayLineup;
    const lineup = team === 'home' ? homeLineup : awayLineup;

    setLineup({
      ...lineup,
      [position]: [...lineup[position], player]
    });
  };

  // Remove player from position
  const removePlayerFromTeam = (team, position, playerIndex) => {
    const setLineup = team === 'home' ? setHomeLineup : setAwayLineup;
    const lineup = team === 'home' ? homeLineup : awayLineup;

    setLineup({
      ...lineup,
      [position]: lineup[position].filter((_, idx) => idx !== playerIndex)
    });
  };

  // Position configuration
  const positionConfig = {
    gk: { label: 'Goalkeeper', min: 1, max: 1, abbr: 'GK' },
    df: { label: 'Defenders', min: 2, max: 4, abbr: 'DF' },
    mf: { label: 'Midfielders', min: 2, max: 4, abbr: 'MF' },
    att: { label: 'Attackers', min: 1, max: 3, abbr: 'ATT' }
  };

  // Validate lineup
  const isLineupValid = (lineup) => {
    return (
      lineup.gk.length === 1 &&
      lineup.df.length >= 2 && lineup.df.length <= 4 &&
      lineup.mf.length >= 2 && lineup.mf.length <= 4 &&
      lineup.att.length >= 1 && lineup.att.length <= 3
    );
  };

  const isHomeValid = isLineupValid(homeLineup);
  const isAwayValid = isLineupValid(awayLineup);

  const handleSave = async () => {
    if (!isHomeValid) {
      alert('Home team lineup is invalid');
      return;
    }

    if (!isAwayValid) {
      alert('Away team lineup is invalid');
      return;
    }

    setSaving(true);
    try {
      // Convert to IDs for API
      const homeData = {
        gk: homeLineup.gk.map(p => (typeof p === 'object' ? p._id : p)),
        df: homeLineup.df.map(p => (typeof p === 'object' ? p._id : p)),
        mf: homeLineup.mf.map(p => (typeof p === 'object' ? p._id : p)),
        att: homeLineup.att.map(p => (typeof p === 'object' ? p._id : p))
      };

      const awayData = {
        gk: awayLineup.gk.map(p => (typeof p === 'object' ? p._id : p)),
        df: awayLineup.df.map(p => (typeof p === 'object' ? p._id : p)),
        mf: awayLineup.mf.map(p => (typeof p === 'object' ? p._id : p)),
        att: awayLineup.att.map(p => (typeof p === 'object' ? p._id : p))
      };

      await api.put(`/matches/${match._id}/starting-lineup`, {
        homeLineup: homeData,
        awayLineup: awayData
      });

      alert('Lineups saved successfully!');
      onSave();
    } catch (error) {
      console.error('Error saving lineups:', error);
      alert('Error saving lineups: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const TeamSelectionSection = ({ team, lineup, setLineup, players, selectedIds }) => {
    const teamName = team === 'home' ? match.homeTeam.name : match.awayTeam.name;
    
    console.log(`📊 TeamSelectionSection for ${teamName}:`, {
      totalPlayers: players.length,
      selectedIds: selectedIds,
      lineup: lineup
    });
    
    const getAvailablePlayers = (position) => {
      // Show ALL players regardless of position - allow flexibility for out-of-position play
      const available = players.filter(p => !selectedIds.includes(p._id));
      console.log(`🔍 Available players for ${teamName} - ${position}:`, available.length, 'out of', players.length);
      return available;
    };

    return (
      <div style={styles.teamSection}>
        <h2 style={styles.teamTitle}>{teamName} - Team Selection</h2>

        {Object.entries(positionConfig).map(([pos, config]) => (
          <div key={pos} style={styles.positionBlock}>
            <div style={styles.positionHeader}>
              <span>
                {config.abbr} - {config.label}
              </span>
              <span style={styles.counter}>
                {lineup[pos].length}/{config.max}
              </span>
            </div>

            {/* Selected Players */}
            <div style={styles.selectedPlayers}>
              {lineup[pos].length === 0 ? (
                <p style={styles.emptyText}>No players selected</p>
              ) : (
                lineup[pos].map((player, idx) => (
                  <div key={idx} style={styles.selectedPlayer}>
                    <span>
                      {typeof player === 'object' ? player.name : player}
                      {typeof player === 'object' && player.number && ` (#${player.number})`}
                    </span>
                    <button
                      onClick={() => removePlayerFromTeam(team, pos, idx)}
                      style={styles.removeBtn}
                      title="Remove player"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add Player */}
            {lineup[pos].length < config.max && (
              <div style={styles.addPlayerSection}>
                {players.length === 0 ? (
                  <p style={{ ...styles.warningText, marginTop: '8px' }}>
                    ⚠️ No players found for {teamName}. Check player management.
                  </p>
                ) : getAvailablePlayers(pos).length === 0 ? (
                  <p style={{ ...styles.warningText, marginTop: '8px' }}>
                    All players already selected
                  </p>
                ) : (
                  <>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          const player = players.find(p => p._id === e.target.value);
                          console.log('Selected player:', player);
                          addPlayerToTeam(team, pos, player);
                          e.target.value = '';
                        }
                      }}
                      className="player-select-dropdown"
                      style={{
                        width: '100%',
                        padding: '10px',
                        fontSize: '14px',
                        border: '2px solid #007bff',
                        borderRadius: '4px',
                        backgroundColor: 'white',
                        color: 'black',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="" style={{ color: 'black' }}>+ Add {config.abbr} ({getAvailablePlayers(pos).length} available)</option>
                      {getAvailablePlayers(pos).map(player => (
                        <option key={player._id} value={player._id} style={{ color: 'black', backgroundColor: 'white' }}>
                          {player.name} {player.number ? `(#${player.number})` : ''} - {player.position}
                        </option>
                      ))}
                    </select>
                    <small style={{ display: 'block', marginTop: '4px', color: '#666' }}>
                      {getAvailablePlayers(pos).length} players available
                    </small>
                  </>
                )}
              </div>
            )}

            {/* Validation Message */}
            {lineup[pos].length < config.min && (
              <p style={styles.warningText}>
                Minimum {config.min} {config.abbr} required
              </p>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ marginBottom: '10px' }}>Loading players...</p>
          <small style={{ color: '#999' }}>Fetching {match.homeTeam.name} and {match.awayTeam.name} players</small>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>Team Selection | Starting Lineup</h1>
        <button onClick={onClose} style={styles.closeBtn} title="Close">
          <X size={24} />
        </button>
      </div>

      <div style={styles.content}>
        <div style={styles.teamGrid}>
          <TeamSelectionSection
            team="home"
            lineup={homeLineup}
            setLineup={setHomeLineup}
            players={homePlayers}
            selectedIds={getSelectedHomePlayerIds()}
          />
          <TeamSelectionSection
            team="away"
            lineup={awayLineup}
            setLineup={setAwayLineup}
            players={awayPlayers}
            selectedIds={getSelectedAwayPlayerIds()}
          />
        </div>
      </div>

      <div style={styles.footer}>
        <button
          onClick={handleSave}
          disabled={!isHomeValid || !isAwayValid || saving}
          style={{
            ...styles.saveBtn,
            ...((!isHomeValid || !isAwayValid || saving) && styles.saveBtnDisabled)
          }}
        >
          {saving ? 'Saving...' : 'Save Lineups'}
        </button>
        <button onClick={onClose} style={styles.cancelBtn}>
          Cancel
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    padding: '20px',
    maxHeight: '90vh',
    overflow: 'auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '15px',
    borderBottom: '2px solid #ddd'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#666',
    padding: '4px',
    display: 'flex',
    alignItems: 'center'
  },
  content: {
    marginBottom: '20px'
  },
  teamGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr'
    }
  },
  teamSection: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  teamTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '16px',
    color: '#333'
  },
  positionBlock: {
    marginBottom: '16px',
    padding: '12px',
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
    borderLeft: '4px solid #007bff'
  },
  positionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: 'bold',
    marginBottom: '10px',
    color: '#333'
  },
  counter: {
    backgroundColor: '#007bff',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '12px'
  },
  selectedPlayers: {
    marginBottom: '10px',
    minHeight: '40px'
  },
  selectedPlayer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#e7f3ff',
    padding: '8px 10px',
    marginBottom: '6px',
    borderRadius: '4px',
    fontSize: '14px'
  },
  removeBtn: {
    background: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    fontSize: '12px',
    transition: 'background-color 0.2s'
  },
  emptyText: {
    color: '#999',
    fontSize: '13px',
    fontStyle: 'italic',
    margin: '0'
  },
  addPlayerSection: {
    marginBottom: '10px'
  },
  playerSelect: {
    width: '100%',
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '14px',
    cursor: 'pointer',
    backgroundColor: '#fff',
    color: '#333',
    minHeight: '38px'
  },
  warningText: {
    color: '#dc3545',
    fontSize: '12px',
    margin: '6px 0 0 0'
  },
  footer: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
    borderTop: '1px solid #ddd',
    paddingTop: '15px'
  },
  saveBtn: {
    backgroundColor: '#28a745',
    color: 'white',
    padding: '10px 20px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
    transition: 'background-color 0.2s'
  },
  saveBtnDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
    opacity: 0.6
  },
  cancelBtn: {
    backgroundColor: '#6c757d',
    color: 'white',
    padding: '10px 20px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
    transition: 'background-color 0.2s'
  }
};

export default TeamSelection;
