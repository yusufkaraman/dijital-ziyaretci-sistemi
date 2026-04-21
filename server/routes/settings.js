const express = require('express');
const prisma = require('../prisma');
const auth = require('../middleware/auth');
const { canManageSettings } = require('../policies/permissions');
const router = express.Router();
const SECRETARY_ALLOWED_SETTINGS = new Set(['ticker_text', 'ticker_speed', 'ticker_company_texts']);

function canUpdateRequestedSettings(role, updates) {
  if (canManageSettings(role)) return true;
  if (role !== 'secretary') return false;
  const keys = Object.keys(updates || {});
  return keys.length > 0 && keys.every((key) => SECRETARY_ALLOWED_SETTINGS.has(key));
}

// GET /api/settings
router.get('/', auth, async (req, res) => {
  try {
    const rows = await prisma.systemSetting.findMany({ orderBy: { id: 'asc' } });
    const settings = {};
    for (const r of rows) {
      settings[r.key] = { value: r.value, label: r.label };
    }
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/settings
router.put('/', auth, async (req, res) => {
  try {
    const updates = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const keys = Object.keys(updates);
    if (!keys.length) return res.status(400).json({ error: 'Guncellenecek ayar bulunamadi' });

    if (!canUpdateRequestedSettings(req.user.role, updates)) {
      return res.status(403).json({
        error: req.user.role === 'secretary'
          ? 'Sekreter sadece lobi kayan yazi ayarini degistirebilir'
          : 'Sadece admin degistirebilir',
      });
    }

    // Plan §4.7: bulk settings update — tek transaction içinde
    await prisma.$transaction(
      Object.entries(updates).map(([key, value]) =>
        prisma.systemSetting.upsert({
          where:  { key },
          update: { value: String(value), updatedAt: new Date() },
          create: { key, value: String(value) },
        })
      )
    );
    if (global.io) global.io.emit('settings:updated', { keys });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
