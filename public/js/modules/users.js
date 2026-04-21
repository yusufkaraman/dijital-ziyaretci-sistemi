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

