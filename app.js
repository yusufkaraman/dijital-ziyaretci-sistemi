// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  DB.init();
  startClock();
  setGreeting();
  populateHostDropdown();
  setupPreviewListeners();
  renderDashboard();
  renderNotifications();
  renderRecentCheckins();
});

// ── CLOCK & GREETING ───────────────────────────────────────────────
function startClock() {
  const el = document.getElementById('live-clock');
  const tick = () => { el.textContent = new Date().toLocaleTimeString('tr-TR'); };
  tick(); setInterval(tick, 1000);
}

function setGreeting() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar';
  const el = document.getElementById('greeting-text');
  if (el) el.textContent = `${greet}, İsmail Bey! 👋`;
  const dateEl = document.getElementById('today-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('tr-TR', {weekday:'long',day:'numeric',month:'long',year:'numeric'});
}

// ── NAVIGATION ─────────────────────────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(a => a.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');
  const nav = document.querySelector(`[data-page="${page}"]`);
  if (nav) nav.classList.add('active');
  const titles = {dashboard:'Dashboard',visitors:'Ziyaretçi Kayıtları',checkin:'Hızlı Check-in',
    appointments:'Randevu Yönetimi',rooms:'Toplantı Odaları',screens:'Ekran Yönetimi',
    hosts:'Personel Rehberi',blacklist:'Kara Liste',reports:'Raporlar'};
  document.getElementById('page-title').textContent = titles[page] || '';
  const renders = {visitors:renderVisitors,appointments:renderAppointments,rooms:renderRooms,
    screens:renderScreens,hosts:renderHosts,blacklist:renderBlacklist,reports:renderReports,dashboard:renderDashboard};
  if (renders[page]) renders[page]();
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// ── DASHBOARD ──────────────────────────────────────────────────────
function renderDashboard() {
  const vis = DB.getAll('visitors');
  const today = new Date().toDateString();
  const todayVis = vis.filter(v => new Date(v.checkIn).toDateString() === today);
  const active   = vis.filter(v => v.status === 'İçeride');
  const waiting  = vis.filter(v => v.status === 'Bekleniyor');
  const appts    = DB.getAll('appointments');
  const todayAppts = appts.filter(a => a.date === new Date().toISOString().split('T')[0]);
  const screens  = DB.getAll('screens').filter(s => s.status === 'online');

  animCount('kpi-today', todayVis.length);
  animCount('kpi-active', active.length);
  animCount('kpi-appointments', todayAppts.length);
  animCount('kpi-screens', screens.length);
  setText('ws-active', active.length);
  setText('ws-today', todayVis.length);
  setText('ws-appts', todayAppts.length);

  // Recent visitors
  const rvEl = document.getElementById('recent-visitors-list');
  if (rvEl) rvEl.innerHTML = todayVis.slice(-5).reverse().map(v => `
    <div class="visitor-mini-item">
      <div class="visitor-mini-avatar" style="background:${avatarBg(v.name)};color:#fff">${ini(v.name)}</div>
      <div class="visitor-mini-info"><div class="visitor-mini-name">${v.name}</div><div class="visitor-mini-sub">${v.company} · ${v.reason}</div></div>
      ${badge(v.status)}
    </div>`).join('') || '<p style="color:#94a3b8;font-size:13px">Bugün ziyaretçi yok</p>';

  // Today appointments
  const uaEl = document.getElementById('upcoming-appointments-list');
  if (uaEl) uaEl.innerHTML = todayAppts.slice(0,5).map(a => `
    <div class="appt-mini-item">
      <div class="appt-mini-time">${a.time}</div>
      <div class="appt-mini-info"><div class="appt-mini-name">${a.name}</div><div class="appt-mini-sub">${a.hostName} · ${a.reason}</div></div>
      ${badge(a.status)}
    </div>`).join('') || '<p style="color:#94a3b8;font-size:13px">Bugün randevu yok</p>';

  // Waiting list
  const wlEl = document.getElementById('waiting-list');
  const wCountEl = document.getElementById('waiting-count');
  if (wCountEl) wCountEl.textContent = waiting.length;
  if (wlEl) wlEl.innerHTML = waiting.map(v => `
    <div class="visitor-mini-item">
      <div class="visitor-mini-avatar" style="background:${avatarBg(v.name)};color:#fff">${ini(v.name)}</div>
      <div class="visitor-mini-info"><div class="visitor-mini-name">${v.name}</div><div class="visitor-mini-sub">${v.hostName} · ${fmtTime(v.checkIn)}'dan beri</div></div>
      <button class="btn-sm checkout" onclick="markActive(${v.id})">Kabul Et</button>
    </div>`).join('') || '<p style="color:#94a3b8;font-size:13px">Bekleyen ziyaretçi yok</p>';

  // SMS log
  const smsEl = document.getElementById('sms-log-list');
  if (smsEl) smsEl.innerHTML = DB.getAll('smsLog').slice(-5).reverse().map(s => `
    <div class="visitor-mini-item">
      <div style="font-size:20px">${s.icon}</div>
      <div class="visitor-mini-info"><div class="visitor-mini-name" style="font-size:12px">${s.msg}</div><div class="visitor-mini-sub">→ ${s.to} · ${s.time}</div></div>
    </div>`).join('') || '<p style="color:#94a3b8;font-size:13px">Bildirim yok</p>';

  drawTrafficChart();
}

