import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import api from '../utils/api';
import { getArchivedTeams, archivedTeamPath } from '../utils/archiveTeamModel';
import { seasonSelectorLabel } from '../utils/archiveSeasonModel';
import '../pages/ArchivedCompetitionPage.css';
import './ArchivedTeamsPage.css';

function teamCardLogoStyle(name) {
  const falcons = name === 'Falcons';
  return {
    width: 80,
    height: 80,
    maxWidth: '26vw',
    maxHeight: '26vw',
    objectFit: 'contain',
    backgroundColor: falcons ? '#94a3b8' : 'transparent',
    padding: falcons ? '4px' : '0',
    borderRadius: '10px',
    boxSizing: 'border-box',
  };
}

export default function ArchivedTeamsPage() {
  const { seasonNumber } = useParams();
  const [season, setSeason] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get(`/seasons/${seasonNumber}`);
        if (!cancelled) setSeason(data);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to load archived season');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [seasonNumber]);

  const teams = useMemo(() => (season ? getArchivedTeams(season) : []), [season]);

  return (
    <div className="archived-teams-page">
      <Link to="/archived" className="archived-competition-back">
        <ArrowLeft size={18} aria-hidden="true" />
        Back to archives
      </Link>

      <header className="archived-teams-header">
        <Users size={24} aria-hidden="true" />
        <div>
          <h1>Historical Teams</h1>
          {season && (
            <p>{seasonSelectorLabel(season)} · squads frozen at archive time</p>
          )}
        </div>
      </header>

      {loading && (
        <div className="archived-competition-state">
          <div className="loading-spinner" />
          <p>Loading teams…</p>
        </div>
      )}

      {!loading && error && (
        <div className="archived-competition-state archived-competition-error">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && teams.length === 0 && (
        <div className="archived-competition-state">
          <p>No team snapshots recorded for this archive.</p>
        </div>
      )}

      {!loading && !error && teams.length > 0 && (
        <div className="teams-page">
          <div className="team-cards">
            {teams.map((t) => (
              <Link
                key={t._id}
                to={archivedTeamPath(seasonNumber, t._id)}
                className="team-card archive-team-card-link"
                style={{ padding: '10px 12px', textDecoration: 'none', color: 'inherit' }}
              >
                <img src={t.logo} alt={t.name} style={teamCardLogoStyle(t.name)} />
                <span style={{ marginTop: 8, fontWeight: 600 }}>{t.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
