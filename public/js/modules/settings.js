// ── AYARLAR (SETTINGS) ────────────────────────────────
function switchSettingsTab(tab) {
  const user = getUser();
  if (window.vdPermissions && !window.vdPermissions.canAccessSettingsTab(user, tab)) {
    showToast('Sekreter sadece kullanıcı yönetimi sekmesini kullanabilir', 'error');
    tab = 'users';
  }

  document.querySelectorAll('.settings-tab').forEach(t => t.style.display = 'none');
  document.getElementById(`settings-tab-${tab}`).style.display = 'block';
  document.querySelectorAll('[id^="tab-btn-"]').forEach(b => {
    b.classList.remove('active');
    b.style.color = 'var(--text-3)';
    b.style.borderBottom = 'none';
  });
  const btn = document.getElementById(`tab-btn-${tab}`);
  btn.classList.add('active');
  btn.style.color = 'var(--primary)';
  btn.style.borderBottom = '2px solid var(--primary)';
  if (tab === 'companies') loadCompaniesList();
  if (tab === 'users') loadUsers();
  if (tab === 'rooms') loadRoomsSettings();
  if (tab === 'screens') loadScreensContent();
  if (tab === 'lobby-settings') loadLobbySettings();
  if (tab === 'blacklist') loadBlacklistSettings();
  if (tab === 'system-logs') loadSystemLogs();
  if (tab === 'sys') loadSystemSettings();
}

async function loadSettings() {
  const user = getUser();
  if (window.vdPermissions && !window.vdPermissions.canAccessSettingsTab(user, 'companies')) {
    switchSettingsTab('users');
    document.querySelectorAll('[id^="tab-btn-"]').forEach(btn => {
      if (btn.id !== 'tab-btn-users') btn.style.display = 'none';
    });
    const usersBtn = document.getElementById('tab-btn-users');
    if (usersBtn) usersBtn.style.display = 'inline-flex';
    return;
  }

  switchSettingsTab('companies');
}

async function loadCompaniesList() {
  const companies = await api.getCompanies({ active_only: 'false' });
  const tbody = document.getElementById('companies-tbody');
  tbody.innerHTML = companies.map(c => `
    <tr>
      <td style="display:flex;align-items:center;gap:10px">
        ${c.logo_path ? `<img src="${esc(c.logo_path)}" style="width:28px;height:28px;object-fit:contain;border-radius:4px;background:#fff;padding:2px" />` : `<div style="width:28px;height:28px;border-radius:4px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:10px;color:#999">—</div>`}
        <strong>${esc(c.name)}</strong> ${c.is_default ? '⭐' : ''}
      </td>
      <td><div style="width:20px;height:20px;border-radius:4px;background:${c.theme_color}"></div></td>
      <td><span class="status-badge ${c.is_active ? 'status-inside' : 'status-left'}">${c.is_active ? 'Aktif' : 'Pasif'}</span></td>
      <td>
        <button class="btn-text" onclick="showCompanyModal(${c.id})">Düzenle</button>
        ${!c.is_default ? `<button class="btn-text" style="margin-left:8px" onclick="setDefaultCompany(${c.id})">Varsayılan Yap</button>` : ''}
        <button class="btn-text" style="margin-left:8px;color:var(--red)" onclick="deleteCompany(${c.id})">Sil</button>
      </td>
    </tr>`).join('');
}

async function loadUsers() {
  const users = await api.getUsers();
  const tbody = document.getElementById('users-tbody');
  const roleMap = (window.vdPermissions && window.vdPermissions.ROLE_LABELS)
    ? window.vdPermissions.ROLE_LABELS
    : { admin:'Admin', manager:'Yönetici', secretary:'Sekreter', personnel:'Personel' };
  tbody.innerHTML = users.map(u => `
    <tr>
      <td><code>${esc(u.username)}</code></td>
      <td><strong>${esc(u.full_name)}</strong></td>
      <td>${esc(roleMap[u.role] || u.role)}</td>
      <td>${u.role === 'personnel' ? `<span class="status-badge status-inside">${esc(u.company_name) || 'Şirket yok'}</span>` : '—'}</td>
      <td><span class="status-badge ${u.is_active ? 'status-inside' : 'status-left'}">${u.is_active ? 'Aktif' : 'Pasif'}</span></td>
      <td><button class="btn-text" onclick="showUserModal(${u.id})">Düzenle</button></td>
    </tr>`).join('');
}