// ── VISITORS ───────────────────────────────────────────────────────
function renderVisitors(data) {
  const rows = data || DB.getAll('visitors');
  const tb = document.getElementById('visitors-tbody');
  if (!tb) return;
  tb.innerHTML = rows.length ? rows.map(v => `
    <tr>
      <td><div class="visitor-cell"><div class="visitor-cell-avatar" style="background:${avatarBg(v.name)};color:#fff">${ini(v.name)}</div><div><div style="font-weight:600">${v.name}</div><div style="font-size:11px;color:#64748b">${v.company}</div></div></div></td>
      <td style="font-family:monospace;font-size:12px;color:#64748b">${v.tc||'—'}</td>
      <td>${v.reason}</td>
      <td>${v.hostName}</td>
      <td style="font-size:12px">${fmtTime(v.checkIn)}</td>
      <td><span class="wait-timer ${waitClass(v.checkIn,v.status)}">${waitLabel(v.checkIn,v.status,v.checkOut)}</span></td>
      <td>${badge(v.status)}</td>
      <td><div style="display:flex;gap:5px">
        ${v.status==='İçeride'?`<button class="btn-sm checkout" onclick="checkOut(${v.id})">Çıkış</button>`:''}
        ${v.status==='Bekleniyor'?`<button class="btn-sm checkout" onclick="markActive(${v.id})">Kabul</button>`:''}
        <button class="btn-sm info" onclick="showQR(${v.id})">QR</button>
        <button class="btn-sm" onclick="viewVisitor(${v.id})">Detay</button>
        <button class="btn-sm danger" onclick="delVisitor(${v.id})">Sil</button>
      </div></td>
    </tr>`).join('') : '<tr><td colspan="8" style="text-align:center;padding:40px;color:#94a3b8">Kayıt bulunamadı</td></tr>';
}

function filterVisitors() {
  const s = (document.getElementById('visitor-search')?.value||'').toLowerCase();
  const st = document.getElementById('status-filter')?.value||'';
  const df = document.getElementById('date-filter')?.value||'today';
  let d = DB.getAll('visitors');
  if (s)  d = d.filter(v => v.name.toLowerCase().includes(s)||(v.tc||'').includes(s));
  if (st) d = d.filter(v => v.status===st);
  if (df==='today') { const t=new Date().toDateString(); d=d.filter(v=>new Date(v.checkIn).toDateString()===t); }
  else if (df==='week') { const w=Date.now()-7*86400000; d=d.filter(v=>new Date(v.checkIn)>w); }
  renderVisitors(d);
}

function checkOut(id) {
  DB.update('visitors',id,{status:'Çıktı',checkOut:new Date().toISOString()});
  renderVisitors(); renderDashboard();
  toast('✅ Çıkış kaydedildi','success');
}
function markActive(id) {
  const v = DB.getById('visitors',id);
  DB.update('visitors',id,{status:'İçeride'});
  renderVisitors(); renderDashboard();
  toast(`✅ ${v?.name} kabul edildi`,'success');
}
function delVisitor(id) {
  if(!confirm('Bu kaydı silmek istiyor musunuz?'))return;
  DB.delete('visitors',id); renderVisitors(); renderDashboard();
  toast('🗑️ Kayıt silindi','warning');
}
function viewVisitor(id) {
  const v = DB.getById('visitors',id); if(!v)return;
  openModal('Ziyaretçi Detayı', `
    <div style="text-align:center;margin-bottom:20px">
      <div style="width:72px;height:72px;border-radius:50%;background:${avatarBg(v.name)};color:#fff;font-size:24px;font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 12px">${ini(v.name)}</div>
      <div style="font-size:20px;font-weight:700">${v.name}</div>
      <div style="color:#64748b;font-size:13px">${v.company}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${fld('TC Kimlik',v.tc||'—')}${fld('Telefon',v.phone||'—')}
      ${fld('Ziyaret Sebebi',v.reason)}${fld('Görüşülen',v.hostName)}
      ${fld('Araç Plakası',v.plate||'—')}${fld('Kişi Sayısı',v.count||'1')}
      ${fld('Giriş',fmtDT(v.checkIn))}${fld('Çıkış',v.checkOut?fmtDT(v.checkOut):'—')}
      ${fld('Rozet No',v.badge||'—')}${fld('Durum',v.status)}
    </div>
    ${v.notes?`<div style="margin-top:14px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"><b>Notlar:</b> ${v.notes}</div>`:''}
    <div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end">
      <button class="btn-secondary" onclick="printBadge(${id})">🖨️ Rozet Yazdır</button>
    </div>`);
}

function showQR(id) {
  const v = DB.getById('visitors',id); if(!v)return;
  openModal(`QR Giriş Kartı — ${v.badge}`,`
    <div style="text-align:center">
      <div style="font-size:13px;color:#64748b;margin-bottom:16px">${v.name} · ${v.company}</div>
      <div class="qr-box">${generateQR(v.badge+v.id)}<div style="font-size:11px;color:#94a3b8;margin-top:8px">QR kodu tarayıcı ile okutun</div></div>
      ${fld('Rozet No',v.badge)} ${fld('Personel',v.hostName)}
    </div>`);
}

