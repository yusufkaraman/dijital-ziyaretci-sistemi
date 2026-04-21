// Zamanlayıcı
setInterval(() => {
  const el = document.getElementById('top-clock');
  if (el) el.textContent = new Date().toLocaleTimeString('tr-TR');
}, 1000);

// Personel filtreleme yardımcı fonksiyonları
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

function shouldShowPersonnelManagement() {
  var user = getUser();
  return Boolean(user && user.role === 'admin');
}

function disablePersonnelManagementForManager() {
  if (shouldShowPersonnelManagement()) return;

  document.querySelectorAll('[data-page="hosts"]').forEach(function(el) {
    el.remove();
  });

  var hostsPage = document.getElementById('page-hosts');
  if (hostsPage) hostsPage.remove();

  var hostsGrid = document.getElementById('hosts-grid');
  if (hostsGrid) {
    var legacyCard = hostsGrid.closest('.dash-grid');
    if (legacyCard) legacyCard.remove();
  }

  var hostsActionBtn = document.getElementById('hosts-primary-action');
  if (hostsActionBtn) {
    var legacyHeaderCard = hostsActionBtn.closest('.dash-grid');
    if (legacyHeaderCard) legacyHeaderCard.remove();
  }

  var filtersWrap = document.getElementById('personnel-company-filters');
  if (filtersWrap) {
    var filtersCard = filtersWrap.closest('.dash-grid');
    if (filtersCard) filtersCard.remove();
  }

  if (document.getElementById('page-title') && document.getElementById('page-title').textContent === 'Personel') {
    document.getElementById('page-title').textContent = 'Dashboard';
  }
}

function shouldScopeToHost(user) {
  if (window.vdPermissions && typeof window.vdPermissions.shouldScopeHostUser === 'function') {
    return window.vdPermissions.shouldScopeHostUser(user);
  }
  return Boolean(user && user.role !== 'admin');
}

function canSeeHostData(user, hostUserId, allowUnassigned) {
  if (window.vdPermissions && typeof window.vdPermissions.canSeeHostScopedEvent === 'function') {
    return window.vdPermissions.canSeeHostScopedEvent(user, hostUserId, { allowUnassigned: !!allowUnassigned });
  }
  if (!user) return false;
  if (allowUnassigned && (hostUserId === null || hostUserId === undefined || hostUserId === '')) return true;
  return Number(hostUserId) === Number(user.id) || user.role === 'admin';
}

// Global Stats Loader (Edited to include Unified Weekly Chart)
function loadStats() {
  var u = getUser();
  var params = {};
  if (u && shouldScopeToHost(u)) params.host_user_id = u.id;
  
  return api.getVisitorStats(params).then(function(s) {
    document.getElementById('kpi-waiting').textContent = s.today_total != null ? s.today_total : 0;
    document.getElementById('kpi-inside').textContent = s.inside != null ? s.inside : 0;
    document.getElementById('kpi-appts').textContent = s.appts_today != null ? s.appts_today : 0;
    document.getElementById('kpi-today').textContent = s.today_total != null ? s.today_total : 0;

    // Haftalık Yoğunluk Grafiği (Tüm Kurum)
    if (s.weekly) {
      console.log('Grafik verisi:', s.weekly);
      if (typeof drawTrafficChart === 'function') {
        drawTrafficChart(s.weekly);
      } else {
        console.error('drawTrafficChart fonksiyonu bulunamadı!');
      }
    }
  }).catch(function(e) { console.warn('Stats:', e.message); });
}


// Toast
function showToast(msg, type) {
  return window.vdShowToast(msg, type);
}

