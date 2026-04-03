const express = require('express');
const { db } = require('../database');
const auth = require('../middleware/auth');
const { canUseOutlook } = require('../policies/permissions');
const {
  buildHostUserFilterSql,
  resolveHostUserIdFromPersonnel,
} = require('../services/appointment-service');
const router = express.Router();

// GET /api/appointments
router.get('/', auth, (req, res) => {
  const { date, status, host_user_id, company, limit, offset } = req.query;
  let sql = `
    SELECT
      a.*, p.full_name as host_name, p.title as host_title, p.email as host_email,
      c.name as host_company_name
    FROM appointments a
    LEFT JOIN personnel p ON a.host_personnel_id=p.id
    LEFT JOIN companies c ON p.company_id=c.id
    WHERE a.status != 'cancelled'
  `;
  const params = [];

  if (date === 'today') { 
    sql += ` AND date(a.planned_time) = date('now','+3 hours')`; 
  } else if (date === 'week') { 
    sql += ` AND a.planned_time >= datetime('now','-1 day','+3 hours') AND a.planned_time <= datetime('now','+7 days','+3 hours')`; 
  } else if (date && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    sql += ` AND date(a.planned_time) = ?`;
    params.push(date);
  } else {
    // Hiçbir tarih seçilmediyse: Sadece Gelecek (veya Bugün)
    sql += ` AND a.planned_time >= date('now','+3 hours')`;
  }

  if (status) { sql += ' AND a.status=?'; params.push(status); }
  if (host_user_id) {
    sql += ` AND ${buildHostUserFilterSql('a', 'p')}`;
    params.push(host_user_id, host_user_id, host_user_id);
  }
  if (company && company !== 'all') {
    sql += ' AND lower(trim(coalesce(a.visitor_company,\'\'))) = lower(trim(?))';
    params.push(company);
  }
  
  sql += ' ORDER BY a.planned_time ASC';
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

// POST /api/appointments
router.post('/', auth, (req, res) => {
  const { visitor_name, visitor_tc, visitor_phone, visitor_email, visitor_company, vehicle_plate, visitor_count, host_personnel_id, reason, notes, planned_time } = req.body;
  if (!visitor_name || !planned_time) return res.status(400).json({ error: 'Ad ve zaman zorunlu' });
  const hostResolution = resolveHostUserIdFromPersonnel(db, host_personnel_id);
  const host_user_id = hostResolution.hostUserId;
  const r = db.prepare(`INSERT INTO appointments (visitor_name, visitor_tc, visitor_phone, visitor_email, visitor_company, vehicle_plate, visitor_count, host_personnel_id, host_user_id, reason, notes, planned_time, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(visitor_name, visitor_tc||null, visitor_phone||null, visitor_email||null, visitor_company||null, vehicle_plate||null, visitor_count||1, host_personnel_id||null, host_user_id, reason||null, notes||null, planned_time, req.user.id);
  const newAppt = db.prepare('SELECT * FROM appointments WHERE id=?').get(r.lastInsertRowid);

  // Outlook Push Entegrasyonu (Taslak / Mock)
  if (canUseOutlook(req.user.role) && process.env.AZURE_CLIENT_ID) {
    console.log(`[Outlook Sync] Randevu (${newAppt.visitor_name}) yöneticinin Outlook takvimine push ediliyor...`);
    // const client = Client.init({...});
    // client.api('/me/events').post({ subject: newAppt.reason, start: {...}, end: {...} });
  }

  res.json(newAppt);
});

// PUT /api/appointments/:id
router.put('/:id', auth, (req, res) => {
  const { visitor_name, visitor_tc, visitor_phone, visitor_email, visitor_company, vehicle_plate, visitor_count, host_personnel_id, reason, notes, planned_time, status } = req.body;
  const hostResolution = resolveHostUserIdFromPersonnel(db, host_personnel_id);
  const host_user_id = hostResolution.hostUserId;
  db.prepare(`UPDATE appointments SET visitor_name=?, visitor_tc=?, visitor_phone=?, visitor_email=?, visitor_company=?, vehicle_plate=?, visitor_count=?, host_personnel_id=?, host_user_id=?, reason=?, notes=?, planned_time=?, status=? WHERE id=?`).run(visitor_name, visitor_tc||null, visitor_phone||null, visitor_email||null, visitor_company||null, vehicle_plate||null, visitor_count||1, host_personnel_id||null, host_user_id, reason||null, notes||null, planned_time, status||'planned', req.params.id);
  res.json(db.prepare('SELECT * FROM appointments WHERE id=?').get(req.params.id));
});

// PUT /api/appointments/:id/cancel
router.put('/:id/cancel', auth, (req, res) => {
  db.prepare(`UPDATE appointments SET status='cancelled' WHERE id=?`).run(req.params.id);
  res.json({ success: true });
});

// POST /api/appointments/:id/checkin (Atomic Appointment-to-Visitor)
router.post('/:id/checkin', auth, (req, res) => {
  const appt = db.prepare('SELECT * FROM appointments WHERE id=? AND status=?').get(req.params.id, 'planned');
  if (!appt) return res.status(404).json({ error: 'Randevu bulunamadı veya daha önceden işlem yapılmış' });
  
  // Start a transaction to ensure atomicity
  const checkinTx = db.transaction((appointment) => {
    // 1. Create the visitor
    const r = db.prepare(`INSERT INTO visitors (full_name, tc_no, phone, email, company_name, host_personnel_id, host_user_id, reason, status, is_approved, is_screen_active, created_by, visitor_count) VALUES (?,?,?,?,?,?,?,?,'waiting',0,0,?,?)`).run(
      appointment.visitor_name, appointment.visitor_tc, appointment.visitor_phone, appointment.visitor_email, appointment.visitor_company, appointment.host_personnel_id, appointment.host_user_id, appointment.reason || 'Randevu: ' + appointment.visitor_name, req.user.id, appointment.visitor_count || 1
    );
    const newVisitorId = r.lastInsertRowid;
    // 2. Mark appointment as arrived
    db.prepare(`UPDATE appointments SET status='arrived' WHERE id=?`).run(appointment.id);
    return newVisitorId;
  });

  try {
    const newVisitorId = checkinTx(appt);
    const visitorObj = db.prepare('SELECT * FROM visitors WHERE id=?').get(newVisitorId);
    
    // Emit waiting socket event
    if (global.io) {
      global.io.emit('visitor:waiting', { visitor: visitorObj, host_user_id: visitorObj.host_user_id });
    }
    
    res.json(visitorObj);
  } catch (err) {
    res.status(500).json({ error: 'Atomik check-in işlemi başarısız', details: err.message });
  }
});

// DELETE /api/appointments/:id
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM appointments WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
