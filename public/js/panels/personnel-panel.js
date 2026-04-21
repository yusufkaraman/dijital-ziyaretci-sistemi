// Saat
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

let currentPersonnelId = null;

function canSeeVisitorEventForPersonnel(user, payload, allowUnassigned) {
  const event = payload || {};
  const visitor = event.visitor || event;
  const hostUserId = event.host_user_id ?? visitor.host_user_id ?? null;
  if (canSeeHostData(user, hostUserId, allowUnassigned)) return true;

  const hostPersonnelId = visitor.host_personnel_id ?? event.host_personnel_id ?? null;
  if (currentPersonnelId !== null && hostPersonnelId !== null && Number(hostPersonnelId) === Number(currentPersonnelId)) {
    return true;
  }

  return false;
}

// Toast
function showToast(msg, type) {
  return window.vdShowToast(msg, type);
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
    return '<div class="notif-item' + (i === 0 ? ' new' : '') + '"><div>' + esc(n.msg) + '</div><div class="notif-time">' + esc(n.time) + '</div></div>';
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

// Banner + Ses
var _bannerVisitorId = null;
let audioCtx = null;
function showArrivalBanner(visitor) {
  _bannerVisitorId = visitor.id;
  document.getElementById('banner-title').textContent = visitor.full_name + ' geldi';
  document.getElementById('banner-sub').textContent = [visitor.company_name, visitor.reason].filter(Boolean).join(' · ') || 'Misafir geldi bildirimi';
  document.getElementById('arrival-banner').classList.add('show');
  playDoorbell();
}
function closeBanner() {
  document.getElementById('arrival-banner').classList.remove('show');
  _bannerVisitorId = null;
}
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
    playT(659.25, 0, 1.2, 0.2);
    playT(523.25, 0.5, 1.5, 0.15);
  } catch (e) {
    console.error('Audio Error:', e);
  }
}
document.addEventListener('click', () => { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); }, { once: true });

