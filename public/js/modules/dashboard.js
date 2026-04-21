async function refreshDashboard() {
  const [stats, visitors, appointments] = await Promise.all([
    api.getVisitorStats(),
    api.getVisitors({ date: 'today' }),
    api.getAppointments({ date: 'today', status: 'planned' })
  ]);

  // KPIs
  document.getElementById('kpi-today').textContent = stats.today_total;
  document.getElementById('kpi-active').textContent = stats.inside;
  document.getElementById('kpi-appointments').textContent = stats.appts_today;
  document.getElementById('kpi-screens').textContent = 1;
  document.getElementById('ws-active').textContent = stats.inside;
  document.getElementById('ws-today').textContent = stats.today_total;
  document.getElementById('ws-appts').textContent = stats.appts_today;

  // Son Girişler
  const rvl = document.getElementById('recent-visitors-list');
  const recent = visitors.slice(0, 5);
  rvl.innerHTML = recent.length ? recent.map(v => `
    <div class="visitor-row" style="cursor:pointer">
      <div class="visitor-avatar">${esc(v.full_name)[0]}</div>
      <div class="visitor-info" onclick="showVisitorDetail(${v.id})">
        <div class="visitor-name">${esc(v.full_name)}</div>
        <div class="visitor-meta">${esc(v.company_name)||'—'} → ${esc(v.host_name)||'—'} ${v.host_company_name ? '('+esc(v.host_company_name)+')' : ''}</div>
        <div class="visitor-meta">${visitorTimeSummary(v)}</div>
      </div>
      <div class="recent-visitor-actions">
        <span class="status-badge recent-visitor-status status-${v.status}">${statusLabel(v.status)}</span>
        ${v.status==='inside' ? `<button class="btn-secondary recent-visitor-btn" onclick="withButtonLock(this, function(){ return checkoutAction(${v.id}) })">Çıkış</button>` : ''}
      </div>
    </div>`).join('') : '<div class="empty-state">Bugün henüz giriş yapılmadı.</div>';

  // Bugünkü Randevular
  const ual = document.getElementById('upcoming-appointments-list');
  const todayAppts = appointments.slice(0, 5);
  ual.innerHTML = todayAppts.length ? todayAppts.map(a => `
    <div class="visitor-row appointment-row">
      <div class="visitor-avatar appointment-avatar" style="background:linear-gradient(135deg,#10b981,#059669)">${esc(a.visitor_name)[0]}</div>
        <div class="visitor-info" style="cursor:pointer" onclick="showAppointmentDetail(${a.id})"><div class="visitor-name">${esc(a.visitor_name)}</div><div class="visitor-meta">🏢 ${esc(a.visitor_company)||'—'} · 🕒 ${formatTime(a.planned_time)} · ${esc(a.host_name)||'—'}</div></div>
      <div class="appointment-row-actions">
        <button class="btn-primary appointment-checkin-btn" onclick='checkInAppointment(${JSON.stringify(a).replace(/'/g, "\\'")})'>Geldi Haber Ver</button>
        <button class="btn-secondary appointment-checkin-btn" onclick='withButtonLock(this, function(){ return quickCompleteAppointment(${a.id}, ${JSON.stringify(a.visitor_name).replace(/'/g, "\\'")}) })'>Geldi Gitti</button>
      </div>
    </div>`).join('') : '<div class="empty-state">Bugün randevu yok</div>';

  // Personel Kayıtları - Onay Bekleyenler (is_approved=0)
  const pending = visitors.filter(v => v.status === 'waiting' && v.is_approved === 0);
  const pendingCountEl = document.getElementById('pending-count');
  if(pendingCountEl) pendingCountEl.textContent = pending.length;
  const pl = document.getElementById('pending-list');
  if(pl) {
    pl.innerHTML = pending.length ? pending.map(v => `
      <div class="visitor-row" style="border-left:4px solid var(--orange)">
        <div class="visitor-avatar" style="background:linear-gradient(135deg,#f59e0b,#d97706)">${esc(v.full_name)[0]}</div>
        <div class="visitor-info" style="cursor:pointer" onclick="showVisitorDetail(${v.id})">
          <div class="visitor-name">${esc(v.full_name)}</div>
          <div class="visitor-meta">Geleceği Kişi: <strong>${esc(v.host_name)||'—'}</strong> ${v.host_company_name ? '('+esc(v.host_company_name)+')' : ''}</div>
          <div class="visitor-meta">${esc(v.company_name)||'—'} · ${esc(v.reason)||'—'}</div>
          <div class="visitor-meta">${visitorTimeSummary(v)}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <button class="btn-primary" style="font-size:11px;padding:6px 12px;background:var(--green);border:1px solid var(--green)" onclick="withButtonLock(this, function(){ return verifyPersonnelGuest(${v.id}) })">✅ Onayla</button>
          <button class="btn-secondary" style="font-size:11px;padding:6px 12px;color:var(--red);border-color:#fecaca" onclick="withButtonLock(this, function(){ return declinePersonnelGuest(${v.id}) })">❌ Reddet</button>
        </div>
      </div>`).join('') : '<div class="empty-state">Onay bekleyen kayıt yok</div>';
  }

  // Bekleme Listesi (Onaylanmış, geliş zamanı beklenen - is_approved=1)
  const waiting = visitors.filter(v => v.status === 'waiting' && v.is_approved === 1);
  const waitingCountEl = document.getElementById('waiting-count');
  if(waitingCountEl) waitingCountEl.textContent = waiting.length;
  const wl = document.getElementById('waiting-list');
  if(wl) {
    wl.innerHTML = waiting.length ? waiting.map(v => `
      <div class="visitor-row" style="border-left:4px solid var(--green)">
        <div class="visitor-avatar" style="background:linear-gradient(135deg,#10b981,#059669)">${esc(v.full_name)[0]}</div>
        <div class="visitor-info" style="cursor:pointer" onclick="showVisitorDetail(${v.id})"><div class="visitor-name">${esc(v.full_name)}</div><div class="visitor-meta">${esc(v.host_name)||'—'} · ${esc(v.reason)||'—'}</div><div class="visitor-meta">${visitorTimeSummary(v)}</div></div>
        <button class="btn-primary" style="font-size:12px;padding:6px 12px" onclick="withButtonLock(this, function(){ return arrivedVisitor(${v.id}) })">Girdi ✓</button>
      </div>`).join('') : '<div class="empty-state">Giriş yapması beklenen kimse yok</div>';
  }



  // Dashboard UI labels updated to more professional Turkish via index.html
}

