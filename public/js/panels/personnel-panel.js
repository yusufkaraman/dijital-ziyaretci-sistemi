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

// Banner + Ses
var _bannerVisitorId = null;
let audioCtx = null;
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
    if(infoBox) infoBox.style.display = 'block';
    btn.textContent = 'Giriş Talebini Gönder';
  } else {
    tAppt.style.color = 'var(--primary)'; tAppt.style.borderBottom = '2px solid var(--primary)';
    tGuest.style.color = 'var(--muted)'; tGuest.style.borderBottom = 'none';
    divTime.style.visibility = 'visible'; divTime.style.position = 'static';
    if(infoBox) infoBox.style.display = 'none';
    btn.textContent = 'İleri Tarihli Randevu Planla';
  }
}
async function openAddVisitorModal() {
  switchModalTab('guest');
  document.getElementById('add-time').value = new Date(Date.now() + 3600000).toISOString().slice(0, 16);
  document.getElementById('add-visitor-modal').classList.add('show');
  
  // Personel listesini yükle ve giriş yapan kullanıcıyı otomatik seç
  try {
    const list = await api.getPersonnel({ is_active: 1 });
    const sel = document.getElementById('add-host-id');
    const currentU = getUser();
    sel.innerHTML = '<option value="">Seçiniz...</option>' + list.map(p => 
      `<option value="${p.id}" ${currentU && p.user_id == currentU.id ? 'selected' : ''}>${p.full_name} (${p.title || p.department || ''})</option>`
    ).join('');
    // Auto-select: match by user_id first, fallback to full_name
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
      showToast('Misafir kaydı danışma onayına gönderildi');
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
      showToast('Randevu planlandı.');
    }
    closeAddVisitorModal();
    loadAll();
  } catch (e) {
    showToast(e.message, 'error');
  }
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

// Veri yükleme
function loadAll() {
  loadTodayAll();
  loadAppointments();
  loadRooms();
}

function loadTodayAll() {
  var u = getUser();
  var params = { date: 'today' };
  if (u && shouldScopeToHost(u)) params.host_user_id = u.id;
  
  api.getVisitors(params).then(function(list) {
    var el = document.getElementById('all-today-list');
    var statMap = { waiting: 'Bekliyor (Onaysız)', inside: 'İçeride', left: 'Çıktı', cancelled: 'İptal / Red' };
    
    // KPI Updates
    let countWaiting = list.filter(v => v.status === 'waiting').length;
    let countInside = list.filter(v => v.status === 'inside').length;
    document.getElementById('kpi-waiting').textContent = countWaiting;
    document.getElementById('kpi-inside').textContent = countInside;
    document.getElementById('kpi-today').textContent = list.length;
    
    if (!list.length) { el.innerHTML = '<div class="empty">Bugün henüz bir misafir kaydınız bulunmuyor.</div>'; return; }
    
    el.innerHTML = list.map(function(v) {
      return '<div class="vitem">' +
        '<div class="vitem-av" style="background:linear-gradient(135deg,#64748b,#475569)">' + v.full_name[0] + '</div>' +
        '<div class="vitem-info"><div class="vitem-name">' + v.full_name + '</div>' +
        '<div class="vitem-meta">' + (v.reason || '—') + ' · ' + (v.arrival_time ? fmt(v.arrival_time) : 'henüz gelmedi') + '</div></div>' +
        '<span class="badge badge-' + v.status + '">' + (statMap[v.status] || v.status) + '</span>' +
        '</div>';
    }).join('');
  }).catch(function(e) { console.warn('Tüm ziyaretçiler:', e.message); });
}