// Yeni Misafir Modal
function switchModalTab(tab) {
  document.getElementById('modal-mode').value = tab;
  const tGuest = document.getElementById('tab-guest');
  const tAppt = document.getElementById('tab-appt');
  const divTime = document.getElementById('div-time');
  const infoBox = document.getElementById('info-box');
  const btn = document.getElementById('btn-submit');

  if (tab === 'guest') {
    tGuest.style.color = 'var(--primary)'; tGuest.style.borderBottom = '2px solid var(--primary)';
    tAppt.style.color = 'var(--muted)'; tAppt.style.borderBottom = 'none';
    divTime.style.visibility = 'hidden'; divTime.style.position = 'absolute';
    if(infoBox) { infoBox.style.display = 'block'; infoBox.innerHTML = '<strong>Not:</strong> Fast check-in kaydı oluşturduğunuz anda misafir doğrudan geldi olarak işlenir ve hosta bildirim gider.'; }
    btn.textContent = 'Fast Check-In Oluştur';
  } else {
    tAppt.style.color = 'var(--primary)'; tAppt.style.borderBottom = '2px solid var(--primary)';
    tGuest.style.color = 'var(--muted)'; tGuest.style.borderBottom = 'none';
    divTime.style.visibility = 'visible'; divTime.style.position = 'static';
    if(infoBox) { infoBox.style.display = 'block'; infoBox.innerHTML = '<strong>Not:</strong> Oluşturduğunuz randevular sekreter onayından geçtikten sonra takviminize eklenecektir.'; }
    btn.textContent = 'Randevu Talebini Gönder';
  }
}
async function openAddVisitorModal() {
  switchModalTab('guest');
  const _now = new Date();
  document.getElementById('add-time').value = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}T${String(_now.getHours()).padStart(2,'0')}:${String(_now.getMinutes()).padStart(2,'0')}`;
  document.getElementById('add-visitor-modal').classList.add('show');
  
  // Personel listesini yükle ve giriş yapan kullanıcıyı otomatik seç
  try {
    const [list, companies] = await Promise.all([
      api.getPersonnel({ is_active: 1 }),
      api.getCompanies({ active_only: 'true' }),
    ]);
    const sel = document.getElementById('add-host-id');
    const companySel = document.getElementById('add-visited-company-id');
    const currentU = getUser();
    if (companySel) {
      companySel.innerHTML = '<option value="">Seçiniz...</option>' +
        companies.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    }
    sel.innerHTML = '<option value="">Seçiniz...</option>' + list.map(p => 
      `<option value="${p.id}" ${currentU && p.user_id == currentU.id ? 'selected' : ''}>${p.full_name} (${p.title || p.department || ''})</option>`
    ).join('');
    // Auto-select: match by user_id first, fallback to full_name
    const myPersonnel = list.find(p => currentU && p.user_id == currentU.id)
      || list.find(p => currentU && p.full_name && currentU.full_name && p.full_name.trim().toLowerCase() === currentU.full_name.trim().toLowerCase());
    if (myPersonnel) {
      sel.value = myPersonnel.id;
      if (companySel && myPersonnel.company_id) {
        companySel.value = String(myPersonnel.company_id);
      }
    } else if (currentU) {
      console.warn('No personnel record found for user:', currentU.id, currentU.full_name);
      showToast('Personel kaydınız bulunamadı. Lütfen yöneticinize başvurun.', 'error');
    }
  } catch(e) { console.warn('Personnel load err', e); }
}
function closeAddVisitorModal() {
  document.getElementById('add-visitor-modal').classList.remove('show');
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
    return showToast('Lütfen zorunlu alanları (Ad Soyad, Personel, Sebep) doldurun.', 'error');
  }

  // TC Kimlik No validasyonu (opsiyonel alan, ama girilmişse 11 hane olmalı)
  if (data.tc_no && !/^\d{11}$/.test(data.tc_no)) {
    return showToast('TC Kimlik No 11 haneli rakamlardan oluşmalıdır.', 'error');
  }

  // Telefon validasyonu (opsiyonel, girilmişse min 10 hane)
  if (data.phone) {
    const phoneDigits = data.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return showToast('Telefon numarası en az 10 haneli olmalıdır.', 'error');
    }
  }

  // E-posta validasyonu (opsiyonel, girilmişse format kontrolü)
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return showToast('Geçerli bir e-posta adresi giriniz.', 'error');
  }

  const timeStr = document.getElementById('add-time').value;
  if (mode === 'appt' && !timeStr) return showToast('Randevu zamanı seçiniz.', 'error');

  // Randevu için geçmiş tarih kontrolü
  if (mode === 'appt' && timeStr && new Date(timeStr) <= new Date()) {
    return showToast('Randevu tarihi gelecekte olmalıdır.', 'error');
  }

  let plannedTime = timeStr ? timeStr.replace('T', ' ') : null;
  if (plannedTime && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(plannedTime)) plannedTime += ':00';

  const btn = document.getElementById('btn-submit');
  await withButtonLock(btn, async () => {
    if (mode === 'guest') {
      data.planned_time = null;
      await api.createVisitor(data);
      showToast('Fast check-in kaydı oluşturuldu ve hosta bildirim gönderildi');
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
      showToast('Randevu talebi oluşturuldu.');
    }
    closeAddVisitorModal();
    loadAll();
  });
}

// Zaman formatlama
function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
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

// ── TAKVİM RANDEVU SİSTEMİ ──────────────────────────────
var _calendarAppointments = [];
var currentCalDate = new Date();
var _selectedCalDate = null;

function loadAll() {
  loadTodayAll();
  loadAppointments();
  loadRooms();
}

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
    if (_selectedCalDate) showDayDetail(_selectedCalDate);
  }).catch(function(e) { console.warn('Randevular:', e.message); });
}

function renderCalendar() {
  var container = document.getElementById('calendar-container');
  if (!container) return;

  var today = new Date();
  var year = currentCalDate.getFullYear();
  var month = currentCalDate.getMonth();
  var firstDay = new Date(year, month, 1).getDay();
  if (firstDay === 0) firstDay = 7;
  var daysInMonth = new Date(year, month + 1, 0).getDate();

  var apptsByDay = {};
  _calendarAppointments.forEach(function(a) {
    var d = new Date(a.planned_time);
    if (d.getFullYear() === year && d.getMonth() === month) {
      var day = d.getDate();
      if (!apptsByDay[day]) apptsByDay[day] = [];
      apptsByDay[day].push(a);
    }
  });
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
      if (dayAppts.length >= 6) { densityClass = 'density-packed'; maxShow = 5; }
      else if (dayAppts.length >= 4) { densityClass = 'density-dense'; maxShow = 4; }
      else if (dayAppts.length === 3) { densityClass = 'density-balanced'; }
      else if (dayAppts.length === 2) { densityClass = 'density-roomy'; maxShow = 2; }
      else { maxShow = 1; }

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
  hideDayDetail();
  loadAppointments();
}

function openGoogleCalendar(a) {
  var start = new Date(a.planned_time).toISOString().replace(/-|:|\.\d+/g, '').replace('000Z','Z');
  var end = new Date(new Date(a.planned_time).getTime() + 3600000).toISOString().replace(/-|:|\.\d+/g, '').replace('000Z','Z');
  var summary = encodeURIComponent('Randevu: ' + a.visitor_name);
  var details = encodeURIComponent('Firma: ' + (a.visitor_company||'—') + '\nEv Sahibi: ' + (a.host_name||'—') + '\nNeden: ' + (a.reason||'—'));
  var url = 'https://www.google.com/calendar/render?action=TEMPLATE&text=' + summary + '&dates=' + start + '/' + end + '&details=' + details + '&sf=true&output=xml';
  if (a.host_email) url += '&add=' + encodeURIComponent(a.host_email);
  window.open(url, '_blank');
}

async function cancelAppt(id) {
  if (!confirm('Randevuyu iptal etmek istediğinize emin misiniz?')) return;
  var row = document.getElementById('appt-row-' + id);
  if (row) row.remove();
  try {
    await api.cancelAppointment(id);
    showToast('Randevu iptal edildi');
    loadAppointments();
  } catch(e) {
    showToast(e.message, 'error');
    loadAppointments();
  }
}

function loadTodayAll() {
  var u = getUser();
  var params = { date: 'today' };
  if (u && shouldScopeToHost(u)) params.host_user_id = u.id;
  
  api.getVisitors(params).then(function(list) {
    var el = document.getElementById('all-today-list');
    var statMap = { waiting: 'Bekliyor (Onaysız)', inside: 'İçeride', left: 'Çıktı', cancelled: 'İptal / Red' };
    
    // KPI Updates
    let countWaiting = list.length;
    let countInside = list.filter(v => v.status === 'inside').length;
    document.getElementById('kpi-waiting').textContent = countWaiting;
    document.getElementById('kpi-inside').textContent = countInside;
    document.getElementById('kpi-today').textContent = list.length;
    
    if (!list.length) { el.innerHTML = '<div class="empty">Bugün henüz bir misafir kaydınız bulunmuyor.</div>'; return; }
    
    el.innerHTML = list.map(function(v) {
      return '<div class="vitem" style="cursor:pointer" onclick="showVisitorDetail(' + v.id + ')">' +
        '<div class="vitem-av" style="background:linear-gradient(135deg,#64748b,#475569)">' + esc((v.full_name || '?')[0]) + '</div>' +
        '<div class="vitem-info"><div class="vitem-name">' + esc(v.full_name) + '</div>' +
        '<div class="vitem-meta">' + esc(v.reason || '—') + ' · ' + visitorTimeSummary(v, fmt) + '</div></div>' +
        '<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">' +
          '<span class="badge badge-' + esc(v.status) + '">' + esc(statMap[v.status] || v.status) + '</span>' +
          (v.status === 'inside' ? '<button class="btn-secondary" style="font-size:11px;padding:5px 10px" onclick="event.stopPropagation(); withButtonLock(this, () => checkoutVisitorByPersonnel(' + v.id + '))">Çıkış</button>' : '') +
        '</div>' +
        '</div>';
    }).join('');
  }).catch(function(e) { console.warn('Tüm ziyaretçiler:', e.message); });
}


function showModal(title, content) {
  return window.vdShowModal(title, content);
}

function closeModal() {
  return window.vdCloseModal();
}

function apptStatusLabel(s) {
  return { planned:'Planlandı', pending_approval:'Onay Bekliyor', arrived:'Geldi', completed:'Tamamlandı', cancelled:'İptal' }[s] || s;
}

async function showVisitorDetail(id) {
  var visitors = await api.getVisitors({});
  var v = visitors.find(function(x) { return x.id == id; });
  if (!v) return;
  var statMap = { waiting: 'Bekliyor', inside: 'İçeride', left: 'Çıktı', cancelled: 'İptal' };
  showModal('👤 ' + esc(v.full_name), '<div style="display:grid;gap:12px">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
    '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">TC / Kimlik</div><div>' + (esc(v.tc_no)||'—') + '</div></div>' +
    '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Telefon</div><div>' + (esc(v.phone)||'—') + '</div></div>' +
    '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Firma</div><div>' + (esc(v.company_name)||'—') + '</div></div>' +
    '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Ziyaret Sebebi</div><div>' + (esc(v.reason)||'—') + '</div></div>' +
    '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Görüşülen</div><div>' + (esc(v.host_name)||'—') + '</div></div>' +
    '<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Durum</div><span class="status-badge status-' + v.status + '">' + (statMap[v.status] || v.status) + '</span></div>' +
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
    (a.status === 'planned' ? '<button class="btn-secondary" onclick="cancelAppt(' + a.id + ');closeModal()">İptal Et</button> <button class="btn-calendar" onclick="openGoogleCalendar(window._lastApptDetail);closeModal()">📅 Takvime Ekle</button>' : '') +
    '</div></div>');
  window._lastApptDetail = a;
}

async function applyPanelBranding() {
  return window.vdApplyPanelBranding({ logoElementId: 'personel-logo-img' });
}

async function loadCurrentUserCompany() {
  try {
    const user = getUser();
    if (!user || !user.id) return;
    const list = await api.getPersonnel({ active_only: 'false' });
    const matched = list.find((p) => Number(p.user_id) === Number(user.id));
    currentPersonnelId = matched ? Number(matched.id) : null;
    const companyEl = document.getElementById('user-company');
    if (companyEl) companyEl.textContent = matched?.company_name ? `Şirket: ${matched.company_name}` : 'Şirket: Atanmamış';
  } catch (e) {
    currentPersonnelId = null;
    const companyEl = document.getElementById('user-company');
    if (companyEl) companyEl.textContent = 'Şirket bilgisi alınamadı';
  }
}

function showChangePasswordModal() {
  return window.vdShowChangePasswordModal();
}

async function submitPasswordChange() {
  return window.vdSubmitPasswordChange();
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
           <span>🕒 ${new Date(res.start_time).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})} - ${new Date(res.end_time).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})} | ${esc(res.title)}</span>
           ${u && window.vdPermissions && window.vdPermissions.canCancelReservation(u, res.user_id) ? `<button style="background:none;border:none;color:red;cursor:pointer;font-size:10px" onclick="withButtonLock(this, () => cancelReservation(${res.id}))">İptal</button>`:''}
        </div>
      `).join('');

      return `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div style="font-weight:800;font-size:15px;color:var(--text)">${esc(r.name)}</div>
          <span style="font-size:11px;padding:3px 8px;border-radius:6px;background:rgba(16,185,129,0.1);color:#10b981;font-weight:700">👥 ${esc(String(r.capacity))} Kişi</span>
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
            ${rooms.map(r => `<option value="${r.id}">${r.name} (${r.capacity} Kişi)</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label style="font-size:12px;font-weight:700">Toplantı Başlığı / Kim İçin *</label>
          <input type="text" id="res-title" class="form-input" placeholder="Örn: Müşteri Görüşmesi" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border)" />
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
          <button class="btn-link" onclick="closeModal()">İptal</button>
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

  if (!roomId || !title || !date || !start || !end) return showToast('Lütfen oda, başlık, tarih ve saatleri tam girin.', 'error');
  if (start >= end) return showToast('Bitiş saati başlangıç saatinden ileride olmalıdır.', 'error');

  const btn = document.querySelector('.modal-content .btn-primary');
  await withButtonLock(btn, async () => {
    await api.reserveRoom(roomId, { title: title, date: date, startTime: start, endTime: end });
    showToast('Oda rezervasyonu tamamlandı!');
    closeModal();
    loadRooms();
  });
}

