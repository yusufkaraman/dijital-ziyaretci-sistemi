// Zamanlayıcı
setInterval(() => {
  const el = document.getElementById('top-clock');
  if (el) el.textContent = new Date().toLocaleTimeString('tr-TR');
}, 1000);

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
    document.getElementById('kpi-waiting').textContent = s.waiting != null ? s.waiting : 0;
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
    btn.textContent = 'Giriş Onayını Kaydet';
  } else {
    tAppt.style.color = 'var(--primary)'; tAppt.style.borderBottom = '2px solid var(--primary)';
    tGuest.style.color = 'var(--muted)'; tGuest.style.borderBottom = 'none';
    divTime.style.visibility = 'visible'; divTime.style.position = 'static';
    btn.textContent = 'Randevu Kaydet';
  }
}
async function openAddVisitorModal() {
  switchModalTab('guest');
  document.getElementById('add-time').value = new Date(Date.now() + 3600000).toISOString().slice(0, 16);
  document.getElementById('add-visitor-modal').classList.add('show');
  document.body.classList.add('modal-open');
  
  // Personel listesini yükle ve otomatik olarak giriş yapan kullanıcıyı seç
  try {
    const list = await api.getPersonnel({ is_active: 1 });
    const sel = document.getElementById('add-host-id');
    const currentU = getUser();
    sel.innerHTML = '<option value="">Seçiniz...</option>' + list.map(p => 
      `<option value="${p.id}" ${currentU && p.user_id == currentU.id ? 'selected' : ''}>${p.full_name} (${p.title || p.department || ''})</option>`
    ).join('');
    // Auto-select current user's personnel record - host is always the logged-in personnel
    // Match by user_id first, fallback to full_name match
    const myPersonnel = list.find(p => currentU && p.user_id == currentU.id)
      || list.find(p => currentU && p.full_name && currentU.full_name && p.full_name.trim().toLowerCase() === currentU.full_name.trim().toLowerCase());
    if (myPersonnel) {
      sel.value = myPersonnel.id;
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
    host_personnel_id: document.getElementById('add-host-id').value,
    reason: document.getElementById('add-reason').value.trim(),
    vehicle_plate: document.getElementById('add-plate').value.trim(),
    visitor_count: parseInt(document.getElementById('add-count').value) || 1,
    notes: document.getElementById('add-notes').value.trim(),
  };

  if (!data.full_name || !data.reason || !data.host_personnel_id) {
    return showToast('Lütfen zorunlu alanları (Ad Soyad, Personel, Sebep) doldurun.', 'error');
  }

  const timeStr = document.getElementById('add-time').value;
  if (mode === 'appt' && !timeStr) return showToast('Randevu zamanı seçiniz.', 'error');

  let plannedTime = timeStr ? timeStr.replace('T', ' ') : null;
  if (plannedTime && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(plannedTime)) plannedTime += ':00';

  try {
    if (mode === 'guest') {
      data.planned_time = null;
      await api.createVisitor(data);
      showToast('Misafir girişi başarıyla onaylanmıştır.');
    } else {
      await api.createAppointment({
        visitor_name: data.full_name,
        visitor_tc: data.tc_no,
        visitor_phone: data.phone,
        visitor_email: data.email,
        visitor_company: data.company_name,
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
    return '<div class="notif-item' + (i === 0 ? ' new' : '') + '"><div>' + n.msg + '</div><div class="notif-time">' + n.time + '</div></div>';
  }).join('');
  var cnt = document.getElementById('notif-count');
  cnt.style.display = 'inline';
  cnt.textContent = _notifs.length;
}
function clearNotifs() {
  _notifs = [];
  document.getElementById('notif-list').innerHTML = '<div class="empty">Bildirim yok</div>';
  document.getElementById('notif-count').style.display = 'none';
}

// Banner
var _bannerVisitorId = null;
function showArrivalBanner(visitor) {
  _bannerVisitorId = visitor.id;
  document.getElementById('banner-title').textContent = visitor.full_name + ' sizi bekliyor';
  document.getElementById('banner-sub').textContent = (visitor.company_name || '') + ' · ' + (visitor.reason || 'Ziyaret');
  document.getElementById('arrival-banner').classList.add('show');
  addNotif('Yeni misafir girişi: ' + visitor.full_name);
  playDoorbell();
  setTimeout(closeBanner, 15000);
}
function closeBanner() {
  document.getElementById('arrival-banner').classList.remove('show');
  _bannerVisitorId = null;
}
function bannerApprove() {
  if (!_bannerVisitorId) return;
  var id = _bannerVisitorId;
  api.approveVisitor(id).then(function() {
    showToast('Misafir girişi onaylandı');
    closeBanner(); loadAll();
  }).catch(function(e) { showToast(e.message, 'error'); });
}
function bannerReject() {
  if (!_bannerVisitorId) return;
  var id = _bannerVisitorId;
  api.rejectVisitor(id, 'Yönetici reddetti').then(function() {
    showToast('Misafir giriş talebi reddedildi');
    closeBanner(); loadAll();
  }).catch(function(e) { showToast(e.message, 'error'); });
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
  renderCalendar();
  return Promise.allSettled([loadStats(), loadWaiting(), loadInside(), loadAppointments(_currentApptFilter), loadTodayAll(), loadRooms()]);
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

// Original loadStats replaced by the improved version above

function loadWaiting() {
  var u = getUser();
  var params = { status: 'waiting', date: 'today' };
  if (u && shouldScopeToHost(u)) params.host_user_id = u.id;
  return api.getVisitors(params).then(function(list) {
    var el = document.getElementById('waiting-list');
    if (!list.length) { el.innerHTML = '<div class="empty">Onay bekleyen misafir bulunmamaktadır.</div>'; return; }
    el.innerHTML = list.map(function(v) {
      return '<div class="vitem">' +
        '<div class="vitem-av" style="background:linear-gradient(135deg,#f59e0b,#d97706)">' + v.full_name[0] + '</div>' +
        '<div class="vitem-info"><div class="vitem-name">' + v.full_name + '</div>' +
        '<div class="vitem-meta">' + (v.company_name || '—') + ' · ' + (v.reason || '—') + '</div></div>' +
        '<div class="vitem-actions">' +
        '<button class="btn-approve" onclick="approveV(' + v.id + ')">✅ Kabul</button>' +
        '<button class="btn-reject" onclick="rejectV(' + v.id + ')">❌ Ret</button>' +
        '</div></div>';
    }).join('');
  }).catch(function(e) { console.warn('Bekleme:', e.message); });
}

function loadInside() {
  var u = getUser();
  var params = { status: 'inside', date: 'today' };
  if (u && shouldScopeToHost(u)) params.host_user_id = u.id;
  return api.getVisitors(params).then(function(list) {
    document.getElementById('inside-count').textContent = list.length;
    var el = document.getElementById('inside-list');
    if (!list.length) { el.innerHTML = '<div class="empty">Şu an kurumda aktif misafir bulunmamaktadır.</div>'; return; }
    el.innerHTML = list.map(function(v) {
      return '<div class="vitem">' +
        '<div class="vitem-av" style="background:linear-gradient(135deg,#10b981,#059669)">' + v.full_name[0] + '</div>' +
        '<div class="vitem-info"><div class="vitem-name">' + v.full_name + '</div>' +
        '<div class="vitem-meta">' + (v.company_name || '—') + ' · Giriş: ' + fmt(v.arrival_time) + '</div></div>' +
        '<button class="btn-reject btn-sm" onclick="checkoutV(' + v.id + ')">Çıkış</button>' +
        '</div>';
    }).join('');
  }).catch(function(e) { console.warn('İçeride:', e.message); });
}

function loadAppointments(params) {
  params = params || {};
  var u = getUser();
  if (u && shouldScopeToHost(u)) params.host_user_id = u.id;
  return api.getAppointments(params).then(function(list) {
    var el = document.getElementById('appts-list');
    var statMap = { planned: 'Planlandı', arrived: 'Geldi', completed: 'Tamamlandı', cancelled: 'İptal' };

    // ── CLIENT-SIDE FILTERS ─────────────────────────────────
    var now = new Date();
    var filterDate = params.date; // e.g. '2026-03-27'

    list = list.filter(function(a) {
      if (!a.planned_time) return false;
      // Always hide cancelled
      if (a.status === 'cancelled') return false;
      var dt = new Date(a.planned_time);
      if (filterDate && filterDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Show only this specific date
        var d = dt.toISOString().slice(0, 10);
        return d === filterDate;
      } else {
        // Default: only today's future slots and onwards
        // Compare date portion: dt date must be >= today's date
        var dtDate = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
        var todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return dtDate >= todayDate;
      }
    });
    // ────────────────────────────────────────────────────────

    if (!list.length) { el.innerHTML = '<div class="empty">Randevu yok</div>'; return; }
    el.innerHTML = list.map(function(a) {
      return '<div class="vitem" id="appt-row-' + a.id + '">' +
        renderCalendarBlock(a.planned_time) +
        '<div class="vitem-info"><div class="vitem-name">' + a.visitor_name + '</div>' +
        '<div class="vitem-meta">🕒 ' + fmt(a.planned_time) + ' · ' + (a.reason || '—') + '</div></div>' +
        '<div class="vitem-actions">' +
        '<button class="btn-calendar" onclick=\'openGoogleCalendar(' + JSON.stringify(a).replace(/'/g, "\\'") + ")\'>📅 Ekle</button>" +
        (a.status === 'planned' ? '<button class="btn-reject btn-sm" onclick="cancelAppt(' + a.id + ')">İptal</button>' : '') +
        '</div>' +
        '<span class="badge badge-' + a.status + '">' + (statMap[a.status] || a.status) + '</span>' +
        '</div>';
    }).join('');
  }).catch(function(e) { console.warn('Randevular:', e.message); });
}

var currentCalDate = new Date();
function renderCalendar() {
  var container = document.getElementById('calendar-container');
  if (!container) return;
  
  var today = new Date();
  var year = currentCalDate.getFullYear();
  var month = currentCalDate.getMonth();
  
  var firstDay = new Date(year, month, 1).getDay();
  if (firstDay === 0) firstDay = 7; // Sunday fix
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  
  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
             '<button onclick="changeMonth(-1)" style="border:none;background:none;cursor:pointer">◀</button>' +
             '<div style="font-weight:800;font-size:13px">' + new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(currentCalDate) + '</div>' +
             '<button onclick="resetApptFilter()" style="font-size:10px; border:1px solid var(--border); border-radius:4px; padding:2px 6px; cursor:pointer">Hepsini Gör</button>' +
             '<button onclick="changeMonth(1)" style="border:none;background:none;cursor:pointer">▶</button></div>';
             
  html += '<div class="calendar-box">';
  ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'].forEach(d => {
    html += '<div class="cal-header">' + d + '</div>';
  });
  
  for (let i = 1; i < firstDay; i++) html += '<div class="cal-day other"></div>';
  
  for (let d = 1; d <= daysInMonth; d++) {
    let dateStr = year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    let isActive = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    html += '<div class="cal-day' + (isActive ? ' active' : '') + '" onclick="filterByDate(\'' + dateStr + '\')">' + d + '</div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

function changeMonth(step) {
  currentCalDate.setMonth(currentCalDate.getMonth() + step);
  renderCalendar();
}

function filterByDate(dateStr) {
  _currentApptFilter = { date: dateStr };
  document.querySelectorAll('.cal-day').forEach(d => {
    d.classList.remove('active');
    if (d.textContent == parseInt(dateStr.split('-')[2])) d.classList.add('active');
  });
  loadAppointments(_currentApptFilter);
}

function resetApptFilter() {
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
    loadAppointments(_currentApptFilter);
  }
}

function loadTodayAll() {
  var u = getUser();
  var params = { date: 'today' };
  if (u && shouldScopeToHost(u)) params.host_user_id = u.id;
  return api.getVisitors(params).then(function(list) {
    var el = document.getElementById('all-today-list');
    var statMap = { waiting: 'Bekliyor', inside: 'İçeride', left: 'Çıktı', cancelled: 'İptal' };
    if (!list.length) { el.innerHTML = '<div class="empty">Bugün henüz misafir girişi yapılmadı.</div>'; return; }
    el.innerHTML = list.map(function(v) {
      return '<div class="vitem">' +
        '<div class="vitem-av" style="background:linear-gradient(135deg,#64748b,#475569)">' + v.full_name[0] + '</div>' +
        '<div class="vitem-info"><div class="vitem-name">' + v.full_name + '</div>' +
        '<div class="vitem-meta">' + (v.reason || '—') + ' · ' + (v.arrival_time ? fmt(v.arrival_time) : 'Giriş bekleniyor') + '</div></div>' +
        '<span class="badge badge-' + v.status + '">' + (statMap[v.status] || v.status) + '</span>' +
        '</div>';
    }).join('');
  }).catch(function(e) { console.warn('Bugün tümü:', e.message); });
}

async function loadRooms() {
  try {
    const rooms = await api.getRooms();
    const grid = document.getElementById('rooms-grid');
    const u = getUser();
    if (!rooms.length) { grid.innerHTML = '<div class="empty">Oda bulunamadı</div>'; return; }
    
    grid.innerHTML = rooms.map(r => {
      const activeRes = (r.reservations || []).map(res => `
        <div style="font-size:12px;background:rgba(245,158,11,0.1);color:#d97706;padding:4px 8px;border-radius:4px;margin-bottom:4px;display:flex;justify-content:space-between;">
           <span>🕒 ${new Date(res.start_time).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})} - ${new Date(res.end_time).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})} | ${res.title}</span>
           ${u && window.vdPermissions && window.vdPermissions.canCancelReservation(u, res.user_id) ? `<button style="background:none;border:none;color:red;cursor:pointer;font-size:10px" onclick="cancelReservation(${res.id})">İptal</button>`:''}
        </div>
      `).join('');

      return `
      <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div style="font-weight:800;font-size:15px;color:var(--text)">${r.name}</div>
          <span style="font-size:11px;padding:3px 8px;border-radius:6px;background:rgba(16,185,129,0.1);color:#10b981;font-weight:700">👥 ${r.capacity} Kişi</span>
        </div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:12px">🔧 ${r.equipment || 'Ekipman yok'}</div>
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
            ${rooms.map(r => `<option value="${r.id}">${r.name} (${r.capacity} Kişi)</option>`).join('')}
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
          <button class="btn-primary" onclick="submitRoomReservation()" style="padding:10px 24px">Rezervasyonu Tamamla</button>
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
function approveV(id) {
  api.approveVisitor(id).then(function() { showToast('Misafir girişi onaylandı.'); loadAll(); })
    .catch(function(e) { showToast(e.message, 'error'); });
}
function rejectV(id) {
  var reason = '';
  api.rejectVisitor(id, reason).then(function() { showToast('Misafir giriş talebi reddedildi.'); loadAll(); })
    .catch(function(e) { showToast(e.message, 'error'); });
}
function checkoutV(id) {
  api.checkoutVisitor(id).then(function() { showToast('Çıkış kaydedildi'); loadAll(); })
    .catch(function(e) { showToast(e.message, 'error'); });
}

function openGoogleCalendar(a) {
  var start = new Date(a.planned_time).toISOString().replace(/-|:|\.\d+/g, '').replace('000Z','Z');
  var end = new Date(new Date(a.planned_time).getTime() + 3600000).toISOString().replace(/-|:|\.\d+/g, '').replace('000Z','Z');
  var summary = encodeURIComponent('Misafir: ' + a.visitor_name);
  var details = encodeURIComponent('Firma: ' + (a.visitor_company||'—') + '\\nEv Sahibi: ' + (a.host_name||'—') + '\\nNeden: ' + (a.reason||'—'));
  var url = 'https://www.google.com/calendar/render?action=TEMPLATE&text=' + summary + '&dates=' + start + '/' + end + '&details=' + details + '&location=Simsoft+Ofis&sf=true&output=xml';
  if (a.host_email) url += '&add=' + encodeURIComponent(a.host_email);
  window.open(url, '_blank');
}

function downloadICS(a) {
  var start = new Date(a.planned_time).toISOString().replace(/-|:|\.\d+/g, '');
  var end = new Date(new Date(a.planned_time).getTime() + 3600000).toISOString().replace(/-|:|\.\d+/g, '');
  var ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Simsoft//VisitorManagement//TR',
    'BEGIN:VEVENT',
    'UID:appt-' + a.id + '@simsoft.com',
    'DTSTAMP:' + new Date().toISOString().replace(/-|:|\.\d+/g, ''),
    'DTSTART:' + start,
    'DTEND:' + end,
    'SUMMARY:Misafir: ' + a.visitor_name,
    'DESCRIPTION:Misafir Randevu Kaydı\\nFirma: ' + (a.visitor_company||'—') + '\\nEv Sahibi: ' + (a.host_name||'—') + '\\nNeden: ' + (a.reason||'—'),
    'LOCATION:Simsoft Ofis',
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

  var u = getUser();
  if (u) {
    u.full_name = normalizeManagerName(u);
    sessionStorage.setItem('vd_user', JSON.stringify(u));
    applyUserChip(u);
  }

  function normalizeManagerName(user) {    if (!user) return '';
    var name = user.full_name || '';
    if (user.username === 'mudur' && (name === 'İsmail Karaman' || name === 'Ismail Karaman')) return 'İsmail Bıkmaz';
    return name;
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
          showWindowsNotification('Misafiriniz Kapıda', d.visitor.full_name + ' sizi bekliyor.');
        }
        addNotif('Yeni misafir girişi: ' + d.visitor.full_name);
        loadAll();
      },
      'visitor:approved': function(d) {
        var cu = getUser();
        if (!cu) return;
        var v = d.visitor;
        if (v && canSeeHostData(cu, v.host_user_id, false)) {
          playDoorbell();
          addNotif('✅ Misafiriniz onaylandı: ' + v.full_name);
          showToast('✅ ' + v.full_name + ' misafiriniz sekreterya tarafından onaylandı!');
        }
        loadAll();
      },
      'visitor:arrived': function(d) {
        addNotif(d.visitor.full_name + ' içeri girdi');
        loadAll();
      },
      'visitor:rejected': function(d) {
        var cu = getUser();
        var v = d.visitor;
        if (v && cu && canSeeHostData(cu, v.host_user_id, false)) {
          playDoorbell();
          addNotif('❌ Misafiriniz reddedildi: ' + (v.full_name || '') + (d.reason ? ' - ' + d.reason : ''));
          showToast('❌ Misafiriniz reddedildi' + (d.reason ? ': ' + d.reason : ''), 'error');
        } else {
          addNotif('Misafir girişi reddedildi' + (d.reason ? ': ' + d.reason : ''));
        }
      },
    },
  });

  loadAll();
  setInterval(loadAll, 20000);
});
