const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database');
const authMiddleware = require('../middleware/auth');
const { normalizeManagerUserRecord } = require('../services/auth-service');
const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });

  const user = db.prepare('SELECT * FROM users WHERE username=? AND is_active=1').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
  }

  normalizeManagerUserRecord(db, user);

  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });

  // Aktivite logu
  db.prepare(`INSERT INTO activity_logs (user_id, action, entity_type, details) VALUES (?,?,?,?)`).run(
    user.id, 'login', 'user', `${user.full_name} giriş yaptı`
  );

  res.json({
    token,
    user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role, department: user.department }
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  normalizeManagerUserRecord(db, req.user);
  res.json({ user: req.user });
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, (req, res) => {
  db.prepare(`INSERT INTO activity_logs (user_id, action, entity_type, details) VALUES (?,?,?,?)`).run(
    req.user.id, 'logout', 'user', `${req.user.full_name} çıkış yaptı`
  );
  res.json({ success: true });
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Mevcut şifre ve yeni şifre gerekli' });
  }

  if (typeof new_password !== 'string' || new_password.length < 8) {
    return res.status(400).json({ error: 'Yeni şifre en az 8 karakter olmalıdır' });
  }

  if (current_password === new_password) {
    return res.status(400).json({ error: 'Yeni şifre mevcut şifre ile aynı olamaz' });
  }

  const user = db.prepare('SELECT id, full_name, password_hash FROM users WHERE id=? AND is_active=1').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(400).json({ error: 'Mevcut şifre hatalı' });
  }

  const newHash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(newHash, user.id);

  db.prepare(`INSERT INTO activity_logs (user_id, action, entity_type, details) VALUES (?,?,?,?)`).run(
    req.user.id, 'password_change', 'user', `${user.full_name} şifresini değiştirdi`
  );

  res.json({ success: true });
});

module.exports = router;
