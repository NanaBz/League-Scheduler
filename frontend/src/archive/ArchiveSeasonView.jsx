import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Trophy, Star, BarChart3, ClipboardList, ArrowLeft, Sparkles, Award, Users } from 'lucide-react';
import CompetitionFilterControl from '../components/CompetitionFilterControl';
import FixtureFilterControl from '../components/FixtureFilterControl';
import ArchivedCompetitionStats from './ArchivedCompetitionStats';
import ArchiveLeagueStandings from './ArchiveLeagueStandings';
import ArchiveFixtureCard from './ArchiveFixtureCard';
import {
  COMP_ROWS,
  buildTeamByIdMap,
  competitionHasArchiveData,
  mergeLeagueStandings,
  resolveMatchSide,
} from './teamArchiveModel';
import './archive.css';

function seriesWinnerName(season, teamByIdMap, competition, winsNeeded) {
  const list = (season.matches || []).filter((m) => m.competition === competition && !m.isVoided);
  const wins = {};
  for (const m of list) {
    if (!m.isPlayed) continue;
    const hr = resolveMatchSide(m, 'home', teamByIdMap);
    const ar = resolveMatchSide(m, 'away', teamByIdMap);
    const hn = hr.name;
    const an = ar.name;
    let w = null;
    if (typeof m.homeScore === 'number' && typeof m.awayScore === 'number') {
      if (m.homeScore > m.awayScore) w = hn;
      else if (m.awayScore > m.homeScore) w = an;
      else if (m.homePenalties != null && m.awayPenalties != null && m.homePenalties !== m.awayPenalties) {
        w = m.homePenalties > m.awayPenalties ? hn : an;
      }
    }
    if (w && w !== 'Unknown Team' && w !== 'Unknown') wins[w] = (wins[w] || 0) + 1;
  }
  const entry = Object.entries(wins).find(([, c]) => c >= winsNeeded);
  return entry ? entry[0] : null;
}

