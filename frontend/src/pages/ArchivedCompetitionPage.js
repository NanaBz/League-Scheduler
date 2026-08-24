import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Archive } from 'lucide-react';
import api from '../utils/api';
import {
  getCompetitionBySlug,
  seasonSelectorLabel,
} from '../utils/archiveSeasonModel';
import ArchivedCompetitionDetail from '../components/archive/ArchivedCompetitionDetail';
import './ArchivedCompetitionPage.css';

export default function ArchivedCompetitionPage() {
  const { seasonNumber, competitionSlug } = useParams();
  const competition = getCompetitionBySlug(competitionSlug);
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

  if (!competition) {
    return (
      <div className="archived-competition-page">
        <Link to="/archived" className="archived-competition-back">
          <ArrowLeft size={18} aria-hidden="true" />
          Back to archives
        </Link>
        <div className="archived-competition-state">Unknown competition.</div>
      </div>
    );
  }

  return (
    <div className="archived-competition-page archived-competition-page--wide">
      <Link to="/archived" className="archived-competition-back">
        <ArrowLeft size={18} aria-hidden="true" />
        Back to archives
      </Link>

      {loading && (
        <div className="archived-competition-state">
          <div className="loading-spinner" />
          <p>Loading archive…</p>
        </div>
      )}

      {!loading && error && (
        <div className="archived-competition-state archived-competition-error">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && season && (
        <>
          <header className="archived-competition-header">
            <div className="archived-competition-header-icon" aria-hidden="true">
              <Archive size={24} />
            </div>
            <div>
              <p className="archived-competition-eyebrow">{seasonSelectorLabel(season)} · Archived</p>
              <h2>{competition.label}</h2>
              <p className="archived-competition-sub">{competition.tagline}</p>
            </div>
          </header>

          <ArchivedCompetitionDetail season={season} competition={competition} />
        </>
      )}
    </div>
  );
}
