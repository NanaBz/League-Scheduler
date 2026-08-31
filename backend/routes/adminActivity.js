const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { authenticateAdmin } = require('../middleware/auth');
const { formatLogEntry } = require('../utils/adminAuditLog');

// GET /api/admin/activity — recent admin audit log entries
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

    const [logs, total] = await Promise.all([
      AuditLog.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(),
    ]);

    res.json({
      success: true,
      total,
      skip,
      limit,
      entries: logs.map(formatLogEntry),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
