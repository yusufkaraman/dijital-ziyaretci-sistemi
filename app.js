/**
 * app.js — Sekretarya Panel Uygulama Mantığı
 */

// ── STATE ──────────────────────────────────────────────────────────────────
let currentPage = 'dashboard';

// ── INIT ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  DB.init();
  startClock();
  setTodayDate();
  populateHostDropdown();
  renderDashboard();
  renderNotifications();
  setupPreviewListeners();

  // Animate KPIs on load
  document.querySelectorAll('.kpi-value').forEach(el => {
    const target = parseInt(el.textContent) || 0;
    animateCount(el, target);
  });
});

// ── CLOCK & DATE ───────────────────────────────────────────────────────────
function startClock() {
  const clockEl = document.getElementById('live-clock');
  const update = () => {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  };
  update();
  setInterval(update, 1000);
}

function setTodayDate() {
  const d = document.getElementById('today-date');
  if (d) d.textContent = new Date().toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric', weekday:'long' });
}

// ── NAVIGATION ─────────────────────────────────────────────────────────────
function navigate(page) {
  // hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(a => a.classList.remove('active'));

  // show target
  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');

  const nav = document.querySelector(`[data-page="${page}"]`);
  if (nav) nav.classList.add('active');

  const titles = {
    dashboard:'Dashboard', visitors:'Ziyaretçi Kayıtları',
    checkin:'Hızlı Check-in', appointments:'Randevu Yönetimi',
    screens:'Ekran Yönetimi', hosts:'Personel Listesi', reports:'Raporlar'
  };
  document.getElementById('page-title').textContent = titles[page] || 'Panel';
  currentPage = page;

  // Render on demand
  if (page === 'visitors')     renderVisitors();
  if (page === 'appointments') renderAppointments();
  if (page === 'screens')      renderScreens();
  if (page === 'hosts')        renderHosts();
  if (page === 'reports')      renderReports();
  if (page === 'dashboard')    renderDashboard();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────
function renderDashboard() {
  const visitors = DB.getAll('visitors');
  const today = new Date().toDateString();

  const todayVisitors = visitors.filter(v => new Date(v.checkIn).toDateString() === today);
  const activeVisitors = visitors.filter(v => v.status === 'İçeride');
  const appointments  = DB.getAll('appointments');
  const todayAppts    = appointments.filter(a => a.date === new Date().toISOString().split('T')[0]);
  const screens       = DB.getAll('screens');
  const onlineScreens = screens.filter(s => s.status === 'online');

  setKpi('kpi-today',        todayVisitors.length);
  setKpi('kpi-active',       activeVisitors.length);
  setKpi('kpi-appointments', todayAppts.length);
  setKpi('kpi-screens',      onlineScreens.length);

  const activeCount = document.getElementById('active-count');
  if (activeCount) activeCount.textContent = activeVisitors.length;

  // Recent visitors
  const rvList = document.getElementById('recent-visitors-list');
  if (rvList) {
    const recent = [...todayVisitors].reverse().slice(0,5);
    rvList.innerHTML = recent.length ? recent.map(v => `
      <div class="visitor-mini-item">
        <div class="visitor-mini-avatar" style="background:${avatarBg(v.name)};color:white">${initials(v.name)}</div>
        <div class="visitor-mini-info">
          <div class="visitor-mini-name">${v.name}</div>
          <div class="visitor-mini-sub">${v.company} · ${v.reason}</div>
        </div>
        ${statusBadge(v.status)}
      </div>`) .join('') : '<p style="color:var(--text-3);font-size:13px;padding:8px 0">Bugün ziyaretçi yok</p>';
  }

  // Upcoming appointments
  const uaList = document.getElementById('upcoming-appointments-list');
  if (uaList) {
    const todayApptsSorted = [...todayAppts].sort((a,b) => a.time.localeCompare(b.time)).slice(0,5);
    uaList.innerHTML = todayApptsSorted.length ? todayApptsSorted.map(a => `
      <div class="appt-mini-item">
        <div class="appt-mini-time">${a.time}</div>
        <div class="appt-mini-info">
          <div class="appt-mini-name">${a.name}</div>
          <div class="appt-mini-sub">${a.hostName} · ${a.reason}</div>
        </div>
        <span class="status-badge ${a.status === 'Onaylı' ? 'status-active' : 'status-waiting'}">${a.status}</span>
      </div>`) .join('') : '<p style="color:var(--text-3);font-size:13px;padding:8px 0">Bugün randevu yok</p>';
  }

  drawTrafficChart();
}

function setKpi(id, val) {
  const el = document.getElementById(id);
  if (el) animateCount(el, val);
}

// ── VISITORS TABLE ─────────────────────────────────────────────────────────
function renderVisitors(data) {
  const visitors = data || DB.getAll('visitors');
  const tbody = document.getElementById('visitors-tbody');
  if (!tbody) return;

  tbody.innerHTML = visitors.length ? visitors.map(v => `
    <tr>
      <td>
        <div class="visitor-cell">
          <div class="visitor-cell-avatar" style="background:${avatarBg(v.name)};color:white">${initials(v.name)}</div>
          <div>
            <div style="font-weight:600">${v.name}</div>
            <div style="font-size:11px;color:var(--text-2)">${v.company}</div>
          </div>
        </div>
      </td>
      <td style="color:var(--text-2);font-family:monospace">${v.tc || '—'}</td>
      <td>${v.reason}</td>
      <td>${v.hostName}</td>
      <td style="font-size:12px">${fmtTime(v.checkIn)}</td>
      <td style="font-size:12px">${v.checkOut ? fmtTime(v.checkOut) : '—'}</td>
      <td>${statusBadge(v.status)}</td>
      <td>
        <div style="display:flex;gap:6px">
          ${v.status === 'İçeride' ? `<button class="btn-sm checkout" onclick="checkOut(${v.id})">Çıkış</button>` : ''}
          ${v.status === 'Bekleniyor' ? `<button class="btn-sm checkout" onclick="markActive(${v.id})">Kabul</button>` : ''}
          <button class="btn-sm" onclick="viewVisitor(${v.id})">Detay</button>
          <button class="btn-sm danger" onclick="deleteVisitor(${v.id})">Sil</button>
        </div>
      </td>
    </tr>`).join('') : `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-3)">Kayıt bulunamadı</td></tr>`;
}

function filterVisitors() {
  const search  = (document.getElementById('visitor-search')?.value  || '').toLowerCase();
  const status  =  document.getElementById('status-filter')?.value   || '';
  const dateF   =  document.getElementById('date-filter')?.value     || 'today';

  let data = DB.getAll('visitors');

  if (search)  data = data.filter(v => v.name.toLowerCase().includes(search) || (v.tc || '').includes(search));
  if (status)  data = data.filter(v => v.status === status);

  if (dateF === 'today') {
    const today = new Date().toDateString();
    data = data.filter(v => new Date(v.checkIn).toDateString() === today);
  } else if (dateF === 'week') {
    const week = Date.now() - 7 * 86400000;
    data = data.filter(v => new Date(v.checkIn).getTime() > week);
  }

  renderVisitors(data);
}

function checkOut(id) {
  DB.update('visitors', id, { status:'Çıktı', checkOut: new Date().toISOString() });
  renderVisitors();
  if (currentPage === 'dashboard') renderDashboard();
  toast('✅ Ziyaretçi çıkışı kaydedildi', 'success');
  addNotif('👤', `Ziyaretçi çıkış yaptı: ${DB.getById('visitors',id)?.name}`, 'az önce', 'green');
}

function markActive(id) {
  DB.update('visitors', id, { status:'İçeride' });
  renderVisitors();
  if (currentPage === 'dashboard') renderDashboard();
  toast('✅ Ziyaretçi kabul edildi', 'success');
}

function deleteVisitor(id) {
  if (!confirm('Bu kaydı silmek istediğinizden emin misiniz?')) return;
  DB.delete('visitors', id);
  renderVisitors();
  if (currentPage === 'dashboard') renderDashboard();
  toast('🗑️ Kayıt silindi', 'warning');
}

function viewVisitor(id) {
  const v = DB.getById('visitors', id);
  if (!v) return;
  document.getElementById('modal-title').textContent = 'Ziyaretçi Detayı';
  document.getElementById('modal-body').innerHTML = `
    <div style="text-align:center;margin-bottom:20px">
      <div style="width:72px;height:72px;border-radius:50%;background:${avatarBg(v.name)};
        color:white;font-size:24px;font-weight:800;display:flex;align-items:center;
        justify-content:center;margin:0 auto 12px">${initials(v.name)}</div>
      <div style="font-size:20px;font-weight:700">${v.name}</div>
      <div style="color:var(--text-2);font-size:13px">${v.company}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      ${field('TC Kimlik', v.tc || '—')}
      ${field('Telefon', v.phone || '—')}
      ${field('E-posta', v.email || '—')}
      ${field('Ziyaret Sebebi', v.reason)}
      ${field('Görüşülen Personel', v.hostName)}
      ${field('Rozet No', v.badge || '—')}
      ${field('Giriş', fmtDateTime(v.checkIn))}
      ${field('Çıkış', v.checkOut ? fmtDateTime(v.checkOut) : 'Devam ediyor')}
    </div>
    ${v.notes ? `<div style="margin-top:16px;padding:12px;background:var(--bg-hover);border-radius:8px;font-size:13px;color:var(--text-2)"><b>Notlar:</b> ${v.notes}</div>` : ''}
  `;
  openModal();
}

// ── CHECK-IN ───────────────────────────────────────────────────────────────
function setupPreviewListeners() {
  const name    = document.getElementById('ci-name');
  const company = document.getElementById('ci-company');
  if (!name) return;

  name.addEventListener('input', () => {
    const n = name.value || 'Ad Soyad';
    document.getElementById('preview-name').textContent = n;
    document.getElementById('preview-avatar').textContent = n === 'Ad Soyad' ? '?' : initials(n);
  });
  company.addEventListener('input', () => {
    document.getElementById('preview-company').textContent = company.value || 'Firma / Kurum';
  });
}

function populateHostDropdown() {
  const select = document.getElementById('ci-host');
  if (!select) return;
  DB.getAll('hosts').forEach(h => {
    const opt = document.createElement('option');
    opt.value = h.id;
    opt.textContent = `${h.name} (${h.dept})`;
    select.appendChild(opt);
  });
}

function checkInVisitor() {
  const name    = document.getElementById('ci-name').value.trim();
  const tc      = document.getElementById('ci-tc').value.trim();
  const phone   = document.getElementById('ci-phone').value.trim();
  const email   = document.getElementById('ci-email').value.trim();
  const company = document.getElementById('ci-company').value.trim();
  const hostId  = parseInt(document.getElementById('ci-host').value);
  const reason  = document.getElementById('ci-reason').value;
  const notes   = document.getElementById('ci-notes').value.trim();

  if (!name) { toast('⚠️ Ad Soyad zorunludur', 'warning'); return; }
  if (!hostId) { toast('⚠️ Görüşülecek personeli seçiniz', 'warning'); return; }
  if (!reason) { toast('⚠️ Ziyaret sebebi seçiniz', 'warning'); return; }

  const host = DB.getById('hosts', hostId);
  const visitors = DB.getAll('visitors');
  const badge = 'B-' + String(visitors.length + 1).padStart(3, '0');

  const v = DB.insert('visitors', {
    name, tc, phone, email, company,
    hostId, hostName: host?.name || '—',
    reason, notes, badge,
    checkIn: new Date().toISOString(),
    checkOut: null,
    status: 'İçeride'
  });

  DB.update('hosts', hostId, { visits: (host?.visits || 0) + 1 });

  toast(`✅ ${name} girişi kaydedildi — Rozet: ${badge}`, 'success');
  addNotif('👤', `Yeni giriş: ${name} → ${host?.name}`, 'az önce', 'purple');

  clearCheckinForm();
  renderRecentCheckins();
  renderDashboard();

  // Show ticket overlay
  showCheckinTicket(v, host);
}

function showCheckinTicket(v, host) {
  document.getElementById('modal-title').textContent = '🎫 Giriş Kartı Oluşturuldu';
  document.getElementById('modal-body').innerHTML = `
    <div style="text-align:center">
      <div style="width:72px;height:72px;border-radius:50%;background:${avatarBg(v.name)};
        color:white;font-size:24px;font-weight:800;display:flex;align-items:center;
        justify-content:center;margin:0 auto 16px">${initials(v.name)}</div>
      <div style="font-size:22px;font-weight:800;margin-bottom:4px">${v.name}</div>
      <div style="color:var(--text-2);font-size:13px;margin-bottom:20px">${v.company || 'Bireysel'}</div>
      <div style="background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(6,182,212,0.1));
        border:1px solid rgba(99,102,241,0.3);border-radius:12px;padding:20px;margin-bottom:16px">
        <div style="font-size:32px;font-weight:900;letter-spacing:4px;color:var(--purple-l)">${v.badge}</div>
        <div style="font-size:12px;color:var(--text-2);margin-top:4px">ROZET NUMARASI</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;text-align:left">
        ${field('Görüşülecek', host?.name || '—')}
        ${field('Ziyaret Sebebi', v.reason)}
        ${field('Giriş Saati', fmtTime(v.checkIn))}
        ${field('Süre Limiti', '3 saat')}
      </div>
    </div>`;
  openModal();
}

function renderRecentCheckins() {
  const list = document.getElementById('recent-checkins-list');
  if (!list) return;
  const recent = DB.getAll('visitors').slice(-5).reverse();
  list.innerHTML = recent.map(v => `
    <div class="recent-item">
      <div class="recent-avatar" style="background:${avatarBg(v.name)};color:white">${initials(v.name)}</div>
      <div class="recent-info">
        <div class="recent-name">${v.name}</div>
        <div class="recent-time">${fmtTime(v.checkIn)} · ${v.badge}</div>
      </div>
      ${statusBadge(v.status)}
    </div>`).join('');
}

function clearCheckinForm() {
  ['ci-name','ci-tc','ci-phone','ci-email','ci-company','ci-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('ci-host').selectedIndex = 0;
  document.getElementById('ci-reason').selectedIndex = 0;
  document.getElementById('preview-name').textContent    = 'Ad Soyad';
  document.getElementById('preview-company').textContent = 'Firma / Kurum';
  document.getElementById('preview-avatar').textContent  = '?';
}

// ── APPOINTMENTS ───────────────────────────────────────────────────────────
function renderAppointments() {
  const grid = document.getElementById('appointments-grid');
  if (!grid) return;
  const appts = DB.getAll('appointments').sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  grid.innerHTML = appts.map(a => `
    <div class="appt-card priority-${a.priority}">
      <div class="appt-card-header">
        <div>
          <div class="appt-card-name">${a.name}</div>
          <div class="appt-card-company">${a.company}</div>
        </div>
        <div>
          <div class="appt-card-time">${a.time}</div>
          <div class="appt-card-date">${fmtDate(a.date)}</div>
        </div>
      </div>
      <div class="appt-card-detail">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        ${a.hostName} · ${a.reason}
      </div>
      ${a.notes ? `<div style="font-size:11px;color:var(--text-3);margin-bottom:10px">📝 ${a.notes}</div>` : ''}
      <div class="appt-card-footer">
        <span class="status-badge ${a.status === 'Onaylı' ? 'status-active' : 'status-waiting'}">${a.status}</span>
        <div style="display:flex;gap:6px">
          ${a.status === 'Beklemede' ? `<button class="btn-sm checkout" onclick="confirmAppt(${a.id})">Onayla</button>` : ''}
          <button class="btn-sm danger" onclick="deleteAppt(${a.id})">İptal</button>
        </div>
      </div>
    </div>`).join('');
}

function showAppointmentModal() {
  document.getElementById('modal-title').textContent = 'Yeni Randevu';
  const hosts = DB.getAll('hosts');
  document.getElementById('modal-body').innerHTML = `
    <div class="form-row">
      <div class="form-group"><label>Ad Soyad *</label><input id="ma-name" class="form-input" placeholder="Ziyaretçi adı" /></div>
      <div class="form-group"><label>Firma</label><input id="ma-company" class="form-input" placeholder="Kurumu" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Personel *</label>
        <select id="ma-host" class="form-input">
          <option value="">Seçiniz...</option>
          ${hosts.map(h => `<option value="${h.id}">${h.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Sebep</label>
        <select id="ma-reason" class="form-input">
          <option>Toplantı</option><option>İş Görüşmesi</option><option>Danışma</option>
          <option>Teknik Destek</option><option>Teslimat</option><option>Diğer</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Tarih *</label><input id="ma-date" type="date" class="form-input" value="${new Date().toISOString().split('T')[0]}" /></div>
      <div class="form-group"><label>Saat *</label><input id="ma-time" type="time" class="form-input" value="10:00" /></div>
    </div>
    <div class="form-group"><label>Notlar</label><textarea id="ma-notes" class="form-input" rows="2" placeholder="Ek bilgi..."></textarea></div>
    <div class="form-group"><label>Öncelik</label>
      <select id="ma-priority" class="form-input">
        <option value="low">Düşük</option><option value="med" selected>Orta</option><option value="high">Yüksek</option>
      </select>
    </div>
    <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px">
      <button class="btn-secondary" onclick="closeModal()">İptal</button>
      <button class="btn-primary" onclick="saveAppointment()">Kaydet</button>
    </div>`;
  openModal();
}

function saveAppointment() {
  const name    = document.getElementById('ma-name').value.trim();
  const company = document.getElementById('ma-company').value.trim();
  const hostId  = parseInt(document.getElementById('ma-host').value);
  const reason  = document.getElementById('ma-reason').value;
  const date    = document.getElementById('ma-date').value;
  const time    = document.getElementById('ma-time').value;
  const notes   = document.getElementById('ma-notes').value.trim();
  const priority= document.getElementById('ma-priority').value;

  if (!name || !hostId || !date || !time) { toast('⚠️ Zorunlu alanları doldurunuz', 'warning'); return; }

  const host = DB.getById('hosts', hostId);
  DB.insert('appointments', { name, company, hostId, hostName: host?.name || '—', reason, date, time, notes, priority, status:'Beklemede' });
  closeModal();
  renderAppointments();
  toast('📅 Randevu oluşturuldu', 'success');
}

function confirmAppt(id) {
  DB.update('appointments', id, { status:'Onaylı' });
  renderAppointments();
  toast('✅ Randevu onaylandı', 'success');
}

function deleteAppt(id) {
  if (!confirm('Randevuyu iptal etmek istiyor musunuz?')) return;
  DB.delete('appointments', id);
  renderAppointments();
  toast('🗑️ Randevu iptal edildi', 'warning');
}

// ── SCREENS ────────────────────────────────────────────────────────────────
function renderScreens() {
  const grid = document.getElementById('screens-grid');
  if (!grid) return;
  const screens = DB.getAll('screens');

  grid.innerHTML = screens.map(s => `
    <div class="screen-card">
      <div class="screen-card-top">
        <div class="screen-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        </div>
        <div style="flex:1">
          <div class="screen-name">${s.name}</div>
          <div class="screen-location">${s.location}</div>
          <div class="${s.status === 'online' ? 'screen-online' : 'screen-offline'}">
            ${s.status === 'online' ? '🟢 Çevrimiçi' : '🔴 Çevrimdışı'} · ${s.lastPing}
          </div>
        </div>
      </div>
      <div class="screen-preview">
        <div class="screen-preview-label">Aktif İçerik</div>
        <div class="screen-preview-content">${s.content}</div>
      </div>
      <div class="screen-actions">
        <button class="btn-sm" onclick="editScreen(${s.id})">✏️ Düzenle</button>
        <button class="btn-sm ${s.status === 'online' ? 'danger' : 'checkout'}" onclick="toggleScreen(${s.id})">
          ${s.status === 'online' ? '⏸ Durdur' : '▶ Başlat'}
        </button>
      </div>
    </div>`).join('');
}

function showScreenModal() {
  document.getElementById('modal-title').textContent = 'Ekran Ekle';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group"><label>Ekran Adı *</label><input id="ms-name" class="form-input" placeholder="Giriş Ekranı" /></div>
    <div class="form-group"><label>Konum</label><input id="ms-location" class="form-input" placeholder="1. Kat - Resepsiyon" /></div>
    <div class="form-group"><label>İçerik Tipi</label>
      <select id="ms-type" class="form-input">
        <option value="karşılama">Karşılama Ekranı</option>
        <option value="bilgi">Bilgi Ekranı</option>
        <option value="takvim">Toplantı Takvimi</option>
        <option value="duyuru">Duyuru Ekranı</option>
        <option value="menü">Menü Ekranı</option>
        <option value="güvenlik">Güvenlik / Yönlendirme</option>
      </select>
    </div>
    <div class="form-group"><label>Yayın İçeriği</label><textarea id="ms-content" class="form-input" rows="3" placeholder="Ekranda gösterilecek içerik..."></textarea></div>
    <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px">
      <button class="btn-secondary" onclick="closeModal()">İptal</button>
      <button class="btn-primary" onclick="saveScreen()">Ekle</button>
    </div>`;
  openModal();
}

function saveScreen() {
  const name     = document.getElementById('ms-name').value.trim();
  const location = document.getElementById('ms-location').value.trim();
  const type     = document.getElementById('ms-type').value;
  const content  = document.getElementById('ms-content').value.trim();
  if (!name) { toast('⚠️ Ekran adı zorunludur', 'warning'); return; }
  DB.insert('screens', { name, location, type, content, status:'online', lastPing:'az önce' });
  closeModal();
  renderScreens();
  toast('🖥️ Ekran eklendi', 'success');
}

function editScreen(id) {
  const s = DB.getById('screens', id);
  if (!s) return;
  document.getElementById('modal-title').textContent = 'Ekran Düzenle';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group"><label>İçerik</label>
      <textarea id="es-content" class="form-input" rows="4">${s.content}</textarea>
    </div>
    <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px">
      <button class="btn-secondary" onclick="closeModal()">İptal</button>
      <button class="btn-primary" onclick="updateScreenContent(${id})">Güncelle</button>
    </div>`;
  openModal();
}

function updateScreenContent(id) {
  const content = document.getElementById('es-content').value.trim();
  DB.update('screens', id, { content });
  closeModal();
  renderScreens();
  toast('✅ Ekran içeriği güncellendi', 'success');
}

function toggleScreen(id) {
  const s = DB.getById('screens', id);
  DB.update('screens', id, { status: s.status === 'online' ? 'offline' : 'online', lastPing:'az önce' });
  renderScreens();
  toast(s.status === 'online' ? '⏸ Ekran durduruldu' : '▶ Ekran başlatıldı', 'success');
}

// ── HOSTS ──────────────────────────────────────────────────────────────────
function renderHosts() {
  const grid = document.getElementById('hosts-grid');
  if (!grid) return;
  const hosts = DB.getAll('hosts');

  grid.innerHTML = hosts.map(h => `
    <div class="host-card">
      <div class="host-avatar" style="background:${h.color}">${h.avatar}</div>
      <div class="host-name">${h.name}</div>
      <div class="host-dept">${h.dept}</div>
      <div class="host-title">${h.title} — Dahili: ${h.ext}</div>
      <div class="host-stats">
        <div class="host-stat">
          <div class="host-stat-val">${h.visits || 0}</div>
          <div class="host-stat-lbl">Toplam Ziyaret</div>
        </div>
        <div class="host-stat">
          <div class="host-stat-val">${DB.query('appointments', a => a.hostId === h.id).length}</div>
          <div class="host-stat-lbl">Randevu</div>
        </div>
      </div>
    </div>`).join('');
}

function showHostModal() {
  document.getElementById('modal-title').textContent = 'Personel Ekle';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-row">
      <div class="form-group"><label>Ad Soyad *</label><input id="mh-name" class="form-input" /></div>
      <div class="form-group"><label>Departman *</label><input id="mh-dept" class="form-input" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Unvan</label><input id="mh-title" class="form-input" /></div>
      <div class="form-group"><label>Dahili No</label><input id="mh-ext" class="form-input" placeholder="101" /></div>
    </div>
    <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px">
      <button class="btn-secondary" onclick="closeModal()">İptal</button>
      <button class="btn-primary" onclick="saveHost()">Ekle</button>
    </div>`;
  openModal();
}

function saveHost() {
  const name  = document.getElementById('mh-name').value.trim();
  const dept  = document.getElementById('mh-dept').value.trim();
  const title = document.getElementById('mh-title').value.trim();
  const ext   = document.getElementById('mh-ext').value.trim();
  if (!name || !dept) { toast('⚠️ Zorunlu alanları doldurunuz', 'warning'); return; }
  const colors = ['#6366f1','#ec4899','#06b6d4','#10b981','#f59e0b','#8b5cf6','#ef4444','#14b8a6'];
  const color  = colors[Math.floor(Math.random() * colors.length)];
  const avatar = initials(name);
  DB.insert('hosts', { name, dept, title, ext, avatar, color, visits:0 });
  // rebuild host dropdown
  const sel = document.getElementById('ci-host');
  if (sel) {
    sel.innerHTML = '<option value="">Seçiniz...</option>';
    DB.getAll('hosts').forEach(h => {
      const opt = document.createElement('option');
      opt.value = h.id; opt.textContent = `${h.name} (${h.dept})`;
      sel.appendChild(opt);
    });
  }
  closeModal();
  renderHosts();
  toast('✅ Personel eklendi', 'success');
}

// ── REPORTS ────────────────────────────────────────────────────────────────
function renderReports() {
  const visitors = DB.getAll('visitors');
  const today    = new Date();
  const month    = today.getMonth();

  document.getElementById('rep-total').textContent = visitors.length;
  document.getElementById('rep-month').textContent = visitors.filter(v => new Date(v.checkIn).getMonth() === month).length;

  drawReasonChart();
  drawTopHosts();
  drawMonthlyChart();
}

// ── CHARTS ─────────────────────────────────────────────────────────────────
function drawTrafficChart() {
  const canvas = document.getElementById('trafficChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width  = canvas.parentElement.clientWidth;
  canvas.height = 200;

  const days   = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
  const entries = [12, 19, 15, 24, 18, 8, 5];
  const exits   = [10, 17, 14, 22, 16, 7, 4];
  drawBarChart(ctx, canvas.width, canvas.height, days, entries, exits);
}

function drawBarChart(ctx, w, h, labels, data1, data2) {
  ctx.clearRect(0, 0, w, h);
  const padL=40, padR=16, padT=16, padB=32;
  const cw = w - padL - padR;
  const ch = h - padT - padB;
  const max  = Math.max(...data1, ...data2) * 1.2;
  const barW = (cw / labels.length) * 0.35;
  const gap  = barW * 0.2;

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i=0; i<=4; i++) {
    const y = padT + (ch / 4) * i;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.fillStyle = 'rgba(148,163,184,0.5)';
    ctx.font = '10px Inter';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(max - (max/4)*i), padL - 4, y + 4);
  }

  labels.forEach((label, i) => {
    const x = padL + (cw / labels.length) * i + (cw / labels.length) / 2;
    const barX1 = x - barW - gap/2;
    const barX2 = x + gap/2;

    // Bar 1 (entries)
    const h1 = (data1[i] / max) * ch;
    const grad1 = ctx.createLinearGradient(0, padT + ch - h1, 0, padT + ch);
    grad1.addColorStop(0, 'rgba(99,102,241,0.9)');
    grad1.addColorStop(1, 'rgba(99,102,241,0.2)');
    ctx.fillStyle = grad1;
    roundRect(ctx, barX1, padT + ch - h1, barW, h1, 4);

    // Bar 2 (exits)
    const h2 = (data2[i] / max) * ch;
    const grad2 = ctx.createLinearGradient(0, padT + ch - h2, 0, padT + ch);
    grad2.addColorStop(0, 'rgba(6,182,212,0.9)');
    grad2.addColorStop(1, 'rgba(6,182,212,0.2)');
    ctx.fillStyle = grad2;
    roundRect(ctx, barX2, padT + ch - h2, barW, h2, 4);

    // Labels
    ctx.fillStyle = 'rgba(148,163,184,0.7)';
    ctx.font = '11px Inter'; ctx.textAlign = 'center';
    ctx.fillText(label, x, h - 8);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function drawReasonChart() {
  const canvas = document.getElementById('reasonChart');
  if (!canvas) return;
  const ctx    = canvas.getContext('2d');
  canvas.width = 160; canvas.height = 160;

  const visitors = DB.getAll('visitors');
  const counts   = {};
  visitors.forEach(v => { counts[v.reason] = (counts[v.reason] || 0) + 1; });

  const colors  = ['#6366f1','#06b6d4','#10b981','#f59e0b','#ec4899','#8b5cf6'];
  const labels  = Object.keys(counts);
  const values  = Object.values(counts);
  const total   = values.reduce((a,b)=>a+b,0);

  let startAngle = -Math.PI / 2;
  const cx = 80, cy = 80, r = 70, inner = 42;

  labels.forEach((label, i) => {
    const slice = (values[i] / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    startAngle += slice;
  });

  // Donut hole
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.fillStyle = '#161920';
  ctx.fill();

  // Center text
  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'bold 18px Inter';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total, cx, cy);

  // Legend
  const legendEl = document.getElementById('pie-legend');
  if (legendEl) {
    legendEl.innerHTML = labels.map((l,i) => `
      <div class="pie-legend-item">
        <div class="pie-legend-dot" style="background:${colors[i % colors.length]}"></div>
        <span class="pie-legend-label">${l}</span>
        <span class="pie-legend-value">${values[i]}</span>
      </div>`).join('');
  }
}

function drawTopHosts() {
  const el = document.getElementById('top-hosts-list');
  if (!el) return;
  const hosts = DB.getAll('hosts').sort((a,b) => (b.visits||0) - (a.visits||0)).slice(0,5);
  const max = hosts[0]?.visits || 1;

  el.innerHTML = hosts.map((h,i) => `
    <div class="top-host-item">
      <div class="top-host-rank">${i+1}</div>
      <div class="top-host-bar-wrap">
        <div class="top-host-name">${h.name}</div>
        <div class="top-host-bar"><div class="top-host-bar-fill" style="width:${((h.visits||0)/max*100)}%"></div></div>
      </div>
      <div class="top-host-count">${h.visits||0}</div>
    </div>`).join('');
}

function drawMonthlyChart() {
  const canvas = document.getElementById('monthlyChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width  = canvas.parentElement.clientWidth;
  canvas.height = 200;

  const months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  const data   = [42, 58, 71, 83, 65, 90, 78, 95, 88, 102, 76, 110];
  const padL=40, padR=16, padT=16, padB=32;
  const w = canvas.width, h = canvas.height;
  const cw = w - padL - padR, ch = h - padT - padB;
  const max = Math.max(...data) * 1.15;

  ctx.clearRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
  for (let i=0; i<=4; i++) {
    const y = padT + (ch/4)*i;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w-padR, y); ctx.stroke();
    ctx.fillStyle = 'rgba(148,163,184,0.5)'; ctx.font = '10px Inter'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(max - (max/4)*i), padL-4, y+4);
  }

  // Gradient fill below line
  const points = data.map((v, i) => ({
    x: padL + (cw / (data.length-1)) * i,
    y: padT + ch - (v / max) * ch
  }));

  const grad = ctx.createLinearGradient(0, padT, 0, padT+ch);
  grad.addColorStop(0, 'rgba(99,102,241,0.25)');
  grad.addColorStop(1, 'rgba(99,102,241,0)');
  ctx.beginPath();
  ctx.moveTo(points[0].x, padT+ch);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length-1].x, padT+ch);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke();

  // Dots
  points.forEach(p => {
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
    ctx.fillStyle = '#6366f1'; ctx.fill();
    ctx.strokeStyle = '#161920'; ctx.lineWidth = 2; ctx.stroke();
  });

  // Labels
  ctx.fillStyle = 'rgba(148,163,184,0.7)'; ctx.font = '11px Inter'; ctx.textAlign = 'center';
  months.forEach((m, i) => {
    ctx.fillText(m, points[i].x, h-8);
  });
}

// ── NOTIFICATIONS ──────────────────────────────────────────────────────────
function toggleNotifications() {
  document.getElementById('notif-panel').classList.toggle('open');
}

function renderNotifications() {
  const notifs = DB.getAll('notifications');
  const list   = document.getElementById('notif-list');
  const dot    = document.getElementById('notif-dot');
  const unread = notifs.filter(n => !n.read);

  if (dot) dot.style.display = unread.length ? 'block' : 'none';

  if (list) {
    list.innerHTML = notifs.length ? notifs.map(n => `
      <div class="notif-item">
        <div class="notif-item-icon" style="background:rgba(99,102,241,0.1)">${n.icon}</div>
        <div class="notif-item-text">
          <div class="notif-item-title">${n.title}</div>
          <div class="notif-item-time">${n.time}</div>
        </div>
      </div>`).join('') : '<p style="padding:16px;color:var(--text-3);font-size:13px">Bildirim yok</p>';
  }
}

function addNotif(icon, title, time, color) {
  DB.insert('notifications', { icon, title, time, color, read:false });
  renderNotifications();
}

function clearNotifications() {
  DB.notifications = [];
  DB._save('notifications');
  renderNotifications();
  document.getElementById('notif-panel').classList.remove('open');
}

// ── SEARCH ─────────────────────────────────────────────────────────────────
function globalSearch(val) {
  if (!val.trim()) return;
  navigate('visitors');
  document.getElementById('visitor-search').value = val;
  filterVisitors();
}

// ── MODAL ──────────────────────────────────────────────────────────────────
function openModal()  { document.getElementById('modal-overlay').classList.add('open'); }
function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }

// ── TOAST ──────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg, type='success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ── HELPERS ────────────────────────────────────────────────────────────────
function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase();
}

