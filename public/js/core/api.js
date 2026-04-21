// -- Simdesk API Core ---------------------------------------------------------
const API_BASE = '/api';

function buildQuery(params) {
  const query = new URLSearchParams(params || {}).toString();
  return query ? ('?' + query) : '';
}

function authHeaders(extra) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;
  return Object.assign(headers, extra || {});
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

async function apiPublicFetch(path, options) {
  const requestOptions = options || {};
  let res;
  try {
    res = await fetch(API_BASE + path, requestOptions);
  } catch {
    throw new Error('Sunucuya baglanilamiyor');
  }

  const data = await readJsonSafe(res);
  if (!res.ok) {
    throw new Error(data.error || ('Sunucu hatasi: ' + res.status));
  }
  return data;
}

async function apiFetch(path, options) {
  const requestOptions = options || {};
  const token = getToken();
  if (!token) {
    if (window.location.pathname !== '/') window.location.href = '/';
    throw new Error('Oturum bulunamadi');
  }

  let res;
  try {
    res = await fetch(API_BASE + path, Object.assign({}, requestOptions, {
      headers: authHeaders(requestOptions.headers || {}),
    }));
  } catch {
    throw new Error('Sunucuya baglanilamiyor');
  }

  if (res.status === 401) {
    if (window.location.pathname !== '/') {
      clearSession();
      window.location.href = '/';
    }
    throw new Error('Oturum suresi doldu');
  }

  const data = await readJsonSafe(res);
  if (!res.ok) {
    throw new Error(data.error || ('Sunucu hatasi: ' + res.status));
  }
  return data;
}

function apiJson(path, method, payload) {
  const body = payload === undefined ? undefined : JSON.stringify(payload);
  return apiFetch(path, { method: method || 'GET', body: body });
}

async function apiMultipart(path, formData, method) {
  const token = getToken();
  if (!token) {
    if (window.location.pathname !== '/') window.location.href = '/';
    throw new Error('Oturum bulunamadi');
  }

  let res;
  try {
    res = await fetch(API_BASE + path, {
      method: method || 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: formData,
    });
  } catch {
    throw new Error('Sunucuya baglanilamiyor');
  }

  const data = await readJsonSafe(res);
  if (!res.ok) {
    throw new Error(data.error || ('Sunucu hatasi: ' + res.status));
  }
  return data;
}

function apiPublicGet(path) {
  return apiPublicFetch(path, { method: 'GET' });
}

