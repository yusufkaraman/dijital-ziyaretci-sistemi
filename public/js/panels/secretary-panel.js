// ═══════════════════════════════════════════════════════
//  Simdesk — Sekreter Paneli app.js (API Entegreli)
// ═══════════════════════════════════════════════════════

let socket;
let notificationsData = [];
let personnelCache = [];
let companyCache = [];
let appointmentPersonnelCache = [];
let appointmentCompanyFilter = 'all';
let appointmentDateFilter = 'future';
let personnelCompanyFilter = 'all';

function normalizeCompanyName(value) {
  return (value || '').trim().toLocaleLowerCase('tr-TR');
}

function collectUniqueCompanyNames(items, extractor) {
  const seen = new Map();
  (items || []).forEach((item) => {
    const rawName = (extractor(item) || '').trim();
    if (!rawName) return;
    const normalized = normalizeCompanyName(rawName);
    if (!seen.has(normalized)) seen.set(normalized, rawName);
  });
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'tr'));
}

function setPersonnelCompanyFilter(value) {
  personnelCompanyFilter = value || 'all';
  loadPersonnel();
}


// Socket.IO bağlantısı
function initSocket() {
  if (socket && typeof vdDestroySocket === 'function') {
    vdDestroySocket(socket);
  }

  socket = vdCreateSocket({
    onSystemReload: () => {
      console.log('🔄 Update detected, reloading...');
    },
    handlers: {
      'visitor:waiting': (d) => {
        const msg = `🔔 Yeni giriş talebi: ${d.visitor.full_name}`;
        showToast(msg);
        showWindowsNotification('Yeni Misafir Kaydı', msg);
        refreshActivePage();
      },
      'visitor:arrived': (d) => {
        const msg = `✅ ${d.visitor.full_name} lobiye giriş yaptı`;
        showToast(msg);
        showWindowsNotification('Misafir Geldi', msg);
        playNotificationSound();
        refreshActivePage();
      },
      'visitor:approved': (d) => {
        showToast(`👔 ${d.visitor.full_name} onaylandı (${d.by})`);
        refreshActivePage();
      },
      'visitor:rejected': (d) => {
        showToast(`❌ ${d.reason ? d.reason : 'Giriş talebi reddedildi'} (${d.by})`, 'error');
        refreshActivePage();
      },
      'visitor:checkout': (d) => {
        showToast(`👋 ${d.visitor.full_name} çıkış yaptı`);
        refreshActivePage();
      },
      'visitor:cancelled': () => {
        showToast('Giriş kaydı iptal edildi');
        refreshActivePage();
      },
      'appointment:created': (d) => {
        if (d && d.appointment && d.appointment.status === 'pending_approval') {
          showToast('Yeni randevu onay talebi: ' + d.appointment.visitor_name);
          showWindowsNotification('Randevu Onay Talebi', d.appointment.visitor_name + ' için randevu onayı bekliyor.');
        }
        refreshActivePage();
      },
      'appointment:approved': () => {
        refreshActivePage();
      },
      'appointment:updated': () => {
        refreshActivePage();
      },
      'appointment:cancelled': () => {
        refreshActivePage();
      },
      'appointment:deleted': () => {
        refreshActivePage();
      },
      'visitor:deleted': () => {
        refreshActivePage();
      },
      'personnel:created': () => {
        refreshActivePage();
      },
      'personnel:updated': () => {
        refreshActivePage();
      },
      'personnel:deleted': () => {
        refreshActivePage();
      },
      'blacklist:created': () => {
        refreshActivePage();
      },
      'blacklist:deleted': () => {
        refreshActivePage();
      },
      'room:created': () => {
        refreshActivePage();
      },
      'room:updated': () => {
        refreshActivePage();
      },
      'room:deleted': () => {
        refreshActivePage();
      },
      'room:reserved': () => {
        refreshActivePage();
      },
      'room:reservation_cancelled': () => {
        refreshActivePage();
      },
      'user:created': () => {
        refreshActivePage();
      },
      'user:updated': () => {
        refreshActivePage();
      },
      'user:deleted': () => {
        refreshActivePage();
      },
      'company:created': () => {
        refreshActivePage();
      },
      'company:updated': () => {
        refreshActivePage();
      },
      'company:deleted': () => {
        refreshActivePage();
      },
    },
  });
}

