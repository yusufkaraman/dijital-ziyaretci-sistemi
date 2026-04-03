const express = require('express');
const { db } = require('../database');
const auth = require('../middleware/auth');
const { canViewActivityLogs, canViewSystemLogs } = require('../policies/permissions');
const router = express.Router();

// GET /api/logs/activity
router.get('/activity', auth, (req, res) => {
  if (!canViewActivityLogs(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 500, 50), 1000);

  const logs = db.prepare(`
    SELECT l.id, l.user_id, l.action, l.entity_type, l.entity_id, l.details, l.created_at,
           u.full_name as user_name, u.role as user_role
    FROM activity_logs l LEFT JOIN users u ON l.user_id=u.id
    ORDER BY l.created_at DESC LIMIT ?
  `).all(limit);

  const normalized = logs.map(l => ({
    id: l.id,
    user: { id: l.user_id, name: l.user_name, role: l.user_role },
    action: l.action,
    entity: { type: l.entity_type, id: l.entity_id },
    details: l.details,
    created_at: l.created_at,
  }));

  res.json({ items: normalized, count: normalized.length });
});

// GET /api/logs/system (Debug/Error logs - Admin/Manager)
router.get('/system', auth, (req, res) => {
  if (!canViewSystemLogs(req.user.role)) return res.status(403).json({ error: 'Sadece yöneticiler hata loglarını görebilir' });

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 20), 1000);
  const logs = db.prepare(`
    SELECT l.*, u.full_name as user_name
    FROM system_logs l LEFT JOIN users u ON l.user_id=u.id
    ORDER BY l.created_at DESC LIMIT ?
  `).all(limit);

  res.json({ items: logs });
});

// GET /api/logs/screen
router.get('/screen', auth, (req, res) => {
  if (!canViewActivityLogs(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 500, 50), 1000);

  const logs = db.prepare(`
    SELECT id, visitor_id, content_id, action, start_time, end_time, duration_seconds, created_at
    FROM screen_logs
    ORDER BY created_at DESC LIMIT ?
  `).all(limit);

  const normalized = logs.map(l => ({
    id: l.id,
    visitor_id: l.visitor_id,
    content_id: l.content_id,
    action: l.action,
    start_time: l.start_time,
    end_time: l.end_time,
    duration_seconds: l.duration_seconds,
    created_at: l.created_at,
  }));

  res.json({ items: normalized, count: normalized.length });
});

// GET /api/visitors/export — CSV
router.get('/export', auth, (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 1000, 100), 5000);

  const visitors = db.prepare(`
    SELECT v.*, p.full_name as host_name
    FROM visitors v LEFT JOIN personnel p ON v.host_personnel_id=p.id
    ORDER BY v.created_at DESC LIMIT ?
  `).all(limit);

  const headers = ['ID', 'Ad Soyad', 'TC No', 'Telefon', 'Firma', 'Ziyaret Sebebi', 'Görüşülen Personel', 'Giriş', 'Çıkış', 'Durum', 'Kayıt Tarihi'];
  const rows = visitors.map(v => [
    v.id, v.full_name, v.tc_no||'', v.phone||'', v.company_name||'', v.reason||'',
    v.host_name||'', v.arrival_time||'', v.checkout_time||'', v.status, v.created_at
  ]);

  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="ziyaretciler.csv"');
  res.send('\uFEFF' + csv); // BOM for Excel Turkish charset
});

module.exports = router;
