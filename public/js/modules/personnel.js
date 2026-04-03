// ── PERSONEL ──────────────────────────────────────────
async function loadPersonnel() {
  const personnel = await api.getPersonnel({ active_only: 'false' });
  const grid = document.getElementById('hosts-grid');
  const filtersWrap = document.getElementById('personnel-company-filters');
  const user = getUser();
  const isAdminOrManager = window.vdPermissions
    ? window.vdPermissions.canManagePersonnel(user)
    : Boolean(user && (user.role === 'admin' || user.role === 'manager'));
  const isSecretary = window.vdPermissions
    ? window.vdPermissions.isSecretary(user)
    : Boolean(user && user.role === 'secretary');
  const hostsActionBtn = document.getElementById('hosts-primary-action');

  if (hostsActionBtn) {
    if (isSecretary) {
      hostsActionBtn.setAttribute('onclick', 'showUserModal()');
      hostsActionBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Yeni Kullanıcı`;
    } else {
      hostsActionBtn.setAttribute('onclick', 'showHostModal()');
      hostsActionBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Personel Ekle`;
    }
  }

  if (isSecretary) {
    const allUsers = await api.getUsers({ all_roles: 'true' });
    const users = allUsers.filter((u) => u.is_active);
    const companyNames = collectUniqueCompanyNames(users, (u) => u.company_name);

    if (personnelCompanyFilter !== 'all' && !companyNames.includes(personnelCompanyFilter)) {
      personnelCompanyFilter = 'all';
    }

    if (filtersWrap) {
      filtersWrap.innerHTML = '';
      const allNames = ['all'].concat(companyNames);
      allNames.forEach((companyName) => {
        const isAll = companyName === 'all';
        const label = isAll ? 'Tümü' : companyName;
        const active = personnelCompanyFilter === companyName;
        const btn = document.createElement('button');
        btn.className = 'btn-secondary';
        btn.style.cssText = 'padding:6px 12px;' + (active ? 'background:var(--primary);color:#fff;border-color:var(--primary)' : '');
        btn.textContent = label;
        btn.addEventListener('click', () => setPersonnelCompanyFilter(companyName));
        filtersWrap.appendChild(btn);
      });
    }

    const filteredUsers = personnelCompanyFilter === 'all'
      ? users
      : users.filter((u) => normalizeCompanyName(u.company_name) === normalizeCompanyName(personnelCompanyFilter));

    const roleMap = {
      admin: 'Admin',
      manager: 'Yönetici',
      secretary: 'Sekreter',
      personnel: 'Personel',
    };

    grid.innerHTML = filteredUsers.length ? filteredUsers.map((u) => `
      <div class="personnel-card ${u.is_active ? '' : 'inactive'}" style="background:var(--card-bg);border:1px solid var(--border);border-radius:16px;padding:24px;text-align:center;position:relative">
        ${!u.is_active ? '<span style="position:absolute;top:10px;right:10px;font-size:10px;background:#ef4444;color:#fff;padding:2px 6px;border-radius:4px">PASİF</span>' : ''}
        <div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#1a56db,#0891b2);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:700;margin:0 auto 12px">${(u.full_name || '?')[0]}</div>
        <div style="font-weight:700;font-size:15px;margin-bottom:4px">${u.full_name || '—'}</div>
        <div style="font-size:12px;color:var(--primary);margin-bottom:4px">${roleMap[u.role] || u.role || '—'}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">${u.company_name || 'Şirket bilgisi yok'}</div>
        <div style="font-size:12px;color:var(--text-muted)">${u.department || 'Departman yok'}</div>
        <div style="display:flex;gap:8px;margin-top:16px;justify-content:center">
          <button class="btn-secondary" style="font-size:11px;padding:5px 10px" onclick="showUserModal(${u.id})">Düzenle</button>
          <button class="btn-text" style="color:#ef4444;font-size:11px" onclick="deleteUser(${u.id})">Sil</button>
        </div>
      </div>`).join('') : '<div class="empty-state">Kullanıcı bulunamadı</div>';
    return;
  }

  const companyNames = collectUniqueCompanyNames(personnel, (p) => p.company_name);

  if (personnelCompanyFilter !== 'all' && !companyNames.includes(personnelCompanyFilter)) {
    personnelCompanyFilter = 'all';
  }

  if (filtersWrap) {
    filtersWrap.innerHTML = '';
    const allNames = ['all'].concat(companyNames);
    allNames.forEach((companyName) => {
      const isAll = companyName === 'all';
      const label = isAll ? 'Tümü' : companyName;
      const active = personnelCompanyFilter === companyName;
      const btn = document.createElement('button');
      btn.className = 'btn-secondary';
      btn.style.cssText = 'padding:6px 12px;' + (active ? 'background:var(--primary);color:#fff;border-color:var(--primary)' : '');
      btn.textContent = label;
      btn.addEventListener('click', () => setPersonnelCompanyFilter(companyName));
      filtersWrap.appendChild(btn);
    });
  }

  const filteredPersonnel = personnelCompanyFilter === 'all'
    ? personnel
    : personnel.filter((p) => normalizeCompanyName(p.company_name) === normalizeCompanyName(personnelCompanyFilter));

  grid.innerHTML = filteredPersonnel.length ? filteredPersonnel.map(p => `
    <div class="personnel-card ${p.is_active ? '' : 'inactive'}" style="background:var(--card-bg);border:1px solid var(--border);border-radius:16px;padding:24px;text-align:center;position:relative">
      ${!p.is_active ? '<span style="position:absolute;top:10px;right:10px;font-size:10px;background:#ef4444;color:#fff;padding:2px 6px;border-radius:4px">PASİF</span>' : ''}
      <div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#1a56db,#0891b2);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:700;margin:0 auto 12px">${p.full_name[0]}</div>
      <div style="font-weight:700;font-size:15px;margin-bottom:4px">${p.full_name}</div>
      <div style="font-size:12px;color:var(--primary);margin-bottom:4px">${p.title||'—'}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">${p.company_name||''}</div>
      ${p.phone ? `<div style="font-size:12px;color:var(--text-muted)">📞 ${p.phone}</div>` : ''}
      ${p.email ? `<div style="font-size:12px;color:var(--text-muted)">✉️ ${p.email}</div>` : ''}
      ${isAdminOrManager ? `
        <div style="display:flex;gap:8px;margin-top:16px;justify-content:center">
          <button class="btn-secondary" style="font-size:11px;padding:5px 10px" onclick="showHostModal(${p.id})">Düzenle</button>
          ${(window.vdPermissions ? window.vdPermissions.canDeletePersonnel(user) : false) ? `<button class="btn-text" style="color:#ef4444;font-size:11px" onclick="deleteHost(${p.id})">Sil</button>` : ''}
        </div>
      ` : ''}
    </div>`).join('') : '<div class="empty-state">Personel bulunamadı</div>';
}

