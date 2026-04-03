// Parçacıklar
const pc = document.getElementById('particles');
for (let i = 0; i < 25; i++) {
  const p = document.createElement('div');
  p.className = 'particle';
  const size = 1 + Math.random() * 4;
  p.style.cssText = `left:${Math.random() * 100}%;width:${size}px;height:${size}px;animation-duration:${12 + Math.random() * 16}s;animation-delay:${-Math.random() * 28}s`;
  pc.appendChild(p);
}

// SAAT
function updateClock() {
  const n = new Date();
  document.getElementById('clock-time').textContent = n.toLocaleTimeString('tr-TR');
  document.getElementById('clock-date').textContent = n.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('footer-date').textContent = n.toLocaleDateString('tr-TR');
}
updateClock();
setInterval(updateClock, 1000);

// EKRAN YONETIMI
let currentMode = 'default';

function showWelcome(visitor) {
  const ws = document.getElementById('welcome-screen');
  const ds = document.getElementById('default-screen');
  document.getElementById('welcome-name').textContent = visitor.full_name;
  document.getElementById('welcome-company').textContent = visitor.company_name || '';
  document.getElementById('welcome-purpose').textContent = visitor.reason ? `📋 ${visitor.reason}` : '';
  document.getElementById('welcome-host').textContent = visitor.host_name || '—';
  ds.classList.add('screen-hide');
  ws.classList.remove('screen-hide');
  currentMode = 'welcome';
}

function showDefault() {
  const ws = document.getElementById('welcome-screen');
  const ds = document.getElementById('default-screen');
  ws.classList.add('screen-hide');
  ds.classList.remove('screen-hide');
  currentMode = 'default';
  loadStats();
}

async function loadStats() {
  try {
    const s = await api.getPublicVisitorStats();
    document.getElementById('def-inside').textContent = s.inside || 0;
    document.getElementById('def-today').textContent = s.today_total || 0;
    document.getElementById('def-appts').textContent = s.appts_today || 0;
  } catch (_) {}
}

async function loadScreenState() {
  try {
    const d = await api.getCurrentScreenState();
    if (d.visitor) {
      showWelcome(d.visitor);
    } else {
      showDefault();
    }
    if (d.settings && d.settings.company_name) {
      document.getElementById('company-name').textContent = d.settings.company_name;
    }
  } catch (e) {
    console.error(e);
  }
}

// SOCKET
const socket = vdCreateSocket({
  onConnect: () => {
    document.getElementById('conn-dot').classList.add('live');
    const labelEl = document.getElementById('conn-label') || document.getElementById('conn-text');
    if (labelEl) labelEl.textContent = 'Canlı Bağlantı';
  },
  onDisconnect: () => {
    document.getElementById('conn-dot').classList.remove('live');
    const labelEl = document.getElementById('conn-label') || document.getElementById('conn-text');
    if (labelEl) labelEl.textContent = 'Bağlantı Kesildi...';
  },
  handlers: {
    'screen:update': (d) => {
      if (d.action === 'arrived' && d.visitor) showWelcome(d.visitor);
      else if (d.action === 'checkout') showDefault();
    },
    'visitor:arrived': (d) => {
      if (d.visitor) showWelcome(d.visitor);
    },
  },
});

// FULLSCREEN
function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}

window.toggleFullscreen = toggleFullscreen;

// BASLAT
loadScreenState();
loadStats();
setInterval(loadStats, 30000);
setInterval(loadScreenState, 60000);
