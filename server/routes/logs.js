const express = require('express');
const prisma = require('../prisma');
const auth = require('../middleware/auth');
const { canViewActivityLogs, canViewSystemLogs } = require('../policies/permissions');
const router = express.Router();

// GET /api/logs/activity
router.get('/activity', auth, async (req, res) => {
  try {
    if (!canViewActivityLogs(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 500, 50), 1000);

    const logs = await prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { fullName: true, role: true } } },
    });

    const normalized = logs.map(l => ({
      id:     l.id,
      user:   { id: l.userId, name: l.user?.fullName ?? null, role: l.user?.role ?? null },
      action: l.action,
      entity: { type: l.entityType, id: l.entityId },
      details:    l.details,
      created_at: l.createdAt,
    }));

    res.json({ items: normalized, count: normalized.length });
  } catch (e) {
    console.error('GET /api/logs/activity hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/logs/system
router.get('/system', auth, async (req, res) => {
  try {
    if (!canViewSystemLogs(req.user.role)) return res.status(403).json({ error: 'Sadece yöneticiler hata loglarını görebilir' });

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 20), 1000);

    const logs = await prisma.systemLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const items = logs.map(l => ({
      id:         l.id,
      level:      l.level,
      module:     l.module,
      message:    l.message,
      details:    l.details,
      user_id:    l.userId,
      created_at: l.createdAt,
    }));

    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/logs/screen
router.get('/screen', auth, async (req, res) => {
  try {
    if (!canViewActivityLogs(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 500, 50), 1000);

    const logs = await prisma.screenLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const normalized = logs.map(l => ({
      id:               l.id,
      visitor_id:       l.visitorId,
      content_id:       l.contentId,
      action:           l.action,
      start_time:       l.startTime,
      end_time:         l.endTime,
      duration_seconds: l.durationSeconds,
      created_at:       l.createdAt,
    }));

    res.json({ items: normalized, count: normalized.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/logs/export — CSV
router.get('/export', auth, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 1000, 100), 5000);

    const visitors = await prisma.visitor.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { hostPersonnel: { select: { fullName: true } } },
    });

    const headers = ['ID', 'Ad Soyad', 'TC No', 'Telefon', 'Firma', 'Ziyaret Sebebi', 'Görüşülen Personel', 'Giriş', 'Çıkış', 'Durum', 'Kayıt Tarihi'];
    const rows = visitors.map(v => [
      v.id,
      v.fullName,
      v.tcNo            || '',
      v.phone           || '',
      v.companyName     || '',
      v.reason          || '',
      v.hostPersonnel?.fullName || '',
      v.arrivalTime     || '',
      v.checkoutTime    || '',
      v.status,
      v.createdAt,
    ]);

    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ziyaretciler.csv"');
    res.send('\uFEFF' + csv); // BOM for Excel Turkish charset
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