function generateQR(seed) {
  const size=12; const cells=[];
  let n=0; for(let c of seed){n=(n*31+c.charCodeAt(0))&0xFFFF;}
  for(let i=0;i<size*size;i++){n=(n*1664525+1013904223)&0xFFFFFFFF;cells.push(n&1);}
  const px=6;
  let svg=`<svg width="${size*px}" height="${size*px}" viewBox="0 0 ${size*px} ${size*px}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#f8fafc"/>`;
  cells.forEach((c,i)=>{if(c){const x=(i%size)*px,y=Math.floor(i/size)*px;svg+=`<rect x="${x}" y="${y}" width="${px-1}" height="${px-1}" rx="1" fill="#1e40af"/>`;}});
  svg+=`<rect x="0" y="0" width="${3*px}" height="${3*px}" fill="none" stroke="#1e40af" stroke-width="2"/>
    <rect x="${(size-3)*px}" y="0" width="${3*px}" height="${3*px}" fill="none" stroke="#1e40af" stroke-width="2"/>
    <rect x="0" y="${(size-3)*px}" width="${3*px}" height="${3*px}" fill="none" stroke="#1e40af" stroke-width="2"/>
    </svg>`;
  return svg;
}

function printBadge(id) {
  const v = DB.getById('visitors',id); if(!v)return;
  const w=window.open('','_blank','width=400,height=300');
  w.document.write(`<html><body style="font-family:Inter,sans-serif;text-align:center;padding:20px">
    <h2 style="color:#1e40af">ZİYARETÇİ ROZET</h2>
    <div style="font-size:32px;font-weight:900;letter-spacing:4px;color:#1e40af;border:2px solid #bfdbfe;border-radius:8px;padding:10px;margin:10px 0">${v.badge}</div>
    <div style="font-size:18px;font-weight:700">${v.name}</div>
    <div style="color:#64748b">${v.company}</div>
    <div style="margin-top:10px;font-size:13px">Görüşülen: <b>${v.hostName}</b></div>
    <div style="font-size:12px;color:#94a3b8">Giriş: ${fmtDT(v.checkIn)}</div>
    <script>window.print();window.close();<\/script></body></html>`);
}

function exportCSV() {
  const rows = DB.getAll('visitors');
  const head = 'Ad,TC,Firma,Sebep,Personel,Giriş,Çıkış,Durum';
  const data = rows.map(v=>`${v.name},${v.tc||''},${v.company},${v.reason},${v.hostName},${fmtDT(v.checkIn)},${v.checkOut?fmtDT(v.checkOut):''},${v.status}`).join('\n');
  const blob = new Blob(['\uFEFF'+head+'\n'+data],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ziyaretciler.csv'; a.click();
}

// ── CHECK-IN ───────────────────────────────────────────────────────
function setupPreviewListeners() {
  ['ci-name','ci-company'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input',()=>{
      const n=document.getElementById('ci-name')?.value||'Ad Soyad';
      const c=document.getElementById('ci-company')?.value||'Firma / Kurum';
      setText('preview-name',n); setText('preview-company',c);
      setText('preview-avatar',n==='Ad Soyad'?'?':ini(n));
    });
  });
}

function populateHostDropdown() {
  const sel=document.getElementById('ci-host'); if(!sel)return;
  sel.innerHTML='<option value="">Seçiniz...</option>';
  DB.getAll('hosts').forEach(h=>{const o=document.createElement('option');o.value=h.id;o.textContent=`${h.name} (${h.dept})`;sel.appendChild(o);});
}

function checkBlacklist(tc) {
  if(tc.length<11)return;
  const found=DB.query('blacklist',b=>b.tc===tc).length>0;
  document.getElementById('blacklist-alert').classList.toggle('show',found);
}

function checkInVisitor() {
  const name=document.getElementById('ci-name').value.trim();
  const tc=document.getElementById('ci-tc').value.trim();
  const hostId=parseInt(document.getElementById('ci-host').value);
  const reason=document.getElementById('ci-reason').value;
  if(!name){toast('⚠️ Ad Soyad zorunludur','warning');return;}
  if(!hostId){toast('⚠️ Personel seçiniz','warning');return;}
  if(!reason){toast('⚠️ Ziyaret sebebi seçiniz','warning');return;}
  if(tc&&DB.query('blacklist',b=>b.tc===tc).length>0){
    toast('⛔ Kara listede kayıtlı kişi girişi onaylanmadı!','error');return;
  }
  const host=DB.getById('hosts',hostId);
  const badge='B-'+String(DB.getAll('visitors').length+1).padStart(3,'0');
  const v=DB.insert('visitors',{
    name,tc,phone:document.getElementById('ci-phone').value.trim(),
    email:document.getElementById('ci-email').value.trim(),
    company:document.getElementById('ci-company').value.trim(),
    plate:document.getElementById('ci-plate').value.trim(),
    count:document.getElementById('ci-count').value,
    hostId,hostName:host?.name||'—',reason,
    notes:document.getElementById('ci-notes').value.trim(),
    badge,checkIn:new Date().toISOString(),checkOut:null,status:'İçeride'
  });
  DB.update('hosts',hostId,{visits:(host?.visits||0)+1});

  // SMS/Email simülasyonu
  const smsOn=document.getElementById('ci-sms')?.checked;
  const emailOn=document.getElementById('ci-email-notif')?.checked;
  if(smsOn)  DB.insert('smsLog',{to:host?.name,msg:`Ziyaretçiniz ${name} girişini yaptı — Rozet: ${badge}`,time:fmtTime(new Date().toISOString()),type:'sms',icon:'📱'});
  if(emailOn)DB.insert('smsLog',{to:host?.name,msg:`${name} ${reason} için geldi`,time:fmtTime(new Date().toISOString()),type:'email',icon:'📧'});

  addNotif('👤',`Yeni giriş: ${name} → ${host?.name}`,'az önce');
  toast(`✅ ${name} girişi kaydedildi — ${badge}`,'success');
  clearCheckinForm();
  renderRecentCheckins();
  renderDashboard();
  openModal('🎫 Giriş Kartı',`
    <div style="text-align:center">
      <div style="width:72px;height:72px;border-radius:50%;background:${avatarBg(v.name)};color:#fff;font-size:24px;font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 14px">${ini(v.name)}</div>
      <div style="font-size:22px;font-weight:800">${v.name}</div>
      <div style="color:#64748b;margin-bottom:20px">${v.company||'Bireysel'}</div>
      <div style="background:linear-gradient(135deg,#eff6ff,#e0f2fe);border:1px solid #bfdbfe;border-radius:12px;padding:20px;margin-bottom:16px">
        <div style="font-size:34px;font-weight:900;letter-spacing:5px;color:#1e40af">${v.badge}</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px">ROZET NUMARASI</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;text-align:left">
        ${fld('Görüşülen',host?.name||'—')}${fld('Sebep',v.reason)}
        ${fld('Giriş Saati',fmtTime(v.checkIn))}${fld('Kişi Sayısı',v.count)}
      </div>
      <button class="btn-primary" onclick="printBadge(${v.id})" style="margin-top:16px">🖨️ Rozet Yazdır</button>
    </div>`);
}

