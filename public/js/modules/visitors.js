// ── ZİYARETÇİLER ──────────────────────────────────────
let allVisitors = [];
async function loadVisitors() {
  const dateFilter = document.getElementById('date-filter')?.value || 'today';
  allVisitors = await api.getVisitors({ date: dateFilter });
  renderVisitorsTable(allVisitors);
}

function renderVisitorsTable(list) {
  const tbody = document.getElementById('visitors-tbody');
  tbody.innerHTML = list.length ? list.map(v => `
    <tr>
      <td><div style="display:flex;align-items:center;gap:10px">
        <div class="visitor-avatar" style="width:32px;height:32px;font-size:12px;flex-shrink:0">${esc(v.full_name)[0]}</div>
        <div><div style="font-weight:600">${esc(v.full_name)}</div><div style="font-size:12px;color:var(--text-muted)">${esc(v.company_name)||'—'}</div></div>
      </div></td>
      <td>${esc(v.tc_no)||'—'}</td>
      <td>${esc(v.reason)||'—'}</td>
      <td>${esc(v.host_name)||'—'}</td>
      <td>${visitorTimeSummary(v)}</td>
      <td>${calcDuration(v)}</td>
      <td><span class="status-badge status-${v.status}">${statusLabel(v.status)}</span></td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${v.status==='waiting' && v.is_approved===0 ? `<button class="btn-primary" style="font-size:11px;padding:5px 10px;background:var(--green);border:none" onclick="withButtonLock(this, function(){ return verifyPersonnelGuest(${v.id}) })">✅ Onayla</button> <button class="btn-sm danger" onclick="withButtonLock(this, function(){ return declinePersonnelGuest(${v.id}) })">❌</button>` : ''}
          ${v.status==='waiting' && v.is_approved===1 ? `<button class="btn-primary" style="font-size:11px;padding:5px 10px" onclick="withButtonLock(this, function(){ return arrivedVisitor(${v.id}) })">Girdi ✓</button>` : ''}
          ${v.status==='inside' ? `<button class="btn-checkout-red" onclick="withButtonLock(this, function(){ return checkoutAction(${v.id}) })">Çıkış</button>` : ''}
          <button class="btn-icon" onclick="showVisitorDetail(${v.id})" title="Detay">👁</button>
        </div>
      </td>
    </tr>`).join('') : `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">Kayıtlı bilgiye ulaşılamadı.</td></tr>`;
}

function filterVisitors() {
  const search = document.getElementById('visitor-search').value.toLowerCase();
  const status = document.getElementById('status-filter').value;
  const statusMap = { 'İçeride':'inside','Çıktı':'left','Bekleniyor':'waiting' };
  let filtered = allVisitors;
  if (status) filtered = filtered.filter(v => v.status === (statusMap[status] || status));
  if (search) filtered = filtered.filter(v =>
    v.full_name.toLowerCase().includes(search) ||
    (v.tc_no||'').includes(search) || (v.company_name||'').toLowerCase().includes(search));
  renderVisitorsTable(filtered);
}

async function filterVisitorsDate() {
  await loadVisitors();
  filterVisitors();
}

// Global search
function globalSearch(val) {
  navigate('visitors');
  setTimeout(() => { document.getElementById('visitor-search').value = val; filterVisitors(); }, 100);
}

async function checkoutAction(id) {
  if (!confirm('Çıkış işlemini onaylıyor musunuz?')) return;
  await api.checkoutVisitor(id);
  showToast('Çıkış kaydedildi');
  loadVisitors();
}

async function showVisitorDetail(id) {
  const visitors = await api.getVisitors({});
  const v = visitors.find(x => x.id == id);
  if (!v) return;
  showModal(`👤 ${esc(v.full_name)}`, `
    <div style="display:grid;gap:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">TC / Kimlik</div><div>${esc(v.tc_no)||'—'}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Telefon</div><div>${esc(v.phone)||'—'}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Firma</div><div>${esc(v.company_name)||'—'}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Ziyaret Sebebi</div><div>${esc(v.reason)||'—'}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Görüşülen</div><div>${esc(v.host_name)||'—'}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Durum</div><span class="status-badge status-${v.status}">${statusLabel(v.status)}</span></div>
        <div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Giriş</div><div>${v.arrival_time ? formatTime(v.arrival_time) : '—'}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Çıkış</div><div>${v.checkout_time ? formatTime(v.checkout_time) : '—'}</div></div>
      </div>
      ${v.notes ? `<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Notlar</div><div>${esc(v.notes)}</div></div>` : ''}
      <div style="display:flex;gap:10px;margin-top:8px">
        ${v.status==='waiting' && v.is_approved===0 ? `<button class="btn-primary" style="background:var(--green);border:none" onclick="verifyPersonnelGuest(${v.id});closeModal()">✅ Onayla</button> <button class="btn-secondary" style="color:var(--red);border-color:#fecaca" onclick="declinePersonnelGuest(${v.id});closeModal()">❌ Reddet</button>` : ''}
        ${v.status==='waiting' && v.is_approved===1 ? `<button class="btn-primary" onclick="arrivedVisitor(${v.id});closeModal()">🚪 İçeri Al (Giriş)</button>` : ''}
        ${v.status==='inside' ? `<button class="btn-checkout-red" onclick="checkoutAction(${v.id});closeModal()" style="padding:10px 16px; font-size:13px">👋 Çıkış Yaptır</button>` : ''}
      </div>
    </div>`);
}

async function exportCSV() {
  try {
    const token = sessionStorage.getItem('vd_token');
    const res = await fetch('/api/logs/export', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('Export başarısız');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ziyaretci-rapor-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch(e) { showToast(e.message, 'error'); }
}

