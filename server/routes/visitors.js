const express = require('express');
const { db } = require('../database');
const auth = require('../middleware/auth');
const v = require('../middleware/validate');
const router = express.Router();
const {
  canAssignSelfAsHost,
  canAutoApproveVisitor,
  canDeleteVisitors,
  canUseOutlook,
} = require('../policies/permissions');
const {
  buildHostUserFilterSql,
  resolveHostUserIdFromPersonnel,
} = require('../services/appointment-service');
const { closeActiveScreenLog, startScreenLog } = require('../services/screen-service');
const {
  logVisitorActivity,
  getVisitorWithHost,
  emitSocket,
  emitScreenUpdate,
  notifyNewVisitor,
  notifyVisitorArrived,
  closeActiveVisitorSession,
} = require('../services/visitor-service');

// GET /api/visitors — tüm ziyaretçiler (filtreli)
router.get('/', auth, (req, res) => {
  const { status, date, search, host_user_id, limit, offset } = req.query;
  let sql = `SELECT v.*, p.full_name as host_name, p.title as host_title, c.name as host_company_name
             FROM visitors v LEFT JOIN personnel p ON v.host_personnel_id = p.id LEFT JOIN companies c ON c.id = p.company_id WHERE 1=1`;
  const params = [];

  if (status) { sql += ' AND v.status=?'; params.push(status); }
  if (date === 'today') { sql += ` AND date(v.created_at)=date('now','localtime')`; }
  else if (date === 'week') { sql += ` AND v.created_at >= datetime('now','-7 days','localtime')`; }
  if (search) { sql += ' AND (v.full_name LIKE ? OR v.tc_no LIKE ? OR v.company_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (host_user_id) {
    sql += ` AND ${buildHostUserFilterSql('v', 'p')}`;
    params.push(host_user_id, host_user_id, host_user_id);
  }

  sql += ' ORDER BY v.created_at DESC';
  const lim = Number.parseInt(limit, 10);
  const off = Number.parseInt(offset, 10);
  const hasLimit = Number.isInteger(lim) && lim > 0;
  const hasOffset = Number.isInteger(off) && off >= 0;
  if (hasLimit) {
    sql += ' LIMIT ?';
    params.push(Math.min(lim, 500));
    if (hasOffset) {
      sql += ' OFFSET ?';
      params.push(off);
    }
  }
  res.json(db.prepare(sql).all(...params));
});

// GET /api/visitors/active — şu an içerideki aktif ziyaretçi (ekran için)
router.get('/active', (req, res) => {
  const v = db.prepare(`SELECT v.*, p.full_name as host_name FROM visitors v LEFT JOIN personnel p ON v.host_personnel_id=p.id WHERE v.status='inside' AND v.is_screen_active=1 ORDER BY v.arrival_time DESC LIMIT 1`).get();
  res.json(v || null);
});