async function arrivedVisitor(id) {
  try {
    await api.arrivedVisitor(id);
    showToast('✅ Giriş başarıyla onaylanmıştır!');
    refreshDashboard();
  } catch (e) { showToast(e.message, 'error'); }
}

async function verifyPersonnelGuest(id) {
  try {
    await api.verifyVisitor(id);
    showToast('✅ Personelin kayıt talebi onaylandı!');
    refreshDashboard();
  } catch(e) { showToast(e.message, 'error'); }
}

async function declinePersonnelGuest(id) {
  if(!confirm('Bu kaydı reddetmek istediğinize emin misiniz?')) return;
  const reason = prompt('Reddetme sebebini girin (Zorunlu değil):') || 'Sekreterya tarafından reddedildi.';
  try {
    await api.rejectVisitor(id, reason);
    showToast('❌ Kayıt reddedildi.', 'error');
    refreshDashboard();
  } catch(e) { showToast(e.message, 'error'); }
}

async function checkInAppointment(appt) {
  if(!confirm(`${appt.visitor_name} isimli kişinin giriş işlemini onaylıyor musunuz?`)) return;
  try {
    // Randevuyu ziyaretçiye dönüştür (backend'de appointments status update + visitors insert)
    // Şimdilik client'ta createVisitor + cancelAppointment yapıyoruz
    await api.createVisitor({
      full_name: appt.visitor_name,
      company_name: appt.visitor_company,
      host_personnel_id: appt.host_personnel_id,
      reason: appt.reason,
      notes: appt.notes
    });
    await api.cancelAppointment(appt.id); // Veya status='completed' yapacak bir endpoint
    showToast('✅ Giriş kaydı oluşturuldu, onay bekleniyor.');
    refreshDashboard();
  } catch(e) { showToast(e.message, 'error'); }
}

async function quickCompleteAppointment(id, visitorName) {
  if (!confirm(`${visitorName || 'Bu randevu'} geldi/gitti olarak kapatılsın mı?`)) return;
  try {
    await api.quickCompleteAppointment(id);
    showToast('✅ Randevu geldi/gitti olarak kapatıldı.');
    refreshDashboard();
    if (typeof loadAppointments === 'function') loadAppointments();
    if (typeof loadRecentCheckins === 'function') loadRecentCheckins();
  } catch (e) {
    showToast(e.message || 'Randevu kapatılamadı', 'error');
  }
}

window.quickCompleteAppointment = quickCompleteAppointment;

