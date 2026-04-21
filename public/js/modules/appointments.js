// ── RANDEVULAR ────────────────────────────────────────

async function loadPendingApprovals() {
  const section = document.getElementById('pending-approvals-section');
  if (!section) return;
  try {
    const pending = await api.getAppointments({ status: 'pending_approval', range: 'all' });
    if (!pending.length) {
      section.innerHTML = '';
      return;
    }
    section.innerHTML = `
      <div style="background:linear-gradient(135deg,rgba(245,158,11,0.08),rgba(217,119,6,0.05));border:1px solid rgba(245,158,11,0.3);border-radius:16px;padding:20px;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
          <span style="font-size:22px">⏳</span>
          <div>
            <div style="font-weight:800;font-size:16px;color:#92400e">Onay Bekleyen Randevular (${pending.length})</div>
            <div style="font-size:12px;color:#b45309">Personel tarafından oluşturulan randevu talepleri</div>
          </div>
        </div>
        <div style="display:grid;gap:12px">
          ${pending.map(a => `
            <div class="appointment-card" id="pending-appt-${a.id}" style="background:#fff;border:1px solid rgba(245,158,11,0.2);border-radius:12px;padding:16px;display:flex;gap:14px;align-items:flex-start">
              ${renderCalendarBlock(a.planned_time)}
              <div style="flex:1;cursor:pointer" onclick="showAppointmentDetail(${a.id})">
                <div style="font-weight:700;font-size:15px;margin-bottom:3px">${esc(a.visitor_name)}</div>
                <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">
                  Firma: ${esc(a.visitor_company)||'—'} · Görüşülen: ${esc(a.host_name)||'—'}
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  <span style="font-size:11px;padding:2px 7px;border-radius:6px;background:rgba(56,189,248,0.12);color:#0369a1">👤 ${esc(a.host_name) || '—'}</span>
                  <span style="font-size:11px;padding:2px 7px;border-radius:6px;background:rgba(26,86,219,0.1);color:#1a56db">🕐 ${formatTime(a.planned_time)}</span>
                  <span style="font-size:11px;padding:2px 7px;border-radius:6px;background:rgba(16,185,129,0.1);color:#10b981">📋 ${esc(a.reason)||'—'}</span>
                  <span class="status-badge status-pending_approval" style="background:rgba(245,158,11,0.15);color:#92400e;font-size:11px;padding:2px 8px;border-radius:6px;font-weight:700">Onay Bekliyor</span>
                </div>
              </div>
              <div style="display:flex;flex-direction:column;gap:6px">
                <button class="btn-primary" style="font-size:12px;padding:6px 14px;background:#10b981;border-color:#10b981" onclick="approveAppt(${a.id})">✓ Onayla</button>
                <button class="btn-secondary" style="font-size:12px;padding:6px 14px;color:#dc2626" onclick="cancelAppt(${a.id})">✕ Reddet</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
  } catch (e) {
    console.warn('Onay bekleyenler:', e.message);
  }
}

async function approveAppt(id) {
  try {
    await api.approveAppointment(id);
    showToast('Randevu onaylandı');
    var row = document.getElementById('pending-appt-' + id);
    if (row) row.remove();
    loadPendingApprovals();
    loadAppointments();
  } catch (e) {
    showToast(e.message || 'Onaylama başarısız', 'error');
  }
}

function renderCalendarBlock(dateStr) {
  if (!dateStr) return '<div style="width:52px;height:52px;border-radius:12px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;">?</div>';
  const d = new Date(dateStr);
  const months = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  return `<div style="width:52px;height:52px;border:1px solid rgba(0,96,240,0.15);border-radius:12px;overflow:hidden;background:#fff;display:flex;flex-direction:column;flex-shrink:0;box-shadow:0 4px 10px rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(135deg,#e11d48,#be123c);color:#fff;font-size:10px;font-weight:800;text-align:center;padding:4px 0;text-transform:uppercase;letter-spacing:1px;line-height:1;">${months[d.getMonth()]}</div>
    <div style="flex:1;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:var(--text);line-height:1;">${d.getDate()}</div>
  </div>`;
}