function renderRecentCheckins() {
  const el=document.getElementById('recent-checkins-list'); if(!el)return;
  el.innerHTML=DB.getAll('visitors').slice(-5).reverse().map(v=>`
    <div class="recent-item">
      <div class="recent-avatar" style="background:${avatarBg(v.name)};color:#fff">${ini(v.name)}</div>
      <div style="flex:1"><div class="recent-name">${v.name}</div><div class="recent-time">${fmtTime(v.checkIn)} · ${v.badge}</div></div>
      ${badge(v.status)}
    </div>`).join('');
}

function clearCheckinForm() {
  ['ci-name','ci-tc','ci-phone','ci-email','ci-company','ci-plate','ci-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('ci-host').selectedIndex=0;
  document.getElementById('ci-reason').selectedIndex=0;
  document.getElementById('ci-count').selectedIndex=0;
  setText('preview-name','Ad Soyad'); setText('preview-company','Firma / Kurum'); setText('preview-avatar','?');
  document.getElementById('blacklist-alert')?.classList.remove('show');
}

// ── APPOINTMENTS ───────────────────────────────────────────────────
function renderAppointments() {
  const el=document.getElementById('appointments-grid'); if(!el)return;
  const all=DB.getAll('appointments').sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  el.innerHTML=all.map(a=>`
    <div class="appt-card priority-${a.priority}">
      <div class="appt-card-header">
        <div><div class="appt-card-name">${a.name}</div><div class="appt-card-company">${a.company}</div></div>
        <div><div class="appt-card-time">${a.time}</div><div class="appt-card-date">${fmtDate(a.date)}</div></div>
      </div>
      <div class="appt-card-detail">👤 ${a.hostName} · ${a.reason}</div>
      ${a.notes?`<div style="font-size:11px;color:#94a3b8;margin-bottom:10px;padding-left:8px">📝 ${a.notes}</div>`:''}
      <div class="appt-card-footer">
        ${badge(a.status)}
        <div style="display:flex;gap:6px">
          ${a.status==='Beklemede'?`<button class="btn-sm checkout" onclick="confirmAppt(${a.id})">Onayla</button>`:''}
          <button class="btn-sm danger" onclick="delAppt(${a.id})">İptal</button>
        </div>
      </div>
    </div>`).join('');
}

function showAppointmentModal() {
  const hosts=DB.getAll('hosts');
  openModal('Yeni Randevu',`
    <div class="form-row">
      <div class="form-group"><label>Ad Soyad *</label><input id="ma-name" class="form-input" /></div>
      <div class="form-group"><label>Firma</label><input id="ma-company" class="form-input" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Personel *</label>
        <select id="ma-host" class="form-input"><option value="">Seçiniz...</option>
          ${hosts.map(h=>`<option value="${h.id}">${h.name}</option>`).join('')}</select></div>
      <div class="form-group"><label>Sebep</label>
        <select id="ma-reason" class="form-input"><option>Toplantı</option><option>İş Görüşmesi</option>
          <option>Danışma</option><option>Teknik Destek</option><option>Denetim</option><option>Diğer</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Tarih *</label><input id="ma-date" type="date" class="form-input" value="${new Date().toISOString().split('T')[0]}" /></div>
      <div class="form-group"><label>Saat *</label><input id="ma-time" type="time" class="form-input" value="10:00" /></div>
    </div>
    <div class="form-group"><label>Öncelik</label>
      <select id="ma-priority" class="form-input"><option value="low">Düşük</option><option value="med" selected>Orta</option><option value="high">Yüksek</option></select></div>
    <div class="form-group"><label>Notlar</label><textarea id="ma-notes" class="form-input" rows="2"></textarea></div>
    <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px">
      <button class="btn-secondary" onclick="closeModal()">İptal</button>
      <button class="btn-primary" onclick="saveAppt()">Kaydet</button>
    </div>`);
}

function saveAppt() {
  const name=document.getElementById('ma-name').value.trim();
  const hostId=parseInt(document.getElementById('ma-host').value);
  if(!name||!hostId){toast('⚠️ Zorunlu alanları doldurunuz','warning');return;}
  const host=DB.getById('hosts',hostId);
  DB.insert('appointments',{name,company:document.getElementById('ma-company').value.trim(),
    hostId,hostName:host?.name||'—',reason:document.getElementById('ma-reason').value,
    date:document.getElementById('ma-date').value,time:document.getElementById('ma-time').value,
    notes:document.getElementById('ma-notes').value.trim(),priority:document.getElementById('ma-priority').value,status:'Beklemede'});
  closeModal(); renderAppointments(); toast('📅 Randevu oluşturuldu','success');
}

function confirmAppt(id){DB.update('appointments',id,{status:'Onaylı'});renderAppointments();toast('✅ Randevu onaylandı','success');}
function delAppt(id){if(!confirm('İptal edilsin mi?'))return;DB.delete('appointments',id);renderAppointments();toast('🗑️ Randevu iptal edildi','warning');}

// ── ROOMS ──────────────────────────────────────────────────────────
function renderRooms() {
  const el=document.getElementById('rooms-grid'); if(!el)return;
  const map={occupied:{label:'Dolu',cls:'danger'},available:{label:'Müsait',cls:'checkout'},reserved:{label:'Rezerve',cls:'btn-sm'}};
  el.innerHTML=DB.getAll('rooms').map(r=>`
    <div class="room-card ${r.status}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div class="room-name">${r.name}</div>
          <div class="room-cap">📍 ${r.floor} · Max ${r.capacity} Kişi</div>
        </div>
        <span class="status-badge ${r.status==='available'?'status-active':r.status==='occupied'?'status-checkout':'status-waiting'}">
          ${r.status==='available'?'Müsait':r.status==='occupied'?'Dolu':'Rezerve'}
        </span>
      </div>
      ${r.event?`<div class="room-event">📅 ${r.event}${r.time?' · '+r.time:''}</div>`:'<div class="room-event" style="color:#94a3b8">Etkinlik yok</div>'}
      <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">
        ${r.features.map(f=>`<span style="font-size:11px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:4px;padding:2px 7px">${f}</span>`).join('')}
      </div>
      <div style="margin-top:12px;display:flex;gap:8px">
        ${r.status==='available'?`<button class="btn-sm checkout" onclick="reserveRoom(${r.id})">Rezerve Et</button>`:
          `<button class="btn-sm danger" onclick="freeRoom(${r.id})">Serbest Bırak</button>`}
      </div>
    </div>`).join('');
}

function reserveRoom(id) {
  openModal('Oda Rezervasyonu',`
    <div class="form-group"><label>Etkinlik / Toplantı Adı</label><input id="rm-event" class="form-input" /></div>
    <div class="form-row">
      <div class="form-group"><label>Başlangıç</label><input id="rm-start" type="time" class="form-input" value="09:00" /></div>
      <div class="form-group"><label>Bitiş</label><input id="rm-end" type="time" class="form-input" value="10:00" /></div>
    </div>
    <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px">
      <button class="btn-secondary" onclick="closeModal()">İptal</button>
      <button class="btn-primary" onclick="saveRoomRez(${id})">Rezerve Et</button>
    </div>`);
}

function saveRoomRez(id) {
  const event=document.getElementById('rm-event').value.trim();
  const s=document.getElementById('rm-start').value, e=document.getElementById('rm-end').value;
  DB.update('rooms',id,{status:'reserved',event,time:`${s}-${e}`});
  closeModal(); renderRooms(); toast('📅 Oda rezerve edildi','success');
}

function freeRoom(id){DB.update('rooms',id,{status:'available',event:'',time:''});renderRooms();toast('✅ Oda serbest bırakıldı','success');}
function showRoomReservation(){navigate('rooms');}

// ── SCREENS ────────────────────────────────────────────────────────
function renderScreens() {
  const el=document.getElementById('screens-grid'); if(!el)return;
  el.innerHTML=DB.getAll('screens').map(s=>`
    <div class="screen-card">
      <div class="screen-card-top">
        <div class="screen-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div>
        <div style="flex:1"><div class="screen-name">${s.name}</div><div class="screen-location">${s.location}</div>
          <div class="${s.status==='online'?'screen-online':'screen-offline'}">${s.status==='online'?'🟢 Çevrimiçi':'🔴 Çevrimdışı'} · ${s.lastPing}</div></div>
      </div>
      <div class="screen-preview"><div class="screen-preview-label">Aktif İçerik</div><div class="screen-preview-content">${s.content}</div></div>
      <div class="screen-actions">
        <button class="btn-sm info" onclick="editScreen(${s.id})">✏️ Düzenle</button>
        <button class="btn-sm ${s.status==='online'?'danger':'checkout'}" onclick="toggleScreen(${s.id})">${s.status==='online'?'⏸ Durdur':'▶ Başlat'}</button>
      </div>
    </div>`).join('');
}

function showScreenModal(){
  openModal('Ekran Ekle',`
    <div class="form-group"><label>Ekran Adı *</label><input id="ms-name" class="form-input" /></div>
    <div class="form-group"><label>Konum</label><input id="ms-loc" class="form-input" /></div>
    <div class="form-group"><label>İçerik</label><textarea id="ms-content" class="form-input" rows="3"></textarea></div>
    <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px">
      <button class="btn-secondary" onclick="closeModal()">İptal</button>
      <button class="btn-primary" onclick="saveScreen()">Ekle</button>
    </div>`);
}

function saveScreen(){
  const name=document.getElementById('ms-name').value.trim();
  if(!name){toast('⚠️ Ekran adı zorunludur','warning');return;}
  DB.insert('screens',{name,location:document.getElementById('ms-loc').value.trim(),content:document.getElementById('ms-content').value.trim(),status:'online',lastPing:'az önce'});
  closeModal(); renderScreens(); toast('🖥️ Ekran eklendi','success');
}

function editScreen(id){
  const s=DB.getById('screens',id);
  openModal('İçerik Düzenle',`
    <div class="form-group"><label>İçerik</label><textarea id="es-content" class="form-input" rows="4">${s.content}</textarea></div>
    <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px">
      <button class="btn-secondary" onclick="closeModal()">İptal</button>
      <button class="btn-primary" onclick="DB.update('screens',${id},{content:document.getElementById('es-content').value});closeModal();renderScreens();toast('✅ Güncellendi','success')">Kaydet</button>
    </div>`);
}

function toggleScreen(id){const s=DB.getById('screens',id);DB.update('screens',id,{status:s.status==='online'?'offline':'online',lastPing:'az önce'});renderScreens();toast(s.status==='online'?'⏸ Durduruldu':'▶ Başlatıldı','success');}

// ── HOSTS ──────────────────────────────────────────────────────────
function renderHosts(){
  const el=document.getElementById('hosts-grid'); if(!el)return;
  el.innerHTML=DB.getAll('hosts').map(h=>`
    <div class="host-card">
      <div class="host-avatar" style="background:${h.color}">${h.avatar}</div>
      <div class="host-name">${h.name}</div>
      <div class="host-dept">${h.dept}</div>
      <div class="host-title">${h.title} · Dahili: ${h.ext}</div>
      <div class="host-stats">
        <div class="host-stat"><div class="host-stat-val">${h.visits||0}</div><div class="host-stat-lbl">Ziyaret</div></div>
        <div class="host-stat"><div class="host-stat-val">${DB.query('appointments',a=>a.hostId===h.id).length}</div><div class="host-stat-lbl">Randevu</div></div>
      </div>
    </div>`).join('');
}

function showHostModal(){
  openModal('Personel Ekle',`
    <div class="form-row">
      <div class="form-group"><label>Ad Soyad *</label><input id="mh-name" class="form-input" /></div>
      <div class="form-group"><label>Departman *</label><input id="mh-dept" class="form-input" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Unvan</label><input id="mh-title" class="form-input" /></div>
      <div class="form-group"><label>Dahili No</label><input id="mh-ext" class="form-input" placeholder="101" /></div>
    </div>
    <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px">
      <button class="btn-secondary" onclick="closeModal()">İptal</button>
      <button class="btn-primary" onclick="saveHost()">Ekle</button>
    </div>`);
}

function saveHost(){
  const name=document.getElementById('mh-name').value.trim();
  const dept=document.getElementById('mh-dept').value.trim();
  if(!name||!dept){toast('⚠️ Zorunlu alanları doldurunuz','warning');return;}
  const colors=['#1e40af','#7c3aed','#0369a1','#16a34a','#d97706','#dc2626','#0891b2','#059669'];
  DB.insert('hosts',{name,dept,title:document.getElementById('mh-title').value.trim(),ext:document.getElementById('mh-ext').value.trim(),avatar:ini(name),color:colors[Math.floor(Math.random()*colors.length)],visits:0});
  populateHostDropdown(); closeModal(); renderHosts(); toast('✅ Personel eklendi','success');
}

// ── BLACKLIST ──────────────────────────────────────────────────────
function renderBlacklist(){
  const tb=document.getElementById('blacklist-tbody'); if(!tb)return;
  const all=DB.getAll('blacklist');
  tb.innerHTML=all.length?all.map(b=>`
    <tr>
      <td><div class="visitor-cell"><div class="visitor-cell-avatar" style="background:#dc2626;color:#fff">⛔</div><div style="font-weight:600">${b.name}</div></div></td>
      <td style="font-family:monospace">${b.tc}</td>
      <td>${b.company||'—'}</td>
      <td><span style="color:#dc2626;font-weight:600">${b.reason}</span></td>
      <td style="color:#64748b">${b.addedAt}</td>
      <td><button class="btn-sm danger" onclick="delBlacklist(${b.id})">Kaldır</button></td>
    </tr>`).join(''):`<tr><td colspan="6" style="text-align:center;padding:40px;color:#94a3b8">Kara liste boş</td></tr>`;
}

function showBlacklistModal(){
  openModal('Kara Listeye Ekle',`
    <div class="form-row">
      <div class="form-group"><label>Ad Soyad *</label><input id="bl-name" class="form-input" /></div>
      <div class="form-group"><label>TC Kimlik *</label><input id="bl-tc" class="form-input" maxlength="11" /></div>
    </div>
    <div class="form-group"><label>Firma</label><input id="bl-company" class="form-input" /></div>
    <div class="form-group"><label>Kara Listeye Alma Sebebi *</label><input id="bl-reason" class="form-input" /></div>
    <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px">
      <button class="btn-secondary" onclick="closeModal()">İptal</button>
      <button class="btn-primary" onclick="saveBlacklist()" style="background:linear-gradient(135deg,#dc2626,#ef4444)">Listeye Ekle</button>
    </div>`);
}

function saveBlacklist(){
  const name=document.getElementById('bl-name').value.trim();
  const tc=document.getElementById('bl-tc').value.trim();
  const reason=document.getElementById('bl-reason').value.trim();
  if(!name||!tc||!reason){toast('⚠️ Zorunlu alanları doldurunuz','warning');return;}
  DB.insert('blacklist',{name,tc,company:document.getElementById('bl-company').value.trim(),reason,addedAt:new Date().toISOString().split('T')[0]});
  closeModal(); renderBlacklist(); toast('⛔ Kara listeye eklendi','error');
}

function delBlacklist(id){if(!confirm('Kara listeden kaldırılsın mı?'))return;DB.delete('blacklist',id);renderBlacklist();toast('✅ Kara listeden kaldırıldı','success');}

// ── REPORTS ────────────────────────────────────────────────────────
function renderReports(){
  const vis=DB.getAll('visitors');
  animCount('rep-total',vis.length);
  animCount('rep-month',vis.filter(v=>new Date(v.checkIn).getMonth()===new Date().getMonth()).length);
  drawReasonChart(); drawTopHosts(); drawMonthlyChart();
}

function printReport(){window.print();}

// ── NOTIFICATIONS ──────────────────────────────────────────────────
function toggleNotifications(){document.getElementById('notif-panel').classList.toggle('open');}

function renderNotifications(){
  const notifs=DB.getAll('notifications');
  const dot=document.getElementById('notif-dot');
  if(dot)dot.style.display=notifs.some(n=>!n.read)?'block':'none';
  const badge=document.getElementById('notif-count-badge');
  if(badge)badge.textContent=notifs.filter(n=>!n.read).length||'';
  const list=document.getElementById('notif-list');
  if(list)list.innerHTML=notifs.length?notifs.map(n=>`
    <div class="notif-item">
      <div class="notif-item-icon">${n.icon}</div>
      <div class="notif-item-text"><div class="notif-item-title">${n.title}</div><div class="notif-item-time">${n.time}</div></div>
    </div>`).join(''):'<p style="padding:16px;color:#94a3b8;font-size:13px">Bildirim yok</p>';
}

function addNotif(icon,title,time){DB.insert('notifications',{icon,title,time,read:false});renderNotifications();}
function clearNotifications(){DB.notifications=[];DB._save('notifications');renderNotifications();document.getElementById('notif-panel').classList.remove('open');}

// ── SEARCH ─────────────────────────────────────────────────────────
function globalSearch(val){if(!val.trim())return;navigate('visitors');const el=document.getElementById('visitor-search');if(el)el.value=val;filterVisitors();}

// ── MODAL ──────────────────────────────────────────────────────────
function openModal(title,body){
  document.getElementById('modal-title').textContent=title;
  document.getElementById('modal-body').innerHTML=body;
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal(){document.getElementById('modal-overlay').classList.remove('open');}

// ── TOAST ──────────────────────────────────────────────────────────
let toastT;
function toast(msg,type='success'){
  const el=document.getElementById('toast');
  el.textContent=msg; el.className=`toast ${type} show`;
  clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('show'),3200);
}

// ── CHARTS ─────────────────────────────────────────────────────────
function drawTrafficChart(){
  const c=document.getElementById('trafficChart'); if(!c)return;
  const ctx=c.getContext('2d'); c.width=c.parentElement.clientWidth; c.height=200;
  const labels=['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
  const d1=[12,19,15,24,18,8,5], d2=[10,17,14,22,16,7,4];
  drawBars(ctx,c.width,c.height,labels,d1,d2,'#1e40af','#0ea5e9');
}

function drawBars(ctx,w,h,labels,d1,d2,c1,c2){
  ctx.clearRect(0,0,w,h);
  const pL=40,pR=16,pT=16,pB=32,cw=w-pL-pR,ch=h-pT-pB;
  const max=Math.max(...d1,...d2)*1.2;
  const bw=(cw/labels.length)*0.35,gap=bw*.2;
  for(let i=0;i<=4;i++){
    const y=pT+(ch/4)*i;
    ctx.strokeStyle='rgba(0,0,0,0.06)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pL,y);ctx.lineTo(w-pR,y);ctx.stroke();
    ctx.fillStyle='#94a3b8';ctx.font='10px Inter';ctx.textAlign='right';
    ctx.fillText(Math.round(max-(max/4)*i),pL-4,y+4);
  }
  labels.forEach((lbl,i)=>{
    const x=pL+(cw/labels.length)*i+(cw/labels.length)/2;
    const bx1=x-bw-gap/2, bx2=x+gap/2;
    const h1=(d1[i]/max)*ch, h2=(d2[i]/max)*ch;
    ctx.fillStyle=c1; rr(ctx,bx1,pT+ch-h1,bw,h1,4);
    ctx.fillStyle=c2; rr(ctx,bx2,pT+ch-h2,bw,h2,4);
    ctx.fillStyle='#94a3b8';ctx.font='11px Inter';ctx.textAlign='center';
    ctx.fillText(lbl,x,h-8);
  });
}

function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h);ctx.lineTo(x,y+h);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();ctx.fill();}