// Yeni Misafir Modal
function switchModalTab(tab) {
  document.getElementById('modal-mode').value = tab;
  const tGuest = document.getElementById('tab-guest');
  const tAppt = document.getElementById('tab-appt');
  const divTime = document.getElementById('div-time');
  const btn = document.getElementById('btn-submit');

  if (tab === 'guest') {
    tGuest.style.color = 'var(--primary)'; tGuest.style.borderBottom = '2px solid var(--primary)';
    tAppt.style.color = 'var(--muted)'; tAppt.style.borderBottom = 'none';
    divTime.style.visibility = 'hidden'; divTime.style.position = 'absolute';
    btn.textContent = 'Fast Check-In Kaydı Oluştur';
  } else {
    tAppt.style.color = 'var(--primary)'; tAppt.style.borderBottom = '2px solid var(--primary)';
    tGuest.style.color = 'var(--muted)'; tGuest.style.borderBottom = 'none';
    divTime.style.visibility = 'visible'; divTime.style.position = 'static';
    btn.textContent = 'Randevu Kaydet';
  }
}
async function openAddVisitorModal() {
  switchModalTab('guest');
  const _now = new Date();
  document.getElementById('add-time').value = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}T${String(_now.getHours()).padStart(2,'0')}:${String(_now.getMinutes()).padStart(2,'0')}`;
  document.getElementById('add-visitor-modal').classList.add('show');
  document.body.classList.add('modal-open');
  
  // Personel listesini yükle ve otomatik olarak giriş yapan kullanıcıyı seç
  try {
    const [list, companies] = await Promise.all([
      api.getPersonnel({ is_active: 1 }),
      api.getCompanies({ active_only: 'true' }),
    ]);
    const sel = document.getElementById('add-host-id');
    const companySel = document.getElementById('add-visited-company-id');
    const currentU = getUser();
    sel.innerHTML = '<option value="">Seçiniz...</option>' + list.map(p =>
      `<option value="${p.id}" ${currentU && p.user_id == currentU.id ? 'selected' : ''}>${esc(p.full_name)} (${esc(p.title || p.department || '')})</option>`
    ).join('');
    if (companySel) {
      companySel.innerHTML = '<option value="">Seçiniz...</option>' +
        companies.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    }
    // Auto-select current user's personnel record - host is always the logged-in personnel
    // Match by user_id first, fallback to full_name match
    const myPersonnel = list.find(p => currentU && p.user_id == currentU.id)
      || list.find(p => currentU && p.full_name && currentU.full_name && p.full_name.trim().toLowerCase() === currentU.full_name.trim().toLowerCase());
    if (myPersonnel) {
      sel.value = myPersonnel.id;
      if (companySel && myPersonnel.company_id) {
        companySel.value = String(myPersonnel.company_id);
      }
    } else if (currentU) {
      console.warn('No personnel record found for user:', currentU.id, currentU.full_name);
    }
  } catch(e) { console.warn('Personnel load err', e); }
}
function closeAddVisitorModal() {
  document.getElementById('add-visitor-modal').classList.remove('show');
  document.body.classList.remove('modal-open');
  document.getElementById('add-name').value = '';
  document.getElementById('add-tc').value = '';
  document.getElementById('add-phone').value = '';
  document.getElementById('add-email').value = '';
  document.getElementById('add-company').value = '';
  document.getElementById('add-visited-company-id').value = '';
  document.getElementById('add-reason').value = '';
  document.getElementById('add-plate').value = '';
  document.getElementById('add-notes').value = '';
}
async function submitAddVisitor() {
  const mode = document.getElementById('modal-mode').value;
  const data = {
    full_name: document.getElementById('add-name').value.trim(),
    tc_no: document.getElementById('add-tc').value.trim(),
    phone: document.getElementById('add-phone').value.trim(),
    email: document.getElementById('add-email').value.trim(),
    company_name: document.getElementById('add-company').value.trim(),
    visited_company_id: document.getElementById('add-visited-company-id').value,
    host_personnel_id: document.getElementById('add-host-id').value,
    reason: document.getElementById('add-reason').value.trim(),
    vehicle_plate: document.getElementById('add-plate').value.trim(),
    visitor_count: parseInt(document.getElementById('add-count').value) || 1,
    notes: document.getElementById('add-notes').value.trim(),
  };

  if (!data.full_name || !data.reason || !data.host_personnel_id || !data.visited_company_id) {
    return showToast('Lütfen zorunlu alanları (Ad Soyad, Personel, Ziyaret Edilen Şirket, Sebep) doldurun.', 'error');
  }
  if (data.tc_no && !isValidTC(data.tc_no)) {
    return showToast('TC Kimlik No 11 haneli sayısal olmalıdır.', 'error');
  }
  if (data.phone && !isValidPhone(data.phone)) {
    return showToast('Telefon numarası en az 10 hane olmalıdır.', 'error');
  }
  if (data.email && !isValidEmail(data.email)) {
    return showToast('Geçerli bir e-posta adresi giriniz.', 'error');
  }

  const timeStr = document.getElementById('add-time').value;
  if (mode === 'appt' && !timeStr) return showToast('Randevu zamanı seçiniz.', 'error');

  let plannedTime = timeStr ? timeStr.replace('T', ' ') : null;
  if (plannedTime && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(plannedTime)) plannedTime += ':00';

  try {
    if (mode === 'guest') {
      data.planned_time = null;
      await api.createVisitor(data);
      showToast('Fast check-in kaydı oluşturuldu ve hosta bildirim gönderildi.');
    } else {
      await api.createAppointment({
        visitor_name: data.full_name,
        visitor_tc: data.tc_no,
        visitor_phone: data.phone,
        visitor_email: data.email,
        visitor_company: data.company_name,
        visited_company_id: Number(data.visited_company_id),
        vehicle_plate: data.vehicle_plate,
        visitor_count: data.visitor_count,
        host_personnel_id: data.host_personnel_id,
        reason: data.reason,
        notes: data.notes,
        planned_time: plannedTime
      });
      showToast('Yeni randevu kaydı takviminize işlendi.');
    }
    closeAddVisitorModal();
    loadAll();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// Bildirimler
var _notifs = [];
function toggleNotifications() {
  const p = document.getElementById('notif-panel');
  p.style.display = p.style.display === 'block' ? 'none' : 'block';
}
function addNotif(msg) {
  _notifs.unshift({ msg, time: new Date().toLocaleTimeString('tr-TR') });
  var el = document.getElementById('notif-list');
  el.innerHTML = _notifs.map(function(n, i) {
    return '<div class="notif-item' + (i === 0 ? ' new' : '') + '"><div>' + esc(n.msg) + '</div><div class="notif-time">' + n.time + '</div></div>';
  }).join('');
  var cnt = document.getElementById('notif-count');
  cnt.style.display = 'inline';
  cnt.textContent = _notifs.length;
}
function clearNotifs() {
  _notifs = [];
  document.getElementById('notif-list').innerHTML = '<div class="empty-state">Bildirim yok</div>';
  document.getElementById('notif-count').style.display = 'none';
}

function formatVisitorNotificationDetails(visitor) {
  if (!visitor) return '';
  var parts = [];
  if (visitor.company_name) parts.push(visitor.company_name);
  if (visitor.reason) parts.push(visitor.reason);
  var count = parseInt(visitor.visitor_count, 10);
  if (!Number.isFinite(count) || count < 1) count = 1;
  parts.push(count + ' kisi');
  return parts.join(' · ');
}

// Banner
var _bannerVisitorId = null;
function showArrivalBanner(visitor) {
  _bannerVisitorId = visitor.id;
  document.getElementById('banner-title').textContent = visitor.full_name + ' geldi';
  document.getElementById('banner-sub').textContent = formatVisitorNotificationDetails(visitor) || 'Misafir geldi bildirimi';
  document.getElementById('arrival-banner').classList.add('show');
  playDoorbell();
}
function closeBanner() {
  document.getElementById('arrival-banner').classList.remove('show');
  _bannerVisitorId = null;
}

// Outlook
async function connectOutlook() {
  try {
    const data = await api.startOutlookLogin();
    if (data.url) {
      window.location.href = data.url;
    } else {
      showToast(data.error || 'Bağlantı başlatılamadı (Mock Mod)', 'error');
    }
  } catch(e) { showToast(e.message, 'error'); }
}
async function syncOutlook() {
  try {
    const data = await api.syncOutlook();
    showToast(data.message || 'Senkronizasyon tamamlandı');
    if (data.added > 0) loadAll();
  } catch(e) { showToast(e.message, 'error'); }
}

// Ses
let audioCtx = null;
function playDoorbell() {
  try {
    const ctx = audioCtx || (audioCtx = new (window.AudioContext || window.webkitAudioContext)());
    if (ctx.state === 'suspended') ctx.resume();
    const playT = (f, s, d, v) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.setValueAtTime(f, ctx.currentTime + s);
      g.gain.setValueAtTime(0, ctx.currentTime + s);
      g.gain.linearRampToValueAtTime(v, ctx.currentTime + s + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + s + d);
      o.start(ctx.currentTime + s); o.stop(ctx.currentTime + s + d);
    };
    playT(659.25, 0, 1.2, 0.2);   // Ding
    playT(523.25, 0.5, 1.5, 0.15); // Dong
  } catch(e) { console.error('Audio Error:', e); }
}
// Use any interaction to resume audio context
document.addEventListener('click', () => { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); }, { once: true });

// Filtreleme Durumu
var _currentApptFilter = {};

function loadAll() {
  var tasks = [loadStats(), loadRecentArrivals(), loadInside(), loadAppointments(), loadTodayAll(), loadRooms()];
  if (shouldShowPersonnelManagement()) tasks.push(loadPersonnel());
  return Promise.allSettled(tasks);
}

function renderCalendarBlock(dateStr) {
  if (!dateStr) return '<div class="vitem-av">?</div>';
  const d = new Date(dateStr);
  const months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  return '<div style="width:44px;height:44px;border:1px solid rgba(0,96,240,0.15);border-radius:10px;overflow:hidden;background:#fff;display:flex;flex-direction:column;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,0.05);">' +
    '<div style="background:linear-gradient(135deg,#e11d48,#be123c);color:#fff;font-size:9px;font-weight:800;text-align:center;padding:3px 0;text-transform:uppercase;letter-spacing:1px;line-height:1;">' + months[d.getMonth()] + '</div>' +
    '<div style="flex:1;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:var(--text);line-height:1;">' + d.getDate() + '</div>' +
  '</div>';
}

// Zaman formatlama
function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function showModal(title, content) {
  return window.vdShowModal(title, content);
}

function closeModal() {
  return window.vdCloseModal();
}

function showChangePasswordModal() {
  return window.vdShowChangePasswordModal();
}

async function submitPasswordChange() {
  return window.vdSubmitPasswordChange();
}

function statusLabel(s) {
  return { waiting:'Bekliyor', inside:'İçeride', left:'Çıktı', cancelled:'İptal' }[s] || s;
}

function apptStatusLabel(s) {
  return { planned:'Planlandı', pending_approval:'Onay Bekliyor', arrived:'Geldi', completed:'Tamamlandı', cancelled:'İptal' }[s] || s;
}

async function showVisitorDetail(id) {
  var visitors = await api.getVisitors({});
  var v = visitors.find(function(x) { return x.id == id; });
  if (!v) return;
  showModal('👤 ' + esc(v.full_name), '<div style="display:grid;gap:12px">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
    '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">TC / Kimlik</div><div>' + (esc(v.tc_no)||'—') + '</div></div>' +
    '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Telefon</div><div>' + (esc(v.phone)||'—') + '</div></div>' +
    '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Firma</div><div>' + (esc(v.company_name)||'—') + '</div></div>' +
    '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Ziyaret Sebebi</div><div>' + (esc(v.reason)||'—') + '</div></div>' +
    '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Görüşülen</div><div>' + (esc(v.host_name)||'—') + '</div></div>' +
    '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Durum</div><span class="status-badge status-' + v.status + '">' + statusLabel(v.status) + '</span></div>' +
    '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Giriş</div><div>' + (v.arrival_time ? fmt(v.arrival_time) : '—') + '</div></div>' +
    '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Çıkış</div><div>' + (v.checkout_time ? fmt(v.checkout_time) : '—') + '</div></div>' +
    '</div>' +
    (v.notes ? '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Notlar</div><div>' + esc(v.notes) + '</div></div>' : '') +
    '</div>');
}

async function showAppointmentDetail(id) {
  var appointments = await api.getAppointments({ range: 'all' });
  var a = appointments.find(function(x) { return x.id == id; });
  if (!a) return;
  showModal('📅 ' + esc(a.visitor_name), '<div style="display:grid;gap:12px">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
    '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Ziyaretçi</div><div>' + esc(a.visitor_name) + '</div></div>' +
    '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Telefon</div><div>' + (esc(a.visitor_phone)||'—') + '</div></div>' +
    '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Ziyaretçi Firması</div><div>' + (esc(a.visitor_company)||'—') + '</div></div>' +
    '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Görüşülen</div><div>' + (esc(a.host_name)||'—') + '</div></div>' +
    '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Görüşülen Firma</div><div>' + (esc(a.host_company_name)||'—') + '</div></div>' +
    '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Ziyaret Sebebi</div><div>' + (esc(a.reason)||'—') + '</div></div>' +
    '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Planlanan Tarih</div><div>' + window.vdFormatDate(a.planned_time) + ' ' + fmt(a.planned_time) + '</div></div>' +
    '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Durum</div><span class="status-badge status-' + a.status + '">' + apptStatusLabel(a.status) + '</span></div>' +
    '</div>' +
    (a.notes ? '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Notlar</div><div>' + esc(a.notes) + '</div></div>' : '') +
    '<div style="display:flex;gap:10px;margin-top:8px">' +
    (a.status === 'planned' ? '<button class="btn-secondary" onclick="cancelAppt(' + a.id + ');closeModal()">İptal Et</button> <button class="btn-calendar" onclick="openGoogleCalendar(_lastApptDetail);closeModal()">📅 Takvime Ekle</button>' : '') +
    '</div></div>');
  window._lastApptDetail = a;
}

// Original loadStats replaced by the improved version above

function loadRecentArrivals() {
  var u = getUser();
  var params = { status: 'inside', date: 'today' };
  if (u && shouldScopeToHost(u)) params.host_user_id = u.id;
  return api.getVisitors(params).then(function(list) {
    var el = document.getElementById('waiting-list');
    if (!list.length) { el.innerHTML = '<div class="empty-state">Bugün yeni fast check-in kaydı bulunmamaktadır.</div>'; return; }
    el.innerHTML = list.map(function(v) {
      return '<div class="visitor-row" style="border-left:4px solid var(--orange)">' +
        '<div class="visitor-avatar" style="background:linear-gradient(135deg,#f59e0b,#d97706)">' + esc(v.full_name[0]) + '</div>' +
        '<div class="visitor-info"><div class="visitor-name">' + esc(v.full_name) + '</div>' +
        '<div class="visitor-meta">' + esc(v.company_name || '—') + ' · ' + esc(v.reason || '—') + ' · ' + visitorTimeSummary(v, fmt) + '</div></div>' +
        '<span class="status-badge status-inside">Misafir Geldi</span>' +
        '</div>';
    }).join('');
  }).catch(function(e) { console.warn('Son gelenler:', e.message); });
}

function loadInside() {
  var u = getUser();
  var params = { status: 'inside', date: 'today' };
  if (u && shouldScopeToHost(u)) params.host_user_id = u.id;
  return api.getVisitors(params).then(function(list) {
    document.getElementById('inside-count').textContent = list.length;
    var el = document.getElementById('inside-list');
    if (!list.length) { el.innerHTML = '<div class="empty-state">Şu an kurumda aktif misafir bulunmamaktadır.</div>'; return; }
    el.innerHTML = list.map(function(v) {
      return '<div class="visitor-row">' +
        '<div class="visitor-avatar" style="background:linear-gradient(135deg,#10b981,#059669)">' + esc(v.full_name[0]) + '</div>' +
        '<div class="visitor-info"><div class="visitor-name">' + esc(v.full_name) + '</div>' +
        '<div class="visitor-meta">' + esc(v.company_name || '—') + ' · ' + visitorTimeSummary(v, fmt) + '</div></div>' +
        '<button class="btn-secondary" style="font-size:11px;padding:5px 10px" onclick="withButtonLock(this, function(){ return checkoutV(' + v.id + ') })">Çıkış</button>' +
        '</div>';
    }).join('');
  }).catch(function(e) { console.warn('İçeride:', e.message); });
}

// Takvim randevu verileri (ay bazında cache)
var _calendarAppointments = [];

function loadAppointments() {
  var params = {};
  var u = getUser();
  params.month = currentCalDate.getFullYear() + '-' + String(currentCalDate.getMonth() + 1).padStart(2, '0');
  if (u && shouldScopeToHost(u)) params.host_user_id = u.id;
  return api.getAppointments(params).then(function(list) {
    _calendarAppointments = list.filter(function(a) {
      return a.planned_time && a.status !== 'cancelled';
    });
    renderCalendar();
    // Seçili gün varsa detay panelini güncelle
    if (_selectedCalDate) showDayDetail(_selectedCalDate);
  }).catch(function(e) { console.warn('Randevular:', e.message); });
}

var currentCalDate = new Date();
var _selectedCalDate = null;

function renderCalendar() {
  var container = document.getElementById('calendar-container');
  if (!container) return;

  var today = new Date();
  var year = currentCalDate.getFullYear();
  var month = currentCalDate.getMonth();
  var firstDay = new Date(year, month, 1).getDay();
  if (firstDay === 0) firstDay = 7;
  var daysInMonth = new Date(year, month + 1, 0).getDate();

  // Randevuları güne göre grupla
  var apptsByDay = {};
  _calendarAppointments.forEach(function(a) {
    var d = new Date(a.planned_time);
    if (d.getFullYear() === year && d.getMonth() === month) {
      var day = d.getDate();
      if (!apptsByDay[day]) apptsByDay[day] = [];
      apptsByDay[day].push(a);
    }
  });
  // Her günü saate göre sırala
  Object.keys(apptsByDay).forEach(function(day) {
    apptsByDay[day].sort(function(a, b) {
      return new Date(a.planned_time) - new Date(b.planned_time);
    });
  });

  var statColors = { planned:'#3b82f6', pending_approval:'#f59e0b', arrived:'#f59e0b', completed:'#10b981' };

  var html = '<div class="big-cal-nav">' +
    '<button class="btn-secondary btn-sm" onclick="changeMonth(-1)">◀ Önceki</button>' +
    '<div class="big-cal-title">' + new Intl.DateTimeFormat('tr-TR', { month:'long', year:'numeric' }).format(currentCalDate) + '</div>' +
    '<button class="btn-secondary btn-sm" onclick="changeMonth(1)">Sonraki ▶</button>' +
    '</div>';

  var isMobileCalendar = window.innerWidth <= 900;
  var dayLabels = isMobileCalendar
    ? ['Pzt','Sal','Car','Per','Cum','Cmt','Paz']
    : ['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'];

  html += '<div class="big-cal-shell">';
  html += '<div class="big-cal-weekdays">';
  dayLabels.forEach(function(d) {
    html += '<div class="big-cal-header">' + d + '</div>';
  });
  html += '</div>';
  html += '<div class="big-cal-grid">';

  // Önceki ayın boş günleri
  for (var i = 1; i < firstDay; i++) html += '<div class="big-cal-cell empty"></div>';

  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr = year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    var isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    var isSelected = _selectedCalDate === dateStr;
    var dayAppts = apptsByDay[d] || [];
    var cellClass = 'big-cal-cell' + (isToday ? ' today' : '') + (isSelected ? ' selected' : '');

    html += '<div class="' + cellClass + '" onclick="filterByDate(\'' + dateStr + '\')">';
    html += '<div class="big-cal-day-num">' + d + '</div>';

    if (dayAppts.length > 0) {
      var densityClass = 'density-comfy';
      var maxShow = 3;
      if (dayAppts.length >= 6) {
        densityClass = 'density-packed';
        maxShow = 5;
      } else if (dayAppts.length >= 4) {
        densityClass = 'density-dense';
        maxShow = 4;
      } else if (dayAppts.length === 3) {
        densityClass = 'density-balanced';
      } else if (dayAppts.length === 2) {
        densityClass = 'density-roomy';
        maxShow = 2;
      } else {
        maxShow = 1;
      }
      html += '<div class="big-cal-appts ' + densityClass + '">';
      dayAppts.slice(0, maxShow).forEach(function(a) {
        var time = fmt(a.planned_time);
        var color = statColors[a.status] || '#3b82f6';
        html += '<div class="big-cal-appt ' + densityClass + '" style="border-left:3px solid ' + color + '">' +
          '<span class="big-cal-appt-time">' + time + '</span> ' +
          '<span class="big-cal-appt-name">' + esc(a.visitor_name || '—') + '</span>' +
          '</div>';
      });
      if (dayAppts.length > maxShow) {
        html += '<div class="big-cal-more">+' + (dayAppts.length - maxShow) + ' daha</div>';
      }
      html += '</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  html += '</div>';
  container.innerHTML = html;
}

function changeMonth(step) {
  currentCalDate.setMonth(currentCalDate.getMonth() + step);
  _selectedCalDate = null;
  hideDayDetail();
  loadAppointments();
}

function filterByDate(dateStr) {
  _selectedCalDate = dateStr;
  _currentApptFilter = { date: dateStr };
  renderCalendar();
  showDayDetail(dateStr);
}

function showDayDetail(dateStr) {
  var panel = document.getElementById('day-detail-panel');
  var header = document.getElementById('day-detail-header');
  var list = document.getElementById('day-detail-list');
  if (!panel) return;

  var d = new Date(dateStr + 'T00:00:00');
  var dayName = new Intl.DateTimeFormat('tr-TR', { weekday:'long', day:'numeric', month:'long', year:'numeric' }).format(d);
  header.textContent = dayName + ' — Randevular';

  var statMap = { planned:'Planlandı', pending_approval:'Onay Bekliyor', arrived:'Geldi', completed:'Tamamlandı', cancelled:'İptal' };
  var dayAppts = _calendarAppointments.filter(function(a) {
    return new Date(a.planned_time).toISOString().slice(0,10) === dateStr;
  }).sort(function(a, b) {
    return new Date(a.planned_time) - new Date(b.planned_time);
  });

  if (!dayAppts.length) {
    list.innerHTML = '<div class="empty-state">Bu tarihte randevu bulunmuyor.</div>';
  } else {
    list.innerHTML = dayAppts.map(function(a) {
      return '<div class="visitor-row" id="appt-row-' + a.id + '">' +
        renderCalendarBlock(a.planned_time) +
        '<div class="visitor-info" style="cursor:pointer" onclick="showAppointmentDetail(' + a.id + ')"><div class="visitor-name">' + esc(a.visitor_name) + '</div>' +
        '<div class="visitor-meta">🕒 ' + fmt(a.planned_time) + ' · ' + esc(a.reason || '—') + (a.host_name ? ' · 👤 ' + esc(a.host_name) : '') + '</div></div>' +
        '<div style="display:flex;align-items:center;gap:6px">' +
        '<span class="status-badge status-' + a.status + '">' + (statMap[a.status] || a.status) + '</span>' +
        '<button class="btn-calendar" data-appt-id="' + a.id + '">📅 Ekle</button>' +
        (a.status === 'planned' ? '<button class="btn-secondary" style="font-size:11px;padding:5px 10px" onclick="withButtonLock(this, function(){ return cancelAppt(' + a.id + ') })">İptal</button>' : '') +
        '</div></div>';
    }).join('');
    // Bind Google Calendar buttons via data attribute (safe, avoids JSON.stringify in onclick)
    list.querySelectorAll('.btn-calendar[data-appt-id]').forEach(function(btn) {
      var apptId = Number(btn.getAttribute('data-appt-id'));
      var appt = dayAppts.find(function(a) { return a.id === apptId; });
      if (appt) btn.addEventListener('click', function() { openGoogleCalendar(appt); });
    });
  }
  panel.style.display = 'block';
}

function hideDayDetail() {
  var panel = document.getElementById('day-detail-panel');
  if (panel) panel.style.display = 'none';
}

function resetApptFilter() {
  _selectedCalDate = null;
  currentCalDate = new Date();
  _currentApptFilter = {};
  hideDayDetail();
  loadAppointments();
  loadRooms();
  loadStats();
}

async function cancelAppt(id) {
  if (!confirm('Randevuyu iptal etmek istediğinize emin misiniz?')) return;
  // Remove from DOM immediately for instant feedback
  var row = document.getElementById('appt-row-' + id);
  if (row) row.remove();
  try {
    await api.cancelAppointment(id);
    showToast('Randevu iptal edildi');
    initSocket();
    initNotifications().then(() => {
      if (Notification.permission !== 'granted') {
        document.getElementById('btn-enable-notifications').style.display = 'inline-block';
      }
    });
    loadStats();
  } catch(e) {
    // Restore on failure
    showToast(e.message, 'error');
    loadAppointments();
  }
}

function loadTodayAll() {
  var u = getUser();
  var params = { date: 'today' };
  if (u && shouldScopeToHost(u)) params.host_user_id = u.id;
  return api.getVisitors(params).then(function(list) {
    var el = document.getElementById('all-today-list');
    if (!list.length) { el.innerHTML = '<div class="empty-state">Bugün henüz misafir girişi yapılmadı.</div>'; return; }
    el.innerHTML = list.map(function(v) {
      return '<div class="visitor-row" style="cursor:pointer" onclick="showVisitorDetail(' + v.id + ')">' +
        '<div class="visitor-avatar" style="background:linear-gradient(135deg,#64748b,#475569)">' + esc(v.full_name[0]) + '</div>' +
        '<div class="visitor-info"><div class="visitor-name">' + esc(v.full_name) + '</div>' +
        '<div class="visitor-meta">' + esc(v.reason || '—') + ' · ' + visitorTimeSummary(v, fmt) + '</div></div>' +
        '<span class="status-badge status-' + v.status + '">' + statusLabel(v.status) + '</span>' +
        '</div>';
    }).join('');
  }).catch(function(e) { console.warn('Bugün tümü:', e.message); });
}

async function loadRooms() {
  try {
    const rooms = await api.getRooms();
    const grid = document.getElementById('rooms-grid');
    const u = getUser();
    if (!rooms.length) { grid.innerHTML = '<div class="empty-state">Oda bulunamadı</div>'; return; }
    
    grid.innerHTML = rooms.map(r => {
      const activeRes = (r.reservations || []).map(res => `
        <div style="font-size:12px;background:rgba(245,158,11,0.1);color:#d97706;padding:4px 8px;border-radius:4px;margin-bottom:4px;display:flex;justify-content:space-between;">
           <span>🕒 ${new Date(res.start_time).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})} - ${new Date(res.end_time).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})} | ${esc(res.title)}</span>
           ${u && window.vdPermissions && window.vdPermissions.canCancelReservation(u, res.user_id) ? `<button style="background:none;border:none;color:red;cursor:pointer;font-size:10px" onclick="withButtonLock(this, function(){ return cancelReservation(${res.id}) })">İptal</button>`:''}
        </div>
      `).join('');

      return `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div style="font-weight:800;font-size:15px;color:var(--text)">${esc(r.name)}</div>
          <span style="font-size:11px;padding:3px 8px;border-radius:6px;background:rgba(16,185,129,0.1);color:#10b981;font-weight:700">👥 ${r.capacity} Kişi</span>
        </div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:12px">🔧 ${esc(r.equipment || 'Ekipman yok')}</div>
        <div style="margin-top:12px;">
          <div style="font-size:11px;font-weight:700;color:var(--text);margin-bottom:6px;text-transform:uppercase;">Bugünkü Rezervasyonlar</div>
          ${activeRes || '<div style="font-size:12px;color:var(--muted)">Planlanmış rezervasyon yok.</div>'}
        </div>
      </div>`;
    }).join('');
  } catch(e) { console.warn('Odalar:', e.message); }
}

async function showRoomReservation() {
  try {
    const rooms = await api.getRooms();
    const todayStr = new Date().toISOString().split('T')[0];
    
    showModal('Oda Rezervasyonu', `
      <div style="display:grid;gap:14px">
        <div class="form-group">
          <label style="font-size:12px;font-weight:700">Toplantı Odası *</label>
          <select id="res-room" class="form-input" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border)">
            <option value="">Seçiniz...</option>
            ${rooms.map(r => `<option value="${r.id}">${esc(r.name)} (${r.capacity} Kişi)</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label style="font-size:12px;font-weight:700">Toplantı Başlığı / Kim İçin *</label>
          <input type="text" id="res-title" class="form-input" placeholder="Örn: Pazarlama Sunumu" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border)" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
           <div class="form-group">
             <label style="font-size:12px;font-weight:700">Tarih *</label>
             <input type="date" id="res-date" value="${todayStr}" class="form-input" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border)" />
           </div>
           <div></div>
           <div class="form-group">
             <label style="font-size:12px;font-weight:700">Başlangıç Saati *</label>
             <input type="time" id="res-start" class="form-input" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border)" />
           </div>
           <div class="form-group">
             <label style="font-size:12px;font-weight:700">Bitiş Saati *</label>
             <input type="time" id="res-end" class="form-input" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border)" />
           </div>
        </div>
        
        <div style="text-align:right;margin-top:16px;">
          <button id="btn-enable-notifications" style="display:none;background:var(--green);color:white;border:none;padding:8px 16px;border-radius:12px;font-weight:600;cursor:pointer;margin-right:10px" onclick="requestNotificationPermission()">🔔 Bildirimleri Aç</button>
          <a href="#" class="nav-lnk" onclick="logout(); return false;">Çıkış Yap</a>
          <button class="btn-primary" onclick="withButtonLock(this, submitRoomReservation)" style="padding:10px 24px">Rezervasyonu Tamamla</button>
        </div>
      </div>
    `);
  } catch (e) { showToast('Odalar yüklenirken hata oluştu', 'error'); }
}