async function loadAppointments() {
  loadPendingApprovals();
  const params = { status: 'planned' };
  const dateFilter = appointmentDateFilter || 'future';
  if (dateFilter === 'future') {
    params.range = 'future';
  } else {
    params.range = dateFilter;
  }
  if (appointmentCompanyFilter && appointmentCompanyFilter !== 'all') {
    params.company = appointmentCompanyFilter;
  }

  const appointments = await api.getAppointments(params);
  appointments.sort((a, b) => new Date(a.planned_time) - new Date(b.planned_time));

  const filterContainer = document.getElementById('appointments-company-filters');
  if (filterContainer) {
    const allAppointments = await api.getAppointments({ status: 'planned', range: dateFilter });
    const companyList = Array.from(new Set(
      allAppointments
        .map((a) => (a.host_company_name || '').trim())
        .filter((name) => name.length > 0)
    )).sort((a, b) => a.localeCompare(b, 'tr'));

    const buttonHtml = ['all', ...companyList].map((companyName) => {
      const isAll = companyName === 'all';
      const label = isAll ? 'Tumu' : esc(companyName);
      const active = appointmentCompanyFilter === companyName;
      const bg = active ? 'var(--primary)' : 'var(--card-bg)';
      const fg = active ? '#fff' : 'var(--text)';
      const border = active ? 'var(--primary)' : 'var(--border)';
      return `<button class="btn-text" data-company-filter="${esc(companyName)}" style="border:1px solid ${border};background:${bg};color:${fg};padding:6px 10px;border-radius:999px;font-size:12px">${label}</button>`;
    }).join('');

    filterContainer.innerHTML = buttonHtml;
    filterContainer.querySelectorAll('[data-company-filter]').forEach((btn) => {
      btn.onclick = async () => {
        appointmentCompanyFilter = btn.getAttribute('data-company-filter') || 'all';
        await loadAppointments();
      };
    });
  }

  const grid = document.getElementById('appointments-grid');
  grid.innerHTML = appointments.length ? appointments.map(a => `
    <div class="appointment-card" style="background:var(--card-bg);border:1px solid var(--border);border-radius:16px;padding:20px;display:flex;gap:16px;align-items:flex-start">
      ${renderCalendarBlock(a.planned_time)}
      <div style="flex:1;cursor:pointer" onclick="showAppointmentDetail(${a.id})">
        <div style="font-weight:700;font-size:16px;margin-bottom:4px">${esc(a.visitor_name)}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px">Firma: ${esc(a.visitor_company)||'—'} · Görüşülen: ${esc(a.host_name)||'—'} (${esc(a.host_company_name) || 'Şirket bilgisi yok'})</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span style="font-size:12px;padding:3px 8px;border-radius:6px;background:rgba(56,189,248,0.12);color:#0369a1">👤 ${esc(a.host_name) || '—'}</span>
          <span style="font-size:12px;padding:3px 8px;border-radius:6px;background:rgba(168,85,247,0.12);color:#7e22ce">🏢 ${esc(a.host_company_name) || 'Şirket yok'}</span>
          <span style="font-size:12px;padding:3px 8px;border-radius:6px;background:rgba(26,86,219,0.1);color:#1a56db">🕐 ${formatTime(a.planned_time)}</span>
          <span style="font-size:12px;padding:3px 8px;border-radius:6px;background:rgba(16,185,129,0.1);color:#10b981">📋 ${esc(a.reason)||'—'}</span>
          <span class="status-badge status-${a.status}">${apptStatusLabel(a.status)}</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="btn-calendar" onclick='openGoogleCalendar(${JSON.stringify(a).replace(/'/g, "\\'")})'><span>📅</span> Takvime Ekle</button>
        ${a.status==='planned' ? `<button class="btn-secondary" style="font-size:12px;padding:6px 10px" onclick="cancelAppt(${a.id})">İptal</button>` : ''}
      </div>
    </div>`).join('') : '<div class="empty-state" style="padding:64px;text-align:center">📅 Randevu bulunamadı</div>';
}

function changeAppointmentDateFilter(value) {
  appointmentDateFilter = value || 'future';
  loadAppointments();
}