async function showUserModal(id = null) {
  try {
    let u = { username:'', full_name:'', role:'personnel', department:'', company_id:'', is_active:1 };
    const [users, companies] = await Promise.all([
      api.getUsers({ all_roles: 'true' }),
      api.getCompanies({ active_only: 'true' })
    ]);
    if (id) u = users.find(x => x.id == id) || u;
    const actor = getUser();
    const isSecretary = window.vdPermissions
      ? window.vdPermissions.isSecretary(actor)
      : Boolean(actor && actor.role === 'secretary');
    const assignableRoles = window.vdPermissions
      ? window.vdPermissions.getAssignableRoles(actor)
      : (isSecretary ? ['secretary', 'personnel'] : ['admin', 'manager', 'secretary', 'personnel']);
    const roleLabels = {
      admin: 'Admin (Tam Yetki)',
      manager: 'Yönetici (Onay Yetkisi)',
      secretary: 'Sekreter (Kayıt Yetkisi)',
      personnel: 'Personel',
    };
    const normalizedRole = assignableRoles.includes(u.role) ? u.role : 'personnel';
    const availableRoleOptions = assignableRoles.map((role) => (
      `<option value="${role}" ${normalizedRole === role ? 'selected' : ''}>${roleLabels[role] || role}</option>`
    )).join('');
    const companyOptions = ['<option value="">Seçiniz...</option>']
      .concat(companies.map((c) => `<option value="${c.id}" ${Number(u.company_id)===Number(c.id)?'selected':''}>${c.name}</option>`))
      .join('');
    const showCompanyRow = '';

    showModal(id ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı', `
      <div style="display:grid;gap:14px">
        <div class="form-group"><label>Kullanıcı Adı *</label><input type="text" id="usr-uname" class="form-input" value="${u.username}" ${id?'disabled':''}/></div>
        <div class="form-group"><label>Ad Soyad *</label><input type="text" id="usr-name" class="form-input" value="${u.full_name}"/></div>
        <div class="form-row">
          <div class="form-group"><label>Rol</label>
            <select id="usr-role" class="form-input">
              ${availableRoleOptions}
            </select>
          </div>
          <div class="form-group"><label>Departman</label><input type="text" id="usr-dept" class="form-input" value="${u.department||''}"/></div>
        </div>
        <div class="form-group" id="usr-company-row" style="${showCompanyRow}">
          <label>Şirket *</label>
          <select id="usr-company-id" class="form-input">${companyOptions}</select>
        </div>
        <div class="form-group">
          <label>Şifre ${id?'(Değiştirmek istiyorsanız yazın)':''}</label>
          <input type="text" id="usr-pass" class="form-input" autocomplete="new-password" placeholder="${id ? 'Yeni şifre girerseniz aynen görünür ve güncellenir' : 'En az 8 karakter'}" />
          <div style="font-size:11px;color:var(--text-3);margin-top:4px">${id ? 'Güvenlik nedeniyle mevcut şifre okunamaz; buraya yeni şifre yazarsanız tam metin olarak görünür.' : 'Şifre en az 8 karakter olmalıdır.'}</div>
        </div>
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="usr-active" ${u.is_active?'checked':''} /> Kullanıcı Aktif
          </label>
        </div>
        <div class="form-actions">
          <button class="btn-secondary" onclick="closeModal()">İptal</button>
          <button class="btn-primary" onclick="saveUser(${id})">Kaydet</button>
        </div>
      </div>`);

  } catch (e) {
    showToast(e.message || 'Yeni kullanıcı penceresi açılamadı', 'error');
  }
}

let _saveUserBusy = false;
async function saveUser(id) {
  if (_saveUserBusy) return;
  _saveUserBusy = true;
  try { await _doSaveUser(id); } finally { _saveUserBusy = false; }
}

async function _doSaveUser(id) {
  const actor = getUser();
  const isSecretary = window.vdPermissions
    ? window.vdPermissions.isSecretary(actor)
    : Boolean(actor && actor.role === 'secretary');
  const assignableRoles = window.vdPermissions
    ? window.vdPermissions.getAssignableRoles(actor)
    : (isSecretary ? ['secretary', 'personnel'] : ['admin', 'manager', 'secretary', 'personnel']);
  const roleEl = document.getElementById('usr-role');
  const selectedRole = roleEl && assignableRoles.includes(roleEl.value)
    ? roleEl.value
    : 'personnel';
  const companyEl = document.getElementById('usr-company-id');
  const selectedCompanyId = companyEl
    ? (companyEl.value ? Number(companyEl.value) : null)
    : null;
  const body = {
    full_name: document.getElementById('usr-name').value,
    role: selectedRole,
    department: document.getElementById('usr-dept').value,
    company_id: selectedCompanyId,
    is_active: document.getElementById('usr-active').checked ? 1 : 0,
    password: document.getElementById('usr-pass').value
  };
  if (!id) body.username = document.getElementById('usr-uname').value;
  if (!id && !body.password) return showToast('Yeni kullanıcı için şifre zorunlu', 'error');
  if (!id && !selectedCompanyId) return showToast('Yeni kullanıcı için şirket seçimi zorunludur', 'error');
  if (body.password && body.password.length < 8) return showToast('Şifre en az 8 karakter olmalıdır', 'error');

  try {
    if (id) await api.updateUser(id, body);
    else await api.createUser(body);
    closeModal(); showToast('Kullanıcı kaydedildi'); await loadPersonnel();
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteUser(id) {
  if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz? (Pasif duruma getirilecektir)')) return;
  try {
    await api.deleteUser(id);
    showToast('Kullanıcı silindi'); 
    await loadPersonnel();
  } catch(e) { showToast(e.message, 'error'); }
}

function showChangePasswordModal() {
  return window.vdShowChangePasswordModal();
}

async function submitPasswordChange() {
  return window.vdSubmitPasswordChange();
}

async function loadSystemSettings() {
  const settings = await api.getSettings();
  const form = document.getElementById('system-settings-form');
  form.innerHTML = Object.entries(settings).map(([key, data]) => `
    <div class="form-group">
      <label>${data.label}</label>
      <input type="text" id="set-${key}" class="form-input" value="${data.value}" />
    </div>`).join('');
}

async function saveSystemSettings() {
  const settings = await api.getSettings();
  const updates = {};
  Object.keys(settings).forEach(key => {
    updates[key] = document.getElementById(`set-${key}`).value;
  });
  try {
    await api.updateSettings(updates);
    showToast('Sistem ayarları güncellendi');
  } catch(e) { showToast(e.message, 'error'); }
}

async function loadRoomsSettings() {
  const rooms = await api.getRooms();
  const tbody = document.getElementById('rooms-settings-tbody');
  tbody.innerHTML = rooms.map(r => `
    <tr>
      <td><strong>${r.name}</strong></td>
      <td>${r.capacity} Kişi</td>
      <td><span class="status-badge ${r.status=='available'?'status-inside':'status-left'}">${r.status=='available'?'Müsait':'Dolu'}</span></td>
      <td><button class="btn-text" onclick="showRoomModal(${r.id})">Düzenle</button></td>
    </tr>`).join('');
}

async function showRoomModal(id = null) {
  let r = { name:'', capacity:10, floor:'', equipment:'' };
  if (id) r = await api.getRooms().then(list => list.find(x => x.id == id));
  showModal(id ? 'Oda Düzenle' : 'Yeni Oda', `
    <div style="display:grid;gap:14px">
      <div class="form-group"><label>Oda Adı *</label><input type="text" id="rm-name" class="form-input" value="${r.name}"/></div>
      <div class="form-group"><label>Kapasite</label><input type="number" id="rm-cap" class="form-input" value="${r.capacity}"/></div>
      <div class="form-group"><label>Kat / Lokasyon</label><input type="text" id="rm-floor" class="form-input" value="${r.floor||''}"/></div>
      <div class="form-group"><label>Ekipman</label><input type="text" id="rm-eq" class="form-input" value="${r.equipment||''}" placeholder="Projeksiyon, Whiteboard..."/></div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="closeModal()">İptal</button>
        <button class="btn-primary" onclick="saveRoom(${id})">Kaydet</button>
      </div>
    </div>`);
}

async function saveRoom(id) {
  const body = {
    name: document.getElementById('rm-name').value,
    capacity: Number(document.getElementById('rm-cap').value) || 10,
    floor: document.getElementById('rm-floor').value,
    equipment: document.getElementById('rm-eq').value
  };
  try {
    if (id) await api.updateRoom(id, body);
    else await api.createRoom(body);
    closeModal(); showToast('Oda kaydedildi'); loadRoomsSettings();
  } catch(e) { showToast(e.message, 'error'); }
}

async function loadBlacklistSettings() {
  const list = await api.getBlacklist();
  const tbody = document.getElementById('blacklist-settings-tbody');
  tbody.innerHTML = list.map(b => `
    <tr>
      <td><strong>${esc(b.full_name)}</strong></td>
      <td>${esc(b.tc_no || b.company) || '—'}</td>
      <td><span style="color:var(--red);font-size:12px">${esc(b.reason)}</span></td>
      <td><button class="btn-text" onclick="deleteBlacklist(${b.id})">Kaldır</button></td>
    </tr>`).join('');
}

async function showBlacklistModal() {
  showModal('Engellenen Kişi Ekle', `
    <div style="display:grid;gap:14px">
      <div class="form-group"><label>Ad Soyad *</label><input type="text" id="bl-name" class="form-input"/></div>
      <div class="form-group"><label>TC No / Firma</label><input type="text" id="bl-meta" class="form-input"/></div>
      <div class="form-group"><label>Engelleme Nedeni</label><textarea id="bl-reason" class="form-input"></textarea></div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="closeModal()">İptal</button>
        <button class="btn-primary" onclick="withButtonLock(this, saveBlacklist)">Kaydet</button>
      </div>
    </div>`);
}

async function saveBlacklist() {
  const body = {
    full_name: document.getElementById('bl-name').value,
    tc_no: document.getElementById('bl-meta').value,
    reason: document.getElementById('bl-reason').value
  };
  try {
    await api.addBlacklist(body);
    closeModal(); showToast('Kişi kara listeye eklendi'); loadBlacklistSettings();
  } catch(e) { showToast(e.message, 'error'); }
}

async function deleteBlacklist(id) {
  if (!confirm('Bu kişiyi kara listeden çıkarmak istediğinize emin misiniz?')) return;
  await api.deleteBlacklist(id);
  showToast('Kişi kara listeden çıkarıldı'); loadBlacklistSettings();
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

// ── İçerik cache (edit modal için) ──
let _contentsCache = [];
let _companiesCache = [];
let _tickerSettingsCache = {};
let _companyTickerMap = {};
let _selectedCompanyTickerId = '';

function parseCompanyTickerMap(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

async function loadScreensContent() {
  const [contents, companies] = await Promise.all([api.getContents(), api.getCompanies()]);
  _contentsCache = contents;
  _companiesCache = companies;

  // Sirket dropdown'unu doldur (upload icin)
  const uploadSelect = document.getElementById('media-upload-company');
  if (uploadSelect) {
    uploadSelect.innerHTML = '<option value="">Genel (Tum Sirketler)</option>' +
      companies.map(co => `<option value="${co.id}">${esc(co.name)}</option>`).join('');
  }

  const grid = document.getElementById('screens-content-grid');
  grid.innerHTML = contents.map(c => {
    const companyBadge = c.company_name
      ? `<div style="display:flex;align-items:center;gap:4px;margin-top:4px">
           ${c.company_logo ? `<img src="${esc(c.company_logo)}" style="width:16px;height:16px;object-fit:contain;border-radius:2px"/>` : ''}
           <span style="font-size:10px;color:var(--primary);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.company_name)}</span>
         </div>`
      : `<div style="font-size:10px;color:var(--text-3);margin-top:4px">Genel</div>`;
    const activeStyle = c.is_active ? '' : 'opacity:0.5;';
    return `
    <div style="background:#f8fafc;border:1px solid var(--border);border-radius:10px;overflow:hidden;position:relative;${activeStyle}">
      ${c.type === 'image' ? `<img src="${esc(c.file_path)}" style="width:100%;height:100px;object-fit:cover"/>` :
        `<div style="height:100px;background:#000;display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px">▶</div>`}
      ${!c.is_active ? '<div style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.6);color:#fff;font-size:9px;padding:2px 6px;border-radius:3px">PASIF</div>' : ''}
      <div style="padding:10px">
        <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(c.title || 'Isimsiz')}">${esc(c.title || 'Isimsiz')}</div>
        ${companyBadge}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
          <div style="display:flex;gap:6px">
            <button class="btn-text" style="color:var(--primary);font-size:11px" onclick="showEditContentModal(${c.id})">Duzenle</button>
            <button class="btn-text" style="color:var(--red);font-size:11px" onclick="deleteContent(${c.id})">Sil</button>
          </div>
          <span style="font-size:10px;color:var(--text-3)">${c.type.toUpperCase()} ${c.file_size ? formatFileSize(c.file_size) : ''}</span>
        </div>
      </div>
    </div>`;
  }).join('');
  if (contents.length === 0) grid.innerHTML = '<div class="empty-state">Henuz icerik yuklenmemis.</div>';

  // Ticker mesajlarini yukle
  loadTickerMessages();
}

function showEditContentModal(contentId) {
  const c = _contentsCache.find(x => x.id === contentId);
  if (!c) return;
  const companyOptions = '<option value="">Genel (Tum Sirketler)</option>' +
    _companiesCache.map(co => `<option value="${co.id}" ${co.id === c.company_id ? 'selected' : ''}>${esc(co.name)}</option>`).join('');

  showModal('Icerik Duzenle', `
    <input type="hidden" id="edit-content-id" value="${c.id}" />
    <div class="form-group"><label>Baslik</label><input type="text" id="edit-content-title" class="form-input" value="${(c.title || '').replace(/"/g, '&quot;')}" /></div>
    <div class="form-group"><label>Sirket Etiketi</label><select id="edit-content-company" class="form-input">${companyOptions}</select></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group"><label>Gosterim Sirasi</label><input type="number" id="edit-content-order" class="form-input" value="${c.display_order || 0}" min="0" /></div>
      <div class="form-group" style="display:flex;flex-direction:column;gap:8px;padding-top:22px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin:0"><input type="checkbox" id="edit-content-active" ${c.is_active ? 'checked' : ''} /> Aktif</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin:0"><input type="checkbox" id="edit-content-default" ${c.is_default ? 'checked' : ''} /> Varsayilan</label>
      </div>
    </div>
    ${c.type === 'image' ? `<div style="margin-top:8px"><img src="${esc(c.file_path)}" style="width:100%;max-height:150px;object-fit:contain;border-radius:6px;border:1px solid var(--border)" /></div>` : ''}
    <div class="form-actions" style="margin-top:16px;display:flex;gap:8px">
      <button class="btn-primary" onclick="withButtonLock(this, saveContentEdit)">Kaydet</button>
      <button class="btn-secondary" onclick="closeModal()">Iptal</button>
    </div>
  `);
}

async function saveContentEdit() {
  const id = Number(document.getElementById('edit-content-id').value);
  const data = {
    title: document.getElementById('edit-content-title').value,
    company_id: document.getElementById('edit-content-company').value || null,
    display_order: Number(document.getElementById('edit-content-order').value) || 0,
    is_active: document.getElementById('edit-content-active').checked ? 1 : 0,
    is_default: document.getElementById('edit-content-default').checked ? 1 : 0,
  };
  try {
    await api.updateContent(id, data);
    closeModal();
    showToast('Icerik guncellendi');
    loadScreensContent();
  } catch(e) { showToast(e.message, 'error'); }
}

var _allowedMediaTypes = ['image/jpeg','image/png','image/gif','image/webp','image/svg+xml','video/mp4','video/webm'];
var _maxMediaSize = Infinity;
var _allowedImageTypes = ['image/jpeg','image/png','image/gif','image/webp','image/svg+xml'];
var _maxImageSize = Infinity;

async function uploadMediaFile(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  if (!_allowedMediaTypes.includes(file.type)) {
    input.value = ''; return showToast('Desteklenmeyen dosya tipi. Resim veya video yükleyin.', 'error');
  }
  if (file.size > _maxMediaSize) {
    input.value = ''; return showToast('Dosya boyutu çok büyük.', 'error');
  }
  const formData = new FormData();
  formData.append('media', file);
  formData.append('title', file.name);

  const companyId = document.getElementById('media-upload-company')?.value;
  if (companyId) formData.append('company_id', companyId);

  showToast('Dosya yukleniyor...', 'info');
  try {
    await api.uploadContent(formData);
    showToast('Medya basariyla yuklendi');
    loadScreensContent();
  } catch(e) { showToast(e.message, 'error'); }
  input.value = '';
}

async function deleteContent(id) {
  if (!confirm('Bu icerigi silmek istediginize emin misiniz?')) return;
  await api.deleteContent(id);
  showToast('Icerik silindi'); loadScreensContent();
}

// ── TICKER (Kayan Yazı) Yönetimi ──────────────────────────
async function loadTickerMessages() {
  const container = document.getElementById('ticker-rows-container');
  if (!container) return;
  try {
    const [s, companies] = await Promise.all([
      api.getSettings(),
      _companiesCache.length ? Promise.resolve(_companiesCache) : api.getCompanies({ active_only: 'false' }),
    ]);
    _tickerSettingsCache = s || {};
    _companiesCache = companies || [];
    _companyTickerMap = parseCompanyTickerMap(s.ticker_company_texts ? s.ticker_company_texts.value : '');

    const speedInput = document.getElementById('ticker-speed-input');
    if (speedInput) speedInput.value = s.ticker_speed ? (s.ticker_speed.value || '40') : '40';

    const tickerValue = s.ticker_text ? (s.ticker_text.value || '') : '';
    const msgs = tickerValue.split('|').map(m => m.trim()).filter(Boolean);
    container.innerHTML = '';
    if (msgs.length === 0) {
      addTickerRow();
    } else {
      msgs.forEach(m => addTickerRow(m));
    }
    loadCompanyTickerEditor();
  } catch (e) {
    console.warn('Ticker load error', e);
    container.innerHTML = '';
    addTickerRow();
    loadCompanyTickerEditor();
  }
}

function addTickerRow(text) {
  const container = document.getElementById('ticker-rows-container');
  if (!container) return;
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:8px';
  row.innerHTML = `
    <span style="cursor:grab;color:var(--text-3);font-size:16px" title="Sirala">⠿</span>
    <input type="text" class="form-input ticker-msg-input" value="${esc(text || '')}" placeholder="Kayan yazı metni girin..." style="flex:1">
    <button class="btn-text" style="color:var(--text-3)" onclick="moveTickerRow(this,-1)" title="Yukari">▲</button>
    <button class="btn-text" style="color:var(--text-3)" onclick="moveTickerRow(this,1)" title="Asagi">▼</button>
    <button class="btn-text" style="color:var(--red);font-size:16px" onclick="removeTickerRow(this)" title="Sil">✕</button>
  `;
  container.appendChild(row);
}

function removeTickerRow(btn) {
  const row = btn.closest('div');
  const container = document.getElementById('ticker-rows-container');
  if (container && container.children.length <= 1) {
    return showToast('En az bir kayan yazı satiri olmali', 'error');
  }
  row.remove();
}

function moveTickerRow(btn, direction) {
  const row = btn.closest('div');
  const container = row.parentElement;
  if (direction === -1 && row.previousElementSibling) {
    container.insertBefore(row, row.previousElementSibling);
  } else if (direction === 1 && row.nextElementSibling) {
    container.insertBefore(row.nextElementSibling, row);
  }
}

function loadCompanyTickerEditor() {
  const select = document.getElementById('company-ticker-select');
  if (!select) return;
  const companies = (_companiesCache || []).filter((company) => company && company.id);
  if (!companies.length) {
    select.innerHTML = '<option value="">Firma bulunamadı</option>';
    renderCompanyTickerRows();
    return;
  }

  const currentValue = _selectedCompanyTickerId || select.value || String(companies[0].id);
  select.innerHTML = companies.map((company) =>
    `<option value="${company.id}">${esc(company.name)}</option>`
  ).join('');
  select.value = companies.some((company) => String(company.id) === String(currentValue))
    ? String(currentValue)
    : String(companies[0].id);
  _selectedCompanyTickerId = select.value;
  renderCompanyTickerRows();
}

function getSelectedCompanyTickerId() {
  const select = document.getElementById('company-ticker-select');
  const id = select ? String(select.value || '') : '';
  _selectedCompanyTickerId = id;
  return id;
}

function renderCompanyTickerRows() {
  const container = document.getElementById('company-ticker-rows-container');
  if (!container) return;
  const companyId = getSelectedCompanyTickerId();
  const tickerValue = companyId ? (_companyTickerMap[companyId] || '') : '';
  const msgs = tickerValue.split('|').map(m => m.trim()).filter(Boolean);
  container.innerHTML = '';
  if (!companyId) {
    container.innerHTML = '<div class="empty-state">Once firma secin.</div>';
    return;
  }
  if (!msgs.length) {
    addCompanyTickerRow();
    return;
  }
  msgs.forEach((msg) => addCompanyTickerRow(msg));
}

function addCompanyTickerRow(text) {
  const container = document.getElementById('company-ticker-rows-container');
  if (!container) return;
  if (container.classList.contains('empty-state')) container.innerHTML = '';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:8px';
  row.innerHTML = `
    <span style="cursor:grab;color:var(--text-3);font-size:16px" title="Sirala">⠿</span>
    <input type="text" class="form-input company-ticker-msg-input" value="${esc(text || '')}" placeholder="Firmaya ozel kayan yazi metni..." style="flex:1">
    <button class="btn-text" style="color:var(--text-3)" onclick="moveCompanyTickerRow(this,-1)" title="Yukari">▲</button>
    <button class="btn-text" style="color:var(--text-3)" onclick="moveCompanyTickerRow(this,1)" title="Asagi">▼</button>
    <button class="btn-text" style="color:var(--red);font-size:16px" onclick="removeCompanyTickerRow(this)" title="Sil">✕</button>
  `;
  container.appendChild(row);
}

function removeCompanyTickerRow(btn) {
  const row = btn.closest('div');
  const container = document.getElementById('company-ticker-rows-container');
  if (container && container.children.length <= 1) {
    return showToast('En az bir satir kalsin; firmaya ozel yaziyi bos birakmak icin metni silip kaydedin.', 'error');
  }
  row.remove();
}

function moveCompanyTickerRow(btn, direction) {
  const row = btn.closest('div');
  const container = row.parentElement;
  if (direction === -1 && row.previousElementSibling) {
    container.insertBefore(row, row.previousElementSibling);
  } else if (direction === 1 && row.nextElementSibling) {
    container.insertBefore(row.nextElementSibling, row);
  }
}

let _saveTickerBusy = false;
async function saveTickerMessages() {
  if (_saveTickerBusy) return;
  _saveTickerBusy = true;
  try {
    const inputs = document.querySelectorAll('#ticker-rows-container .ticker-msg-input');
    const msgs = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);
    if (msgs.length === 0) {
      _saveTickerBusy = false;
      return showToast('En az bir kayan yazı mesaji girin', 'error');
    }
    const tickerText = msgs.join(' | ');
    const speedInput = document.getElementById('ticker-speed-input');
    const speed = Math.max(8, Math.min(180, Number(speedInput ? speedInput.value : 40) || 40));
    if (speedInput) speedInput.value = String(speed);
    await api.updateSettings({ ticker_text: tickerText, ticker_speed: String(speed) });
    showToast('Kayan yazılar kaydedildi');
  } catch (e) { showToast(e.message, 'error'); }
  _saveTickerBusy = false;
}

let _saveCompanyTickerBusy = false;
async function saveCompanyTickerMessages() {
  if (_saveCompanyTickerBusy) return;
  _saveCompanyTickerBusy = true;
  try {
    const companyId = getSelectedCompanyTickerId();
    if (!companyId) {
      _saveCompanyTickerBusy = false;
      return showToast('Firma secin', 'error');
    }
    const inputs = document.querySelectorAll('#company-ticker-rows-container .company-ticker-msg-input');
    const msgs = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);
    const nextMap = Object.assign({}, _companyTickerMap);
    if (msgs.length) nextMap[companyId] = msgs.join(' | ');
    else delete nextMap[companyId];
    await api.updateSettings({ ticker_company_texts: JSON.stringify(nextMap) });
    _companyTickerMap = nextMap;
    showToast('Firmaya ozel kayan yazilar kaydedildi');
  } catch (e) { showToast(e.message, 'error'); }
  _saveCompanyTickerBusy = false;
}

// Firma bazli yeni kayan yazi editoru. Eski genel editor fonksiyonlarini bilincli olarak override eder.
function updateTickerSpeedLabel(value) {
  const speed = Math.max(8, Math.min(180, Number(value) || 40));
  const label = document.getElementById('ticker-speed-value');
  if (label) label.textContent = String(speed);
}

async function loadTickerMessages() {
  const container = document.getElementById('company-ticker-cards');
  if (!container) return;
  try {
    const [s, companies] = await Promise.all([
      api.getSettings(),
      _companiesCache.length ? Promise.resolve(_companiesCache) : api.getCompanies({ active_only: 'false' }),
    ]);
    _tickerSettingsCache = s || {};
    _companiesCache = companies || [];
    _companyTickerMap = parseCompanyTickerMap(s.ticker_company_texts ? s.ticker_company_texts.value : '');

    const speedInput = document.getElementById('ticker-speed-input');
    const speed = s.ticker_speed ? (s.ticker_speed.value || '40') : '40';
    if (speedInput) speedInput.value = speed;
    updateTickerSpeedLabel(speed);
    renderCompanyTickerCards();
  } catch (e) {
    console.warn('Ticker load error', e);
    container.innerHTML = '<div class="empty-state">Kayan yazi ayarlari yuklenemedi.</div>';
  }
}

function renderCompanyTickerCards() {
  const container = document.getElementById('company-ticker-cards');
  if (!container) return;
  const companies = (_companiesCache || []).filter((company) => company && company.id);
  if (!companies.length) {
    container.innerHTML = '<div class="empty-state">Firma bulunamadi.</div>';
    return;
  }

  container.innerHTML = companies.map((company) => {
    const companyId = String(company.id);
    const msgs = String(_companyTickerMap[companyId] || '').split('|').map(m => m.trim()).filter(Boolean);
    const rows = msgs.length ? msgs : [''];
    return `
      <div class="company-ticker-card" data-company-id="${companyId}" style="border:1px solid var(--border);border-radius:10px;background:#fff;padding:14px;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
          <div style="display:flex;align-items:center;gap:8px;min-width:0">
            ${company.logo_path ? `<img src="${esc(company.logo_path)}" style="width:28px;height:28px;object-fit:contain;border-radius:4px;background:#fff;border:1px solid var(--border);padding:2px" />` : `<div style="width:28px;height:28px;border-radius:4px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:10px;color:#999">-</div>`}
            <strong style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(company.name)}</strong>
          </div>
          <button class="btn-secondary" style="font-size:11px;padding:5px 9px" onclick="addCompanyTickerRow(${company.id})">+ Satir</button>
        </div>
        <div class="company-ticker-rows" style="display:flex;flex-direction:column;gap:8px">
          ${rows.map((msg) => companyTickerRowHtml(msg)).join('')}
        </div>
      </div>`;
  }).join('');
}

function companyTickerRowHtml(text) {
  return `
    <div class="company-ticker-row" style="display:flex;align-items:center;gap:8px">
      <input type="text" class="form-input company-ticker-msg-input" value="${esc(text || '')}" placeholder="Firmaya ozel kayan yazi metni..." style="flex:1">
      <button class="btn-text" style="color:var(--text-3)" onclick="moveCompanyTickerRow(this,-1)" title="Yukari">▲</button>
      <button class="btn-text" style="color:var(--text-3)" onclick="moveCompanyTickerRow(this,1)" title="Asagi">▼</button>
      <button class="btn-text" style="color:var(--red);font-size:16px" onclick="removeCompanyTickerRow(this)" title="Sil">✕</button>
    </div>`;
}

function addCompanyTickerRow(companyId) {
  const card = document.querySelector(`.company-ticker-card[data-company-id="${companyId}"]`);
  const rows = card ? card.querySelector('.company-ticker-rows') : null;
  if (!rows) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = companyTickerRowHtml('');
  rows.appendChild(wrapper.firstElementChild);
}

function removeCompanyTickerRow(btn) {
  const row = btn.closest('.company-ticker-row');
  const rows = row ? row.parentElement : null;
  if (rows && rows.children.length <= 1) {
    const input = row.querySelector('.company-ticker-msg-input');
    if (input) input.value = '';
    return;
  }
  if (row) row.remove();
}

function moveCompanyTickerRow(btn, direction) {
  const row = btn.closest('.company-ticker-row');
  const container = row ? row.parentElement : null;
  if (!row || !container) return;
  if (direction === -1 && row.previousElementSibling) {
    container.insertBefore(row, row.previousElementSibling);
  } else if (direction === 1 && row.nextElementSibling) {
    container.insertBefore(row.nextElementSibling, row);
  }
}

async function saveAllCompanyTickerMessages() {
  if (_saveCompanyTickerBusy) return;
  _saveCompanyTickerBusy = true;
  try {
    const nextMap = {};
    document.querySelectorAll('.company-ticker-card').forEach((card) => {
      const companyId = card.getAttribute('data-company-id');
      const inputs = card.querySelectorAll('.company-ticker-msg-input');
      const msgs = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);
      if (companyId && msgs.length) nextMap[companyId] = msgs.join(' | ');
    });
    const speedInput = document.getElementById('ticker-speed-input');
    const speed = Math.max(8, Math.min(180, Number(speedInput ? speedInput.value : 40) || 40));
    if (speedInput) speedInput.value = String(speed);
    updateTickerSpeedLabel(speed);
    await api.updateSettings({
      ticker_company_texts: JSON.stringify(nextMap),
      ticker_speed: String(speed),
      ticker_text: '',
    });
    _companyTickerMap = nextMap;
    showToast('Firma kayan yazilari kaydedildi');
  } catch (e) { showToast(e.message, 'error'); }
  _saveCompanyTickerBusy = false;
}

function saveTickerMessages() {
  return saveAllCompanyTickerMessages();
}

// ── LOBİ AYARLARI (Admin) ──────────────────────────────
async function loadLobbySettings() {
  try {
    const s = await api.getSettings();
    if (s.company_name) document.getElementById('set-company-name').value = s.company_name.value || '';
    if (s.welcome_message) document.getElementById('set-welcome-msg').value = s.welcome_message.value || '';
    if (s.lobby_bg_overlay) document.getElementById('set-bg-overlay').value = s.lobby_bg_overlay.value || '0.4';
    if (s.lobby_media_enabled) document.getElementById('set-media-enabled').checked = s.lobby_media_enabled.value == '1';
    
    if (s.lobby_box_width) document.getElementById('set-box-width').value = s.lobby_box_width.value || '650px';
    if (s.lobby_box_vertical_pos) document.getElementById('set-box-vpos').value = s.lobby_box_vertical_pos.value || '50%';

    const prev = document.getElementById('lobby-logo-preview');
    if (s.lobby_logo_path && s.lobby_logo_path.value) {
      prev.src = s.lobby_logo_path.value;
      prev.style.display = 'block';
    } else { prev.style.display = 'none'; }
  } catch(e) { console.warn('Lobby Settings error', e); }
}

async function saveSettingsAlt() {
  try {
    const data = {
      company_name: document.getElementById('set-company-name').value,
      welcome_message: document.getElementById('set-welcome-msg').value,
      lobby_bg_overlay: document.getElementById('set-bg-overlay').value,
      lobby_media_enabled: document.getElementById('set-media-enabled').checked ? '1' : '0',
      lobby_box_width: document.getElementById('set-box-width').value,
      lobby_box_vertical_pos: document.getElementById('set-box-vpos').value
    };
    await api.updateSettings(data);
    showToast('✅ Lobi ayarları başarıyla kaydedildi');
  } catch(e) { showToast(e.message, 'error'); }
}

async function uploadLobbyLogo() {
  const fileEl = document.getElementById('lobby-logo-file');
  if (!fileEl.files || !fileEl.files[0]) return showToast('Lütfen logo dosyası seçin', 'error');
  var logoFile = fileEl.files[0];
  if (!_allowedImageTypes.includes(logoFile.type)) {
    fileEl.value = ''; return showToast('Sadece resim dosyası yükleyebilirsiniz (JPEG, PNG, GIF, WebP, SVG).', 'error');
  }
  if (logoFile.size > _maxImageSize) {
    fileEl.value = ''; return showToast('Logo dosyası 5MB\'dan büyük olamaz.', 'error');
  }

  const formData = new FormData();
  formData.append('media', logoFile);
  formData.append('type', 'image');
  formData.append('title', 'Lobby Logo');

  try {
    const data = await api.uploadContent(formData);

    await api.updateSettings({ lobby_logo_path: data.file_path });
    showToast('🚀 Logo yüklendi');
    loadLobbySettings();
  } catch(e) { showToast(e.message, 'error'); }
}

// ── SİSTEM LOGLARI (Admin) ─────────────────────────────
async function loadSystemLogs() {
  const listEl = document.getElementById('system-logs-list');
  listEl.innerHTML = '<div class="empty-state">Yükleniyor...</div>';
  try {
    const data = await api.getSystemLogs();
    if (!data.items?.length) { listEl.innerHTML = '<div class="empty-state">Log kaydı bulunamadı.</div>'; return; }
    
    listEl.innerHTML = `
      <table style="width:100%; border-collapse:collapse; background:#fff">
        <thead style="position:sticky; top:0; background:#f8fafc; text-align:left; border-bottom:2px solid var(--border)">
          <tr><th style="padding:10px">Tarih</th><th>Seviye</th><th>Modül</th><th>Mesaj</th></tr>
        </thead>
        <tbody>
          ${data.items.map(l => {
            const color = l.level === 'error' ? 'var(--red)' : (l.level === 'warn' ? 'var(--orange)' : 'inherit');
            return `<tr style="border-bottom:1px solid #eee; color:${color}">
              <td style="padding:8px; white-space:nowrap">${new Date(l.created_at).toLocaleString('tr-TR')}</td>
              <td style="text-transform:uppercase; font-weight:700">${esc(l.level)}</td>
              <td>${esc(l.module) || '-'}</td>
              <td title="${esc(l.details) || ''}">${esc(l.message)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  } catch(e) { listEl.innerHTML = '<div class="error">Loglar yüklenemedi: ' + esc(e.message) + '</div>'; }
}

async function showCompanyModal(id = null) {
  let c = { name:'', theme_color:'#1a56db', is_default:0, is_active:1 };
  if (id) {
    const list = await api.getCompanies({ active_only: 'false' });
    c = list.find(x => x.id == id);
  }
  showModal(id ? 'Şirketi Düzenle' : 'Yeni Şirket', `
    <div style="display:grid;gap:14px">
      <div class="form-group"><label>Şirket Adı *</label><input type="text" id="co-name" class="form-input" value="${c.name}"/></div>
      <div class="form-group"><label>Temo Rengi (Karşılama Yazısı Rengi)</label><input type="color" id="co-color" class="form-input" value="${c.theme_color}" style="height:44px"/></div>
      ${id ? `<div class="form-group">
        <label>Şirket Logosu</label>
        <div style="display:flex;align-items:center;gap:12px">
          ${c.logo_path ? `<img src="${c.logo_path}" style="width:48px;height:48px;object-fit:contain;border-radius:6px;background:#fff;padding:4px;border:1px solid #ddd" />` : '<span style="color:#999;font-size:12px">Logo yok</span>'}
          <label class="btn-secondary btn-sm" style="cursor:pointer;margin:0">
            Logo Yükle
            <input type="file" id="co-logo-file" accept="image/*" style="display:none" onchange="uploadCompanyLogo(${id})" />
          </label>
        </div>
      </div>` : ''}
      <div class="form-row">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="co-active" ${c.is_active?'checked':''} /> Aktif
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="co-default" ${c.is_default?'checked':''} /> Varsayılan
        </label>
      </div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="closeModal()">İptal</button>
        <button class="btn-primary" onclick="saveCompany(${id})">Kaydet</button>
      </div>
    </div>`);
}

let _saveCompanyBusy = false;
async function saveCompany(id) {
  if (_saveCompanyBusy) return;
  _saveCompanyBusy = true;
  try { await _doSaveCompany(id); } finally { _saveCompanyBusy = false; }
}

async function _doSaveCompany(id) {
  const body = {
    name: document.getElementById('co-name').value,
    theme_color: document.getElementById('co-color').value,
    is_active: document.getElementById('co-active').checked ? 1 : 0,
    is_default: document.getElementById('co-default').checked ? 1 : 0
  };
  if (!body.name) return showToast('Ad zorunlu!', 'error');
  try {
    if (id) await api.updateCompany(id, body);
    else await api.createCompany(body);
    closeModal(); showToast('Şirket kaydedildi'); loadSettings();
  } catch (e) { showToast(e.message, 'error'); }
}

async function uploadCompanyLogo(companyId) {
  const input = document.getElementById('co-logo-file');
  if (!input || !input.files.length) return;
  var coLogoFile = input.files[0];
  if (!_allowedImageTypes.includes(coLogoFile.type)) {
    input.value = ''; return showToast('Sadece resim dosyası yükleyebilirsiniz (JPEG, PNG, GIF, WebP, SVG).', 'error');
  }
  if (coLogoFile.size > _maxImageSize) {
    input.value = ''; return showToast('Logo dosyası 5MB\'dan büyük olamaz.', 'error');
  }
  const fd = new FormData();
  fd.append('logo', coLogoFile);
  try {
    const token = sessionStorage.getItem('vd_token');
    const resp = await fetch(`/api/companies/${companyId}/logo`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: fd,
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Logo yüklenemedi');
    showToast('Logo yüklendi');
    closeModal();
    loadCompaniesList();
    showCompanyModal(companyId);
  } catch (e) { showToast(e.message, 'error'); }
}

async function setDefaultCompany(id) {
  try {
    await api.setDefaultCompany(id);
    showToast('Varsayılan şirket değişti'); loadSettings();
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteCompany(id) {
  try {
    const companies = await api.getCompanies({ active_only: 'false' });
    const company = companies.find((c) => Number(c.id) === Number(id));
    if (!company) return showToast('Şirket bulunamadı', 'error');
    if (company.is_default) return showToast('Varsayılan şirket silinemez. Önce varsayılan şirketi değiştirin.', 'error');

    const activeCount = companies.filter((c) => c.is_active).length;
    if (company.is_active && activeCount <= 1) {
      return showToast('Sistemde en az bir aktif şirket kalmalıdır', 'error');
    }

    const actionText = company.is_active ? 'pasife almak' : 'silme isteğini tamamlamak';
    const ok = confirm(`"${company.name}" firması için ${actionText} istediğinize emin misiniz?`);
    if (!ok) return;

    await api.deleteCompany(id);
    showToast(company.is_active ? 'Firma pasife alındı' : 'Pasif firma için silme isteği işlendi');
    loadCompaniesList();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

