import React, { useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import api from '../utils/api';
import TeamDetailHero from './TeamDetailHero';
import TeamDetailBody from './TeamDetailBody';
import { aggregatePlayerStatsAcrossCompetitions, topByMetric } from '../utils/aggregateTeamPlayerStats';
import { boysLeaguePosition, ordinal } from '../utils/teamTablePosition';

function teamPickerLogoClass(teamName) {
  return `team-picker-logo${teamName === 'Falcons' ? ' team-picker-logo--falcons' : ''}`;
}

export default function TeamsPage({ refreshKey = 0, onNavigateToGirlsTeams }) {
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/teams')
      .then(({ data }) => setTeams(data))
      .catch(() => setTeams([]));
  }, [refreshKey]);

  useEffect(() => {
    if (!selectedTeam) return;
    setLoading(true); setError(null);
    Promise.all([
      api.get('/players', { params: { teamId: selectedTeam._id } }),
      api.get('/stats', { params: { team: selectedTeam._id } })
    ])
      .then(([playersRes, statsRes]) => {
        setPlayers(playersRes.data);
        setStats(statsRes.data || []);
      })
      .catch(() => setError('Failed to load roster'))
      .finally(() => setLoading(false));
  }, [selectedTeam]);

  const grouped = useMemo(() => {
    const g = { GK: [], DF: [], MF: [], ATT: [] };
    for (const p of players) { if (g[p.position]) g[p.position].push(p); }
    return g;
  }, [players]);

  const captain = useMemo(() => players.find(p => p.isCaptain), [players]);
  const viceCaptain = useMemo(() => players.find(p => p.isViceCaptain), [players]);
  const aggregatedPlayerStats = useMemo(
    () => aggregatePlayerStatsAcrossCompetitions(stats),
    [stats]
  );
  const topScorer = useMemo(() => {
    const t = topByMetric(aggregatedPlayerStats, 'goals');
    if (!t || (t.goals || 0) <= 0) return null;
    return t;
  }, [aggregatedPlayerStats]);
  const topAssister = useMemo(() => {
    const t = topByMetric(aggregatedPlayerStats, 'assists');
    if (!t || (t.assists || 0) <= 0) return null;
    return t;
  }, [aggregatedPlayerStats]);

  const heroTableSubtitle = useMemo(() => {
    if (!selectedTeam || selectedTeam.competition !== 'league') return '';
    const pos = boysLeaguePosition(selectedTeam._id, teams);
    if (pos == null) return '';
    return `League · ${ordinal(pos)}`;
  }, [selectedTeam, teams]);

  const visibleTeams = teams.filter(t => (t.competition === 'league' || t.competition === 'acwpl') && !['Orion','Firestorm'].includes(t.name));

  return (
    <div className="teams-page teams-page--boys">
      {!selectedTeam && (
        <>
          <header className="teams-page-header">
            <h1><Users size={22} aria-hidden="true" /> Men&apos;s Teams</h1>
            <p>Explore league squads, leadership, and player statistics.</p>
          </header>
          <div className="team-cards">
            {visibleTeams.map(t => (
              <button
                key={t._id}
                type="button"
                className="team-card"
                onClick={() => setSelectedTeam(t)}
              >
                <img
                  src={t.logo}
                  alt=""
                  className={teamPickerLogoClass(t.name)}
                />
                <span className="team-card-name">{t.name}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {selectedTeam && (
        <div className="team-detail-stack">
          <TeamDetailHero
            team={selectedTeam}
            onBack={() => setSelectedTeam(null)}
            subtitle={heroTableSubtitle}
            backLabel="Back to teams"
          />
          <TeamDetailBody
            team={selectedTeam}
            loading={loading}
            error={error}
            captain={captain}
            viceCaptain={viceCaptain}
            topScorer={topScorer}
            topAssister={topAssister}
            grouped={grouped}
            variant="boys"
          />
        </div>
      )}
    </div>
  );
}
