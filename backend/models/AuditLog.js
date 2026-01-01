const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  admin: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    email: String
  },
  details: mongoose.Schema.Types.Mixed, // Flexible for extra info
  ip: String,
  userAgent: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
