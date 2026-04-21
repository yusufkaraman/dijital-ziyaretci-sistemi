process.env.TZ = 'Europe/Istanbul';
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const prisma = require('./prisma');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);
const ALLOWED_ORIGINS_RAW = (process.env.ALLOWED_ORIGINS || '*').split(',').map(o => o.trim()).filter(Boolean);
const ioCorsOrigin = ALLOWED_ORIGINS_RAW.includes('*') ? '*' : ALLOWED_ORIGINS_RAW;
const io = new Server(server, { cors: { origin: ioCorsOrigin, credentials: true } });
global.io = io;

const PORT = process.env.PORT || 3000;
const UPLOAD_PATH = process.env.UPLOAD_PATH || './server/uploads';
if (!fs.existsSync(UPLOAD_PATH)) fs.mkdirSync(UPLOAD_PATH, { recursive: true });

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// ── TEMEL MIDDLEWARE ──────────────────────────────────────
const corsOptions = ALLOWED_ORIGINS_RAW.includes('*')
  ? { origin: '*', credentials: true }
  : { origin: ALLOWED_ORIGINS_RAW, credentials: true };

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

const publicReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
});

function onlyGet(middleware) {
  return function onlyGetWrapper(req, res, next) {
    if (req.method !== 'GET') return next();
    return middleware(req, res, next);
  };
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(corsOptions));
app.use('/api/auth/login', loginLimiter);
app.use('/api', apiLimiter);
app.use('/api/contents', onlyGet(publicReadLimiter));
app.use('/api/weather', onlyGet(publicReadLimiter));
app.use('/api/news', onlyGet(publicReadLimiter));
app.use('/api/screen', onlyGet(publicReadLimiter));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
// Uploads: lobi ekranı (unauthenticated) ve panel (authenticated) erişimi
// Lobi ekranı /uploads/ altındaki medyayı doğrudan kullanır, bu yüzden public bırakıyoruz.
// Hassas dosyalar uploads'a yüklenmemeli; sadece medya (resim/video) kabul ediliyor.
app.use('/uploads', express.static(path.resolve(UPLOAD_PATH)));

// ── SAYFA ROUTE'LARI (static'ten ÖNCE) ───────────────────
// Böylece GET / → login.html, /panel → index.html vb. doğru çalışır
// (express.static GET / isteğinde index.html servis ederdi)
app.get('/favicon.ico', async (req, res) => {
  try {
    const row = await prisma.systemSetting.findFirst({
      where: { key: { in: ['lobby_logo_path', 'company_logo_path'] } },
      orderBy: { key: 'asc' },
      select: { value: true },
    });

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
app.use('/api/news',         require('./routes/news'));

// ── HEALTH CHECK ─────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', uptime: process.uptime(), db: 'connected' });
  } catch (e) {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ── SOCKET.IO ─────────────────────────────────────────────
const jwt = require('jsonwebtoken');
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    socket.user = decoded;
  } catch (_) { /* geçersiz token — anonim bağlantı olarak devam */ }
  next();
});
io.on('connection', (socket) => {
  socket.on('disconnect', () => {});
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
  // ── Ortam değişkeni doğrulaması ────────────────────────
  const requiredEnv = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = requiredEnv.filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`\n❌ Eksik ortam değişkenleri: ${missing.join(', ')}\n   .env dosyasını kontrol edin.\n`);
    process.exit(1);
  }
  if (process.env.JWT_SECRET.length < 32) {
    console.error('\n❌ JWT_SECRET en az 32 karakter olmalı.\n');
    process.exit(1);
  }
  if (process.env.NODE_ENV === 'production' && ALLOWED_ORIGINS_RAW.includes('*')) {
    console.warn('\n⚠️  UYARI: ALLOWED_ORIGINS="*" üretim ortamında güvenlik riski oluşturur.\n');
  }

  // ── PostgreSQL / Prisma ────────────────────────────────
  await prisma.$connect();
  logger.info('SYSTEM', 'PostgreSQL bağlantısı kuruldu (Prisma)');

  const screenApiKey = (process.env.SCREEN_API_KEY || '').trim();
  if (!screenApiKey) {
    const warningMessage = 'SCREEN_API_KEY tanimli degil; /api/screen/log gelistirme modunda korumasiz calisacak.';
    if (process.env.NODE_ENV === 'production') {
      console.error('\nSCREEN_API_KEY production ortaminda zorunludur.\n');
      process.exit(1);
    }
    console.warn(`\nUYARI: ${warningMessage}\n`);
    logger.warn('SYSTEM', warningMessage, { route: '/api/screen/log' });
  }

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
  });

  // ── CANLI YENİLEME (LIVE RELOAD) — sadece geliştirme ortamında ──
  if (process.env.NODE_ENV !== 'production') {
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
}

if (require.main === module) {
  start().catch(console.error);
}

// ── GRACEFUL SHUTDOWN ─────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n🛑 ${signal} alındı — bağlantılar kapatılıyor...`);
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

module.exports = { app, io, start };