const api = {
  // Auth
  login: function(credentials) {
    return apiPublicFetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials || {}),
    });
  },
  logout: function() { return apiFetch('/auth/logout', { method: 'POST' }); },
  me: function() { return apiFetch('/auth/me'); },
  changePassword: function(data) { return apiJson('/auth/change-password', 'POST', data); },

  // Users
  getUsers: function(params) { return apiFetch('/users' + buildQuery(params)); },
  createUser: function(data) { return apiJson('/users', 'POST', data); },
  updateUser: function(id, data) { return apiJson('/users/' + id, 'PUT', data); },
  deleteUser: function(id) { return apiFetch('/users/' + id, { method: 'DELETE' }); },
  purgeUser: function(id) { return apiFetch('/users/' + id + '/purge', { method: 'DELETE' }); },

  // Visitors
  getVisitors: function(params) { return apiFetch('/visitors' + buildQuery(params)); },
  getVisitorStats: function(params) { return apiFetch('/visitors/stats' + buildQuery(params)); },
  getPublicVisitorStats: function(params) { return apiPublicGet('/visitors/stats' + buildQuery(params)); },
  createVisitor: function(data) { return apiJson('/visitors', 'POST', data); },
  arrivedVisitor: function(id) { return apiFetch('/visitors/' + id + '/arrived', { method: 'PUT' }); },
  verifyVisitor: function(id) { return apiFetch('/visitors/' + id + '/verify', { method: 'PUT' }); },
  approveVisitor: function(id) { return apiFetch('/visitors/' + id + '/approve', { method: 'PUT' }); },
  rejectVisitor: function(id, reason) { return apiJson('/visitors/' + id + '/reject', 'PUT', { reason: reason }); },
  checkoutVisitor: function(id) { return apiFetch('/visitors/' + id + '/checkout', { method: 'PUT' }); },
  cancelVisitor: function(id) { return apiFetch('/visitors/' + id + '/cancel', { method: 'PUT' }); },
  deleteVisitor: function(id) { return apiFetch('/visitors/' + id, { method: 'DELETE' }); },

  // Personnel
  getPersonnel: function(params) { return apiFetch('/personnel' + buildQuery(params)); },
  createPersonnel: function(data) { return apiJson('/personnel', 'POST', data); },
  updatePersonnel: function(id, data) { return apiJson('/personnel/' + id, 'PUT', data); },
  deletePersonnel: function(id) { return apiFetch('/personnel/' + id, { method: 'DELETE' }); },

  // Companies
  getCompanies: function(params) { return apiFetch('/companies' + buildQuery(params)); },
  createCompany: function(data) { return apiJson('/companies', 'POST', data); },
  updateCompany: function(id, data) { return apiJson('/companies/' + id, 'PUT', data); },
  deleteCompany: function(id) { return apiFetch('/companies/' + id, { method: 'DELETE' }); },
  setDefaultCompany: function(id) { return apiFetch('/companies/' + id + '/default', { method: 'PUT' }); },

  // Appointments
  getAppointments: function(params) { return apiFetch('/appointments' + buildQuery(params)); },
  createAppointment: function(data) { return apiJson('/appointments', 'POST', data); },
  updateAppointment: function(id, data) { return apiJson('/appointments/' + id, 'PUT', data); },
  cancelAppointment: function(id) { return apiFetch('/appointments/' + id + '/cancel', { method: 'PUT' }); },
  approveAppointment: function(id) { return apiFetch('/appointments/' + id + '/approve', { method: 'PUT' }); },
  deleteAppointment: function(id) { return apiFetch('/appointments/' + id, { method: 'DELETE' }); },

  // Rooms
  getRooms: function(params) { return apiFetch('/rooms' + buildQuery(params)); },
  createRoom: function(data) { return apiJson('/rooms', 'POST', data); },
  updateRoom: function(id, data) { return apiJson('/rooms/' + id, 'PUT', data); },
  setRoomStatus: function(id, status, visitorId) {
    return apiJson('/rooms/' + id + '/status', 'PUT', { status: status, current_visitor_id: visitorId });
  },
  reserveRoom: function(roomId, payload) { return apiJson('/rooms/' + roomId + '/reserve', 'POST', payload); },
  cancelRoomReservation: function(id) { return apiFetch('/rooms/reservations/' + id, { method: 'DELETE' }); },

  // Blacklist
  getBlacklist: function() { return apiFetch('/blacklist'); },
  checkBlacklist: function(tc) { return apiPublicGet('/blacklist/check/' + encodeURIComponent(tc || '')); },
  addBlacklist: function(data) { return apiJson('/blacklist', 'POST', data); },
  deleteBlacklist: function(id) { return apiFetch('/blacklist/' + id, { method: 'DELETE' }); },

  // Screen + content
  getCurrentScreenState: function() { return apiPublicGet('/screen/current'); },
  getScreenState: function() { return apiPublicGet('/screen/current'); },
  getSettings: function() { return apiFetch('/settings'); },
  updateSettings: function(data) { return apiJson('/settings', 'PUT', data); },
  getContents: function() { return apiFetch('/contents'); },
  uploadContent: function(formData) { return apiMultipart('/contents/upload', formData, 'POST'); },
  updateContent: function(id, data) { return apiJson('/contents/' + id, 'PUT', data); },
  deleteContent: function(id) { return apiFetch('/contents/' + id, { method: 'DELETE' }); },

  // Push + logs
  subscribePush: function(subscription) { return apiJson('/push/subscribe', 'POST', subscription); },
  getSystemLogs: function(params) { return apiFetch('/logs/system' + buildQuery(params)); },

  // Outlook
  startOutlookLogin: function() { return apiFetch('/outlook/login'); },
  syncOutlook: function() { return apiFetch('/outlook/sync', { method: 'POST' }); },
};

if (typeof window !== 'undefined') {
  window.api = api;
  window.apiPublicFetch = apiPublicFetch;
  window.apiFetch = apiFetch;
}
