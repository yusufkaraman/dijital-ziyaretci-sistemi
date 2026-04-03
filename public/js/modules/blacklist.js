// ── KARA LİSTE ────────────────────────────────────────
async function loadBlacklist() {
  const list = await api.getBlacklist();
  const tbody = document.getElementById('blacklist-tbody');
  tbody.innerHTML = list.length ? list.map(b => `
    <tr>
      <td><strong>${b.full_name}</strong></td>
      <td>${b.tc_no||'—'}</td>
      <td>${b.company||'—'}</td>
      <td><span style="color:#ef4444">${b.reason||'—'}</span></td>
      <td>${formatDate(b.created_at)}</td>
      <td><button class="btn-secondary" style="color:#ef4444;font-size:12px;padding:5px 10px" onclick="removeFromBlacklist(${b.id})">Kaldır</button></td>
    </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">Kara liste boş</td></tr>';
}

async function removeFromBlacklist(id) {
  if (!confirm('Kara listeden kaldırmak emin misiniz?')) return;
  await api.deleteBlacklist(id);
  showToast('Kara listeden kaldırıldı'); loadBlacklist();
}

function showBlacklistModal() {
  showModal('Kara Listeye Ekle', `
    <div style="display:grid;gap:14px">
      <div class="form-row">
        <div class="form-group"><label>Ad Soyad *</label><input type="text" id="bl-name" class="form-input"/></div>
        <div class="form-group"><label>TC Kimlik</label><input type="text" id="bl-tc" class="form-input" maxlength="11"/></div>
      </div>
      <div class="form-group"><label>Firma</label><input type="text" id="bl-company" class="form-input"/></div>
      <div class="form-group"><label>Sebep *</label><textarea id="bl-reason" class="form-input" rows="2"></textarea></div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="closeModal()">İptal</button>
        <button class="btn-primary" style="background:linear-gradient(135deg,#ef4444,#dc2626)" onclick="addToBlacklist()">Kara Listeye Ekle</button>
      </div>
    </div>`);
}

async function addToBlacklist() {
  const body = {
    full_name: document.getElementById('bl-name').value,
    tc_no: document.getElementById('bl-tc').value,
    company: document.getElementById('bl-company').value,
    reason: document.getElementById('bl-reason').value
  };
  if (!body.full_name) { showToast('Ad soyad zorunlu!', 'error'); return; }
  await api.addBlacklist(body);
  closeModal(); showToast('⛔ Kara listeye eklendi'); loadBlacklist();
}

