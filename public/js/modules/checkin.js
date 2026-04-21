// ── CHECK-IN ──────────────────────────────────────────
function normalizeText(value) {
  return (value || '')
    .toString()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildHostSuggestionList(personnel, companyName, queryText, options) {
  const opts = options || {};
  const useCompanyFilter = opts.useCompanyFilter === true;
  const normalizedCompany = normalizeText(companyName);
  const companyScoped = useCompanyFilter && normalizedCompany
    ? personnel.filter((p) => normalizeText(p.company_name) === normalizedCompany)
    : personnel;

  // Seçili şirkette kayıt yoksa önerileri boş bırakma; tüm personeli geri getir.
  const source = companyScoped.length ? companyScoped : personnel;

  const normalizedQuery = normalizeText(queryText);

  const base = source.map((p) => {
    const companyPart = p.company_name ? ` | ${p.company_name}` : '';
    const titlePart = p.title ? ` - ${p.title}` : '';
    return {
      id: p.id,
      label: p.full_name,
      displayLabel: `${p.full_name}${titlePart}${companyPart}`,
      searchableName: normalizeText(p.full_name),
      searchableLabel: normalizeText(`${p.full_name} ${p.title || ''} ${p.company_name || ''}`),
    };
  });

  if (!normalizedQuery) return base;

  const startsWith = base.filter((s) => s.searchableName.startsWith(normalizedQuery));
  const contains = base.filter((s) => !s.searchableName.startsWith(normalizedQuery) && s.searchableLabel.includes(normalizedQuery));
  return startsWith.concat(contains);
}

function fillHostDatalist(datalistId, suggestions) {
  const datalist = document.getElementById(datalistId);
  if (!datalist) return;
  datalist.innerHTML = suggestions.map((s) => `<option value="${esc(s.label)}">${esc(s.displayLabel)}</option>`).join('');
}

function resolveHostIdFromText(inputText, suggestions) {
  const normalizedInput = normalizeText(inputText);
  if (!normalizedInput) return null;

  const exact = suggestions.find((s) => normalizeText(s.label) === normalizedInput);
  if (exact) return exact.id;

  const startsWith = suggestions.find((s) => s.searchableName.startsWith(normalizedInput));
  if (startsWith) return startsWith.id;

  const contains = suggestions.find((s) => s.searchableName.includes(normalizedInput));
  return contains ? contains.id : null;
}

function setupHostSuggestionInput({ inputId, hiddenId, datalistId, personnelProvider, companyProvider }) {
  const hostInput = document.getElementById(inputId);
  const hiddenInput = document.getElementById(hiddenId);
  if (!hostInput || !hiddenInput) return;

  const refreshSuggestions = () => {
    const allPersonnel = typeof personnelProvider === 'function' ? personnelProvider() : [];
    const companyName = typeof companyProvider === 'function' ? companyProvider() : '';
    const inputText = hostInput.value || '';
    const suggestions = buildHostSuggestionList(allPersonnel, companyName, inputText, { useCompanyFilter: false }).slice(0, 100);
    fillHostDatalist(datalistId, suggestions);

    const resolvedId = resolveHostIdFromText(inputText, suggestions);
    hiddenInput.value = resolvedId ? String(resolvedId) : '';
  };

  hostInput.oninput = refreshSuggestions;
  hostInput.onblur = refreshSuggestions;
  refreshSuggestions();
}

async function loadCheckinPage() {
  const [personnel, companies] = await Promise.all([
    api.getPersonnel({ active_only: 'true' }),
    api.getCompanies({ active_only: 'true' }),
  ]);

  // Personel listesini isim bazında tekilleştir (aynı kişi birden fazla şirkette görünmesin)
  const seen = new Map();
  personnel.forEach(p => {
    const key = (p.full_name || '').trim().toLocaleLowerCase('tr-TR');
    if (!seen.has(key)) seen.set(key, p);
  });
  personnelCache = Array.from(seen.values());
  companyCache = companies;

  const companySelect = document.getElementById('ci-company');
  if (companySelect) {
    companySelect.innerHTML = '<option value="">Seçiniz...</option>' +
      companyCache.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  }

  // Preview updater
  const nameInput = document.getElementById('ci-name');
  const visitorCompInput = document.getElementById('ci-visitor-company');
  if (nameInput) nameInput.oninput = updatePreview;
  if (visitorCompInput) visitorCompInput.oninput = updatePreview;

  setupHostSuggestionInput({
    inputId: 'ci-host-text',
    hiddenId: 'ci-host-id',
    datalistId: 'ci-host-suggestions',
    personnelProvider: () => personnelCache,
    companyProvider: () => {
      const selectedId = document.getElementById('ci-company')?.value || '';
      const selectedCompany = companyCache.find((c) => String(c.id) === String(selectedId));
      return selectedCompany?.name || '';
    },
  });

  if (companySelect) {
    companySelect.onchange = () => {
      const hostInput = document.getElementById('ci-host-text');
      const hostIdInput = document.getElementById('ci-host-id');
      if (hostInput) hostInput.value = '';
      if (hostIdInput) hostIdInput.value = '';
      const evt = new Event('input');
      if (hostInput) hostInput.dispatchEvent(evt);
    };
  }

  loadRecentCheckins();
}

function updatePreview() {
  const name = document.getElementById('ci-name').value || 'Ad Soyad';
  const comp = document.getElementById('ci-visitor-company').value || 'Çalıştığı Şirket';
  document.getElementById('preview-name').textContent = name;
  document.getElementById('preview-company').textContent = comp;
  document.getElementById('preview-avatar').textContent = name[0] || '?';
}

async function loadRecentCheckins() {
  const list = await api.getVisitors({ date: 'today', status: 'inside' });
  const el = document.getElementById('recent-checkins-list');
  el.innerHTML = list.slice(0, 5).map(v => `
    <div class="visitor-row" style="padding:10px 0;cursor:pointer" onclick="showVisitorDetail(${v.id})">
      <div class="visitor-avatar" style="width:28px;height:28px;font-size:11px">${esc(v.full_name)[0]}</div>
      <div class="visitor-info"><div style="font-size:13px;font-weight:500">${esc(v.full_name)}</div><div style="font-size:11px;color:var(--text-muted)">${visitorTimeSummary(v)}</div></div>
    </div>`).join('') || '<div class="empty-state" style="font-size:12px">Henüz giriş yok</div>';
}

async function checkBlacklist(tc) {
  const alert = document.getElementById('blacklist-alert');
  if (tc.length < 11) { alert.style.display = 'none'; return; }
  const result = await api.checkBlacklist(tc);
  alert.style.display = result.blacklisted ? 'block' : 'none';
  if (result.blacklisted) alert.textContent = `⛔ DİKKAT! Bu TC kara listede! Sebep: ${result.entry.reason || 'Belirtilmemiş'}`;
}

let _checkInBusy = false;
async function checkInVisitor() {
  if (_checkInBusy) return;
  _checkInBusy = true;
  try { await _doCheckIn(); } finally { _checkInBusy = false; }
}

async function _doCheckIn() {
  const name = document.getElementById('ci-name').value.trim();
  const tc = document.getElementById('ci-tc').value.trim();
  const phone = document.getElementById('ci-phone').value.trim();
  const email = document.getElementById('ci-email').value.trim();
  const visitorCompany = (document.getElementById('ci-visitor-company').value || '').trim();
  const visitedCompanyId = (document.getElementById('ci-company').value || '').trim();
  const selectedCompany = companyCache.find((c) => String(c.id) === String(visitedCompanyId));
  const company = selectedCompany?.name || '';
  let host_id = document.getElementById('ci-host-id').value;
  const hostText = (document.getElementById('ci-host-text').value || '').trim();
  const reason = document.getElementById('ci-reason').value;
  const plate = document.getElementById('ci-plate').value.trim();
  const count = document.getElementById('ci-count').value;
  const notes = document.getElementById('ci-notes').value.trim();
  const send_email = false;

  if (!host_id && hostText) {
    const suggestions = buildHostSuggestionList(personnelCache, company, hostText, { useCompanyFilter: false });
    const resolvedId = resolveHostIdFromText(hostText, suggestions);
    if (resolvedId) host_id = String(resolvedId);
  }

  if (!name) { showToast('Ad Soyad zorunlu!', 'error'); return; }
  if (tc && !isValidTC(tc)) { showToast('TC kimlik numarası 11 haneli rakamlardan oluşmalıdır.', 'error'); return; }
  if (phone && !isValidPhone(phone)) { showToast('Geçerli bir telefon numarası giriniz (10-11 hane).', 'error'); return; }
  if (email && !isValidEmail(email)) { showToast('Geçerli bir e-posta adresi giriniz.', 'error'); return; }
  if (!host_id) { showToast('Görüşülecek personel seçiniz veya önerilerden bir isim giriniz.', 'error'); return; }
  if (!reason) { showToast('Ziyaret sebebi seçiniz!', 'error'); return; }

  try {
    const v = await api.createVisitor({
      full_name: name, tc_no: tc, phone, email,
      company_name: visitorCompany || null, visited_company_id: visitedCompanyId ? Number(visitedCompanyId) : null, host_personnel_id: host_id||null,
      reason, vehicle_plate: plate, visitor_count: count,
      notes, send_email: send_email
    });
    showToast(`✅ ${name} giriş kaydı oluşturuldu.`);
    if (document.getElementById('preview-status')) {
      document.getElementById('preview-status').textContent = 'Onaylandı';
      document.getElementById('preview-status').style.background = 'rgba(16, 185, 129, 0.2)';
      document.getElementById('preview-status').style.color = '#10b981';
    }
    clearCheckinForm();
    loadRecentCheckins();
    // Dashboard'u da güncelle (sayaçlar, listeler)
    if (typeof refreshDashboard === 'function') refreshDashboard();
  } catch (e) {
    if (e.message.includes('KARALİSTE')) {
      document.getElementById('blacklist-alert').style.display = 'block';
      document.getElementById('blacklist-alert').textContent = '⛔ ' + e.message;
    }
    showToast(e.message, 'error');
  }
}

function clearCheckinForm() {
  ['ci-name','ci-tc','ci-phone','ci-email','ci-visitor-company','ci-company','ci-plate','ci-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const hostText = document.getElementById('ci-host-text');
  const hostId = document.getElementById('ci-host-id');
  if (hostText) hostText.value = '';
  if (hostId) hostId.value = '';
  document.getElementById('ci-reason').value = '';
  document.getElementById('ci-count').value = '1';
  document.getElementById('blacklist-alert').style.display = 'none';
  document.getElementById('preview-name').textContent = 'Ad Soyad';
  document.getElementById('preview-company').textContent = 'Çalıştığı Şirket';
  document.getElementById('preview-avatar').textContent = '?';
  document.getElementById('preview-status').textContent = 'Giriş Bekleniyor';
  document.getElementById('preview-status').style.background = '';
  document.getElementById('preview-status').style.color = '';
}

