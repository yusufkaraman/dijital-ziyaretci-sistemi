const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const DB_PATH = path.resolve(process.env.DB_PATH || './server/database.db');
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

// sql.js senkron wrapper - better-sqlite3 API'sine benzer arayüz sağlar
class SyncDB {
  constructor(sqlJs, buffer) {
    this._db = new sqlJs.Database(buffer || null);
    this._path = DB_PATH;
    this._dirty = false;
  }

  _save() {
    const data = this._db.export();
    fs.writeFileSync(this._path, Buffer.from(data));
  }

  exec(sql) {
    this._db.run(sql);
    this._dirty = true;
    this._save();
  }

  pragma(p) { } // no-op for sql.js

  prepare(sql) {
    const db = this;
    return {
      run(...params) {
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        db._db.run(sql, flatParams.map(p => p === undefined ? null : p));
        db._dirty = true;
        db._save();
        // Get last insert rowid
        const r = db._db.exec('SELECT last_insert_rowid() as id');
        const lastInsertRowid = r.length ? r[0].values[0][0] : null;
        return { lastInsertRowid };
      },
      get(...params) {
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const stmt = db._db.prepare(sql);
        stmt.bind(flatParams.map(p => p === undefined ? null : p));
        if (stmt.step()) {
          const cols = stmt.getColumnNames();
          const vals = stmt.get();
          stmt.free();
          const obj = {};
          cols.forEach((c, i) => obj[c] = vals[i]);
          return obj;
        }
        stmt.free();
        return undefined;
      },
      all(...params) {
        const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const results = [];
        try {
          const stmt = db._db.prepare(sql);
          if (flatParams.length > 0) {
            stmt.bind(flatParams.map(p => (p === undefined || p === null) ? null : p));
          }
          while (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            const obj = {};
            cols.forEach((c, i) => obj[c] = vals[i]);
            results.push(obj);
          }
          stmt.free();
        } catch(e) { console.error('all() error:', e.message, '\nSQL:', sql, '\nParams:', flatParams); }
        return results;
      }
    };
  }
}

// Veritabanını başlat (sync wrapper kullanarak)
let dbInstance = null;

async function initDB() {
  if (dbInstance) return dbInstance;
  const SQL = await initSqlJs();
  let buffer = null;
  if (fs.existsSync(DB_PATH)) {
    buffer = fs.readFileSync(DB_PATH);
  }
  dbInstance = new SyncDB(SQL, buffer);

  // Tablolar
  dbInstance.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','+3 hours'))
);
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  logo_path TEXT,
  theme_color TEXT DEFAULT '#1a56db',
  is_default INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','+3 hours'))
);
CREATE TABLE IF NOT EXISTS personnel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  full_name TEXT NOT NULL,
  title TEXT,
  department TEXT,
  phone TEXT,
  email TEXT,
  user_id INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','+3 hours'))
);
CREATE TABLE IF NOT EXISTS visitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  tc_no TEXT,
  phone TEXT,
  email TEXT,
  company_name TEXT,
  vehicle_plate TEXT,
  visitor_count INTEGER DEFAULT 1,
  host_personnel_id INTEGER,
  host_user_id INTEGER,
  reason TEXT,
  notes TEXT,
  status TEXT DEFAULT 'waiting',
  is_approved INTEGER DEFAULT 0,
  is_screen_active INTEGER DEFAULT 0,
  planned_time TEXT,
  arrival_time TEXT,
  checkout_time TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now','+3 hours'))
);
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_name TEXT NOT NULL,
  visitor_tc TEXT,
  visitor_phone TEXT,
  visitor_email TEXT,
  visitor_company TEXT,
  vehicle_plate TEXT,
  visitor_count INTEGER DEFAULT 1,
  host_personnel_id INTEGER,
  host_user_id INTEGER,
  reason TEXT,
  notes TEXT,
  planned_time TEXT NOT NULL,
  status TEXT DEFAULT 'planned',
  visitor_id INTEGER,
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now','+3 hours'))
);
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  capacity INTEGER DEFAULT 10,
  floor TEXT,
  equipment TEXT,
  status TEXT DEFAULT 'available',
  current_visitor_id INTEGER,
  created_at TEXT DEFAULT (datetime('now','+3 hours'))
);
CREATE TABLE IF NOT EXISTS room_reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  user_id INTEGER,
  title TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now','+3 hours'))
);
CREATE TABLE IF NOT EXISTS blacklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  tc_no TEXT,
  company TEXT,
  reason TEXT,
  added_by INTEGER,
  created_at TEXT DEFAULT (datetime('now','+3 hours'))
);
CREATE TABLE IF NOT EXISTS contents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER,
  type TEXT NOT NULL,
  file_path TEXT,
  title TEXT,
  content_text TEXT,
  display_order INTEGER DEFAULT 0,
  is_default INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','+3 hours'))
);
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now','+3 hours'))
);
CREATE TABLE IF NOT EXISTS screen_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id INTEGER,
  content_id INTEGER,
  action TEXT,
  start_time TEXT,
  end_time TEXT,
  duration_seconds INTEGER,
  created_at TEXT DEFAULT (datetime('now','+3 hours'))
);
CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  label TEXT,
  updated_at TEXT DEFAULT (datetime('now','+3 hours'))
);
CREATE TABLE IF NOT EXISTS system_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT DEFAULT 'info',
  module TEXT,
  message TEXT NOT NULL,
  details TEXT,
  user_id INTEGER,
  created_at TEXT DEFAULT (datetime('now','+3 hours'))
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  subscription TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now','+3 hours')),
  UNIQUE(user_id, subscription)
);
  `);

  // Performans indeksleri (400+ kullanıcı ve yoğun filtreleme için)
  dbInstance.exec(`
CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, is_active);
CREATE INDEX IF NOT EXISTS idx_personnel_company_active ON personnel(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_personnel_user_id ON personnel(user_id);
CREATE INDEX IF NOT EXISTS idx_visitors_status_created ON visitors(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitors_host_user_created ON visitors(host_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitors_host_personnel_created ON visitors(host_personnel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitors_created_at ON visitors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitors_tc_no ON visitors(tc_no);
CREATE INDEX IF NOT EXISTS idx_appointments_planned_status ON appointments(planned_time ASC, status);
CREATE INDEX IF NOT EXISTS idx_appointments_host_user_planned ON appointments(host_user_id, planned_time ASC);
CREATE INDEX IF NOT EXISTS idx_appointments_host_personnel_planned ON appointments(host_personnel_id, planned_time ASC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_screen_logs_visitor_created ON screen_logs(visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_screen_logs_start_time ON screen_logs(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_companies_default_active ON companies(is_default, is_active);
  `);

  // Varsayılan ayarlar
  const defaultSettings = [
    ['welcome_message', 'Hoş Geldiniz', 'Karşılama Mesajı'],
    ['company_name', 'Bıkmaz Grup Lobi Ekranı', 'Şirket Adı'],
    ['screen_rotation_seconds', '10', 'Ekran Döngü Süresi (sn)'],
    ['lobby_logo_path', '/Assets/sitelogo.png', 'Lobi Logo Yolu'],
    ['lobby_bg_overlay', '0.4', 'Lobi Arka Plan Karartma (0.0-1.0)'],
    ['lobby_video_bg', '1', 'Videolar Arka Planda Oynasın (1/0)'],
    ['lobby_media_enabled', '1', 'Lobi Medyası Aktif (1/0)'],
    ['lobby_box_width', '650px', 'Lobi Kutusu Genişliği'],
    ['lobby_box_vertical_pos', '50%', 'Lobi Kutusu Dikey Konum (%)'],
    ['lobby_box_padding', '50px 100px', 'Lobi Kutusu İç Boşluk'],
    ['notification_sound', '1', 'Bildirim Sesi'],
    ['weather_city', 'Çankaya, Ankara', 'Lobi Ekranı Hava Durumu Şehri'],
  ];
  for (const [k, v, l] of defaultSettings) {
    const exists = dbInstance.prepare('SELECT id FROM system_settings WHERE key=?').get(k);
    if (!exists) dbInstance.prepare('INSERT INTO system_settings (key, value, label) VALUES (?,?,?)').run(k, v, l);
  }

  // Eski marka değerlerini yeni marka adına normalize et
  dbInstance.prepare(`
    UPDATE system_settings
    SET value='Bıkmaz Grup Lobi Ekranı'
    WHERE key='company_name' AND (
      value LIKE 'VisiDesk%' OR
      value LIKE 'Simdesk%' OR
      value LIKE 'Simsoft%'
    )
  `).run();

  // Mevcut kurulumlar için şirket sözlüğünü güvenli şekilde tamamla
  const companyDictionary = [
    ['BIKMAZ GRUP', '#0b3d2e', 1],
    ['BETA', '#1a56db', 0],
    ['TETA', '#0891b2', 0],
    ['SIMSOFT', '#0f766e', 0],
    ['SmartICT', '#7c3aed', 0],
    ['Airobos', '#b45309', 0],
    ['Agrobrain', '#166534', 0],
    ['Avaitech', '#1d4ed8', 0],
  ];
  for (const [name, color, isDefault] of companyDictionary) {
    const exists = dbInstance.prepare('SELECT id FROM companies WHERE name=? LIMIT 1').get(name);
    if (!exists) {
      dbInstance.prepare(`
        INSERT INTO companies (name, theme_color, is_default, is_active)
        VALUES (?,?,?,1)
      `).run(name, color, isDefault);
    }
  }
  dbInstance.prepare('UPDATE companies SET is_default=0').run();
  dbInstance.prepare("UPDATE companies SET is_default=1 WHERE name='BIKMAZ GRUP'").run();

  // Eski sekreter adını normalize et
  dbInstance.prepare(`
    UPDATE users
    SET full_name='Gulmira Bakmaz'
    WHERE username='sekreter' AND full_name IN ('Ayşe Yılmaz', 'Ayse Yilmaz')
  `).run();

  // Eski müdür adını sadece mudur hesabı için normalize et
  dbInstance.prepare(`
    UPDATE users
    SET full_name='İsmail Bıkmaz'
    WHERE username='mudur' AND full_name IN ('İsmail Karaman', 'Ismail Karaman')
  `).run();
  dbInstance.prepare(`
    UPDATE personnel
    SET full_name='İsmail Bıkmaz'
    WHERE user_id=(SELECT id FROM users WHERE username='mudur' LIMIT 1)
      AND full_name IN ('İsmail Karaman', 'Ismail Karaman')
  `).run();

  // Geçersiz user_id=0 değerlerini temizle, eşleşebilen personeli kullanıcıyla bağla
  dbInstance.prepare(`UPDATE personnel SET user_id=NULL WHERE user_id=0`).run();
  dbInstance.prepare(`
    UPDATE personnel
    SET user_id=(
      SELECT u.id
      FROM users u
      WHERE lower(trim(u.full_name)) = lower(trim(personnel.full_name))
      LIMIT 1
    )
    WHERE (user_id IS NULL OR user_id=0)
      AND EXISTS (
        SELECT 1
        FROM users u2
        WHERE lower(trim(u2.full_name)) = lower(trim(personnel.full_name))
      )
  `).run();

  // Geçmiş kayıtlar için host_user_id alanını personel bağından türet
  dbInstance.prepare(`
    UPDATE appointments
    SET host_user_id=(SELECT NULLIF(p.user_id,0) FROM personnel p WHERE p.id=appointments.host_personnel_id)
    WHERE (host_user_id IS NULL OR host_user_id=0)
      AND host_personnel_id IS NOT NULL
  `).run();
  dbInstance.prepare(`
    UPDATE visitors
    SET host_user_id=(SELECT NULLIF(p.user_id,0) FROM personnel p WHERE p.id=visitors.host_personnel_id)
    WHERE (host_user_id IS NULL OR host_user_id=0)
      AND host_personnel_id IS NOT NULL
  `).run();

  console.log('✅ Veritabanı hazır:', DB_PATH);
  return dbInstance;
}

// Senkron erişim için proxy (initDB() çağrıldıktan sonra kullanılabilir)
const dbProxy = new Proxy({}, {
  get(_, prop) {
    if (!dbInstance) throw new Error('DB henüz başlatılmadı! initDB() bekleniyor.');
    return dbInstance[prop];
  }
});

module.exports = { initDB, db: dbProxy };
