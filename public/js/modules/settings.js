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
      <td><strong>${c.name}</strong> ${c.is_default ? '⭐' : ''}</td>
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
      <td><code>${u.username}</code></td>
      <td><strong>${u.full_name}</strong></td>
      <td>${roleMap[u.role] || u.role}</td>
      <td>${u.role === 'personnel' ? `<span class="status-badge status-inside">${u.company_name || 'Şirket yok'}</span>` : '—'}</td>
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
          <input type="password" id="usr-pass" class="form-input" placeholder="••••••••" />
          <div style="font-size:11px;color:var(--text-3);margin-top:4px">Şifre en az 8 karakter olmalıdır.</div>
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

async function saveUser(id) {
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
    capacity: document.getElementById('rm-cap').value,
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
      <td><strong>${b.full_name}</strong></td>
      <td>${b.tc_no || b.company || '—'}</td>
      <td><span style="color:var(--red);font-size:12px">${b.reason}</span></td>
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
        <button class="btn-primary" onclick="saveBlacklist()">Kaydet</button>
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

async function loadScreensContent() {
  const contents = await api.getContents();
  const grid = document.getElementById('screens-content-grid');
  grid.innerHTML = contents.map(c => `
    <div style="background:#f8fafc;border:1px solid var(--border);border-radius:10px;overflow:hidden;position:relative">
      ${c.type === 'image' ? `<img src="${c.file_path}" style="width:100%;height:100px;object-fit:cover"/>` : 
        `<div style="height:100px;background:#000;display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px">▶️</div>`}
      <div style="padding:10px">
        <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${c.title}">${c.title}</div>
        <div style="display:flex;justify-content:space-between;margin-top:5px">
          <button class="btn-text" style="color:var(--red)" onclick="deleteContent(${c.id})">Sil</button>
          <span style="font-size:10px;color:var(--text-3)">${c.type.toUpperCase()}</span>
        </div>
      </div>
    </div>`).join('');
  if (contents.length === 0) grid.innerHTML = '<div class="empty-state">Henüz içerik yüklenmemiş.</div>';
}

async function uploadMediaFile(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  const formData = new FormData();
  formData.append('media', file);
  formData.append('title', file.name);

  showToast('Dosya yükleniyor...', 'info');
  try {
    await api.uploadContent(formData);
    showToast('Medya başarıyla yüklendi');
    loadScreensContent();
  } catch(e) { showToast(e.message, 'error'); }
  input.value = '';
}

async function deleteContent(id) {
  if (!confirm('Bu içeriği silmek istediğinize emin misiniz?')) return;
  await api.deleteContent(id);
  showToast('İçerik silindi'); loadScreensContent();
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

  const formData = new FormData();
  formData.append('media', fileEl.files[0]);
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
              <td style="text-transform:uppercase; font-weight:700">${l.level}</td>
              <td>${l.module || '-'}</td>
              <td title="${l.details || ''}">${l.message}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  } catch(e) { listEl.innerHTML = '<div class="error">Loglar yüklenemedi: ' + e.message + '</div>'; }
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

async function saveCompany(id) {
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