const avatarColors = ['#6366f1','#8b5cf6','#ec4899','#06b6d4','#10b981','#f59e0b','#ef4444','#14b8a6'];
function avatarBg(name) {
  let hash = 0;
  for (let c of (name||'')) hash = ((hash << 5) - hash) + c.charCodeAt(0);
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function statusBadge(status) {
  const map = { 'İçeride':'status-active', 'Çıktı':'status-checkout', 'Bekleniyor':'status-waiting' };
  return `<span class="status-badge ${map[status] || ''}">${status}</span>`;
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('tr-TR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('tr-TR', { day:'numeric', month:'long' });
}

function field(label, value) {
  return `<div style="background:var(--bg-hover);border-radius:8px;padding:10px">
    <div style="font-size:11px;color:var(--text-2);margin-bottom:2px">${label}</div>
    <div style="font-size:13px;font-weight:600">${value}</div>
  </div>`;
}

function animateCount(el, target) {
  const start = 0;
  const dur   = 800;
  const begin = performance.now();
  const step  = (now) => {
    const progress = Math.min((now - begin) / dur, 1);
    const eased    = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Close notification panel on outside click
document.addEventListener('click', e => {
  const panel  = document.getElementById('notif-panel');
  const btn    = e.target.closest('.btn-icon');
  if (!panel.contains(e.target) && !btn) panel.classList.remove('open');
});

// Init recent checkins on check-in page load
document.querySelector('[data-page="checkin"]')?.addEventListener('click', () => {
  setTimeout(renderRecentCheckins, 100);
});
