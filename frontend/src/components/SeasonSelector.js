import React, { useState, useEffect } from 'react';
import { Calendar, ChevronDown, ChevronUp, BarChart3, Trash2, Check, X, Cog, AlertTriangle, Folder } from 'lucide-react';
import api from '../utils/api';

const SeasonSelector = ({ onSeasonSelect, currentSeason, showArchived = true, isAdmin = false }) => {
  const [seasons, setSeasons] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // Season number to confirm deletion

  useEffect(() => {
    fetchSeasons();
  }, []);

  const fetchSeasons = async () => {
    try {
      const response = await api.get('/seasons');
      setSeasons(response.data);
    } catch (error) {
      console.error('Error fetching seasons:', error);
    }
  };

  const handleSeasonSelect = (season) => {
    onSeasonSelect(season);
    setIsOpen(false);
  };

  const deleteSeason = async (seasonNumber) => {
    try {
      await api.delete(`/seasons/${seasonNumber}`);
      console.log(`✅ Deleted Season ${seasonNumber}`);
      fetchSeasons(); // Refresh the list
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting season:', error);
      alert(`Failed to delete Season ${seasonNumber}. ${error.response?.data?.message || error.message}`);
    }
  };

  const deleteAllSeasons = async () => {
    if (window.confirm('⚠️ Are you sure you want to delete ALL archived seasons? This cannot be undone!')) {
      try {
        await api.delete('/seasons');
        console.log('✅ Deleted all seasons');
        fetchSeasons(); // Refresh the list
        setShowAdminPanel(false);
      } catch (error) {
        console.error('Error deleting all seasons:', error);
        alert(`Failed to delete all seasons. ${error.response?.data?.message || error.message}`);
      }
    }
  };

  return (
    <div className="season-selector">
      <button 
        className="season-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Calendar size={16} /> {currentSeason ? `Season ${currentSeason.seasonNumber}` : 'Current Season'} {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      
      {isOpen && (
        <div className="season-dropdown">
          <div className="season-option current" onClick={() => handleSeasonSelect(null)}>
            Current Season (Live)
          </div>
          
          {showArchived && seasons.length > 0 && (
            <>
              <div className="season-divider">Archived Seasons</div>
              {seasons.map(season => (
                <div 
                  key={season.seasonNumber}
                  className="season-option archived"
                >
                  <div onClick={() => handleSeasonSelect(season)} className="season-info">
                    <BarChart3 size={14} /> Season {season.seasonNumber}
                    <small>
                      {season.winners && season.winners.league && ` • League: ${season.winners.league.name}`}
                      {season.winners && season.winners.cup && ` • Cup: ${season.winners.cup.name}`}
                    </small>
                  </div>
                  {isAdmin && (
                    <div className="season-actions">
                      {deleteConfirm === season.seasonNumber ? (
                        <div className="delete-confirm">
                          <button 
                            className="confirm-delete"
                            onClick={() => deleteSeason(season.seasonNumber)}
                            title="Confirm Delete"
                          >
                            <Check size={14} />
                          </button>
                          <button 
                            className="cancel-delete"
                            onClick={() => setDeleteConfirm(null)}
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button 
                          className="delete-season"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(season.seasonNumber);
                          }}
                          title="Delete Season"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
          
          {showArchived && isAdmin && (
            <>
              <div className="season-divider">Admin Actions</div>
              <div 
                className="season-option admin"
                onClick={() => setShowAdminPanel(!showAdminPanel)}
              >
                <Cog size={14} /> Admin Panel {showAdminPanel ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </div>
              
              {showAdminPanel && (
                <div className="admin-panel">
                  <button 
                    className="admin-action delete-all"
                    onClick={deleteAllSeasons}
                  >
                    <Trash2 size={14} /> Delete All Seasons
                  </button>
                  <small className="admin-warning">
                    <AlertTriangle size={12} /> Use for test data cleanup
                  </small>
                </div>
              )}
            </>
          )}
          
          {seasons.length === 0 && showArchived && (
            <div className="season-option disabled">
              <Folder size={14} /> No archived seasons yet
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SeasonSelector;
