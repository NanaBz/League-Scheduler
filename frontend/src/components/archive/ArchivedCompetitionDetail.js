import React, { useMemo } from 'react';
import { Trophy, Star } from 'lucide-react';
import { getTeamColors } from '../../utils/teamBrandColors';
import { buildArchiveViewModel } from '../../utils/archiveViewAdapter';
import { getArchivedCompetitionSummary } from '../../utils/archiveSeasonModel';
import ArchiveStandingsTable from './ArchiveStandingsTable';
import ArchiveScorersSection from './ArchiveScorersSection';
import ArchiveCupBracket from './ArchiveCupBracket';
import ArchiveSuperCupShowcase from './ArchiveSuperCupShowcase';
import ArchiveSeriesOverview from './ArchiveSeriesOverview';
import ArchiveFixtureList from './ArchiveFixtureList';

function ChampionBanner({ winner, label, icon: Icon = Trophy }) {
  if (!winner?.name) return null;
  const colors = getTeamColors(winner.name);
  return (
    <div
      className="banner archive-champion-banner"
      style={{
        backgroundColor: colors.primary,
        color: colors.secondary,
        border: `3px solid ${colors.secondary}`,
        fontWeight: 'bold',
        textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
      }}
    >
      <Icon size={18} /> {label}: {winner.name}
    </div>
  );
}

export default function ArchivedCompetitionDetail({ season, competition }) {
  const view = useMemo(
    () => buildArchiveViewModel(season, competition),
    [season, competition]
  );
  const summary = useMemo(
    () => getArchivedCompetitionSummary(season, competition),
    [season, competition]
  );

  const winner = view.winner || summary.winner;

  if (!view.hasSnapshot) {
    return (
      <div className="archive-detail-empty card">
        <p>No archived data is available for {competition.label} in this season.</p>
      </div>
    );
  }

  const compId = competition.id;

  return (
    <div className="archived-competition-detail">
      {compId === 'league' && winner && (
        <ChampionBanner winner={winner} label="League Champions" />
      )}
      {compId === 'cup' && winner && (
        <ChampionBanner winner={winner} label="Agha Cup Winners" />
      )}
      {compId === 'super-cup' && winner && (
        <ChampionBanner winner={winner} label="Super Cup Champions" icon={Star} />
      )}

      {compId === 'league' && (
        <>
          <ArchiveStandingsTable
            standings={view.standings}
            variant="league"
            seasonNumber={season.seasonNumber}
          />
          <ArchiveScorersSection statistics={view.statistics} />
          <ArchiveFixtureList fixtures={view.fixtures} competitionId="league" />
        </>
      )}

      {compId === 'acwpl' && (
        <>
          <ArchiveStandingsTable
            standings={view.standings}
            variant="acwpl"
            title="Final ACWPL Table"
            seasonNumber={season.seasonNumber}
          />
          <ArchiveScorersSection statistics={view.statistics} />
          <ArchiveFixtureList fixtures={view.fixtures} competitionId="acwpl" />
        </>
      )}

      {compId === 'cup' && (
        <>
          <ArchiveCupBracket semiFinals={view.semiFinals} finalMatch={view.finalMatch} />
          <ArchiveScorersSection statistics={view.statistics} />
          <ArchiveFixtureList fixtures={view.fixtures} competitionId="cup" />
        </>
      )}

      {compId === 'super-cup' && (
        <>
          <ArchiveSuperCupShowcase
            match={view.finalMatch}
            originalDoubleWinnerId={view.originalDoubleWinnerId}
          />
          <ArchiveScorersSection statistics={view.statistics} title="Top Scorers" showAssists />
          <ArchiveFixtureList fixtures={view.fixtures} competitionId="super-cup" title="Match Result" />
        </>
      )}

      {compId === 'girls-super-cup' && (
        <>
          <ArchiveSeriesOverview
            fixtures={view.fixtures}
            winsByTeam={view.winsByTeam}
            winner={winner}
            format={view.format || 'best-of-3'}
            competitionLabel="Girls Super Cup"
          />
          <ArchiveScorersSection statistics={view.statistics} />
          <ArchiveFixtureList fixtures={view.fixtures} competitionId="girls-super-cup" title="All Results" />
        </>
      )}
    </div>
  );
}