function drawReasonChart(){
  const c=document.getElementById('reasonChart'); if(!c)return;
  const ctx=c.getContext('2d'); c.width=160;c.height=160;
  const vis=DB.getAll('visitors');
  const counts={};vis.forEach(v=>{counts[v.reason]=(counts[v.reason]||0)+1;});
  const colors=['#1e40af','#0ea5e9','#16a34a','#d97706','#7c3aed','#dc2626'];
  const labels=Object.keys(counts),vals=Object.values(counts),total=vals.reduce((a,b)=>a+b,0);
  let ang=-Math.PI/2;
  labels.forEach((l,i)=>{
    const sl=(vals[i]/total)*Math.PI*2;
    ctx.beginPath();ctx.moveTo(80,80);ctx.arc(80,80,72,ang,ang+sl);ctx.closePath();
    ctx.fillStyle=colors[i%colors.length];ctx.fill();ang+=sl;
  });
  ctx.beginPath();ctx.arc(80,80,42,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();
  ctx.fillStyle='#0f172a';ctx.font='bold 18px Inter';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(total,80,80);
  const leg=document.getElementById('pie-legend');
  if(leg)leg.innerHTML=labels.map((l,i)=>`<div class="pie-legend-item"><div class="pie-legend-dot" style="background:${colors[i%colors.length]}"></div><span class="pie-legend-label">${l}</span><span class="pie-legend-value">${vals[i]}</span></div>`).join('');
}

function drawTopHosts(){
  const el=document.getElementById('top-hosts-list');if(!el)return;
  const hosts=DB.getAll('hosts').sort((a,b)=>(b.visits||0)-(a.visits||0)).slice(0,5);
  const max=hosts[0]?.visits||1;
  el.innerHTML=hosts.map((h,i)=>`<div class="top-host-item"><div class="top-host-rank">${i+1}</div><div class="top-host-bar-wrap"><div class="top-host-name">${h.name}</div><div class="top-host-bar"><div class="top-host-bar-fill" style="width:${((h.visits||0)/max*100)}%"></div></div></div><div class="top-host-count">${h.visits||0}</div></div>`).join('');
}

function drawMonthlyChart(){
  const c=document.getElementById('monthlyChart');if(!c)return;
  const ctx=c.getContext('2d');c.width=c.parentElement.clientWidth;c.height=200;
  const months=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  const data=[42,58,71,83,65,90,78,95,88,102,76,110];
  const pL=40,pR=16,pT=16,pB=32,w=c.width,h=c.height,cw=w-pL-pR,ch=h-pT-pB,max=Math.max(...data)*1.15;
  ctx.clearRect(0,0,w,h);
  for(let i=0;i<=4;i++){const y=pT+(ch/4)*i;ctx.strokeStyle='rgba(0,0,0,0.06)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pL,y);ctx.lineTo(w-pR,y);ctx.stroke();ctx.fillStyle='#94a3b8';ctx.font='10px Inter';ctx.textAlign='right';ctx.fillText(Math.round(max-(max/4)*i),pL-4,y+4);}
  const pts=data.map((v,i)=>({x:pL+(cw/(data.length-1))*i,y:pT+ch-(v/max)*ch}));
  const grd=ctx.createLinearGradient(0,pT,0,pT+ch);grd.addColorStop(0,'rgba(30,64,175,0.18)');grd.addColorStop(1,'rgba(30,64,175,0)');
  ctx.beginPath();ctx.moveTo(pts[0].x,pT+ch);pts.forEach(p=>ctx.lineTo(p.x,p.y));ctx.lineTo(pts[pts.length-1].x,pT+ch);ctx.closePath();ctx.fillStyle=grd;ctx.fill();
  ctx.beginPath();ctx.strokeStyle='#1e40af';ctx.lineWidth=2.5;ctx.lineJoin='round';pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));ctx.stroke();
  pts.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fillStyle='#1e40af';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();});
  ctx.fillStyle='#94a3b8';ctx.font='11px Inter';ctx.textAlign='center';months.forEach((m,i)=>ctx.fillText(m,pts[i].x,h-8));
}

