import React from 'react';
import {
  Users,
  BarChart3,
  Crown,
  ArrowDownLeft,
  ArrowUpRight,
  Medal,
  Trophy,
  AlertCircle,
} from 'lucide-react';
import './FantasyAdminDashboardStats.css';

function StatTile({ icon: Icon, label, value, meta, title, accent }) {
  return (
    <article className={`admin-fantasy-stat-tile${accent ? ' admin-fantasy-stat-tile--accent' : ''}`}>
      <div className="admin-fantasy-stat-tile__head">
        <span className="admin-fantasy-stat-tile__icon" aria-hidden="true">
          <Icon size={15} />
        </span>
        <span className="admin-fantasy-stat-tile__label">{label}</span>
      </div>
      <div
        className="admin-fantasy-stat-tile__value"
        title={title || (typeof value === 'string' ? value : undefined)}
      >
        {value}
      </div>
      {meta ? <div className="admin-fantasy-stat-tile__meta">{meta}</div> : null}
    </article>
  );
}

function StatsSkeleton() {
  return (
    <div
      className="admin-fantasy-stats-grid admin-fantasy-stats-grid--loading"
      aria-busy="true"
      aria-label="Loading dashboard statistics"
    >
      {Array.from({ length: 7 }, (_, index) => (
        <div key={index} className="admin-fantasy-stat-skeleton" aria-hidden="true">
          <div className="admin-fantasy-stat-skeleton__head" />
          <div className="admin-fantasy-stat-skeleton__value" />
          <div className="admin-fantasy-stat-skeleton__meta" />
        </div>
      ))}
    </div>
  );
}

function StatsError({ message, onRetry }) {
  return (
    <div className="admin-fantasy-stats-error" role="alert">
      <span className="admin-fantasy-stats-error__icon" aria-hidden="true">
        <AlertCircle size={18} />
      </span>
      <div className="admin-fantasy-stats-error__text">
        <p className="admin-fantasy-stats-error__title">Statistics unavailable</p>
        <p className="admin-fantasy-stats-error__message">{message}</p>
      </div>
      {onRetry ? (
        <button type="button" className="btn btn-ghost btn-compact admin-fantasy-stats-error__retry" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
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

export default function FantasyAdminDashboardStats({ dashboard, error, onRetry }) {
  if (error) {
    return <StatsError message={error} onRetry={onRetry} />;
  }

  if (!dashboard) {
    return <StatsSkeleton />;
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
    <section className="admin-fantasy-stats-grid" aria-label="Fantasy dashboard statistics">
      <StatTile
        accent
        icon={Users}
        label="Total Fantasy Players"
        value={dashboard.totalFantasyPlayers}
      />
      <StatTile
        accent
        icon={BarChart3}
        label="Average Points"
        value={dashboard.avgPoints}
      />
      <StatTile
        icon={Crown}
        label="Most Captained"
        value={mostCaptainedName}
        meta={mostCaptainedMeta}
        title={mostCaptainedName}
      />
      <StatTile
        icon={ArrowDownLeft}
        label="Top Transfer In"
        value={transferInValue}
        title={transferInValue}
      />
      <StatTile
        icon={ArrowUpRight}
        label="Top Transfer Out"
        value={transferOutValue}
        title={transferOutValue}
      />
      <StatTile
        icon={Medal}
        label="Manager of the Week"
        value={motwName}
        meta={motwMeta}
        title={motwTitle || motwName}
      />
      <StatTile
        icon={Trophy}
        label="Top Manager"
        value={topManagerName}
        meta={topManagerMeta}
        title={topManager ? `${topManager.manager} — ${topManager.team}` : topManagerName}
      />
    </section>
  );
}