// ── TOAST ─────────────────────────────────────────────
function showToast(msg, type = 'success') {
  return window.vdShowToast(msg, type);
}

// ── BİLDİRİM SESİ ─────────────────────────────────────
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const playT = (f, s, d, v) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.setValueAtTime(f, ctx.currentTime + s);
      g.gain.setValueAtTime(0, ctx.currentTime + s);
      g.gain.linearRampToValueAtTime(v, ctx.currentTime + s + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + s + d);
      o.start(ctx.currentTime + s); o.stop(ctx.currentTime + s + d);
    };
    playT(659.25, 0, 0.8, 0.15); // E5
    playT(830.61, 0.05, 0.7, 0.1); // G#5
  } catch {}
}


// ── NAVİGASYON ────────────────────────────────────────
const PAGE_TITLES = {
  dashboard:'Kontrol Paneli', visitors:'Giriş Kayıtları', checkin:'Hızlı Giriş Kaydı',
  appointments:'Randevu Yönetimi', rooms:'Toplantı Odaları', screens:'Ekran Yönetimi',
  hosts:'Personel Rehberi', blacklist:'Kara Liste', reports:'Raporlar & Analizler',
  settings: 'Sistem Ayarları'
};

const SECRETARY_ACTIVE_PAGE_STATE_KEY = 'panel-active-page';

function persistActiveSecretaryPage(page) {
  if (window.vdPageState && typeof window.vdPageState.set === 'function') {
    window.vdPageState.set('active-page', page, SECRETARY_ACTIVE_PAGE_STATE_KEY);
  }
}

function readPersistedSecretaryPage() {
  if (!(window.vdPageState && typeof window.vdPageState.get === 'function')) return 'dashboard';
  const page = window.vdPageState.get('active-page', 'dashboard', SECRETARY_ACTIVE_PAGE_STATE_KEY);
  return PAGE_TITLES[page] ? page : 'dashboard';
}

function navigate(page) {
  const currentUser = getUser();
  if (page === 'settings' && window.vdPermissions && currentUser && !window.vdPermissions.canAccessSettingsTab(currentUser, 'companies')) {
    showToast('Sekreter için Ayarlar menüsü kapalı. Kullanıcı ekleme Personel menüsündedir.', 'error');
    page = 'hosts';
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const el = document.getElementById(`page-${page}`);
  if (el) el.classList.add('active');
  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');
  document.getElementById('page-title').textContent = PAGE_TITLES[page] || page;
  persistActiveSecretaryPage(page);
  closeSidebar();
  loadPage(page);
}

async function loadPage(page) {
  try {
    if (page === 'dashboard') await refreshDashboard();
    else if (page === 'visitors') await loadVisitors();
    else if (page === 'checkin') await loadCheckinPage();
    else if (page === 'appointments') await loadAppointments();
    else if (page === 'rooms') await loadRooms();
    else if (page === 'hosts') await loadPersonnel();
    else if (page === 'blacklist') await loadBlacklist();
    else if (page === 'reports') await loadReports();
    else if (page === 'settings') await loadSettings();
  } catch (e) { showToast(e.message, 'error'); }
}

function refreshActivePage() {
  const activePage = document.querySelector('.page.active');
  if (!activePage) return;
  const pageId = activePage.id.replace('page-', '');
  loadPage(pageId);
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar) return;

  if (window.innerWidth <= 900) {
    const isOpen = sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open', isOpen);
    return;
  }

  sidebar.classList.toggle('collapsed');
}