function showAppointmentModal() {
  const now = new Date();
  const localDefault = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  showModal('Yeni Randevu', `
    <div style="display:grid;gap:14px">
      <div class="form-row">
        <div class="form-group"><label>Ad ve Soyad *</label><input type="text" id="appt-name" class="form-input" placeholder="Ad Soyad"/></div>
        <div class="form-group"><label>Telefon</label><input type="text" id="appt-phone" class="form-input" placeholder="0555 000 00 00"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Çalıştığı Şirket / Kurum</label><input type="text" id="appt-visitor-company" class="form-input" placeholder="ABC Şirketi"/></div>
        <div class="form-group"><label>Ziyaret Edilen Şirket</label>
          <select id="appt-company" class="form-input"><option value="">Yükleniyor...</option></select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Görüşülecek Personel</label>
          <input type="text" id="appt-host-text" class="form-input" list="appt-host-suggestions" placeholder="İsim yazın, sistem önersin..." />
          <datalist id="appt-host-suggestions"></datalist>
          <input type="hidden" id="appt-host-id" />
        </div>
        <div class="form-group"><label>Sebep</label><select id="appt-reason" class="form-input"><option value="">Seçiniz...</option><option>İş Görüşmesi</option><option>Toplantı</option><option>Teslimat</option><option>Teknik Destek</option><option>Danışma</option><option>Denetim</option><option>Diğer</option></select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Tarih & Saat *</label><input type="datetime-local" id="appt-time" class="form-input" value="${localDefault}"/></div>
      </div>
      <div class="form-actions">
        <button class="btn-secondary" onclick="closeModal()">İptal</button>
        <button class="btn-primary" onclick="saveAppointment()">Randevu Oluştur</button>
      </div>
    </div>`);

  Promise.all([
    api.getPersonnel({ active_only: 'false' }),
    api.getCompanies({ active_only: 'true' }),
  ])
    .then(([personnel, companies]) => {
      const seen = new Map();
      personnel.forEach((p) => {
        const key = (p.full_name || '').trim().toLocaleLowerCase('tr-TR');
        if (!seen.has(key)) seen.set(key, p);
      });
      appointmentPersonnelCache = Array.from(seen.values());
      const companySelect = document.getElementById('appt-company');
      if (companySelect) {
        companySelect.innerHTML = '<option value="">Seçiniz...</option>' +
          companies.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
      }

      setupHostSuggestionInput({
        inputId: 'appt-host-text',
        hiddenId: 'appt-host-id',
        datalistId: 'appt-host-suggestions',
        personnelProvider: () => appointmentPersonnelCache,
        companyProvider: () => {
          const selectedId = document.getElementById('appt-company')?.value || '';
          const selectedCompany = companies.find((c) => String(c.id) === String(selectedId));
          return selectedCompany?.name || '';
        },
      });

      if (companySelect) {
        companySelect.onchange = () => {
          const hostInput = document.getElementById('appt-host-text');
          const hostIdInput = document.getElementById('appt-host-id');
          if (hostInput) hostInput.value = '';
          if (hostIdInput) hostIdInput.value = '';
          const evt = new Event('input');
          if (hostInput) hostInput.dispatchEvent(evt);
        };
      }
    })
    .catch((e) => {
      const companySelect = document.getElementById('appt-company');
      if (companySelect) companySelect.innerHTML = '<option value="">Şirket listesi yüklenemedi</option>';
      showToast(e.message || 'Form verileri yüklenemedi', 'error');
    });
}

let _saveApptBusy = false;
async function saveAppointment() {
  if (_saveApptBusy) return;
  _saveApptBusy = true;
  try { await _doSaveAppointment(); } finally { _saveApptBusy = false; }
}

async function _doSaveAppointment() {
  const rawName = (document.getElementById('appt-name')?.value || '').trim();
  const rawPhone = (document.getElementById('appt-phone')?.value || '').trim();
  const rawVisitorCompany = (document.getElementById('appt-visitor-company')?.value || '').trim();
  const rawVisitedCompanyId = (document.getElementById('appt-company')?.value || '').trim();
  const rawHostCompany = rawVisitedCompanyId
    ? (document.getElementById('appt-company')?.selectedOptions?.[0]?.text || '').trim()
    : '';
  let rawHost = document.getElementById('appt-host-id')?.value || '';
  const rawHostText = (document.getElementById('appt-host-text')?.value || '').trim();
  const rawTime = (document.getElementById('appt-time')?.value || '').trim();
  const rawReason = (document.getElementById('appt-reason')?.value || '').trim();

  if (!rawName || !rawTime) {
    showToast('Ad ve saat zorunlu!', 'error');
    return;
  }
  if (rawPhone && !isValidPhone(rawPhone)) {
    showToast('Geçerli bir telefon numarası giriniz (10-11 hane).', 'error');
    return;
  }

  if (!rawHost && rawHostText) {
    const suggestions = buildHostSuggestionList(appointmentPersonnelCache, rawHostCompany, rawHostText);
    const resolvedId = resolveHostIdFromText(rawHostText, suggestions);
    if (resolvedId) rawHost = String(resolvedId);
  }

  // datetime-local değeri backend tarafı için SQLite uyumlu formata dönüştür.
  let normalizedTime = rawTime.replace('T', ' ');
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(normalizedTime)) {
    normalizedTime += ':00';
  }

  const body = {
    visitor_name: rawName,
    visitor_phone: rawPhone || null,
    visitor_company: rawVisitorCompany || null,
    visited_company_id: rawVisitedCompanyId ? Number(rawVisitedCompanyId) : null,
    host_personnel_id: rawHost ? Number(rawHost) : null,
    planned_time: normalizedTime,
    reason: rawReason || null
  };

  try {
    await api.createAppointment(body);
    closeModal();
    showToast('✅ Randevu oluşturuldu!');
    await loadAppointments();
  } catch (e) {
    showToast(e.message || 'Randevu kaydedilemedi', 'error');
  }
}