async function showHostModal(id = null) {
  let p = { full_name:'', title:'', company_name:'', department:'', phone:'', email:'', is_active:1 };
  if (id) p = await api.getPersonnel({ active_only:'false' }).then(list => list.find(x => x.id == id));

  showModal(id ? 'Personel Düzenle' : 'Yeni Personel', `
    <div style="display:grid;gap:14px">
      <div class="form-row">
        <div class="form-group"><label>Ad Soyad *</label><input type="text" id="ph-name" class="form-input" value="${p.full_name}"/></div>
        <div class="form-group"><label>Ünvan</label><input type="text" id="ph-title" class="form-input" value="${p.title||''}"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Firma *</label>
          <input type="text" id="ph-company" class="form-input" value="${p.company_name||''}" placeholder="Şirket adı yazın..."/>
        </div>
        <div class="form-group"><label>Departman</label><input type="text" id="ph-dept" class="form-input" value="${p.department||''}"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Telefon</label><input type="text" id="ph-phone" class="form-input" value="${p.phone||''}"/></div>
        <div class="form-group"><label>E-posta</label><input type="email" id="ph-email" class="form-input" value="${p.email||''}"/></div>
      </div>
      <div class="form-group">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="ph-active" ${p.is_active?'checked':''} /> Aktif Personel
        </label>
      </div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="closeModal()">İptal</button>
        <button class="btn-primary" onclick="saveHost(${id})">Kaydet</button>
      </div>
    </div>`);
}

async function saveHost(id) {
  const body = {
    full_name: document.getElementById('ph-name').value,
    title: document.getElementById('ph-title').value,
    company_name: document.getElementById('ph-company').value,
    department: document.getElementById('ph-dept').value,
    phone: document.getElementById('ph-phone').value,
    email: document.getElementById('ph-email').value,
    is_active: document.getElementById('ph-active').checked ? 1 : 0
  };
  if (!body.full_name) return showToast('Ad soyad zorunlu!', 'error');
  try {
    if (id) await api.updatePersonnel(id, body);
    else await api.createPersonnel(body);
    closeModal(); showToast('Personel kaydedildi'); loadPersonnel();
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteHost(id) {
  if (!confirm('Bu personeli silmek istediğinize emin misiniz? (Pasif duruma getirilecektir)')) return;
  try {
    await api.deletePersonnel(id);
    showToast('Personel silindi'); loadPersonnel();
  } catch(e) { showToast(e.message, 'error'); }
}

