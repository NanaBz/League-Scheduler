const express = require('express');
const router = express.Router();
const Season = require('../models/Season');
const { authenticateAdmin } = require('../middleware/auth');
const AuditLog = require('../models/AuditLog');
const { syncSeasonActiveFlagsToLatest } = require('../utils/seasonContext');
const {
  generateAcademicYearOptions,
  SEMESTER_OPTIONS,
  semesterLabel,
} = require('../utils/academicYear');
const {
  archiveAndResetSeason,
  resetSeasonWithoutArchive,
  validateArchiveRequest,
} = require('../utils/seasonReset');

function sendWorkflowError(res, error) {
  const status = error.status || 500;
  res.status(status).json({
    message: error.message || 'Season reset failed',
    code: error.code || 'reset_failed',
    existingSeasonNumber: error.existingSeasonNumber,
  });
}

// Admin: academic year / semester options for reset workflow (must be before /:seasonNumber)
router.get('/admin/reset-options', authenticateAdmin, async (req, res) => {
  try {
    const existingArchives = await Season.find({
      academicYear: { $exists: true, $ne: '' },
      semester: { $in: ['first', 'second'] },
    })
      .select('academicYear semester seasonNumber displayName archivedAt')
      .sort({ academicYear: -1, semester: 1 })
      .lean();

    res.json({
      academicYearOptions: generateAcademicYearOptions(),
      semesterOptions: SEMESTER_OPTIONS,
      existingArchives,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all seasons
router.get('/', async (req, res) => {
  try {
    const seasons = await Season.find()
      .populate('winners.league', 'name logo')
      .populate('winners.cup', 'name logo')
      .populate('winners.superCup', 'name logo')
      .populate('winners.acwpl', 'name logo')
      .populate('winners.girlsSuperCup', 'name logo')
      .sort({ seasonNumber: -1 });
    res.json(seasons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/reconcile-active', authenticateAdmin, async (req, res) => {
  try {
    await AuditLog.create({
      action: 'reconcile_season_active',
      admin: { id: req.admin._id, email: req.admin.email },
      details: {},
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    const seasonNumber = await syncSeasonActiveFlagsToLatest();
    if (seasonNumber == null) {
      return res.status(400).json({ message: 'No season documents found' });
    }
    res.json({ message: 'Season flags updated', activeSeasonNumber: seasonNumber });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Reset live season WITHOUT creating an archive (testing / development)
router.post('/reset', authenticateAdmin, async (req, res) => {
  try {
    const mode = req.body?.mode;
    if (mode !== 'testing') {
      return res.status(400).json({
        message: 'Explicit mode required. Use mode "testing" for reset without archive, or POST /seasons/archive-and-reset to archive first.',
        code: 'mode_required',
      });
    }

    await AuditLog.create({
      action: 'reset_season_testing',
      admin: { id: req.admin._id, email: req.admin.email },
      details: { mode: 'testing' },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const result = await resetSeasonWithoutArchive();
    res.json({
      message:
        'Live season reset successfully (no archive created). Team rosters and players were kept — adjust them in Player Management as needed.',
      ...result,
    });
  } catch (error) {
    console.error('Error resetting season (testing):', error);
    sendWorkflowError(res, error);
  }
});

// Archive current live season, then reset (admin must supply academic year + semester)
router.post('/archive-and-reset', authenticateAdmin, async (req, res) => {
  try {
    const { academicYear, semester, displayName } = req.body || {};
    const validation = validateArchiveRequest({ academicYear, semester });
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message, code: validation.code });
    }

    await AuditLog.create({
      action: 'archive_and_reset_season',
      admin: { id: req.admin._id, email: req.admin.email },
      details: { academicYear, semester, displayName: displayName || null },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const result = await archiveAndResetSeason({ academicYear, semester, displayName });
    res.json({
      message: `Season archived (${academicYear}, ${semesterLabel(semester)}) and live data reset. School rosters and FPL history were preserved where applicable.`,
      ...result,
    });
  } catch (error) {
    console.error('Error archiving and resetting season:', error);
    sendWorkflowError(res, error);
  }
});

router.get('/:seasonNumber', async (req, res) => {
  try {
    const seasonNumber = parseInt(req.params.seasonNumber, 10);
    if (!Number.isFinite(seasonNumber)) {
      return res.status(404).json({ message: 'Season not found' });
    }

    const season = await Season.findOne({ seasonNumber })
      .populate('finalStandings.team', 'name logo')
      .populate('matches.homeTeam', 'name logo')
      .populate('matches.awayTeam', 'name logo')
      .populate('winners.league', 'name logo')
      .populate('winners.cup', 'name logo')
      .populate('winners.superCup', 'name logo')
      .populate('winners.acwpl', 'name logo')
      .populate('winners.girlsSuperCup', 'name logo');

    if (!season) {
      return res.status(404).json({ message: 'Season not found' });
    }

    res.json(season);
  } catch (error) {
    console.error('Error fetching season details:', error);
    res.status(500).json({ message: error.message });
  }
});

router.delete('/cleanup-duplicates', authenticateAdmin, async (req, res) => {
  try {
    await AuditLog.create({
      action: 'cleanup_duplicate_seasons',
      admin: { id: req.admin._id, email: req.admin.email },
      details: {},
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    const seasons = await Season.find().sort({ seasonNumber: 1, createdAt: 1 });
    const seenNumbers = new Set();
    const duplicatesToDelete = [];

    for (const season of seasons) {
      if (seenNumbers.has(season.seasonNumber)) {
        duplicatesToDelete.push(season._id);
      } else {
        seenNumbers.add(season.seasonNumber);
      }
    }

    if (duplicatesToDelete.length > 0) {
      await Season.deleteMany({ _id: { $in: duplicatesToDelete } });
      res.json({
        message: `Cleaned up ${duplicatesToDelete.length} duplicate seasons`,
        deletedSeasons: duplicatesToDelete.length,
      });
    } else {
      res.json({ message: 'No duplicate seasons found' });
    }
  } catch (error) {
    console.error('Error cleaning up duplicates:', error);
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:seasonNumber', authenticateAdmin, async (req, res) => {
  try {
    const seasonNumber = parseInt(req.params.seasonNumber, 10);
    await AuditLog.create({
      action: 'delete_season',
      admin: { id: req.admin._id, email: req.admin.email },
      details: { seasonNumber },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const seasonToDelete = await Season.findOne({ seasonNumber });
    if (!seasonToDelete) {
      return res.status(404).json({ message: `Season ${seasonNumber} not found` });
    }

    await Season.deleteOne({ seasonNumber });

    res.json({
      message: `Season ${seasonNumber} deleted successfully`,
      deletedSeason: seasonNumber,
    });
  } catch (error) {
    console.error('Error deleting season:', error);
    res.status(500).json({ message: error.message });
  }
});

router.delete('/', authenticateAdmin, async (req, res) => {
  try {
    await AuditLog.create({
      action: 'delete_all_seasons',
      admin: { id: req.admin._id, email: req.admin.email },
      details: {},
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const result = await Season.deleteMany({});

    res.json({
      message: 'All seasons deleted successfully',
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('Error deleting all seasons:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
