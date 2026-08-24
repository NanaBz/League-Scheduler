import React, { useMemo } from 'react';
import TeamDetailHero from '../TeamDetailHero';
import {
  getArchivedSquad,
  getArchivedTeamHeroSubtitle,
  getArchivedTeamLeaders,
  getArchivedTeamPerformance,
  groupArchivedSquadByPosition,
} from '../../utils/archiveTeamModel';
import { seasonSelectorLabel } from '../../utils/archiveSeasonModel';

export default function ArchivedTeamDetailView({ season, team, onBack, backLabel = 'Back to teams' }) {
  const squad = useMemo(
    () => (season && team ? getArchivedSquad(season, team._id) : []),
    [season, team]
  );
  const grouped = useMemo(() => groupArchivedSquadByPosition(squad), [squad]);
  const performance = useMemo(
    () => (season && team ? getArchivedTeamPerformance(season, team._id) : []),
    [season, team]
  );
  const leaders = useMemo(
    () => (season && team ? getArchivedTeamLeaders(season, team._id, squad) : {}),
    [season, team, squad]
  );
  const subtitle = useMemo(
    () => (season && team ? getArchivedTeamHeroSubtitle(season, team) : ''),
    [season, team]
  );

  if (!team || !season) return null;

  return (
    <div className="team-detail-stack">
      <TeamDetailHero
        team={team}
        onBack={onBack}
        subtitle={subtitle}
        backLabel={backLabel}
      />
      <div className="team-detail-body">
        <div className="archive-team-season-badge">
          Historical snapshot · {seasonSelectorLabel(season)}
        </div>

        {performance.length > 0 && (
          <div className="archive-team-performance">
            <h4>Competition performance</h4>
            <ul>
              {performance.map((row) => (
                <li key={row.competition}>
                  <strong>{row.competition}</strong>
                  <span>{row.summary}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ marginBottom: 20, paddingBottom: 15, borderBottom: '1px solid #ddd' }}>
          {team.staff?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <strong>Coaches:</strong>
              <ul style={{ margin: '5px 0 0 20px', fontSize: '0.95em' }}>
                {team.staff.map((s, idx) => (
                  <li key={idx}>{s.name} ({s.role})</li>
                ))}
              </ul>
            </div>
          )}
          <div style={{ marginBottom: 10 }}>
            <strong>Captain:</strong> {leaders.captain ? leaders.captain.name : 'N/A'}
          </div>
          <div style={{ marginBottom: 10 }}>
            <strong>Vice Captain:</strong> {leaders.viceCaptain ? leaders.viceCaptain.name : 'N/A'}
          </div>
          <div style={{ marginBottom: 10 }}>
            <strong>Top Scorer:</strong>{' '}
            {leaders.topScorer
              ? `${leaders.topScorer.player?.name || 'Unknown'} (${leaders.topScorer.goals || 0})`
              : 'N/A'}
          </div>
          <div>
            <strong>Top Assister:</strong>{' '}
            {leaders.topAssister
              ? `${leaders.topAssister.player?.name || 'Unknown'} (${leaders.topAssister.assists || 0})`
              : 'N/A'}
          </div>
        </div>

        <h4 style={{ marginTop: 20, marginBottom: 10 }}>Squad</h4>
        {squad.length === 0 ? (
          <p className="archive-empty-inline">No squad snapshot recorded for this team in this archive.</p>
        ) : (
          <div className="squad-groups">
            {['GK', 'DF', 'MF', 'ATT'].map((pos) => (
              <div key={pos} className={`squad-group squad-${pos}`}>
                <div className="group-title">{pos}</div>
                <ul>
                  {grouped[pos].map((p) => (
                    <li
                      key={p._id}
                      className="player-row"
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="shirt-number">{p.number ?? '-'}</span>
                        <span className="player-name" style={{ color: '#1e293b', fontWeight: 500 }}>
                          {p.name}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85em', color: '#666' }}>
                        {p.isCaptain && (
                          <span style={{ marginRight: 6, fontWeight: 'bold', color: '#d97706' }}>C</span>
                        )}
                        {p.isViceCaptain && (
                          <span style={{ fontWeight: 'bold', color: '#059669' }}>VC</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
