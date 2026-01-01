import React, { useState, useEffect } from 'react';
import { X, AlertCircle, AlertTriangle } from 'lucide-react';
import api from '../utils/api';

const EditPlayerAvailability = ({ onClose, onSuccess }) => {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(''); // Search filter

  // Dialog form state
  const [availabilityType, setAvailabilityType] = useState('injured'); // 'injured' or 'unknown'
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState(50); // 25, 50, 75 (% chance of playing)

  // Fetch teams on mount
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await api.get('/teams');
        setTeams(response.data.filter(t => t && t.name));
      } catch (error) {
        console.error('Error fetching teams:', error);
      }
    };
    fetchTeams();
  }, []);

  // Fetch players when team is selected
  useEffect(() => {
    if (selectedTeam) {
      const fetchPlayers = async () => {
        try {
          const response = await api.get(`/players?team=${selectedTeam._id}`);
          const teamPlayers = response.data.filter(p => p && p.name && p.team && p.team._id === selectedTeam._id);
          setPlayers(teamPlayers);
          setSearchQuery(''); // Reset search when team changes
        } catch (error) {
          console.error('Error fetching players:', error);
          setPlayers([]);
        }
      };
      fetchPlayers();
    } else {
      setPlayers([]);
    }
  }, [selectedTeam]);

  const getTeamLogoClass = (teamName) => {
    return `team-logo ${teamName.toLowerCase()}-logo`;
  };

  const getSeverityColor = (value) => {
    if (value === 75) return '#fff3cd'; // Light yellow
    if (value === 50) return '#ffe680'; // Medium yellow
    if (value === 25) return '#ffcc00'; // Dark yellow
    return '#fff3cd';
  };

  const getSeverityLabel = (value) => {
    if (value === 75) return '75% (Light - Likely to play)';
    if (value === 50) return '50% (Medium - Uncertain)';
    if (value === 25) return '25% (Severe - Unlikely to play)';
    return '';
  };

  // Filter players based on search query
  const filteredPlayers = players.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectPlayer = (player) => {
    setSelectedPlayer(player);
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!selectedPlayer || !description.trim()) {
      alert('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      // Get current matchweek from available matches or default to 1
      const currentMatchweek = 1; // Can be dynamic from backend if needed
      
      await api.post(`/fantasy/admin/players/${selectedPlayer._id}/availability`, {
        matchweek: currentMatchweek,
        injuryDetails: `${availabilityType === 'injured' ? 'Injury' : 'Unknown Status'}: ${description}`,
        chanceOfPlaying: severity
      });

      // Reset form
      setShowDialog(false);
      setSelectedPlayer(null);
      setDescription('');
      setSeverity(50);
      setAvailabilityType('injured');

      if (onSuccess) onSuccess();
      alert('Player availability updated successfully');
    } catch (error) {
      console.error('Error updating availability:', error);
      alert('Failed to update player availability');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
          Select a Team
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '12px'
        }}>
          {teams.map(team => (
            <div
              key={team._id}
              onClick={() => {
                setSelectedTeam(team);
                setSelectedPlayer(null);
              }}
              style={{
                padding: '12px',
                border: selectedTeam?._id === team._id ? '3px solid #007bff' : '2px solid #ddd',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'center',
                backgroundColor: selectedTeam?._id === team._id ? '#e7f3ff' : '#fff',
                transition: 'all 0.2s'
              }}
            >
              {team.logo && (
                <img
                  src={team.logo}
                  alt={team.name}
                  className={getTeamLogoClass(team.name)}
                  style={{ width: '40px', height: '40px', marginBottom: '8px' }}
                />
              )}
              <div style={{ fontSize: '12px', fontWeight: 600 }}>{team.name}</div>
            </div>
          ))}
        </div>
      </div>

      {selectedTeam && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
            Select a Player from {selectedTeam.name}
          </h3>
          
          {/* Search Input */}
          <div style={{ marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="🔍 Search player name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '2px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
            />
            {searchQuery && (
              <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                Found {filteredPlayers.length} player{filteredPlayers.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Player Grid */}
          {filteredPlayers.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '20px', 
              color: '#666', 
              backgroundColor: '#f9f9f9',
              borderRadius: '6px'
            }}>
              {searchQuery ? 'No players found matching your search' : 'No players available'}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: '8px'
            }}>
              {filteredPlayers.map(player => (
                <div
                  key={player._id}
                  onClick={() => handleSelectPlayer(player)}
                  style={{
                    padding: '12px',
                    border: '2px solid #ddd',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: '#f9f9f9',
                    transition: 'all 0.2s',
                    ':hover': { backgroundColor: '#f0f0f0', borderColor: '#999' }
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#333' }}>
                    {player.name}
                  </div>
                  <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
                    {player.position || 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dialog Modal */}
      {showDialog && selectedPlayer && (
        <div style={{
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
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
                {selectedPlayer.name}
              </h2>
              <button
                onClick={() => setShowDialog(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={24} color="#999" />
              </button>
            </div>

            {/* Type Selection */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#666' }}>
                Status Type
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setAvailabilityType('injured')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: availabilityType === 'injured' ? '2px solid #dc3545' : '2px solid #ddd',
                    borderRadius: '6px',
                    backgroundColor: availabilityType === 'injured' ? '#ffe9ec' : '#fff',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <AlertTriangle size={16} />
                  Injury
                </button>
                <button
                  onClick={() => setAvailabilityType('unknown')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: availabilityType === 'unknown' ? '2px solid #ffc107' : '2px solid #ddd',
                    borderRadius: '6px',
                    backgroundColor: availabilityType === 'unknown' ? '#fff8e1' : '#fff',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <AlertCircle size={16} />
                  Unknown
                </button>
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#666' }}>
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Knee injury, Calf strain, Muscle fatigue"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Severity */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#666' }}>
                Chance of Playing
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[75, 50, 25].map(value => (
                  <button
                    key={value}
                    onClick={() => setSeverity(value)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      border: severity === value ? '3px solid #333' : '2px solid #ddd',
                      borderRadius: '6px',
                      backgroundColor: severity === value ? getSeverityColor(value) : '#f9f9f9',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '12px'
                    }}
                  >
                    {value}%
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '11px', color: '#666', marginTop: '8px', fontStyle: 'italic' }}>
                {getSeverityLabel(severity)}
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowDialog(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: '2px solid #ddd',
                  borderRadius: '6px',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: loading ? '#ccc' : '#28a745',
                  color: '#fff',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '14px'
                }}
              >
                {loading ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditPlayerAvailability;
