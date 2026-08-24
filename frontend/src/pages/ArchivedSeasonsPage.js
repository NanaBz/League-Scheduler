import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Trash2, Users } from 'lucide-react';
import api from '../utils/api';
import { sortArchivedSeasons, ARCHIVED_COMPETITIONS } from '../utils/archiveSeasonModel';
import { archivedTeamsListPath } from '../utils/archiveTeamModel';
import ArchivedSeasonSelector from '../components/ArchivedSeasonSelector';
import ArchivedCompetitionCard from '../components/ArchivedCompetitionCard';

import './ArchivedSeasonsPage.css';
import './ArchivedTeamsPage.css';



export default function ArchivedSeasonsPage({ isAdmin = false }) {

  const [seasons, setSeasons] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);

  const [selectedId, setSelectedId] = useState(null);

  const [deleting, setDeleting] = useState(false);



  const loadSeasons = useCallback(async () => {

    setLoading(true);

    setError(null);

    try {

      const { data } = await api.get('/seasons');

      const list = sortArchivedSeasons(Array.isArray(data) ? data : []);

      setSeasons(list);

      setSelectedId((prev) => {

        if (list.length === 0) return null;

        if (prev && list.some((s) => s._id === prev)) return prev;

        return list[0]._id;

      });

    } catch (err) {

      setError(err.response?.data?.message || 'Failed to load archived seasons');

    } finally {

      setLoading(false);

    }

  }, []);



  useEffect(() => {

    loadSeasons();

  }, [loadSeasons]);



  const selected = seasons.find((s) => s._id === selectedId) || null;



  const handleDeleteSelected = async () => {

    if (!selected || deleting) return;

    const label = selected.displayName || selected.name || `Season ${selected.seasonNumber}`;

    const confirmed = window.confirm(

      `Delete "${label}" permanently? This cannot be undone.`

    );

    if (!confirmed) return;



    setDeleting(true);

    setError(null);

    try {

      await api.delete(`/seasons/${selected.seasonNumber}`);

      const remaining = seasons.filter((s) => s._id !== selected._id);

      setSeasons(remaining);

      setSelectedId(remaining[0]?._id || null);

    } catch (err) {

      setError(err.response?.data?.message || 'Failed to delete archived season');

    } finally {

      setDeleting(false);

    }

  };



  return (

    <div className="archived-seasons-page">

      <header className="archived-seasons-hero">

        <div className="archived-seasons-hero-inner">

          <div className="archived-seasons-hero-icon" aria-hidden="true">

            <Archive size={30} />

          </div>

          <div>

            <h1>Season Archives</h1>

            <p>

              Relive past semesters — champions, cup runs, and girls league history.

              This is separate from the current live season.

            </p>

          </div>

        </div>

      </header>



      {loading && (

        <div className="archived-seasons-state">

          <div className="loading-spinner" />

          <p>Loading archived seasons…</p>

        </div>

      )}



      {!loading && error && (

        <div className="archived-seasons-state archived-seasons-error">

          <p>{error}</p>

          <button type="button" className="archived-seasons-retry" onClick={loadSeasons}>

            Try again

          </button>

        </div>

      )}



      {!loading && !error && seasons.length === 0 && (

        <div className="archived-seasons-state archived-seasons-empty">

          <Archive size={40} strokeWidth={1.25} />

          <h3>No archived seasons yet</h3>

          <p>When an admin archives a semester, it will appear here.</p>

        </div>

      )}



      {!loading && !error && seasons.length > 0 && selected && (

        <>

          <ArchivedSeasonSelector

            seasons={seasons}

            selectedId={selectedId}

            onSelect={setSelectedId}

          />

          <Link
            to={archivedTeamsListPath(selected.seasonNumber)}
            className="archived-seasons-teams-link"
          >
            <Users size={18} aria-hidden="true" />
            View historical teams & squads
          </Link>

          {isAdmin && (

            <div className="archived-seasons-admin-bar">

              <button

                type="button"

                className="archived-season-delete"

                onClick={handleDeleteSelected}

                disabled={deleting}

              >

                <Trash2 size={16} aria-hidden="true" />

                {deleting ? 'Deleting…' : 'Delete this archive'}

              </button>

            </div>

          )}



          <section className="archived-comp-grid" aria-label="Archived competitions">

            {ARCHIVED_COMPETITIONS.map((competition) => (

              <ArchivedCompetitionCard

                key={competition.id}

                season={selected}

                competition={competition}

              />

            ))}

          </section>

        </>

      )}

    </div>

  );

}


