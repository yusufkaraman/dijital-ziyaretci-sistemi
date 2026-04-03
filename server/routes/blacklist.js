const express = require('express');
const { db } = require('../database');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/blacklist
router.get('/', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM blacklist ORDER BY created_at DESC').all());
});

// GET /api/blacklist/check/:tc — Auth gerektirmez (check-in ekranı için)
router.get('/check/:tc', (req, res) => {
  const entry = db.prepare('SELECT * FROM blacklist WHERE tc_no=?').get(req.params.tc);
  res.json({ blacklisted: !!entry, entry: entry || null });
});

// POST /api/blacklist
router.post('/', auth, (req, res) => {
  const { full_name, tc_no, company, reason } = req.body;
  if (!full_name) return res.status(400).json({ error: 'Ad soyad zorunlu' });
  const r = db.prepare('INSERT INTO blacklist (full_name, tc_no, company, reason, added_by) VALUES (?,?,?,?,?)').run(full_name, tc_no||null, company||null, reason||null, req.user.id);
  res.json(db.prepare('SELECT * FROM blacklist WHERE id=?').get(r.lastInsertRowid));
});

// DELETE /api/blacklist/:id
router.delete('/:id', auth, (req, res) => {
  db.prepare('DELETE FROM blacklist WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;