export default function ArchiveSeasonView({ season, onBackToLive, liveTeams = [] }) {
  const available = useMemo(
    () => COMP_ROWS.filter((c) => competitionHasArchiveData(season, c.id)),
    [season]
  );

  const [selectedCompetition, setSelectedCompetition] = useState(() => available[0]?.id || 'league');
  const [archiveMwFilter, setArchiveMwFilter] = useState('');
  const [archiveCupFilter, setArchiveCupFilter] = useState('');

  useEffect(() => {
    const first = available[0]?.id;
    if (!first) return;
    setSelectedCompetition((prev) => (available.some((a) => a.id === prev) ? prev : first));
  }, [season.seasonNumber, available]);

  useEffect(() => {
    setArchiveMwFilter('');
    setArchiveCupFilter('');
  }, [selectedCompetition]);

  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-GB');

  const teamByIdMap = useMemo(() => buildTeamByIdMap(season, liveTeams), [season, liveTeams]);

  const matchesForSelectedCompetition = useMemo(
    () => (season.matches || []).filter((m) => m && m.competition === selectedCompetition),
    [season, selectedCompetition]
  );

  const hasPlayedMatchesInSelectedCompetition = useMemo(
    () => (matchesForSelectedCompetition || []).some((m) => m.isPlayed && !m.isVoided),
    [matchesForSelectedCompetition]
  );

  const leagueStandingsRows = useMemo(() => mergeLeagueStandings(season, teamByIdMap), [season, teamByIdMap]);

  const acwplChampion = seriesWinnerName(season, teamByIdMap, 'acwpl', 3);
  const girlsSuperCupChampion = seriesWinnerName(season, teamByIdMap, 'girls-super-cup', 2);

  const renderByMatchweek = (competition, roundWord) => {
    let competitionMatches = (season.matches || []).filter((m) => m.competition === competition);
    if (archiveMwFilter) {
      competitionMatches = competitionMatches.filter((m) => String(m.matchweek) === String(archiveMwFilter));
    }
    if (competitionMatches.length === 0) {
      return <div className="no-matches">No matches found for this competition.</div>;
    }
    const matchweeks = {};
    competitionMatches.forEach((match) => {
      const mw = match.matchweek ?? 0;
      if (!matchweeks[mw]) matchweeks[mw] = [];
      matchweeks[mw].push(match);
    });
    return Object.keys(matchweeks)
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
      .map((mw) => (
        <div key={mw} className="matchweek-section">
          <div className="matchweek-header-mobile">
            <h3>
              {roundWord} {mw}
            </h3>
          </div>
          <div className="matches-cards fixtures-archive">
            {matchweeks[mw].map((m) => (
              <ArchiveFixtureCard key={m._id} match={m} teamByIdMap={teamByIdMap} formatDate={formatDate} variant="league" />
            ))}
          </div>
        </div>
      ));
  };

  const renderCupStages = (competition) => {
    const competitionMatches = (season.matches || []).filter((m) => m.competition === competition);
    if (competitionMatches.length === 0) {
      return <div className="no-matches">No matches found for this competition.</div>;
    }
    const variant = competition === 'super-cup' ? 'super-cup' : 'cup';
    const stages = archiveCupFilter ? [archiveCupFilter] : ['semi-final', 'final'];
    return stages.map((stage) => {
      const stageMatches = competitionMatches.filter((m) => m.stage === stage);
      if (stageMatches.length === 0) return null;
      return (
        <div key={stage} className="cup-stage">
          <div className="matchweek-header-mobile cup-stage-header">
            <h3>{stage === 'semi-final' ? 'Semi-Finals' : 'Final'}</h3>
          </div>
          <div className="matches-cards fixtures-archive">
            {stageMatches.map((match) => (
              <ArchiveFixtureCard
                key={match._id}
                match={match}
                teamByIdMap={teamByIdMap}
                formatDate={formatDate}
                variant={variant}
              />
            ))}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="archived-season-view archive-v2">
      <div className="season-header archived-header-flex">
        <div className="archived-header-left">
          <button type="button" className="back-to-live-btn" onClick={onBackToLive}>
            <ArrowLeft size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Back to Live Season
          </button>
        </div>
        <div className="archived-header-center">
          <h1>Season {season.seasonNumber} Archive</h1>
          <div className="season-info">
            <span>
              <Calendar size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              {formatDate(season.startDate)} - {formatDate(season.endDate)}
            </span>
          </div>
        </div>
        <div className="archived-header-right winners-summary">
          {season.winners?.league && (
            <div className="winner-badge league-winner">
              <Trophy size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} /> League:{' '}
              {season.winners.league.name || '—'}
            </div>
          )}
          {season.winners?.cup && (
            <div className="winner-badge cup-winner">
              <Trophy size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Cup:{' '}
              {season.winners.cup.name || '—'}
            </div>
          )}
          {season.winners?.superCup && (
            <div className="winner-badge supercup-winner">
              <Trophy size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Super Cup:{' '}
              {season.winners.superCup.name || '—'}
            </div>
          )}
          {acwplChampion && (
            <div className="winner-badge acwpl-winner">
              <Trophy size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} /> ACWPL: {acwplChampion}
            </div>
          )}
          {girlsSuperCupChampion && (
            <div className="winner-badge gsc-winner">
              <Sparkles size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Girls Super Cup:{' '}
              {girlsSuperCupChampion}
            </div>
          )}
        </div>
      </div>

      <div className="archived-competition-filter-wrap">
        <CompetitionFilterControl
          value={selectedCompetition}
          onChange={setSelectedCompetition}
          options={available.map((a) => ({ value: a.id, label: a.label }))}
          className="archived-competition-filter"
        />
      </div>

      <div className="competition-content archived-competition-content">
        <ArchivedCompetitionStats
          seasonNumber={season.seasonNumber}
          competition={selectedCompetition}
          hasPlayedMatchesInCompetition={hasPlayedMatchesInSelectedCompetition}
        />

        {selectedCompetition === 'league' && (
          <div className="league-section">
            <h2 className="archived-section-title">
              <BarChart3 size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Final League Table
            </h2>
            <ArchiveLeagueStandings season={season} leagueStandingsRows={leagueStandingsRows} teamByIdMap={teamByIdMap} />
            <h2 className="archived-section-title">
              <ClipboardList size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} /> League Fixtures &amp; Results
            </h2>
            <FixtureFilterControl
              mode="league"
              matches={matchesForSelectedCompetition}
              value={archiveMwFilter}
              onChange={setArchiveMwFilter}
              className="archived-round-filter"
            />
            <div className="fixtures-mobile archived-fixtures-mobile">{renderByMatchweek('league', 'Matchweek')}</div>
          </div>
        )}

        {selectedCompetition === 'cup' && (
          <div className="cup-section">
            <h2 className="archived-section-title">
              <Award size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Cup tournament
            </h2>
            <FixtureFilterControl
              mode="cup"
              matches={matchesForSelectedCompetition}
              value={archiveCupFilter}
              onChange={setArchiveCupFilter}
              className="archived-round-filter"
            />
            <div className="fixtures-mobile archived-fixtures-mobile">{renderCupStages('cup')}</div>
          </div>
        )}

        {selectedCompetition === 'super-cup' && (
          <div className="super-cup-section">
            <h2 className="archived-section-title">
              <Star size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Super Cup
            </h2>
            <FixtureFilterControl
              mode="cup"
              matches={matchesForSelectedCompetition}
              value={archiveCupFilter}
              onChange={setArchiveCupFilter}
              className="archived-round-filter"
            />
            <div className="fixtures-mobile archived-fixtures-mobile">{renderCupStages('super-cup')}</div>
          </div>
        )}

        {selectedCompetition === 'acwpl' && (
          <div className="acwpl-section">
            <h2 className="archived-section-title">
              <Users size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} /> ACWPL fixtures &amp; results
            </h2>
            <FixtureFilterControl
              mode="acwpl"
              matches={matchesForSelectedCompetition}
              value={archiveMwFilter}
              onChange={setArchiveMwFilter}
              className="archived-round-filter"
            />
            <div className="fixtures-mobile archived-fixtures-mobile">{renderByMatchweek('acwpl', 'Matchweek')}</div>
          </div>
        )}

        {selectedCompetition === 'girls-super-cup' && (
          <div className="girls-super-cup-section">
            <h2 className="archived-section-title">
              <Sparkles size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Girls Super Cup fixtures &amp; results
            </h2>
            <FixtureFilterControl
              mode="girls-super-cup"
              matches={matchesForSelectedCompetition}
              value={archiveMwFilter}
              onChange={setArchiveMwFilter}
              className="archived-round-filter"
            />
            <div className="fixtures-mobile archived-fixtures-mobile">{renderByMatchweek('girls-super-cup', 'Round')}</div>
          </div>
        )}
      </div>
    </div>
  );
}
