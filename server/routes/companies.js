const express = require('express');
const { db } = require('../database');
const auth = require('../middleware/auth');
const { canManageCompanies, canDeleteCompany } = require('../policies/permissions');
const router = express.Router();

// GET /api/companies
router.get('/', auth, (req, res) => {
  const { active_only, limit, offset } = req.query;
  let sql = 'SELECT * FROM companies WHERE 1=1';
  const params = [];
  if (active_only !== 'false') sql += ' AND is_active=1';
  sql += ' ORDER BY is_default DESC, name';
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

// POST /api/companies
router.post('/', auth, (req, res) => {
  if (!canManageCompanies(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });
  const { name, theme_color, is_default } = req.body;
  if (!name) return res.status(400).json({ error: 'Firma adı zorunlu' });
  if (is_default) db.prepare('UPDATE companies SET is_default=0').run();
  const r = db.prepare(`INSERT INTO companies (name, theme_color, is_default) VALUES (?,?,?)`).run(name, theme_color||'#1a56db', is_default?1:0);
  res.json(db.prepare('SELECT * FROM companies WHERE id=?').get(r.lastInsertRowid));
});

// PUT /api/companies/:id
router.put('/:id', auth, (req, res) => {
  if (!canManageCompanies(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });
  const { name, theme_color, is_default, is_active } = req.body;
  if (is_default) db.prepare('UPDATE companies SET is_default=0').run();
  db.prepare(`UPDATE companies SET name=?, theme_color=?, is_default=?, is_active=? WHERE id=?`).run(name, theme_color||'#1a56db', is_default?1:0, is_active!==undefined?is_active:1, req.params.id);
  res.json(db.prepare('SELECT * FROM companies WHERE id=?').get(req.params.id));
});

// PUT /api/companies/:id/default
router.put('/:id/default', auth, (req, res) => {
  if (!canManageCompanies(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });
  db.prepare('UPDATE companies SET is_default=0').run();
  db.prepare('UPDATE companies SET is_default=1 WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// DELETE /api/companies/:id
router.delete('/:id', auth, (req, res) => {
  if (!canDeleteCompany(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });
  const company = db.prepare('SELECT id, name, is_active, is_default FROM companies WHERE id=?').get(req.params.id);
  if (!company) return res.status(404).json({ error: 'Firma bulunamadı' });
  if (!company.is_active) return res.json({ success: true });

  const activeCount = db.prepare('SELECT COUNT(1) as cnt FROM companies WHERE is_active=1').get().cnt;
  if (activeCount <= 1) return res.status(400).json({ error: 'En az bir aktif firma kalmalıdır' });

  if (company.is_default) {
    const fallback = db.prepare(`
      SELECT id
      FROM companies
      WHERE is_active=1 AND id<>?
      ORDER BY name
      LIMIT 1
    `).get(req.params.id);
    if (!fallback) return res.status(400).json({ error: 'Varsayılan firma değiştirilemedi' });
    db.prepare('UPDATE companies SET is_default=0 WHERE id=?').run(req.params.id);
    db.prepare('UPDATE companies SET is_default=1 WHERE id=?').run(fallback.id);
  }

  db.prepare('UPDATE companies SET is_active=0 WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
