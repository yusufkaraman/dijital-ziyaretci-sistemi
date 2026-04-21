const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const authMiddleware = require('../middleware/auth');
const { normalizeManagerUserRecord } = require('../services/auth-service');
const router = express.Router();

// ── Brute Force Koruması ─────────────────────────────────
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000; // 15 dakika
const loginAttempts = new Map(); // username -> { count, lockedUntil }

function checkLoginBlock(username) {
  const entry = loginAttempts.get(username);
  if (!entry) return false;
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) return true;
  if (entry.lockedUntil && Date.now() >= entry.lockedUntil) { loginAttempts.delete(username); return false; }
  return false;
}

function recordFailedLogin(username) {
  const entry = loginAttempts.get(username) || { count: 0, lockedUntil: null };
  entry.count++;
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOGIN_LOCK_MS;
  }
  loginAttempts.set(username, entry);
  return entry;
}

function clearLoginAttempts(username) {
  loginAttempts.delete(username);
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });

    // Brute force kontrolü
    if (checkLoginBlock(username)) {
      const entry = loginAttempts.get(username);
      const remainMin = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({ error: `Çok fazla başarısız deneme. ${remainMin} dakika sonra tekrar deneyin.` });
    }

    const user = await prisma.user.findFirst({
      where: { username, isActive: true },
    });

    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      const entry = recordFailedLogin(username);
      const remaining = LOGIN_MAX_ATTEMPTS - entry.count;
      if (entry.lockedUntil) {
        return res.status(429).json({ error: 'Çok fazla başarısız deneme. 15 dakika sonra tekrar deneyin.' });
      }
      return res.status(401).json({ error: `Kullanıcı adı veya şifre hatalı (${remaining} deneme hakkı kaldı)` });
    }

    clearLoginAttempts(username);

    await normalizeManagerUserRecord(prisma, user);

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '24h' });

    // Aktivite logu
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'login',
        entityType: 'user',
        details: `${user.fullName} giriş yaptı`,
      },
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.fullName,
        role: user.role,
        department: user.department,
      },
    });
  } catch (e) {
    console.error('Login hatası:', e.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    await normalizeManagerUserRecord(prisma, req.user);
    res.json({ user: req.user });
  } catch (e) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'logout',
        entityType: 'user',
        details: `${req.user.full_name} çıkış yaptı`,
      },
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
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

    const user = await prisma.user.findFirst({
      where: { id: req.user.id, isActive: true },
      select: { id: true, fullName: true, passwordHash: true },
    });
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

    if (!bcrypt.compareSync(current_password, user.passwordHash)) {
      return res.status(400).json({ error: 'Mevcut şifre hatalı' });
    }

    const newHash = bcrypt.hashSync(new_password, 10);

    // Plan §4.7: user update + activity log atomik
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      }),
      prisma.activityLog.create({
        data: {
          userId: req.user.id,
          action: 'password_change',
          entityType: 'user',
          details: `${user.fullName} şifresini değiştirdi`,
        },
      }),
    ]);

    res.json({ success: true });
  } catch (e) {
    console.error('Şifre değiştirme hatası:', e.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;
