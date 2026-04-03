// ── Simdesk Auth + Session Core ──────────────────────────
function getToken() {
  return sessionStorage.getItem('vd_token') || null;
}

function getUser() {
  try {
    const u = sessionStorage.getItem('vd_user');
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  sessionStorage.removeItem('vd_token');
  sessionStorage.removeItem('vd_user');
  sessionStorage.removeItem('vd_role');
}

function getHomePathForRole(role) {
  if (window.vdPermissions && typeof window.vdPermissions.getHomePathForRole === 'function') {
    return window.vdPermissions.getHomePathForRole(role);
  }
  if (role === 'manager') return '/yonetici';
  if (role === 'personnel') return '/personel.html';
  if (role === 'admin' || role === 'secretary') return '/panel';
  return '/';
}

function redirectToRoleHome(userOrRole) {
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole?.role;
  const target = getHomePathForRole(role);
  if (window.location.pathname !== target) {
    window.location.href = target;
    return true;
  }
  return false;
}

function checkAuth() {
  if (!getToken()) {
    if (window.location.pathname !== '/' && window.location.pathname !== '/login.html') {
      clearSession();
      window.location.href = '/';
    }
    return false;
  }
  return true;
}

function ensureRoleAccess(allowedRoles) {
  if (!checkAuth()) return false;
  const user = getUser();
  if (!user) {
    if (window.location.pathname !== '/') window.location.href = '/';
    return false;
  }
  if (
    !Array.isArray(allowedRoles)
    || (
      window.vdPermissions
        ? window.vdPermissions.hasRoleAccess(user.role, allowedRoles)
        : allowedRoles.includes(user.role)
    )
  ) return true;
  redirectToRoleHome(user);
  return false;
}

function logout() {
  const token = getToken();
  if (token) {
    if (window.api && typeof window.api.logout === 'function') {
      window.api.logout().catch(() => {});
    } else if (typeof api !== 'undefined' && api && typeof api.logout === 'function') {
      api.logout().catch(() => {});
    } else if (typeof apiPublicFetch === 'function') {
      apiPublicFetch('/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
      }).catch(() => {});
    }
  }
  clearSession();
  window.location.href = '/';
}