function closeSidebar() {
  if (window.innerWidth > 900) return;
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

// ── SAAT VE GREETING ──────────────────────────────────
function startClock() {
  function tick() {
    const now = new Date();
    const el = document.getElementById('live-clock');
    if (el) el.textContent = now.toLocaleTimeString('tr-TR');
  }
  tick(); setInterval(tick, 1000);
}

function setGreeting() {
  const h = new Date().getHours();
  const salut = h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar';
  const nameEl = document.getElementById('greeting-text');
  const dateEl = document.getElementById('today-date');
  const u = getUser();
  if (nameEl && u) nameEl.textContent = `${salut}, ${u.full_name}! 👋`;
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('tr-TR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

// ── DASHBOARD ─────────────────────────────────────────

// Runtime bootstrap moved from app.js during Step 5 modular split.

// ── YARDIMCI FONKSİYONLAR ─────────────────────────────
function statusLabel(s) {
  return { waiting:'Bekliyor', inside:'İçeride', left:'Çıktı', cancelled:'İptal' }[s] || s;
}
function apptStatusLabel(s) {
  return { planned:'Planlandı', pending_approval:'Onay Bekliyor', arrived:'Geldi', completed:'Tamamlandı', cancelled:'İptal' }[s] || s;
}
function formatTime(dt) {
  return window.vdFormatTime(dt);
}
function formatDate(dt) {
  return window.vdFormatDate(dt);
}
function calcDuration(v) {
  return window.vdCalcDuration(v);
}

async function applyPanelBranding() {
  return window.vdApplyPanelBranding({ logoElementId: 'panel-logo-img' });
}

// ── BAŞLANGIÇ ─────────────────────────────────────────
let secretaryPanelBootstrapped = false;

async function bootSecretaryPanel() {
  if (secretaryPanelBootstrapped) return;
  secretaryPanelBootstrapped = true;

  if (!ensureRoleAccess(['admin', 'secretary'])) return;

  // Kullanıcı bilgilerini sidebar'a yaz
  const u = getUser();
  if (u) {
    const roleMap = { admin:'Sistem Yöneticisi', secretary:'Sekreter', manager:'Yönetici' };
    const elName = document.getElementById('sidebar-name');
    const elRole = document.getElementById('sidebar-role');
    const elAv = document.getElementById('sidebar-avatar');
    
    if (elName) elName.textContent = u.full_name;
    if (elRole) elRole.textContent = roleMap[u.role] || u.role;
    if (elAv) elAv.textContent = u.full_name.split(' ').map(w=>w[0]).slice(0,2).join('');

    const canSeeSettings = window.vdPermissions
      ? window.vdPermissions.canAccessSettingsTab(u, 'companies')
      : u.role === 'admin';

    // Settings menusu: sadece admin
    if (canSeeSettings) {
      document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');
    } else {
      document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }
  }

  startClock();
  setGreeting();
  initSocket();
  applyPanelBranding();

  // Logo tazelemeyi tek sefer yap
  api.getCompanies({ active_only: 'true' }).then(list => {
    const def = list.find(c => c.is_default) || list[0];
    if (def) document.getElementById('side-logo-title').textContent = def.name;
  }).catch(e => console.warn('Firma logosu yüklenemedi:', e.message));

  navigate(readPersistedSecretaryPage());

  // Status filter listener
  const sf = document.getElementById('status-filter');
  if (sf) sf.addEventListener('change', filterVisitors);
  const df = document.getElementById('date-filter');
  if (df) df.addEventListener('change', filterVisitorsDate);

  // Her 30 saniyede dashboard yenile
  setInterval(() => {
    const activePage = document.querySelector('.page.active');
    if (activePage?.id === 'page-dashboard') refreshDashboard();
  }, 30000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootSecretaryPanel);
} else {
  bootSecretaryPanel();
}
