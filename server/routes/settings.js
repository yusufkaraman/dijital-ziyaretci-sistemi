const express = require('express');
const { db } = require('../database');
const auth = require('../middleware/auth');
const { canManageSettings } = require('../policies/permissions');
const router = express.Router();

// GET /api/settings
router.get('/', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM system_settings ORDER BY id').all();
  const settings = {};
  for (const r of rows) settings[r.key] = { value: r.value, label: r.label };
  res.json(settings);
});

// PUT /api/settings
router.put('/', auth, (req, res) => {
  if (!canManageSettings(req.user.role)) return res.status(403).json({ error: 'Sadece admin değiştirebilir' });
  const updates = req.body;
  const stmt = db.prepare(`UPDATE system_settings SET value=?, updated_at=datetime('now','+3 hours') WHERE key=?`);
  for (const [key, value] of Object.entries(updates)) {
    stmt.run(value, key);
  }
  res.json({ success: true });
});

module.exports = router;
