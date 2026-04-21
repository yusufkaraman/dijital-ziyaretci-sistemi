// ── TOPLANTI ODALARI ──────────────────────────────────
function showModal(title, content) {
  return window.vdShowModal(title, content);
}

function closeModal() {
  return window.vdCloseModal();
}

function formatRoomTime(value) {
  return new Date(value).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function renderRoomReservationList(room) {
  const reservations = room.reservations || [];
  if (!reservations.length) return '<div class="empty-state" style="padding:18px;text-align:center">Bugün rezervasyon yok.</div>';
  return reservations.map((res) => `
    <div class="visitor-row" style="margin-bottom:8px">
      <div class="visitor-info">
        <div class="visitor-name">${esc(res.title || 'Rezervasyon')}</div>
        <div class="visitor-meta">${formatRoomTime(res.start_time)} - ${formatRoomTime(res.end_time)}${res.user_name ? ' · ' + esc(res.user_name) : ''}</div>
      </div>
    </div>
  `).join('');
}

async function showRoomDetail(id) {
  const rooms = await api.getRooms();
  const room = rooms.find((r) => Number(r.id) === Number(id));
  if (!room) return showToast('Oda bulunamadı', 'error');
  showModal(esc(room.name), `
    <div style="display:grid;gap:14px">
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
        <div><div style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:4px">Kapasite</div><div>${esc(String(room.capacity || 0))} Kişi</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:4px">Durum</div><span class="status-badge status-inside">${room.is_active === false ? 'Pasif' : 'Aktif'}</span></div>
      </div>
      <div><div style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:4px">Ekipman</div><div>${esc(room.equipment || 'Ekipman yok')}</div></div>
      <div>
        <div style="font-size:11px;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:8px">Bugünkü Rezervasyonlar</div>
        ${renderRoomReservationList(room)}
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px">
        <button class="btn-secondary" onclick="closeModal()">Kapat</button>
        <button class="btn-primary" onclick="closeModal();showRoomReservationFor(${room.id})">Rezervasyon Yap</button>
      </div>
    </div>
  `);
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
           ${u && window.vdPermissions && window.vdPermissions.canCancelReservation(u, res.user_id) ? `<button style="background:none;border:none;color:red;cursor:pointer;font-size:10px" onclick="event.stopPropagation();cancelReservation(${res.id})">İptal</button>`:''}
        </div>
      `).join('');

      return `
      <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;cursor:pointer" onclick="showRoomDetail(${r.id})">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div style="font-weight:800;font-size:15px;color:var(--text)">${esc(r.name)}</div>
          <div style="display:flex;gap:4px">
             <span style="font-size:11px;padding:3px 8px;border-radius:6px;background:rgba(16,185,129,0.1);color:#10b981;font-weight:700">👥 ${r.capacity} Kişi</span>
             <button class="btn-primary" style="font-size:10px;padding:3px 8px;border-radius:6px;" onclick="event.stopPropagation();showRoomReservationFor(${r.id})">Rezerve Et</button>
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">🔧 ${esc(r.equipment) || 'Ekipman yok'}</div>
        <div style="margin-top:12px;">
          <div style="font-size:11px;font-weight:700;color:var(--text);margin-bottom:6px;text-transform:uppercase;">Bugünkü Rezervasyonlar</div>
          ${activeRes || '<div style="font-size:12px;color:var(--text-muted)">Planlanmış rezervasyon yok.</div>'}
        </div>
      </div>`;
    }).join('');
  } catch(e) { console.warn('Odalar:', e.message); }
}

async function showRoomReservationFor(forceId) {
  try {
    const rooms = await api.getRooms();
    const todayStr = new Date().toISOString().split('T')[0];
    
    showModal('Oda Rezervasyonu', `
      <div style="display:grid;gap:14px">
        <div class="form-group">
          <label style="font-size:12px;font-weight:700">Toplantı Odası *</label>
          <select id="res-room" class="form-input" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border)">
            <option value="">Seçiniz...</option>
            ${rooms.map(r => `<option value="${r.id}" ${forceId === r.id ? 'selected':''}>${esc(r.name)} (${r.capacity} Kişi)</option>`).join('')}
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
          <button class="btn-link" onclick="closeModal()">İptal</button>
          <button class="btn-primary" onclick="submitRoomReservation()" style="padding:10px 24px">Rezervasyonu Tamamla</button>
        </div>
      </div>
    `);
  } catch (e) { showToast('Odalar yüklenirken hata oluştu', 'error'); }
}

function showRoomReservation() {
  return showRoomReservationFor(null);
}

let _roomResBusy = false;
async function submitRoomReservation() {
  if (_roomResBusy) return;
  _roomResBusy = true;
  try { await _doSubmitRoomReservation(); } finally { _roomResBusy = false; }
}

async function _doSubmitRoomReservation() {
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
  } catch(e) { showToast(e.message, 'error'); }
}

window.showRoomReservation = showRoomReservation;
window.showRoomReservationFor = showRoomReservationFor;
window.showRoomDetail = showRoomDetail;
window.submitRoomReservation = submitRoomReservation;
window.cancelReservation = cancelReservation;

