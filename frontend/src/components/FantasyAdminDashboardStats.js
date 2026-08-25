import React from 'react';
import { Users, BarChart3, Crown, ArrowDownLeft, ArrowUpRight, Medal, Trophy } from 'lucide-react';
import './FantasyAdminDashboardStats.css';

function StatTile({ variant, icon: Icon, label, value, meta, title }) {
  return (
    <article className={`admin-fantasy-stat admin-fantasy-stat--${variant}`}>
      <div className="admin-fantasy-stat-head">
        <Icon className="admin-fantasy-stat-icon" size={variant === 'primary' ? 17 : 15} aria-hidden="true" />
        <span className="admin-fantasy-stat-label">{label}</span>
      </div>
      <div className="admin-fantasy-stat-value" title={title || (typeof value === 'string' ? value : undefined)}>
        {value}
      </div>
      {meta ? <div className="admin-fantasy-stat-meta">{meta}</div> : null}
    </article>
  );
}

function formatMotwDisplay(motw) {
  if (!motw?.managers?.length) return '—';
  if (motw.managers.length === 1) return motw.managers[0].manager;
  return `${motw.managers[0].manager} +${motw.managers.length - 1}`;
}

function formatMotwMeta(motw) {
  if (!motw?.managers?.length) return null;
  const tieNote = motw.tieCount > 1 ? ` · ${motw.tieCount}-way tie` : '';
  return `GW${motw.matchweek} · ${motw.points} pts${tieNote}`;
}

export default function FantasyAdminDashboardStats({ dashboard }) {
  if (!dashboard) {
    return (
      <div className="admin-fantasy-stats admin-fantasy-stats--loading" aria-live="polite">
        Loading dashboard…
      </div>
    );
  }

  const mostCaptained = dashboard.mostCaptained?.[0];
  const mostCaptainedName = mostCaptained?.player || 'N/A';
  const mostCaptainedMeta = mostCaptained?.count ? `${mostCaptained.count} teams` : null;

  const transferInValue = dashboard.showTransferStats
    ? dashboard.transfersIn?.[0]?.player || '—'
    : 'From GW2';
  const transferOutValue = dashboard.showTransferStats
    ? dashboard.transfersOut?.[0]?.player || '—'
    : 'From GW2';

  const motw = dashboard.managerOfTheWeek;
  const motwName = formatMotwDisplay(motw);
  const motwMeta = formatMotwMeta(motw);
  const motwTitle = motw?.managers?.map((m) => `${m.manager} (${m.team})`).join(', ');

  const topManager = dashboard.topManager;
  const topManagerName = topManager?.manager || '—';
  const topManagerMeta = topManager ? `${topManager.points} pts total` : null;

  return (
    <section className="admin-fantasy-stats" aria-label="Fantasy dashboard statistics">
      <div className="admin-fantasy-stats-row admin-fantasy-stats-row--primary">
        <StatTile
          variant="primary"
          icon={Users}
          label="Total Fantasy Players"
          value={dashboard.totalFantasyPlayers}
        />
        <StatTile
          variant="primary"
          icon={BarChart3}
          label="Average Points"
          value={dashboard.avgPoints}
        />
      </div>

      <div className="admin-fantasy-stats-row admin-fantasy-stats-row--secondary">
        <StatTile
          variant="secondary"
          icon={Crown}
          label="Most Captained"
          value={mostCaptainedName}
          meta={mostCaptainedMeta}
          title={mostCaptainedName}
        />
        <StatTile
          variant="secondary"
          icon={ArrowDownLeft}
          label="Top Transfer In"
          value={transferInValue}
          title={transferInValue}
        />
        <StatTile
          variant="secondary"
          icon={ArrowUpRight}
          label="Top Transfer Out"
          value={transferOutValue}
          title={transferOutValue}
        />
      </div>

      <div className="admin-fantasy-stats-row admin-fantasy-stats-row--managers">
        <StatTile
          variant="secondary"
          icon={Medal}
          label="Manager of the Week"
          value={motwName}
          meta={motwMeta}
          title={motwTitle || motwName}
        />
        <StatTile
          variant="secondary"
          icon={Trophy}
          label="Top Manager"
          value={topManagerName}
          meta={topManagerMeta}
          title={topManager ? `${topManager.manager} — ${topManager.team}` : topManagerName}
        />
      </div>
    </section>
  );
}