function loadAppointments() {
  var u = getUser();
  var params = {};
  if (u && shouldScopeToHost(u)) params.host_user_id = u.id;
  api.getAppointments(params).then(function(list) {
    var el = document.getElementById('appts-list');
    var statMap = { planned: 'Planlandı', arrived: 'Geldi', completed: 'Tamamlandı', cancelled: 'İptal' };
    if (!list.length) { el.innerHTML = '<div class="empty">Randevu yok</div>'; return; }
    el.innerHTML = list.map(function(a) {
      return '<div class="vitem">' +
        renderCalendarBlock(a.planned_time) +
        '<div class="vitem-info"><div class="vitem-name">' + a.visitor_name + '</div>' +
        '<div class="vitem-meta">🕒 ' + fmt(a.planned_time) + ' · ' + (a.reason || '—') + '</div></div>' +
        '<div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end">' +
          '<span class="badge badge-' + a.status + '">' + (statMap[a.status] || a.status) + '</span>' +
          (a.status === 'planned' ? `<button class="btn-calendar" onclick="downloadICS(${a.id})"><span>📅</span> Takvime Ekle</button>` : '') +
        '</div>' +
        '</div>';
    }).join('');
  }).catch(function(e) { console.warn('Randevular:', e.message); });
}

async function downloadICS(id) {
  try {
    const appts = await api.getAppointments();
    const a = appts.find(item => item.id === id);
    if(!a) return showToast('Randevu bulunamadı','error');

    const startStr = a.planned_time.replace(/[-:]/g,'').split('.')[0] + 'Z';
    const end = new Date(new Date(a.planned_time).getTime() + 60*60*1000); // +1 saat
    const endStr = end.toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';

    const icsContent = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Simsoft//DigitalVisitor//TR',
      'BEGIN:VEVENT',
      `UID:${a.id}@simsoft.com.tr`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').split('.')[0]}Z`,
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      `SUMMARY:Misafir Randevu Kaydı: ${a.visitor_name}`,
      `DESCRIPTION:Misafir: ${a.visitor_name}\\nSebep: ${a.reason || '-'}`,
      `LOCATION:Simsoft Ofis`,
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `randevu-${a.visitor_name.replace(/\s+/g, '-')}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  } catch(e) { showToast('Dosya oluşturulamadı','error'); }
}

function showModal(title, content) {
  return window.vdShowModal(title, content);
}

function closeModal() {
  return window.vdCloseModal();
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
    const companyEl = document.getElementById('user-company');
    if (companyEl) companyEl.textContent = matched?.company_name ? `Şirket: ${matched.company_name}` : 'Şirket: Atanmamış';
  } catch (e) {
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

  try {
    await api.reserveRoom(roomId, { title: title, date: date, startTime: start, endTime: end });

    showToast('Oda rezervasyonu tamamlandı!');
    closeModal();
    loadRooms();
  } catch (e) { showToast(e.message, 'error'); }
}

async function cancelReservation(id) {
  if (!confirm('Bu rezervasyonu iptal etmek istediğinize emin misiniz?')) return;
  try {
    await api.cancelRoomReservation(id);
    showToast('Rezervasyon iptal edildi.');
    loadRooms();
  } catch(e) { showToast(e.message, 'error');  }
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

  // Socket.IO
  vdCreateSocket({
    handlers: {
      'visitor:waiting': function(d) {
        var currentUser = getUser();
        if (currentUser && d.host_user_id == currentUser.id) {
          showToast('Misafir kaydınız oluşturuldu: ' + d.visitor.full_name);
          showArrivalBanner(d.visitor);
          loadAll();
        }
      },
      'visitor:arrived': function(d) {
        var currentUser = getUser();
        if (currentUser && d.host_user_id == currentUser.id) {
          showToast(d.visitor.full_name + ' içeride, sizi bekliyor');
          addNotif('Misafiriniz kuruma giriş yaptı: ' + d.visitor.full_name);
          loadAll();
        }
      },
      'visitor:checkout': function(d) {
        var currentUser = getUser();
        if (currentUser && d.host_user_id == currentUser.id) {
          addNotif('Misafiriniz kurumdan ayrıldı: ' + d.visitor.full_name);
          loadAll();
        }
      },
      'visitor:rejected': function() {
        // server rejected event may not include host_user_id consistently
        loadAll();
      },
    },
  });

  loadAll();
  setInterval(loadAll, 20000);
});
