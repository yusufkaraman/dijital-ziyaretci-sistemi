const express = require('express');
const { db } = require('../database');
const auth = require('../middleware/auth');
const { canDeletePersonnel } = require('../policies/permissions');
const { getOrCreateCompany, normalizeManagerPersonnelRecord } = require('../services/personnel-service');
const router = express.Router();

// GET /api/personnel
router.get('/', auth, (req, res) => {
  normalizeManagerPersonnelRecord(db);

  const { company_id, active_only, limit, offset } = req.query;
  let sql = `SELECT p.*, c.name as company_name FROM personnel p LEFT JOIN companies c ON p.company_id=c.id WHERE 1=1`;
  const params = [];
  if (company_id) { sql += ' AND p.company_id=?'; params.push(company_id); }
  if (active_only !== 'false') { sql += ' AND p.is_active=1'; }
  sql += ' ORDER BY p.full_name';
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

// GET /api/personnel/:id
router.get('/:id', auth, (req, res) => {
  normalizeManagerPersonnelRecord(db);
  const p = db.prepare('SELECT p.*, c.name as company_name FROM personnel p LEFT JOIN companies c ON p.company_id=c.id WHERE p.id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Bulunamadı' });
  res.json(p);
});

// POST /api/personnel
router.post('/', auth, (req, res) => {
  const { company_name, full_name, title, department, phone, email, user_id } = req.body;
  if (!full_name) return res.status(400).json({ error: 'Ad soyad zorunlu' });
  const cid = getOrCreateCompany(db, company_name);
  const r = db.prepare(`INSERT INTO personnel (company_id, full_name, title, department, phone, email, user_id) VALUES (?,?,?,?,?,?,?)`).run(cid, full_name, title||null, department||null, phone||null, email||null, user_id||null);
  res.json(db.prepare('SELECT * FROM personnel WHERE id=?').get(r.lastInsertRowid));
});

// PUT /api/personnel/:id
router.put('/:id', auth, (req, res) => {
  const { company_name, full_name, title, department, phone, email, is_active, user_id } = req.body;
  const cid = getOrCreateCompany(db, company_name);
  db.prepare(`UPDATE personnel SET company_id=?, full_name=?, title=?, department=?, phone=?, email=?, is_active=?, user_id=? WHERE id=?`).run(cid, full_name, title||null, department||null, phone||null, email||null, is_active !== undefined ? is_active : 1, user_id||null, req.params.id);
  res.json(db.prepare('SELECT * FROM personnel WHERE id=?').get(req.params.id));
});

// DELETE /api/personnel/:id
router.delete('/:id', auth, (req, res) => {
  if (!canDeletePersonnel(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });
  db.prepare('UPDATE personnel SET is_active=0 WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