// ── HELPERS ────────────────────────────────────────────────────────
function ini(name){if(!name)return'?';return name.split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase();}

const AC=['#1e40af','#7c3aed','#0369a1','#16a34a','#d97706','#0891b2','#dc2626','#059669'];
function avatarBg(name){let h=0;for(let c of(name||''))h=((h<<5)-h)+c.charCodeAt(0);return AC[Math.abs(h)%AC.length];}

function badge(status){
  const map={'İçeride':'status-active','Çıktı':'status-checkout','Bekleniyor':'status-waiting','Onaylı':'status-active','Beklemede':'status-waiting'};
  return `<span class="status-badge ${map[status]||''}">${status}</span>`;
}

function fmtTime(iso){if(!iso)return'—';return new Date(iso).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});}
function fmtDT(iso){if(!iso)return'—';return new Date(iso).toLocaleString('tr-TR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});}
function fmtDate(s){if(!s)return'—';return new Date(s).toLocaleDateString('tr-TR',{day:'numeric',month:'long'});}
function fld(label,val){return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px"><div style="font-size:11px;color:#64748b;margin-bottom:2px;font-weight:600">${label}</div><div style="font-size:13px;font-weight:600">${val}</div></div>`;}
function setText(id,val){const el=document.getElementById(id);if(el)el.textContent=val;}
function animCount(id,target){const el=document.getElementById(id);if(!el)return;const start=performance.now();const step=now=>{const p=Math.min((now-start)/700,1),e=1-Math.pow(1-p,3);el.textContent=Math.round(target*e);if(p<1)requestAnimationFrame(step);};requestAnimationFrame(step);}

function waitLabel(checkIn,status,checkOut){
  if(status==='Çıktı'&&checkOut){const m=Math.round((new Date(checkOut)-new Date(checkIn))/60000);return m+'dk kalış';}
  const m=Math.round((Date.now()-new Date(checkIn))/60000);
  return status==='İçeride'?m+'dk içeride':status==='Bekleniyor'?m+'dk bekliyor':'—';
}
function waitClass(checkIn,status){
  if(status!=='Bekleniyor')return'';
  return Math.round((Date.now()-new Date(checkIn))/60000)>30?'long':'';
}

document.addEventListener('click',e=>{
  const panel=document.getElementById('notif-panel');
  if(panel&&!panel.contains(e.target)&&!e.target.closest('.btn-icon'))panel.classList.remove('open');
});