// GET /api/visitors/stats — dashboard istatistikleri
router.get('/stats', auth, (req, res) => {
  const { host_user_id } = req.query;
  const hId = host_user_id ? Number(host_user_id) : null;

  let v_sql = "SELECT COUNT(*) as c FROM visitors WHERE date(created_at)=date('now','localtime')";
  let i_sql = "SELECT COUNT(*) as c FROM visitors WHERE status='inside'";
  let w_sql = "SELECT COUNT(*) as c FROM visitors WHERE status='waiting'";
  let a_sql = "SELECT COUNT(*) as c FROM appointments WHERE date(planned_time)=date('now','localtime') AND status='planned'";
  
  const params = [];
  if(hId) {
    v_sql += " AND host_user_id=?";
    i_sql += " AND host_user_id=?";
    w_sql += " AND host_user_id=?";
    a_sql += " AND host_user_id=?";
    params.push(hId);
  }

  const today_total = db.prepare(v_sql).get(...params).c;
  const inside = db.prepare(i_sql).get(...params).c;
  const waiting = db.prepare(w_sql).get(...params).c;
  const appts_today = db.prepare(a_sql).get(...params).c;

  // ── AYLIK İSTATİSTİKLER (Son 30 Gün - Tüm Kurum) ─────────
  const days = [];
  const entries = [];
  const appointments = [];
  
  // 30 gün öncesine kadar olan giriş ve randevu sayılarını tek seferde çek (Performans için)
  const statsSql = (table, col, extraWhere = '') => `
    SELECT date(${col}) as d, COUNT(*) as c 
    FROM ${table}
    WHERE ${col} >= date('now', '+3 hours', '-30 days')${extraWhere}
    GROUP BY d
  `;
  
  const entriesMap = {};
  db.prepare(statsSql('visitors', 'arrival_time')).all().forEach(r => entriesMap[r.d] = r.c);
  
  const appointmentsMap = {};
  db.prepare(statsSql('appointments', 'planned_time', ` AND status != 'cancelled'`)).all().forEach(r => appointmentsMap[r.d] = r.c);

  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() + 3 * 3600000); 
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    
    // Gün etiketi (Hafta içi sadece sayı, hafta sonu veya her 5 günde bir tam tarih?)
    // Chart.js otomatik seçecektir ama biz tam etiketi verelim
    const dayLabel = d.toLocaleDateString('tr-TR', { day:'numeric', month:'short' });
    days.push(dayLabel);
    entries.push(entriesMap[dateStr] || 0);
    appointments.push(appointmentsMap[dateStr] || 0);
  }

  res.json({ 
    today_total, inside, waiting, appts_today,
    weekly: { days, entries, appointments, exits: [] } // Field name kept for compatibility
  });
});

// GET /api/visitors/:id
router.get('/:id', auth, (req, res) => {
  const v = db.prepare(`SELECT v.*, p.full_name as host_name FROM visitors v LEFT JOIN personnel p ON v.host_personnel_id=p.id WHERE v.id=?`).get(req.params.id);
  if (!v) return res.status(404).json({ error: 'Bulunamadı' });
  res.json(v);
});

// POST /api/visitors — yeni ziyaretçi kaydı
router.post(
  '/',
  auth,
  v.chain(
    v.requireFields(['full_name']),
    v.maxLength({
      full_name: 120,
      phone: 30,
      email: 120,
      company_name: 120,
      vehicle_plate: 20,
      reason: 200,
      notes: 500,
    }),
    v.validateTC('tc_no'),
    v.intField('visitor_count', { min: 1, max: 50 }),
    v.validateDate('planned_time')
  ),
  (req, res) => {
    const { full_name, tc_no, phone, email, company_name, vehicle_plate, visitor_count, host_personnel_id, reason, notes, planned_time } = req.body;

    // Kara liste kontrolü
    if (tc_no) {
      const bl = db.prepare('SELECT * FROM blacklist WHERE tc_no=?').get(tc_no);
      if (bl) return res.status(400).json({ error: `KARALİSTE: ${bl.reason}`, blacklisted: true });
    }

    // host_user_id bul (personel üzerinden)
    let host_user_id = null;
    if (host_personnel_id) {
      const hostResolution = resolveHostUserIdFromPersonnel(db, host_personnel_id, { requireActive: true });
      if (!hostResolution.found) return res.status(400).json({ error: 'Geçersiz veya pasif personel' });
      host_user_id = hostResolution.hostUserId;
    } else if (canAssignSelfAsHost(req.user.role)) {
      host_user_id = req.user.id;
    }

    const is_approved = canAutoApproveVisitor(req.user.role) ? 1 : 0;
    const { send_email } = req.body;
    
    const result = db.prepare(`
      INSERT INTO visitors (full_name, tc_no, phone, email, company_name, vehicle_plate, visitor_count,
        host_personnel_id, host_user_id, reason, notes, planned_time, status, is_approved, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'waiting',?,?)
    `).run(full_name, tc_no||null, phone||null, email||null, company_name||null, vehicle_plate||null,
      visitor_count||1, host_personnel_id||null, host_user_id, reason||null, notes||null, planned_time||null, is_approved, req.user.id);

    let createdId = result.lastInsertRowid;
    if (!createdId) {
      const fallback = db.prepare('SELECT id FROM visitors ORDER BY id DESC LIMIT 1').get();
      createdId = fallback ? fallback.id : null;
    }

    const newVisitor = createdId ? db.prepare('SELECT * FROM visitors WHERE id=?').get(createdId) : null;
    if (!newVisitor) {
      return res.status(500).json({ error: 'Ziyaretçi oluşturuldu ancak kayıt okunamadı' });
    }

    logVisitorActivity(db, req.user.id, 'visitor_created', createdId, `${full_name} kaydı oluşturuldu`);

    // Socket olayını global io'ya ilet
    emitSocket('visitor:waiting', { visitor: newVisitor, host_user_id });

    // Windows Push Bildirimi Gönder
    notifyNewVisitor(full_name, host_user_id);

    // Outlook Push Entegrasyonu (Taslak / Mock)
    if ((send_email || canUseOutlook(req.user.role)) && process.env.AZURE_CLIENT_ID) {
      console.log(`[Outlook Sync] Ziyaretçi (${newVisitor.full_name}) bildirim için Outlook'a push ediliyor...`);
    }

    res.json(newVisitor);
  }
);

