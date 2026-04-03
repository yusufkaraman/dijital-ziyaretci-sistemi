// Parçacık animasyonu
const container = document.getElementById('particles');
for (let i = 0; i < 30; i++) {
  const p = document.createElement('div');
  p.className = 'particle';
  p.style.left = Math.random() * 100 + '%';
  p.style.animationDuration = (8 + Math.random() * 12) + 's';
  p.style.animationDelay = (-Math.random() * 20) + 's';
  p.style.width = p.style.height = (1 + Math.random() * 3) + 'px';
  container.appendChild(p);
}

// Zaten giriş yapılmışsa yönlendir
const _tok = sessionStorage.getItem('vd_token');
const _role = sessionStorage.getItem('vd_role');
if (_tok && _role) {
  const target = window.vdPermissions
    ? window.vdPermissions.getHomePathForRole(_role)
    : (_role === 'manager' ? '/yonetici' : '/panel');
  window.location.href = target;
}

function redirectByRole(role) {
  const target = window.vdPermissions
    ? window.vdPermissions.getHomePathForRole(role)
    : (role === 'manager' ? '/yonetici' : '/panel');
  window.location.href = target;
}

async function doLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('error-msg');
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Giriş yapılıyor...';
  errEl.style.display = 'none';

  try {
    const data = await api.login({ username, password });

    sessionStorage.setItem('vd_token', data.token);
    sessionStorage.setItem('vd_user', JSON.stringify(data.user));
    sessionStorage.setItem('vd_role', data.user.role);

    redirectByRole(data.user.role);
  } catch (err) {
    errEl.textContent = '⚠️ ' + err.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.innerHTML = 'Giriş Yap';
  }
}

function quickLogin(user, pass) {
  document.getElementById('username').value = user;
  document.getElementById('password').value = pass;
  document.getElementById('login-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
}

window.doLogin = doLogin;
window.quickLogin = quickLogin;
