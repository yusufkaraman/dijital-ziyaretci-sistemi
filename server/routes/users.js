const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const auth = require('../middleware/auth');
const {
  ALLOWED_USER_ROLES,
  canManageUsers,
  canSecretaryManageRole,
} = require('../policies/permissions');
const {
  validatePasswordPolicy,
  normalizeCompanyId,
  getUserById,
  ensurePersonnelRecordsForUsers,
  syncPersonnelCompanyForUser,
} = require('../services/user-service');
const router = express.Router();

// GET /api/users
router.get('/', auth, (req, res) => {
  if (!canManageUsers(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });
  ensurePersonnelRecordsForUsers(db);
  let sql = `
    SELECT
      u.id, u.username, u.full_name, u.role, u.department, u.is_active, u.created_at,
      p.company_id,
      c.name as company_name
    FROM users u
    LEFT JOIN personnel p ON p.user_id=u.id AND p.is_active=1
    LEFT JOIN companies c ON c.id=p.company_id
    WHERE 1=1
  `;
  const params = [];

  if (req.user.role === 'secretary') {
    sql += ' AND u.role IN (?, ?)';
    params.push('secretary', 'personnel');
  }

  sql += ' ORDER BY u.id';

  const { limit, offset } = req.query;
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

// POST /api/users
router.post('/', auth, (req, res) => {
  if (!canManageUsers(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });
  const { username, password, full_name, role, department, company_id } = req.body;
  if (!username || !password || !full_name || !role) return res.status(400).json({ error: 'Eksik bilgi' });

  if (!ALLOWED_USER_ROLES.has(role)) return res.status(400).json({ error: 'Geçersiz rol' });

  if (req.user.role === 'secretary' && !canSecretaryManageRole(role)) {
    return res.status(403).json({ error: 'Sekreter sadece secretary/personnel kullanicilari yonetebilir' });
  }

  if (!validatePasswordPolicy(password)) {
    return res.status(400).json({ error: 'Şifre en az 8 karakter olmalıdır' });
  }

  const normalizedCompanyId = normalizeCompanyId(company_id);
  if (!normalizedCompanyId) {
    return res.status(400).json({ error: 'Yeni kullanıcı için şirket seçimi zorunludur' });
  }

  const hash = bcrypt.hashSync(password, 10);
  try {
    const r = db.prepare(`INSERT INTO users (username, password_hash, full_name, role, department) VALUES (?,?,?,?,?)`).run(username, hash, full_name, role, department||null);
    // lastInsertRowid can be BigInt in some better-sqlite3 versions; also fallback if 0
    let newUserId = Number(r.lastInsertRowid);
    if (!newUserId) {
      const fallback = db.prepare('SELECT id FROM users WHERE username=?').get(username);
      newUserId = fallback ? fallback.id : null;
    }
    if (!newUserId) return res.status(500).json({ error: 'Kullanıcı oluşturuldu ancak ID alınamadı' });
    
    syncPersonnelCompanyForUser(db, {
      userId: newUserId,
      companyId: normalizedCompanyId,
      fullName: full_name,
      department,
    });
    ensurePersonnelRecordsForUsers(db);
    res.json(getUserById(db, newUserId));
  } catch(e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Bu kullanıcı adı zaten alınmış' });
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/users/:id
router.put('/:id', auth, (req, res) => {
  if (!canManageUsers(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });
  const { full_name, role, department, is_active, password, company_id } = req.body;

  const targetUser = getUserById(db, req.params.id);
  if (!targetUser) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

  if (role && !ALLOWED_USER_ROLES.has(role)) {
    return res.status(400).json({ error: 'Geçersiz rol' });
  }

  const nextFullName = (full_name === undefined || full_name === null || full_name === '') ? targetUser.full_name : full_name;
  const nextRole = role || targetUser.role;
  const nextDepartment = (department === undefined) ? targetUser.department : (department || null);
  const nextActive = is_active === undefined ? targetUser.is_active : (is_active ? 1 : 0);
  const nextCompanyId = normalizeCompanyId(company_id);

  if (req.user.role === 'secretary') {
    // Secretary can manage only secretary/personnel rows and cannot elevate roles.
    if (!canSecretaryManageRole(targetUser.role) || !canSecretaryManageRole(nextRole)) {
      return res.status(403).json({ error: 'Sekreter sadece secretary/personnel kullanicilari yonetebilir' });
    }
  }

  if (password) {
    if (!validatePasswordPolicy(password)) {
      return res.status(400).json({ error: 'Şifre en az 8 karakter olmalıdır' });
    }
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(`UPDATE users SET full_name=?, role=?, department=?, is_active=?, password_hash=? WHERE id=?`).run(nextFullName, nextRole, nextDepartment, nextActive, hash, req.params.id);
  } else {
    db.prepare(`UPDATE users SET full_name=?, role=?, department=?, is_active=? WHERE id=?`).run(nextFullName, nextRole, nextDepartment, nextActive, req.params.id);
  }
  syncPersonnelCompanyForUser(db, {
    userId: Number.parseInt(req.params.id, 10),
    companyId: nextCompanyId,
    fullName: nextFullName,
    department: nextDepartment,
  });
  ensurePersonnelRecordsForUsers(db);
  res.json(getUserById(db, req.params.id));
});

// DELETE /api/users/:id
router.delete('/:id', auth, (req, res) => {
  if (!canManageUsers(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });
  
  const targetUser = getUserById(db, req.params.id);
  if (!targetUser) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

  if (req.user.role === 'secretary' && !canSecretaryManageRole(targetUser.role)) {
    return res.status(403).json({ error: 'Sekreter sadece secretary/personnel kullanicilari yonetebilir' });
  }
  
  db.prepare('UPDATE users SET is_active=0 WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