// PUT /api/visitors/:id/verify — Sekreter Onayı (Beklenen Ziyaretçi)
router.put('/:id/verify', auth, (req, res) => {
  const visitor = db.prepare('SELECT * FROM visitors WHERE id=?').get(req.params.id);
  if (!visitor) return res.status(404).json({ error: 'Bulunamadı' });
  db.prepare(`UPDATE visitors SET is_approved=1 WHERE id=?`).run(req.params.id);
  const updated = getVisitorWithHost(db, req.params.id);
  logVisitorActivity(db, req.user.id, 'visitor_verified', req.params.id, `${visitor.full_name} sekreter tarafından onaylandı, giriş yapması bekleniyor.`);
  emitSocket('visitor:approved', { visitor: updated, by: req.user.full_name, host_user_id: updated.host_user_id || null });
  res.json(updated);
});

// PUT /api/visitors/:id/arrived — "Şimdi Geldi"
router.put('/:id/arrived', auth, (req, res) => {
  const visitor = db.prepare('SELECT * FROM visitors WHERE id=?').get(req.params.id);
  if (!visitor) return res.status(404).json({ error: 'Bulunamadı' });
  if (visitor.status === 'cancelled' || visitor.status === 'left') {
    return res.status(400).json({ error: 'Bu ziyaretçi için akış sonlandırılmış' });
  }

  // Önceki aktif ekran ziyaretçisini kapat
  const prevActives = closeActiveVisitorSession(db);

  db.prepare(`UPDATE visitors SET status='inside', arrival_time=datetime('now','+3 hours'), is_screen_active=1, is_approved=1 WHERE id=?`).run(req.params.id);
  const updated = getVisitorWithHost(db, req.params.id);

  logVisitorActivity(db, req.user.id, 'visitor_arrived', req.params.id, `${visitor.full_name} içeri girdi`);
  startScreenLog(db, visitor.id, null, 'welcome_start');

  // Önceki aktifi kapattıysak logla
  prevActives.forEach(pa => {
    if (pa.id === visitor.id) return;
    logVisitorActivity(db, req.user.id, 'visitor_autoclose', pa.id, `${pa.full_name} önceki aktif ziyaretçi tamamlandı`);
  });

  emitSocket('visitor:arrived', { visitor: updated, host_user_id: updated.host_user_id || null });
  emitScreenUpdate({ visitor: updated, action: 'arrived' });

  // Windows Push Bildirimi (Giriş yaptı/Lobiye geldi)
  notifyVisitorArrived(updated);

  res.json(updated);
});