async function cancelReservation(id) {
  if (!confirm('Bu rezervasyonu iptal etmek istediğinize emin misiniz?')) return;
  try {
    await api.cancelRoomReservation(id);
    showToast('Rezervasyon iptal edildi.');
    loadRooms();
  } catch(e) { showToast(e.message, 'error');  }
}

async function checkoutVisitorByPersonnel(id) {
  try {
    await api.checkoutVisitor(id);
    showToast('Misafir çıkışı kaydedildi.');
    loadAll();
  } catch(e) { showToast(e.message, 'error'); }
}

// Başlat
document.addEventListener('DOMContentLoaded', function() {
  if (!ensureRoleAccess(['personnel'])) return;
  applyPanelBranding();
  initNotifications();

  function applyUserChip(user) {
    if (!user) return;
    document.getElementById('user-name').textContent = user.full_name || '';
    document.getElementById('user-av').textContent = (user.full_name || '?').split(' ').map(w => w[0]).slice(0, 2).join('');
  }

  var u = getUser();
  if (u) { applyUserChip(u); }
  loadCurrentUserCompany();

  api.me().then(function(me) {
    var freshUser = me && (me.user || me);
    if (!freshUser) return;
    sessionStorage.setItem('vd_user', JSON.stringify(freshUser));
    applyUserChip(freshUser);
    loadCurrentUserCompany();
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
    if (typeof addNotif === 'function' && !window.__vdPersonnelAddNotifWrapped) {
      var originalAddNotif = addNotif;
      addNotif = function(msg) {
        var pending = window.__vdPendingWaitingVisitor;
        if (pending && typeof msg === 'string' && msg.indexOf('Yeni misafir') === 0) {
          msg = pending.listMessage;
        }
        return originalAddNotif(msg);
      };
      window.__vdPersonnelAddNotifWrapped = true;
    }

    if (typeof showWindowsNotification === 'function' && !window.__vdPersonnelWindowsNotifWrapped) {
      var originalShowWindowsNotification = showWindowsNotification;
      showWindowsNotification = function(title, body, url) {
        var pending = window.__vdPendingWaitingVisitor;
        if (pending && title === 'Misafiriniz Kapıda') {
          body = pending.message;
        }
        return originalShowWindowsNotification(title, body, url);
      };
      window.__vdPersonnelWindowsNotifWrapped = true;
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
    handlers: {
      'visitor:waiting': function(d) {
        var currentUser = getUser();
        if (currentUser && canSeeVisitorEventForPersonnel(currentUser, d, true)) {
          showToast(d.visitor.full_name + ' geldi ve sizi bekliyor');
          showArrivalBanner(d.visitor);
          addNotif('Misafiriniz geldi: ' + d.visitor.full_name);
          if (typeof showWindowsNotification === 'function') {
            showWindowsNotification('Misafiriniz Geldi', d.visitor.full_name + ' geldi ve sizi bekliyor.');
          }
          loadAll();
        }
      },
      'visitor:approved': function(d) {
        var currentUser = getUser();
        var v = d.visitor;
        if (v && _bannerVisitorId && Number(v.id) === Number(_bannerVisitorId)) {
          closeBanner();
        }
        if (v && currentUser && canSeeVisitorEventForPersonnel(currentUser, d, false)) {
          playDoorbell();
          addNotif('Misafiriniz onaylandı: ' + v.full_name);
          showToast(v.full_name + ' misafiriniz sekreterya tarafından onaylandı!');
        }
        loadAll();
      },
      'visitor:arrived': function(d) {
        var currentUser = getUser();
        var v = d.visitor;
        if (v && _bannerVisitorId && Number(v.id) === Number(_bannerVisitorId)) {
          closeBanner();
        }
        if (v && currentUser && canSeeVisitorEventForPersonnel(currentUser, d, false)) {
          showArrivalBanner(v);
          showToast(d.visitor.full_name + ' içeride, sizi bekliyor');
          addNotif('Misafiriniz kuruma giriş yaptı: ' + d.visitor.full_name);
          if (typeof showWindowsNotification === 'function') {
            showWindowsNotification('Misafiriniz Geldi', d.visitor.full_name + ' kuruma giriş yaptı.');
          }
          loadAll();
        }
      },
      'visitor:checkout': function(d) {
        var v = d.visitor;
        if (v && _bannerVisitorId && Number(v.id) === Number(_bannerVisitorId)) {
          closeBanner();
        }
        var currentUser = getUser();
        if (currentUser && canSeeVisitorEventForPersonnel(currentUser, d, false)) {
          addNotif('Misafiriniz kurumdan ayrıldı: ' + d.visitor.full_name);
          loadAll();
        }
      },
      'visitor:rejected': function(d) {
        var v = d.visitor;
        var visitorId = (v && v.id) || d.visitor_id;
        if (visitorId && _bannerVisitorId && Number(visitorId) === Number(_bannerVisitorId)) {
          closeBanner();
        }
        var currentUser = getUser();
        if (v && currentUser && canSeeVisitorEventForPersonnel(currentUser, d, false)) {
          playDoorbell();
          addNotif('Misafiriniz reddedildi: ' + (v.full_name || '') + (d.reason ? ' - ' + d.reason : ''));
          showToast('Misafiriniz reddedildi' + (d.reason ? ': ' + d.reason : ''), 'error');
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
      'appointment:approved': function(d) {
        var currentUser = getUser();
        var a = d && d.appointment;
        if (a && currentUser && canSeeHostData(currentUser, a.host_user_id, false)) {
          showToast('Randevunuz onaylandı: ' + a.visitor_name);
          addNotif('Randevu onaylandı: ' + a.visitor_name);
        }
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
    },
  });

  loadAll();
  setInterval(loadAll, 20000);
});
