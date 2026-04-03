// ── RANDEVULAR ────────────────────────────────────────
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
  const params = { status: 'planned' };
  if (appointmentCompanyFilter && appointmentCompanyFilter !== 'all') {
    params.company = appointmentCompanyFilter;
  }

  const appointments = await api.getAppointments(params);
  appointments.sort((a, b) => new Date(a.planned_time) - new Date(b.planned_time));

  const filterContainer = document.getElementById('appointments-company-filters');
  if (filterContainer) {
    const allAppointments = await api.getAppointments({ status: 'planned' });
    const companyList = Array.from(new Set(
      allAppointments
        .map((a) => (a.visitor_company || '').trim())
        .filter((name) => name.length > 0)
    )).sort((a, b) => a.localeCompare(b, 'tr'));

    const buttonHtml = ['all', ...companyList].map((companyName) => {
      const isAll = companyName === 'all';
      const label = isAll ? 'Tumu' : companyName;
      const active = appointmentCompanyFilter === companyName;
      const bg = active ? 'var(--primary)' : 'var(--card-bg)';
      const fg = active ? '#fff' : 'var(--text)';
      const border = active ? 'var(--primary)' : 'var(--border)';
      return `<button class="btn-text" data-company-filter="${companyName}" style="border:1px solid ${border};background:${bg};color:${fg};padding:6px 10px;border-radius:999px;font-size:12px">${label}</button>`;
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
      <div style="flex:1">
        <div style="font-weight:700;font-size:16px;margin-bottom:4px">${a.visitor_name}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px">Firma: ${a.visitor_company||'—'} · Görüşülen: ${a.host_name||'—'} (${a.host_company_name || 'Şirket bilgisi yok'})</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span style="font-size:12px;padding:3px 8px;border-radius:6px;background:rgba(56,189,248,0.12);color:#0369a1">👤 ${a.host_name || '—'}</span>
          <span style="font-size:12px;padding:3px 8px;border-radius:6px;background:rgba(168,85,247,0.12);color:#7e22ce">🏢 ${a.host_company_name || 'Şirket yok'}</span>
          <span style="font-size:12px;padding:3px 8px;border-radius:6px;background:rgba(26,86,219,0.1);color:#1a56db">🕐 ${formatTime(a.planned_time)}</span>
          <span style="font-size:12px;padding:3px 8px;border-radius:6px;background:rgba(16,185,129,0.1);color:#10b981">📋 ${a.reason||'—'}</span>
          <span class="status-badge status-${a.status}">${apptStatusLabel(a.status)}</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="btn-calendar" onclick='openGoogleCalendar(${JSON.stringify(a).replace(/'/g, "\\'")})'><span>📅</span> Takvime Ekle</button>
        ${a.status==='planned' ? `<button class="btn-secondary" style="font-size:12px;padding:6px 10px" onclick="cancelAppt(${a.id})">İptal</button>` : ''}
      </div>
    </div>`).join('') : '<div class="empty-state" style="padding:64px;text-align:center">📅 Randevu bulunamadı</div>';
}

function showAppointmentModal() {
  const localDefault = new Date(Date.now() + 3600000).toISOString().slice(0, 16);
  showModal('Yeni Randevu', `
    <div style="display:grid;gap:14px">
      <div class="form-row">
        <div class="form-group"><label>Ad ve Soyad *</label><input type="text" id="appt-name" class="form-input" placeholder="Ad Soyad"/></div>
        <div class="form-group"><label>Telefon</label><input type="text" id="appt-phone" class="form-input" placeholder="0555 000 00 00"/></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Firma</label>
          <select id="appt-company" class="form-input"><option value="">Yükleniyor...</option></select>
        </div>
        <div class="form-group"><label>Görüşülecek Personel</label>
          <input type="text" id="appt-host-text" class="form-input" list="appt-host-suggestions" placeholder="İsim yazın, sistem önersin..." />
          <datalist id="appt-host-suggestions"></datalist>
          <input type="hidden" id="appt-host-id" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Tarih & Saat *</label><input type="datetime-local" id="appt-time" class="form-input" value="${localDefault}"/></div>
        <div class="form-group"><label>Sebep</label><input type="text" id="appt-reason" class="form-input" placeholder="Toplantı, Görüşme..."/></div>
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
      appointmentPersonnelCache = personnel;
      const companySelect = document.getElementById('appt-company');
      if (companySelect) {
        companySelect.innerHTML = '<option value="">Seçiniz...</option>' +
          companies.map((c) => `<option value="${c.name}">${c.name}</option>`).join('');
      }

      setupHostSuggestionInput({
        inputId: 'appt-host-text',
        hiddenId: 'appt-host-id',
        datalistId: 'appt-host-suggestions',
        personnelProvider: () => appointmentPersonnelCache,
        companyProvider: () => document.getElementById('appt-company')?.value || '',
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

async function saveAppointment() {
  const rawName = (document.getElementById('appt-name')?.value || '').trim();
  const rawPhone = (document.getElementById('appt-phone')?.value || '').trim();
  const rawCompany = (document.getElementById('appt-company')?.value || '').trim();
  let rawHost = document.getElementById('appt-host-id')?.value || '';
  const rawHostText = (document.getElementById('appt-host-text')?.value || '').trim();
  const rawTime = (document.getElementById('appt-time')?.value || '').trim();
  const rawReason = (document.getElementById('appt-reason')?.value || '').trim();

  if (!rawName || !rawTime) {
    showToast('Ad ve saat zorunlu!', 'error');
    return;
  }

  if (!rawHost && rawHostText) {
    const suggestions = buildHostSuggestionList(appointmentPersonnelCache, rawCompany, rawHostText);
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
    visitor_company: rawCompany || null,
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

