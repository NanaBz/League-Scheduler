import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../utils/api';
import { getArchivedTeam, archivedTeamsListPath } from '../utils/archiveTeamModel';
import ArchivedTeamDetailView from '../components/archive/ArchivedTeamDetailView';
import '../pages/ArchivedCompetitionPage.css';

export default function ArchivedTeamDetailPage() {
  const { seasonNumber, teamId } = useParams();
  const navigate = useNavigate();
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

  const team = useMemo(
    () => (season ? getArchivedTeam(season, teamId) : null),
    [season, teamId]
  );

  return (
    <div className="archived-teams-page archived-teams-page--detail">
      <Link to={archivedTeamsListPath(seasonNumber)} className="archived-competition-back">
        <ArrowLeft size={18} aria-hidden="true" />
        Back to historical teams
      </Link>

      {loading && (
        <div className="archived-competition-state">
          <div className="loading-spinner" />
          <p>Loading team archive…</p>
        </div>
      )}

      {!loading && error && (
        <div className="archived-competition-state archived-competition-error">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && !team && (
        <div className="archived-competition-state">
          <p>Team not found in this archive.</p>
        </div>
      )}

      {!loading && !error && team && season && (
        <div className="teams-page">
          <ArchivedTeamDetailView
            season={season}
            team={team}
            onBack={() => navigate(archivedTeamsListPath(seasonNumber))}
            backLabel="Back to historical teams"
          />
        </div>
      )}
    </div>
  );
}