async function showAppointmentDetail(id) {
  const appointments = await api.getAppointments({ range: 'all' });
  const a = appointments.find(x => x.id == id);
  if (!a) return;
  showModal(`📅 ${esc(a.visitor_name)}`, `
    <div style="display:grid;gap:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Ziyaretçi</div><div>${esc(a.visitor_name)}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Telefon</div><div>${esc(a.visitor_phone)||'—'}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Ziyaretçi Firması</div><div>${esc(a.visitor_company)||'—'}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Görüşülen</div><div>${esc(a.host_name)||'—'}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Görüşülen Firma</div><div>${esc(a.host_company_name)||'—'}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Ziyaret Sebebi</div><div>${esc(a.reason)||'—'}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Planlanan Tarih</div><div>${formatDate(a.planned_time)} ${formatTime(a.planned_time)}</div></div>
        <div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Durum</div><span class="status-badge status-${a.status}">${apptStatusLabel(a.status)}</span></div>
      </div>
      ${a.notes ? `<div><div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Notlar</div><div>${esc(a.notes)}</div></div>` : ''}
      <div style="display:flex;gap:10px;margin-top:8px">
        ${a.status==='pending_approval' ? `<button class="btn-primary" style="background:var(--green);border:none" onclick="approveAppt(${a.id});closeModal()">✅ Onayla</button> <button class="btn-secondary" style="color:var(--red);border-color:#fecaca" onclick="cancelAppt(${a.id});closeModal()">❌ Reddet</button>` : ''}
        ${a.status==='planned' ? `<button class="btn-secondary" onclick="cancelAppt(${a.id});closeModal()">İptal Et</button> <button class="btn-calendar" onclick='openGoogleCalendar(${JSON.stringify(a).replace(/'/g, "\\\'")}); closeModal()'>📅 Takvime Ekle</button>` : ''}
      </div>
    </div>`);
}

async function cancelAppt(id) {
  if (!confirm('Randevu iptal edilsin mi?')) return;
  await api.cancelAppointment(id);
  showToast('Randevu iptal edildi'); loadAppointments();
}

function openGoogleCalendar(a) {
  const start = new Date(a.planned_time).toISOString().replace(/-|:|\.\d+/g, '').replace('000Z','Z');
  const end = new Date(new Date(a.planned_time).getTime() + 3600000).toISOString().replace(/-|:|\.\d+/g, '').replace('000Z','Z');
  const summary = encodeURIComponent(`Randevu: ${a.visitor_name}`);
  const details = encodeURIComponent(`Firma: ${a.visitor_company||'—'}\nEv Sahibi: ${a.host_name||'—'}\nNeden: ${a.reason||'—'}`);
  let url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${summary}&dates=${start}/${end}&details=${details}&location=Simsoft+Ofis&sf=true&output=xml`;
  if (a.host_email) url += `&add=${encodeURIComponent(a.host_email)}`;
  window.open(url, '_blank');
}

function downloadICS(a) {
  const start = new Date(a.planned_time).toISOString().replace(/-|:|\.\d+/g, '');
  const end = new Date(new Date(a.planned_time).getTime() + 3600000).toISOString().replace(/-|:|\.\d+/g, '');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Simsoft//Management//TR',
    'BEGIN:VEVENT',
    `UID:appt-${a.id}@simsoft.com`,
    `DTSTAMP:${new Date().toISOString().replace(/-|:|\.\d+/g, '')}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:Randevu: ${a.visitor_name}`,
    `DESCRIPTION:Randevu Talebi\\nFirma: ${a.visitor_company||'—'}\\nEv Sahibi: ${a.host_name||'—'}\\nNeden: ${a.reason||'—'}`,
    'LOCATION:Simsoft Ofis',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `randevu-${a.visitor_name.replace(/\s+/g, '-')}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

window.loadAppointments = loadAppointments;
window.showAppointmentModal = showAppointmentModal;
window.saveAppointment = saveAppointment;
window.showAppointmentDetail = showAppointmentDetail;
window.cancelAppt = cancelAppt;
window.changeAppointmentDateFilter = changeAppointmentDateFilter;
window.approveAppt = approveAppt;
window.openGoogleCalendar = openGoogleCalendar;
window.downloadICS = downloadICS;

