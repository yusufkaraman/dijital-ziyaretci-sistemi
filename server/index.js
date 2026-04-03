require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { initDB, db } = require('./database');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
global.io = io;

const PORT = process.env.PORT || 3000;
const UPLOAD_PATH = process.env.UPLOAD_PATH || './server/uploads';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
if (!fs.existsSync(UPLOAD_PATH)) fs.mkdirSync(UPLOAD_PATH, { recursive: true });

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// ── TEMEL MIDDLEWARE ──────────────────────────────────────
const corsOptions = ALLOWED_ORIGINS.includes('*')
  ? { origin: '*', credentials: true }
  : { origin: ALLOWED_ORIGINS, credentials: true };

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dk
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors(corsOptions));
app.use('/api/auth/login', loginLimiter);
app.use('/api', apiLimiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.resolve(UPLOAD_PATH)));

// ── SAYFA ROUTE'LARI (static'ten ÖNCE) ───────────────────
// Böylece GET / → login.html, /panel → index.html vb. doğru çalışır
// (express.static GET / isteğinde index.html servis ederdi)
app.get('/favicon.ico', (req, res) => {
  try {
    const row = db.prepare(`
      SELECT value
      FROM system_settings
      WHERE key IN ('lobby_logo_path', 'company_logo_path')
      ORDER BY CASE key WHEN 'lobby_logo_path' THEN 0 ELSE 1 END
      LIMIT 1
    `).get();

    const configuredPath = row && row.value ? String(row.value).trim() : '';
    const fallback = path.join(PUBLIC_DIR, 'Assets', 'sitelogo.png');
    let resolved = fallback;

    if (configuredPath) {
      if (configuredPath.startsWith('/uploads/')) {
        resolved = path.resolve(UPLOAD_PATH, configuredPath.replace('/uploads/', ''));
      } else {
        resolved = path.join(PUBLIC_DIR, configuredPath.replace(/^\//, ''));
      }
    }

    if (!fs.existsSync(resolved)) resolved = fallback;
    if (!fs.existsSync(resolved)) return res.status(204).end();
    return res.sendFile(resolved);
  } catch (e) {
    return res.status(204).end();
  }
});
app.get('/',      (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'login.html')));
app.get('/panel', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get('/yonetici',(req, res) => res.sendFile(path.join(PUBLIC_DIR, 'yonetici.html')));
app.get('/lobi',  (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'lobi.html')));

// ── STATİK DOSYALAR (JS, CSS vb.) ────────────────────────
app.use(express.static(PUBLIC_DIR));

// ── API ROUTE'LARI ────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/visitors',     require('./routes/visitors'));
app.use('/api/personnel',    require('./routes/personnel'));
app.use('/api/companies',    require('./routes/companies'));
app.use('/api/contents',     require('./routes/contents'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/push',         require('./routes/push'));
app.use('/api/rooms',        require('./routes/rooms'));
app.use('/api/blacklist',    require('./routes/blacklist'));
app.use('/api/screen',       require('./routes/screen'));
app.use('/api/weather',      require('./routes/weather'));
app.use('/api/logs',         require('./routes/logs'));
app.use('/api/settings',     require('./routes/settings'));
app.use('/api/outlook',      require('./routes/outlook'));

// ── SOCKET.IO ─────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Bağlantı: ${socket.id}`);
  socket.on('disconnect', () => console.log(`🔴 Ayrıldı: ${socket.id}`));
});

// ── HATA YAKALAMA (Global Error Handler) ──────────────────
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Sistem Hatası';
  
  // Logla
  logger.error('SERVER', message, { 
    stack: err.stack, 
    path: req.path, 
    method: req.method,
    body: req.method === 'POST' ? req.body : null
  }, req.user ? req.user.id : null);

  res.status(status).json({ error: message });
});

// ── BAŞLAT ────────────────────────────────────────────────
async function start() {
  await initDB();
  logger.info('SYSTEM', 'Sunucu başlatılıyor...', { port: PORT });

  // İlk kurulumda otomatik seed
  try { require('./seed-auto'); } catch(e) { console.log('Seed:', e.message); }

  server.listen(PORT, () => {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║    BIKMAZ GRUP — Dijital Ziyaretçi Sistemi   ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  🌐 Giriş:         http://localhost:${PORT}/        ║`);
    console.log(`║  📋 Sekreter:      http://localhost:${PORT}/panel    ║`);
    console.log(`║  👔 Yönetici:      http://localhost:${PORT}/yonetici ║`);
    console.log(`║  📺 Lobi Ekranı:   http://localhost:${PORT}/lobi     ║`);
    console.log('╚══════════════════════════════════════════════╝\n');
    console.log('  Kullanıcılar:');
    console.log('  admin    / admin123');
    console.log('  sekreter / sekreter123');
    console.log('  mudur    / mudur123\n');
  });

  // ── CANLI YENİLEME (LIVE RELOAD) ────────────────────────
  // Geliştirme kolaylığı: public klasöründe değişim olunca sayfaları yeniletir.
  const fs = require('fs');
  const path = require('path');
  let reloadTimer = null;
  const publicPath = path.join(__dirname, '../public');
  if (fs.existsSync(publicPath)) {
    fs.watch(publicPath, { recursive: true }, (eventType, filename) => {
      if (filename) {
        if (reloadTimer) clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => {
          console.log(`📡 Değişim Algılandı: ${filename} - Panel yenileniyor...`);
          io.emit('system:reload');
        }, 300);
      }
    });
  }
}

if (require.main === module) {
  start().catch(console.error);
}

module.exports = { app, io, start };
