const AuditLog = require('../models/AuditLog');

/** @nboakyeakyeampong from nboakyeakyeampong@gmail.com (local part before @). */
function adminHandleFromEmail(email) {
  if (!email) return '@admin';
  const normalized = String(email).trim().toLowerCase();
  const at = normalized.indexOf('@');
  const local = at >= 0 ? normalized.slice(0, at) : normalized;
  return `@${local}`;
}

const ACTION_SUMMARIES = {
  reconcile_season_active: 'Reconciled Season Flags',
  reset_season_testing: 'Reset Season (Testing)',
  archive_and_reset_season: 'Archived & Reset Season',
  cleanup_duplicate_seasons: 'Cleaned Up Duplicate Seasons',
  delete_season: 'Deleted Season Archive',
  delete_all_seasons: 'Deleted All Season Archives',
  player_created: 'Created Player',
  player_updated: 'Updated Player',
  player_price_updated: 'Updated Player Price',
  player_deleted: 'Deleted Player',
  player_deactivated: 'Deactivated Player',
  player_transferred: 'Transferred Player',
  team_created: 'Created Team',
  team_updated: 'Updated Team',
  team_deleted: 'Deleted Team',
  team_initialized: 'Initialized Default Teams',
  team_staff_added: 'Added Team Staff',
  team_staff_removed: 'Removed Team Staff',
  match_created: 'Created Match',
  match_updated: 'Updated Match',
  match_score_updated: 'Updated Match Score',
  match_live_score_updated: 'Updated Live Match Score',
  match_deleted: 'Deleted Match',
  match_events_updated: 'Updated Match Events',
  match_started_live: 'Started Live Match',
  match_full_time: 'Marked Match Full Time',
  match_abandoned_live: 'Abandoned Live Match',
  match_score_reset: 'Reset Match Score',
  fixtures_generated: 'Generated Fixtures',
  fixtures_published: 'Published Fixtures',
  fixtures_reset: 'Reset Fixtures',
  league_table_recalculated: 'Recalculated League Table',
  fantasy_season_reset: 'Reset Fantasy Season',
  fantasy_prices_reset: 'Reset All Player Prices',
  fantasy_deadline_updated: 'Updated Matchweek Deadline',
  fantasy_minutes_updated: 'Updated Fantasy Match Minutes',
  fantasy_bonus_assigned: 'Assigned Bonus Points',
  fantasy_special_assigned: 'Assigned Special Points',
  fantasy_gameweek_rescored: 'Rescored Gameweek',
};

function humanizeAction(action) {
  if (!action) return 'Admin Action';
  return String(action)
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function summaryForLog(doc) {
  return doc.details?.summary || ACTION_SUMMARIES[doc.action] || humanizeAction(doc.action);
}

function formatLogEntry(doc) {
  const handle = adminHandleFromEmail(doc.admin?.email);
  const summary = summaryForLog(doc);
  return {
    id: doc._id,
    action: doc.action,
    adminHandle: handle,
    adminEmail: doc.admin?.email || null,
    summary,
    displayLine: `${handle} — ${summary}`,
    details: doc.details || {},
    createdAt: doc.createdAt,
  };
}

async function logAdminAction(req, action, details = {}) {
  try {
    if (!req?.admin?._id) return null;
    const summary = details.summary || ACTION_SUMMARIES[action] || humanizeAction(action);
    const { summary: _omit, ...rest } = details;
    return await AuditLog.create({
      action,
      admin: { id: req.admin._id, email: req.admin.email },
      details: { summary, ...rest },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  } catch (err) {
    console.warn('[audit] Failed to write admin log:', err.message);
    return null;
  }
}

module.exports = {
  adminHandleFromEmail,
  ACTION_SUMMARIES,
  formatLogEntry,
  logAdminAction,
};
