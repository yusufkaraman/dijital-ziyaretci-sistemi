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

