// ── PERSONEL ──────────────────────────────────────────
let personnelUserSearch = '';
let personnelUserSearchTimer = null;
let personnelLoadVersion = 0;

async function loadPersonnel() {
  const currentLoadVersion = ++personnelLoadVersion;
  const grid = document.getElementById('hosts-grid');
  if (!grid) return;
  const filtersWrap = document.getElementById('personnel-company-filters');
  const junkSection = document.getElementById('junk-users-section');
  const user = getUser();
  const isAdmin = Boolean(user && user.role === 'admin');
  const isAdminOrManager = window.vdPermissions
    ? window.vdPermissions.canManagePersonnel(user)
    : Boolean(user && (user.role === 'admin' || user.role === 'manager'));
  const isSecretary = window.vdPermissions
    ? window.vdPermissions.isSecretary(user)
    : Boolean(user && user.role === 'secretary');
  const hostsActionBtn = document.getElementById('hosts-primary-action');

  // Sekreter, yönetici ve admin kullanıcı yönetim görünümünü kullansın
  if (isSecretary || isAdminOrManager) {
    if (hostsActionBtn) {
      hostsActionBtn.setAttribute('onclick', 'showUserModal()');
      hostsActionBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Yeni Kullanıcı`;
    }

    const previousSearchInput = filtersWrap ? filtersWrap.querySelector('input[type="search"]') : null;
    const shouldRestoreSearchFocus = Boolean(previousSearchInput && document.activeElement === previousSearchInput);
    const previousSelectionStart = shouldRestoreSearchFocus ? previousSearchInput.selectionStart : null;
    const previousSelectionEnd = shouldRestoreSearchFocus ? previousSearchInput.selectionEnd : null;

    const [allUsers, allPersonnel] = await Promise.all([
      api.getUsers({ all_roles: 'true', include_inactive: isAdmin ? 'true' : undefined }),
      api.getPersonnel({ active_only: 'false' }),
    ]);
    if (currentLoadVersion !== personnelLoadVersion) return;

    const users = allUsers.filter((u) => u.is_active);
    const junkUsers = isAdmin
      ? allUsers.filter((u) => !u.is_active || !u.has_active_personnel)
      : [];
    const junkPersonnel = isAdmin
      ? allPersonnel.filter((p) => !p.is_active)
      : [];
    const searchTerm = (personnelUserSearch || '').trim().toLowerCase();
    const companyNames = collectUniqueCompanyNames(users, (u) => u.company_name);

    if (personnelCompanyFilter !== 'all' && !companyNames.includes(personnelCompanyFilter)) {
      personnelCompanyFilter = 'all';
    }

    if (filtersWrap) {
      filtersWrap.innerHTML = '';
      const searchWrap = document.createElement('div');
      searchWrap.style.cssText = 'flex:1 1 240px;min-width:220px;';
      searchWrap.innerHTML = `
        <input
          type="search"
          class="form-input"
          placeholder="Username ile ara..."
          value="${esc(personnelUserSearch)}"
          oninput="setPersonnelUserSearch(this.value)"
          style="width:100%"
        />`;
      filtersWrap.appendChild(searchWrap);
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

      if (shouldRestoreSearchFocus) {
        const nextSearchInput = filtersWrap.querySelector('input[type="search"]');
        if (nextSearchInput) {
          nextSearchInput.focus({ preventScroll: true });
          if (previousSelectionStart !== null && previousSelectionEnd !== null) {
            nextSearchInput.setSelectionRange(previousSelectionStart, previousSelectionEnd);
          }
        }
      }
    }

    let filteredUsers = personnelCompanyFilter === 'all'
      ? users
      : users.filter((u) => normalizeCompanyName(u.company_name) === normalizeCompanyName(personnelCompanyFilter));
    if (searchTerm) {
      filteredUsers = filteredUsers.filter((u) => {
        const username = String(u.username || '').toLowerCase();
        const fullName = String(u.full_name || '').toLowerCase();
        return username.includes(searchTerm) || fullName.includes(searchTerm);
      });
    }

    const roleMap = {
      admin: 'Admin',
      manager: 'Yönetici',
      secretary: 'Sekreter',
      personnel: 'Personel',
    };

    grid.innerHTML = filteredUsers.length ? filteredUsers.map((u) => `
      <div class="personnel-card ${u.is_active ? '' : 'inactive'}" style="background:var(--card-bg);border:1px solid var(--border);border-radius:16px;padding:24px;text-align:center;position:relative">
        ${!u.is_active ? '<span style="position:absolute;top:10px;right:10px;font-size:10px;background:#ef4444;color:#fff;padding:2px 6px;border-radius:4px">PASİF</span>' : ''}
        <div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#1a56db,#0891b2);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:700;margin:0 auto 12px">${esc((u.full_name || '?')[0])}</div>
        <div style="font-weight:700;font-size:15px;margin-bottom:4px">${esc(u.full_name) || '—'}</div>
        <div style="font-size:12px;color:var(--primary);margin-bottom:4px">${esc(roleMap[u.role] || u.role) || '—'}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">${esc(u.company_name) || 'Şirket bilgisi yok'}</div>
        <div style="font-size:12px;color:var(--text-muted)">${esc(u.department) || 'Departman yok'}</div>
        <div style="display:flex;gap:8px;margin-top:16px;justify-content:center">
          <button class="btn-secondary" style="font-size:11px;padding:5px 10px" onclick="showUserModal(${u.id})">Düzenle</button>
          <button class="btn-text" style="color:#ef4444;font-size:11px" onclick="deleteUser(${u.id})">Sil</button>
        </div>
      </div>`).join('') : '<div class="empty-state">Kullanıcı bulunamadı</div>';
    if (junkSection) {
      let filteredJunkUsers = junkUsers;
      let filteredJunkPersonnel = junkPersonnel;
      if (searchTerm) {
        filteredJunkUsers = filteredJunkUsers.filter((u) => {
          const username = String(u.username || '').toLowerCase();
          const fullName = String(u.full_name || '').toLowerCase();
          return username.includes(searchTerm) || fullName.includes(searchTerm);
        });
        filteredJunkPersonnel = filteredJunkPersonnel.filter((p) => {
          const fullName = String(p.full_name || '').toLowerCase();
          const companyName = String(p.company_name || '').toLowerCase();
          return fullName.includes(searchTerm) || companyName.includes(searchTerm);
        });
      }
      if (!isAdmin || (!filteredJunkUsers.length && !filteredJunkPersonnel.length)) {
        junkSection.style.display = 'none';
        junkSection.innerHTML = '';
      } else {
        junkSection.style.display = 'block';
        junkSection.innerHTML = `
          <div style="border:1px dashed #fca5a5;border-radius:14px;padding:16px;background:linear-gradient(135deg,#fff 0%,#fff6f6 100%)">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px">
              <div>
                <div style="font-weight:800;font-size:15px;color:var(--text-1)">Arşiv / Junk Kullanıcılar</div>
                <div style="font-size:12px;color:var(--text-3)">Pasif kayıtlar ve aktif personel bağlantısı kalmamış kullanıcılar burada listelenir.</div>
              </div>
              <span class="status-badge status-left">${filteredJunkUsers.length + filteredJunkPersonnel.length} kayıt</span>
            </div>
            <div style="display:grid;gap:10px">
              ${filteredJunkUsers.map((u) => {
                const reason = !u.is_active ? 'Pasif kullanıcı' : 'Aktif personel bağlantısı yok';
                return `
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 14px;border:1px solid #fecaca;background:#fff;border-radius:12px">
                    <div style="min-width:0;flex:1 1 260px">
                      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:4px">
                        <strong>${esc(u.full_name || '—')}</strong>
                        <code>${esc(u.username || '—')}</code>
                        <span class="status-badge status-left">${esc(reason)}</span>
                      </div>
                      <div style="font-size:12px;color:var(--text-3)">
                        Rol: ${esc(roleMap[u.role] || u.role)} · Şirket: ${esc(u.company_name || 'Yok')} · Departman: ${esc(u.department || 'Yok')}
                      </div>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
                      ${!u.is_active ? `<button class="btn-secondary" style="font-size:11px;padding:6px 10px" onclick="restoreUser(${u.id})">Geri Etkinleştir</button>` : ''}
                      <button class="btn-text" style="color:#ef4444;font-size:11px" onclick="purgeUser(${u.id})">Kalıcı Sil</button>
                    </div>
                  </div>
                `;
              }).join('')}
              ${filteredJunkPersonnel.map((p) => `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 14px;border:1px solid #fde68a;background:#fffdf5;border-radius:12px">
                  <div style="min-width:0;flex:1 1 260px">
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:4px">
                      <strong>${esc(p.full_name || '—')}</strong>
                      <span class="status-badge status-left">Pasif personel kaydı</span>
                    </div>
                    <div style="font-size:12px;color:var(--text-3)">
                      Şirket: ${esc(p.company_name || 'Yok')} · Ünvan: ${esc(p.title || 'Yok')} · Departman: ${esc(p.department || 'Yok')}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    }
    return;
  }

  if (junkSection) {
    junkSection.style.display = 'none';
    junkSection.innerHTML = '';
  }

  // Diğer roller için basit personel görünümü
  const personnel = await api.getPersonnel({ active_only: 'false' });
  if (currentLoadVersion !== personnelLoadVersion) return;

  if (hostsActionBtn) {
    hostsActionBtn.setAttribute('onclick', 'showHostModal()');
    hostsActionBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Personel Ekle`;
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
      <div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#1a56db,#0891b2);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:700;margin:0 auto 12px">${esc(p.full_name[0])}</div>
      <div style="font-weight:700;font-size:15px;margin-bottom:4px">${esc(p.full_name)}</div>
      <div style="font-size:12px;color:var(--primary);margin-bottom:4px">${esc(p.title)||'—'}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">${esc(p.company_name)||''}</div>
      ${p.phone ? `<div style="font-size:12px;color:var(--text-muted)">📞 ${esc(p.phone)}</div>` : ''}
      ${p.email ? `<div style="font-size:12px;color:var(--text-muted)">✉️ ${esc(p.email)}</div>` : ''}
    </div>`).join('') : '<div class="empty-state">Personel bulunamadı</div>';
}

async function showHostModal(id = null) {
  let p = { full_name:'', title:'', company_name:'', department:'', phone:'', email:'', is_active:1 };
  if (id) p = await api.getPersonnel({ active_only:'false' }).then(list => list.find(x => x.id == id));

  showModal(id ? 'Personel Düzenle' : 'Yeni Personel', `
    <div style="display:grid;gap:14px">
      <div class="form-row">
        <div class="form-group"><label>Ad Soyad *</label><input type="text" id="ph-name" class="form-input" value="${esc(p.full_name)}"/></div>
        <div class="form-group"><label>Ünvan</label><input type="text" id="ph-title" class="form-input" value="${esc(p.title)||''}"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Firma *</label>
          <input type="text" id="ph-company" class="form-input" value="${esc(p.company_name)||''}" placeholder="Şirket adı yazın..."/>
        </div>
        <div class="form-group"><label>Departman</label><input type="text" id="ph-dept" class="form-input" value="${esc(p.department)||''}"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Telefon</label><input type="text" id="ph-phone" class="form-input" value="${esc(p.phone)||''}"/></div>
        <div class="form-group"><label>E-posta</label><input type="email" id="ph-email" class="form-input" value="${esc(p.email)||''}"/></div>
      </div>
      <div class="form-group">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="ph-active" ${p.is_active?'checked':''} /> Aktif Personel
        </label>
      </div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="closeModal()">İptal</button>
        <button class="btn-primary" onclick="withButtonLock(this, function(){ return saveHost(${id}) })">Kaydet</button>
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

async function deleteUser(id) {
  if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz? (Pasif duruma getirilecektir)')) return;
  try {
    await api.deleteUser(id);
    showToast('Kullanıcı silindi');
    await loadPersonnel();
  } catch (e) { showToast(e.message, 'error'); }
}

async function restoreUser(id) {
  if (!confirm('Bu kullanıcı yeniden aktif hale getirilsin mi?')) return;
  try {
    await api.updateUser(id, { is_active: 1 });
    showToast('Kullanıcı yeniden aktif edildi');
    await loadPersonnel();
  } catch (e) { showToast(e.message, 'error'); }
}

async function purgeUser(id) {
  if (!confirm('Bu junk kullanıcı kalıcı olarak silinsin mi? Bu işlem geri alınamaz ve kullanıcı adı yeniden kullanılabilir hale gelir.')) return;
  try {
    await api.purgeUser(id);
    showToast('Junk kullanıcı kalıcı olarak silindi');
    await loadPersonnel();
  } catch (e) { showToast(e.message, 'error'); }
}

function setPersonnelUserSearch(value) {
  personnelUserSearch = value || '';
  if (personnelUserSearchTimer) clearTimeout(personnelUserSearchTimer);
  personnelUserSearchTimer = setTimeout(() => {
    loadPersonnel();
  }, 120);
}