// PUT /api/visitors/:id/approve — Yönetici onayı
router.put('/:id/approve', auth, (req, res) => {
  const visitor = db.prepare('SELECT * FROM visitors WHERE id=?').get(req.params.id);
  if (!visitor) return res.status(404).json({ error: 'Bulunamadı' });
  if (visitor.status === 'cancelled' || visitor.status === 'left') {
    return res.status(400).json({ error: 'Bu ziyaretçi için akış sonlandırılmış' });
  }

  // Önceki aktif ekran ziyaretçisini kapat
  closeActiveVisitorSession(db);

  db.prepare(`UPDATE visitors SET is_approved=1, status='inside', is_screen_active=1, arrival_time=COALESCE(arrival_time, datetime('now','+3 hours')) WHERE id=?`).run(req.params.id);
  const updated = getVisitorWithHost(db, req.params.id);

  logVisitorActivity(db, req.user.id, 'visitor_approved', req.params.id, `${visitor.full_name} onaylandı`);
  startScreenLog(db, visitor.id, null, 'welcome_start');

  emitSocket('visitor:approved', { visitor: updated, by: req.user.full_name, host_user_id: updated.host_user_id || null });
  emitScreenUpdate({ visitor: updated, action: 'approved' });

  res.json(updated);
});

// PUT /api/visitors/:id/reject — Yönetici reddi
router.put(
  '/:id/reject',
  auth,
  v.chain(v.maxLength({ reason: 200 })),
  (req, res) => {
  const { reason } = req.body;
  const visitor = db.prepare('SELECT * FROM visitors WHERE id=?').get(req.params.id);
  if (!visitor) return res.status(404).json({ error: 'Bulunamadı' });
  if (visitor.status === 'cancelled' || visitor.status === 'left') {
    return res.status(400).json({ error: 'Bu ziyaretçi için akış sonlandırılmış' });
  }
  db.prepare(`UPDATE visitors SET status='cancelled', is_approved=0, is_screen_active=0 WHERE id=?`).run(req.params.id);
  logVisitorActivity(db, req.user.id, 'visitor_rejected', req.params.id, `${visitor.full_name} reddedildi: ${reason||''}`);
  emitSocket('visitor:rejected', { visitor_id: req.params.id, visitor, reason, by: req.user.full_name });
  res.json({ success: true });
  }
);

// PUT /api/visitors/:id/checkout — Çıkış
router.put('/:id/checkout', auth, (req, res) => {
  const visitor = db.prepare('SELECT * FROM visitors WHERE id=?').get(req.params.id);
  if (!visitor) return res.status(404).json({ error: 'Bulunamadı' });
  if (visitor.status === 'left' || visitor.status === 'cancelled') {
    return res.status(400).json({ error: 'Bu ziyaretçi için akış sonlandırılmış' });
  }
  if (visitor.is_screen_active) closeActiveScreenLog(db);
  db.prepare(`UPDATE visitors SET status='left', checkout_time=datetime('now','+3 hours'), is_screen_active=0 WHERE id=?`).run(req.params.id);
  const updated = db.prepare('SELECT * FROM visitors WHERE id=?').get(req.params.id);
  emitSocket('visitor:checkout', { visitor: updated, host_user_id: updated.host_user_id || null });
  emitScreenUpdate({ visitor: null, action: 'checkout' });
  res.json(updated);
});

// PUT /api/visitors/:id/cancel
router.put('/:id/cancel', auth, (req, res) => {
  const visitor = db.prepare('SELECT * FROM visitors WHERE id=?').get(req.params.id);
  if (!visitor) return res.status(404).json({ error: 'Bulunamadı' });
  if (visitor.status === 'cancelled' || visitor.status === 'left') {
    return res.status(400).json({ error: 'Bu ziyaretçi için akış sonlandırılmış' });
  }
  if (visitor.is_screen_active) closeActiveScreenLog(db);
  db.prepare(`UPDATE visitors SET status='cancelled', is_screen_active=0 WHERE id=?`).run(req.params.id);
  logVisitorActivity(db, req.user.id, 'visitor_cancelled', req.params.id, `${visitor.full_name} iptal edildi`);
  emitSocket('visitor:cancelled', { id: req.params.id });
  emitScreenUpdate({ visitor: null, action: 'cancel' });
  res.json({ success: true });
});

// DELETE /api/visitors/:id
router.delete('/:id', auth, (req, res) => {
  if (!canDeleteVisitors(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });
  db.prepare('DELETE FROM visitors WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