async function submitRoomReservation() {
  const roomId = document.getElementById('res-room').value;
  const title = document.getElementById('res-title').value.trim();
  const date = document.getElementById('res-date').value;
  const start = document.getElementById('res-start').value;
  const end = document.getElementById('res-end').value;

  if (!roomId || !title || !date || !start || !end) {
    return showToast('Lütfen tüm alanları (Oda, Başlık, Tarih, Saat) doldurun', 'error');
  }

  if (start >= end) {
    return showToast('Bitiş saati başlangıç saatinden sonra olmalıdır.', 'error');
  }

  try {
    await api.reserveRoom(roomId, { title: title, date: date, startTime: start, endTime: end });

    showToast('✅ Oda başarıyla rezerve edildi!');
    closeModal();
    loadRooms();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function cancelReservation(id) {
  if (!confirm('Bu oda rezervasyonunu iptal etmek istediğinize emin misiniz?')) return;
  try {
    await api.cancelRoomReservation(id);
    showToast('Rezervasyon iptal edildi');
    loadRooms();
  } catch(e) { showToast(e.message, 'error'); }
}

// Aksiyonlar
function checkoutV(id) {
  api.checkoutVisitor(id).then(function() { showToast('Çıkış kaydedildi'); loadAll(); })
    .catch(function(e) { showToast(e.message, 'error'); });
}

function openGoogleCalendar(a) {
  var start = new Date(a.planned_time).toISOString().replace(/-|:|\.\d+/g, '').replace('000Z','Z');
  var end = new Date(new Date(a.planned_time).getTime() + 3600000).toISOString().replace(/-|:|\.\d+/g, '').replace('000Z','Z');
  var summary = encodeURIComponent('Misafir: ' + a.visitor_name);
  var details = encodeURIComponent('Firma: ' + (a.visitor_company||'—') + '\\nEv Sahibi: ' + (a.host_name||'—') + '\\nNeden: ' + (a.reason||'—'));
  var companyName = (window.vdBranding && window.vdBranding.companyName) || 'Ofis';
  var url = 'https://www.google.com/calendar/render?action=TEMPLATE&text=' + summary + '&dates=' + start + '/' + end + '&details=' + details + '&location=' + encodeURIComponent(companyName) + '&sf=true&output=xml';
  if (a.host_email) url += '&add=' + encodeURIComponent(a.host_email);
  window.open(url, '_blank');
}

function downloadICS(a) {
  var start = new Date(a.planned_time).toISOString().replace(/-|:|\.\d+/g, '');
  var end = new Date(new Date(a.planned_time).getTime() + 3600000).toISOString().replace(/-|:|\.\d+/g, '');
  var ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bıkmazdesk//VisitorManagement//TR',
    'BEGIN:VEVENT',
    'UID:appt-' + a.id + '@bikmazdesk.app',
    'DTSTAMP:' + new Date().toISOString().replace(/-|:|\.\d+/g, ''),
    'DTSTART:' + start,
    'DTEND:' + end,
    'SUMMARY:Misafir: ' + a.visitor_name,
    'DESCRIPTION:Misafir Randevu Kaydı\\nFirma: ' + (a.visitor_company||'—') + '\\nEv Sahibi: ' + (a.host_name||'—') + '\\nNeden: ' + (a.reason||'—'),
    'LOCATION:' + ((window.vdBranding && window.vdBranding.companyName) || 'Ofis'),
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = 'randevu-' + a.visitor_name.replace(/\s+/g, '-') + '.ics';
  link.click();
  URL.revokeObjectURL(url);
}

async function applyPanelBranding() {
  return window.vdApplyPanelBranding({ logoElementId: 'manager-logo-img' });
}

// Başlat
document.addEventListener('DOMContentLoaded', function() {
  if (!ensureRoleAccess(['manager', 'admin'])) return;
  applyPanelBranding();
  initNotifications();
  disablePersonnelManagementForManager();

  var u = getUser();
  if (u) {
    u.full_name = normalizeManagerName(u);
    sessionStorage.setItem('vd_user', JSON.stringify(u));
    applyUserChip(u);
  }

  function normalizeManagerName(user) {
    if (!user) return '';
    return user.full_name || '';
  }

  function applyUserChip(user) {
    if (!user) return;
    var normalizedName = normalizeManagerName(user);
    document.getElementById('user-name').textContent = normalizedName;
    document.getElementById('user-av').textContent = normalizedName.split(' ').map(function(w) { return w[0]; }).slice(0, 2).join('');
  }

  // Cache eski kalmışsa me endpoint'i ile tazele
  api.me().then(function(me) {
    var freshUser = me && (me.user || me);
    if (!freshUser) return;
    freshUser.full_name = normalizeManagerName(freshUser);
    sessionStorage.setItem('vd_user', JSON.stringify(freshUser));
    applyUserChip(freshUser);
  }).catch(function() {});

  function buildWaitingVisitorDetails(visitor) {
    if (!visitor) return '';
    var parts = [];
    if (visitor.company_name) parts.push('Sirket: ' + visitor.company_name);
    if (visitor.reason) parts.push('Sebep: ' + visitor.reason);
    var count = parseInt(visitor.visitor_count, 10);
    if (!Number.isFinite(count) || count < 1) count = 1;
    parts.push('Kisi: ' + count);
    return parts.join(' | ');
  }

  function buildWaitingVisitorMessage(visitor) {
    var fullName = visitor && visitor.full_name ? visitor.full_name : 'Misafir';
    var details = buildWaitingVisitorDetails(visitor);
    return details ? fullName + ' sizi bekliyor. ' + details : fullName + ' sizi bekliyor.';
  }

  (function wrapWaitingNotifications() {
    if (typeof addNotif === 'function' && !window.__vdManagerAddNotifWrapped) {
      var originalAddNotif = addNotif;
      addNotif = function(msg) {
        var pending = window.__vdPendingWaitingVisitor;
        if (pending && typeof msg === 'string' && msg.indexOf('Yeni misafir') === 0) {
          msg = pending.listMessage;
        }
        return originalAddNotif(msg);
      };
      window.__vdManagerAddNotifWrapped = true;
    }

    if (typeof showWindowsNotification === 'function' && !window.__vdManagerWindowsNotifWrapped) {
      var originalShowWindowsNotification = showWindowsNotification;
      showWindowsNotification = function(title, body, url) {
        var pending = window.__vdPendingWaitingVisitor;
        if (pending && title === 'Misafiriniz Kapıda') {
          body = pending.message;
        }
        return originalShowWindowsNotification(title, body, url);
      };
      window.__vdManagerWindowsNotifWrapped = true;
    }
  })();

  function showArrivalBanner(visitor) {
    var details = buildWaitingVisitorDetails(visitor);
    _bannerVisitorId = visitor.id;
    window.__vdPendingWaitingVisitor = {
      message: buildWaitingVisitorMessage(visitor),
      listMessage: 'Yeni misafir girisi: ' + visitor.full_name + (details ? ' - ' + details : ''),
    };
    document.getElementById('banner-title').textContent = visitor.full_name + ' sizi bekliyor';
    document.getElementById('banner-sub').textContent = details || 'Ziyaret';
    document.getElementById('arrival-banner').classList.add('show');
    playDoorbell();
  }

  // Socket.IO
  vdCreateSocket({
    onSystemReload: function() {
      console.log('🔄 Update detected, reloading...');
    },
    handlers: {
      'visitor:waiting': function(d) {
        var cu = getUser();
        if (!cu) return;
        if (canSeeHostData(cu, d.host_user_id, true)) {
          showArrivalBanner(d.visitor);
          showWindowsNotification('Misafiriniz Geldi', d.visitor.full_name + ' geldi ve sizi bekliyor.');
          addNotif('Misafiriniz geldi: ' + d.visitor.full_name);
          showToast(d.visitor.full_name + ' geldi ve sizi bekliyor');
        }
        loadAll();
      },
      'visitor:approved': function(d) {
        var v = d.visitor;
        if (v && _bannerVisitorId && Number(v.id) === Number(_bannerVisitorId)) {
          closeBanner();
        }
        var cu = getUser();
        if (!cu) return;
        if (v && canSeeHostData(cu, v.host_user_id, false)) {
          playDoorbell();
          addNotif('✅ Misafiriniz onaylandı: ' + v.full_name);
          showToast('✅ ' + v.full_name + ' misafiriniz sekreterya tarafından onaylandı!');
        }
        loadAll();
      },
      'visitor:arrived': function(d) {
        var v = d.visitor;
        if (v && _bannerVisitorId && Number(v.id) === Number(_bannerVisitorId)) {
          closeBanner();
        }
        var cu = getUser();
        if (!cu) return;
        if (canSeeHostData(cu, d.host_user_id || (v && v.host_user_id), true)) {
          showArrivalBanner(v);
          addNotif(v.full_name + ' geldi');
          showToast(v.full_name + ' misafiriniz geldi');
          if (typeof showWindowsNotification === 'function') {
            showWindowsNotification('Misafiriniz Geldi', v.full_name + ' geldi ve sizi bekliyor.');
          }
        }
        loadAll();
      },
      'visitor:rejected': function(d) {
        var v = d.visitor;
        var visitorId = (v && v.id) || d.visitor_id;
        if (visitorId && _bannerVisitorId && Number(visitorId) === Number(_bannerVisitorId)) {
          closeBanner();
        }
        var cu = getUser();
        if (v && cu && canSeeHostData(cu, v.host_user_id, false)) {
          playDoorbell();
          addNotif('❌ Misafiriniz reddedildi: ' + (v.full_name || '') + (d.reason ? ' - ' + d.reason : ''));
          showToast('❌ Misafiriniz reddedildi' + (d.reason ? ': ' + d.reason : ''), 'error');
        }
        loadAll();
      },
      'visitor:cancelled': function(d) {
        if (d && d.id && _bannerVisitorId && Number(d.id) === Number(_bannerVisitorId)) {
          closeBanner();
        }
        loadAll();
      },
      'appointment:created': function() {
        loadAll();
      },
      'appointment:approved': function() {
        loadAll();
      },
      'appointment:updated': function() {
        loadAll();
      },
      'appointment:cancelled': function() {
        loadAll();
      },
      'appointment:deleted': function() {
        loadAll();
      },
      'visitor:deleted': function() {
        loadAll();
      },
      'personnel:created': function() {
        loadAll();
      },
      'personnel:updated': function() {
        loadAll();
      },
      'personnel:deleted': function() {
        loadAll();
      },
      'room:created': function() {
        loadAll();
      },
      'room:updated': function() {
        loadAll();
      },
      'room:reserved': function() {
        loadAll();
      },
      'room:reservation_cancelled': function() {
        loadAll();
      },
    },
  });

  loadAll();
  setInterval(loadAll, 60000);
});
