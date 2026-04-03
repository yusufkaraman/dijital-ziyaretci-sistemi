const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const request = require('supertest');

const TEST_ROOT = path.join(__dirname, '.tmp-test-runtime');
process.env.DB_PATH = path.join(TEST_ROOT, 'database.test.db');
process.env.UPLOAD_PATH = path.join(TEST_ROOT, 'uploads');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
process.env.ALLOWED_ORIGINS = '*';

if (fs.existsSync(TEST_ROOT)) {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true });
}
fs.mkdirSync(TEST_ROOT, { recursive: true });

const { initDB, db } = require('../server/database');
const { app } = require('../server/index');

let adminToken = '';
let managerToken = '';
let secretaryToken = '';

const state = {
  personnelId: null,
  companyId: null,
  roomId: null,
  contentId: null,
  appointmentId: null,
  visitorIdA: null,
  visitorIdB: null,
  visitorIdC: null,
  blacklistId: null,
};

async function login(username, password) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password });

  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  return res.body.token;
}

async function timedGet(url, token) {
  const startedAt = Date.now();
  const res = await request(app)
    .get(url)
    .set('Authorization', `Bearer ${token}`);
  const durationMs = Date.now() - startedAt;
  return { res, durationMs };
}

test('bootstrap test database and seed data', async () => {
  await initDB();
  require('../server/seed-auto');

  adminToken = await login('admin', 'admin123');
  managerToken = await login('mudur', 'mudur123');
  secretaryToken = await login('sekreter', 'sekreter123');

  assert.ok(adminToken.length > 10);
  assert.ok(managerToken.length > 10);
  assert.ok(secretaryToken.length > 10);
});

test('menu pages are reachable', async () => {
  const pages = ['/', '/panel', '/yonetici', '/lobi'];
  for (const page of pages) {
    const res = await request(app).get(page);
    assert.equal(res.status, 200, `expected ${page} to return 200`);
    assert.match(res.text, /<!DOCTYPE html>/i);
  }
});

test('auth endpoints work', async () => {
  const me = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.username, 'admin');

  const logout = await request(app)
    .post('/api/auth/logout')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(logout.status, 200);

  const invalid = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin' });
  assert.equal(invalid.status, 400);
});

test('change password endpoint enforces policy and updates credentials', async () => {
  const weak = await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${secretaryToken}`)
    .send({ current_password: 'sekreter123', new_password: '1234567' });
  assert.equal(weak.status, 400);

  const same = await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${secretaryToken}`)
    .send({ current_password: 'sekreter123', new_password: 'sekreter123' });
  assert.equal(same.status, 400);

  const wrongCurrent = await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${secretaryToken}`)
    .send({ current_password: 'yanlis', new_password: 'sekreter456' });
  assert.equal(wrongCurrent.status, 400);

  const change = await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${secretaryToken}`)
    .send({ current_password: 'sekreter123', new_password: 'sekreter456' });
  assert.equal(change.status, 200);

  const loginOld = await request(app)
    .post('/api/auth/login')
    .send({ username: 'sekreter', password: 'sekreter123' });
  assert.equal(loginOld.status, 401);

  const loginNew = await request(app)
    .post('/api/auth/login')
    .send({ username: 'sekreter', password: 'sekreter456' });
  assert.equal(loginNew.status, 200);
  secretaryToken = loginNew.body.token;
});

test('secretary can create secretary and personnel users only', async () => {
  const denyNonPersonnel = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${secretaryToken}`)
    .send({
      username: 'sec-manager-denied',
      password: '12345678',
      full_name: 'Denied Manager',
      role: 'manager',
      department: 'Ops',
    });
  assert.equal(denyNonPersonnel.status, 403);

  const weakPassword = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${secretaryToken}`)
    .send({
      username: 'sec-personel-weak',
      password: '1234567',
      full_name: 'Weak Password',
      role: 'personnel',
      department: 'Ops',
    });
  assert.equal(weakPassword.status, 400);

  const createPersonnel = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${secretaryToken}`)
    .send({
      username: 'sec-personel-ok',
      password: '12345678',
      full_name: 'Sekreter Personel',
      role: 'personnel',
      company_id: 1,
      department: 'Ops',
    });
  assert.equal(createPersonnel.status, 200);

  const personnelAfterCreate = await request(app)
    .get('/api/personnel?active_only=true')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(personnelAfterCreate.status, 200);
  const linkedPersonnel = (personnelAfterCreate.body || []).find((p) => p.full_name === 'Sekreter Personel');
  assert.ok(linkedPersonnel);

  const createSecretary = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${secretaryToken}`)
    .send({
      username: 'sec-secretary-ok',
      password: '12345678',
      full_name: 'Sekreter Tarafindan Sekreter',
      role: 'secretary',
      company_id: 1,
      department: 'Ops',
    });
  assert.equal(createSecretary.status, 200);

  const usersAfterSecretaryCreate = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${secretaryToken}`);
  assert.equal(usersAfterSecretaryCreate.status, 200);
  const createdSecretary = (usersAfterSecretaryCreate.body || []).find((u) => u.username === 'sec-secretary-ok');
  assert.ok(createdSecretary);
  assert.equal(createdSecretary.role, 'secretary');

  const secretaryUsersAfterCreate = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${secretaryToken}`);
  const createdBySecretary = (secretaryUsersAfterCreate.body || []).find((u) => u.username === 'sec-personel-ok');
  assert.ok(createdBySecretary);
  assert.equal(createdBySecretary.role, 'personnel');

  const updateWeakPassword = await request(app)
    .put(`/api/users/${createdBySecretary.id}`)
    .set('Authorization', `Bearer ${secretaryToken}`)
    .send({ full_name: 'Sekreter Personel', role: 'personnel', is_active: 1, password: '1234567' });
  assert.equal(updateWeakPassword.status, 400);

  const listForSecretary = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${secretaryToken}`);
  assert.equal(listForSecretary.status, 200);
  assert.ok(Array.isArray(listForSecretary.body));
  assert.equal(listForSecretary.body.every((u) => u.role === 'personnel' || u.role === 'secretary'), true);

  const managerRow = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${adminToken}`);
  const anyManager = managerRow.body.find((u) => u.role === 'manager');
  assert.ok(anyManager);

  const denyManagerUpdate = await request(app)
    .put(`/api/users/${anyManager.id}`)
    .set('Authorization', `Bearer ${secretaryToken}`)
    .send({ full_name: 'Denied Update', role: 'manager', is_active: 1 });
  assert.equal(denyManagerUpdate.status, 403);
});

test('personnel CRUD-like flow works', async () => {
  const list = await request(app)
    .get('/api/personnel')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.body));

  const create = await request(app)
    .post('/api/personnel')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ full_name: 'Test Personel', department: 'QA' });
  assert.equal(create.status, 200);

  const listAfterCreate = await request(app)
    .get('/api/personnel')
    .set('Authorization', `Bearer ${adminToken}`);
  const createdPersonnel = (listAfterCreate.body || []).find((p) => p.full_name === 'Test Personel');
  assert.ok(createdPersonnel, 'created personnel should exist in listing');
  state.personnelId = createdPersonnel.id;

  const getById = await request(app)
    .get(`/api/personnel/${state.personnelId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(getById.status, 200);

  const update = await request(app)
    .put(`/api/personnel/${state.personnelId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ full_name: 'Test Personel Updated', is_active: 1 });
  assert.equal(update.status, 200);
  assert.equal(update.body.full_name, 'Test Personel Updated');

  const remove = await request(app)
    .delete(`/api/personnel/${state.personnelId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(remove.status, 200);
});

test('companies CRUD-like flow works', async () => {
  const list = await request(app)
    .get('/api/companies')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(list.status, 200);

  const create = await request(app)
    .post('/api/companies')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Test Firma', theme_color: '#112233' });
  assert.equal(create.status, 200);

  const listAfterCreate = await request(app)
    .get('/api/companies?active_only=false')
    .set('Authorization', `Bearer ${adminToken}`);
  const createdCompany = (listAfterCreate.body || []).find((c) => c.name === 'Test Firma');
  assert.ok(createdCompany, 'created company should exist in listing');
  state.companyId = createdCompany.id;

  const update = await request(app)
    .put(`/api/companies/${state.companyId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Test Firma Updated', theme_color: '#445566', is_default: 0, is_active: 1 });
  assert.equal(update.status, 200);
  assert.equal(update.body.name, 'Test Firma Updated');

  const setDefault = await request(app)
    .put(`/api/companies/${state.companyId}/default`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(setDefault.status, 200);

  const remove = await request(app)
    .delete(`/api/companies/${state.companyId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(remove.status, 200);
});

test('rooms flow works', async () => {
  const list = await request(app)
    .get('/api/rooms')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(list.status, 200);

  const create = await request(app)
    .post('/api/rooms')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Test Oda', capacity: 5, floor: '1', equipment: 'TV' });
  assert.equal(create.status, 200);
  state.roomId = create.body.id;

  const status = await request(app)
    .put(`/api/rooms/${state.roomId}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'occupied' });
  assert.equal(status.status, 200);

  const update = await request(app)
    .put(`/api/rooms/${state.roomId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Test Oda 2', capacity: 8, status: 'available' });
  assert.equal(update.status, 200);
});

test('visitors full status flow works', async () => {
  const list = await request(app)
    .get('/api/visitors')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(list.status, 200);

  const stats = await request(app)
    .get('/api/visitors/stats')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(stats.status, 200);
  assert.equal(typeof stats.body.today_total, 'number');

  const active = await request(app).get('/api/visitors/active');
  assert.equal(active.status, 200);

  const createA = await request(app)
    .post('/api/visitors')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ full_name: 'Test Ziyaretci A', reason: 'Test' });
  assert.equal(createA.status, 200);
  state.visitorIdA = createA.body.id;

  const approve = await request(app)
    .put(`/api/visitors/${state.visitorIdA}/approve`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(approve.status, 200);

  const cancel = await request(app)
    .put(`/api/visitors/${state.visitorIdA}/cancel`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(cancel.status, 200);

  const createB = await request(app)
    .post('/api/visitors')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ full_name: 'Test Ziyaretci B', reason: 'Test' });
  assert.equal(createB.status, 200);
  state.visitorIdB = createB.body.id;

  const arrived = await request(app)
    .put(`/api/visitors/${state.visitorIdB}/arrived`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(arrived.status, 200);

  const checkout = await request(app)
    .put(`/api/visitors/${state.visitorIdB}/checkout`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(checkout.status, 200);

  const createC = await request(app)
    .post('/api/visitors')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ full_name: 'Test Ziyaretci C', reason: 'Delete test' });
  assert.equal(createC.status, 200);
  state.visitorIdC = createC.body.id;

  const getById = await request(app)
    .get(`/api/visitors/${state.visitorIdC}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(getById.status, 200);

  const remove = await request(app)
    .delete(`/api/visitors/${state.visitorIdC}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(remove.status, 200);
});

test('appointments CRUD flow works', async () => {
  const list = await request(app)
    .get('/api/appointments')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(list.status, 200);

  const plannedTime = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const create = await request(app)
    .post('/api/appointments')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ visitor_name: 'Randevu Test', planned_time: plannedTime, reason: 'Test' });
  assert.equal(create.status, 200);
  state.appointmentId = create.body.id;

  const update = await request(app)
    .put(`/api/appointments/${state.appointmentId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ visitor_name: 'Randevu Test Updated', planned_time: plannedTime, status: 'planned' });
  assert.equal(update.status, 200);

  const cancel = await request(app)
    .put(`/api/appointments/${state.appointmentId}/cancel`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(cancel.status, 200);

  const remove = await request(app)
    .delete(`/api/appointments/${state.appointmentId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(remove.status, 200);

  const t0 = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const t1 = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

  const createA = await request(app)
    .post('/api/appointments')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ visitor_name: 'Sirket A Randevu', visitor_company: 'BETA', planned_time: t1, reason: 'Test A' });
  assert.equal(createA.status, 200);

  const createB = await request(app)
    .post('/api/appointments')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ visitor_name: 'Sirket B Randevu', visitor_company: 'TETA', planned_time: t0, reason: 'Test B' });
  assert.equal(createB.status, 200);

  const onlyBeta = await request(app)
    .get('/api/appointments?status=planned&company=BETA')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(onlyBeta.status, 200);
  assert.equal(onlyBeta.body.every((a) => (a.visitor_company || '').trim().toLowerCase() === 'beta'), true);

  const plannedSorted = await request(app)
    .get('/api/appointments?status=planned')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(plannedSorted.status, 200);
  const times = plannedSorted.body.map((a) => a.planned_time).filter(Boolean);
  const sortedTimes = [...times].sort((x, y) => new Date(x) - new Date(y));
  assert.deepEqual(times, sortedTimes);
});

test('contents flow works for text records', async () => {
  const list = await request(app).get('/api/contents');
  assert.equal(list.status, 200);

  const create = await request(app)
    .post('/api/contents')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ type: 'text', title: 'Test Icerik', content_text: 'Merhaba', display_order: 1 });
  assert.equal(create.status, 201);

  const listAfterCreate = await request(app).get('/api/contents');
  const createdContent = (listAfterCreate.body || []).find((c) => c.title === 'Test Icerik');
  assert.ok(createdContent, 'created content should exist in listing');
  state.contentId = createdContent.id;

  const getById = await request(app).get(`/api/contents/${state.contentId}`);
  assert.equal(getById.status, 200);

  const update = await request(app)
    .put(`/api/contents/${state.contentId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Test Icerik Updated' });
  assert.equal(update.status, 200);

  const remove = await request(app)
    .delete(`/api/contents/${state.contentId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(remove.status, 200);
});

test('blacklist flow works', async () => {
  const list = await request(app)
    .get('/api/blacklist')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(list.status, 200);

  const check = await request(app).get('/api/blacklist/check/11111111111');
  assert.equal(check.status, 200);
  assert.equal(typeof check.body.blacklisted, 'boolean');

  const create = await request(app)
    .post('/api/blacklist')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ full_name: 'Test Kara Liste', tc_no: '99999999999', reason: 'Test' });
  assert.equal(create.status, 200);
  state.blacklistId = create.body.id;

  const remove = await request(app)
    .delete(`/api/blacklist/${state.blacklistId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(remove.status, 200);
});

test('screen and logs endpoints work', async () => {
  const current = await request(app).get('/api/screen/current');
  assert.equal(current.status, 200);
  assert.ok('settings' in current.body);

  const logStart = await request(app)
    .post('/api/screen/log')
    .send({ action: 'content_start' });
  assert.equal(logStart.status, 200);

  const logEnd = await request(app)
    .post('/api/screen/log')
    .send({ action: 'content_end' });
  assert.equal(logEnd.status, 200);

  const activity = await request(app)
    .get('/api/logs/activity')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(activity.status, 200);
  assert.ok(Array.isArray(activity.body.items));

  const screenLogs = await request(app)
    .get('/api/logs/screen')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(screenLogs.status, 200);
  assert.ok(Array.isArray(screenLogs.body.items));

  const exportCsv = await request(app)
    .get('/api/logs/export')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(exportCsv.status, 200);
  assert.match(String(exportCsv.headers['content-type'] || ''), /text\/csv/);
});

test('settings and role permissions are enforced', async () => {
  const getSettings = await request(app)
    .get('/api/settings')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(getSettings.status, 200);

  const managerDenied = await request(app)
    .put('/api/settings')
    .set('Authorization', `Bearer ${managerToken}`)
    .send({ welcome_message: 'Denied attempt' });
  assert.equal(managerDenied.status, 403);

  const adminUpdate = await request(app)
    .put('/api/settings')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ welcome_message: 'Test Welcome' });
  assert.equal(adminUpdate.status, 200);
});

test('multi-company personnel data supports autocomplete flow', async () => {
  const c1 = await request(app)
    .post('/api/companies')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'AUTOCO A', theme_color: '#123456' });
  assert.equal(c1.status, 200);

  const c2 = await request(app)
    .post('/api/companies')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'AUTOCO B', theme_color: '#654321' });
  assert.equal(c2.status, 200);

  const p1 = await request(app)
    .post('/api/personnel')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ full_name: 'Autoco Personel A', company_name: 'AUTOCO A', title: 'Mühendis' });
  assert.equal(p1.status, 200);

  const p2 = await request(app)
    .post('/api/personnel')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ full_name: 'Autoco Personel B', company_name: 'AUTOCO B', title: 'Uzman' });
  assert.equal(p2.status, 200);

  const allPersonnel = await request(app)
    .get('/api/personnel?active_only=true')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(allPersonnel.status, 200);
  const autoRows = allPersonnel.body.filter((p) => String(p.full_name || '').startsWith('Autoco Personel'));
  assert.equal(autoRows.length, 2);
  assert.equal(autoRows.every((p) => typeof p.company_name === 'string' && p.company_name.length > 0), true);

  // Frontend autocomplete is text+suggestion based: API must provide name + company label data.
  const suggestionRows = autoRows.map((p) => ({ full_name: p.full_name, company_name: p.company_name }));
  assert.equal(suggestionRows.some((r) => r.full_name === 'Autoco Personel A' && r.company_name), true);
  assert.equal(suggestionRows.some((r) => r.full_name === 'Autoco Personel B' && r.company_name), true);
});

test('manager cannot manage users and personnel user can change own password', async () => {
  const managerDeniedUsersList = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${managerToken}`);
  assert.equal(managerDeniedUsersList.status, 403);

  const createPersonnelUser = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      username: 'phase6-personel',
      password: 'phase6pass1',
      full_name: 'Phase6 Personel',
      role: 'personnel',
      company_id: 1,
      department: 'Test',
    });
  assert.equal(createPersonnelUser.status, 200);

  const personnelToken = await login('phase6-personel', 'phase6pass1');

  const wrongCurrent = await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${personnelToken}`)
    .send({ current_password: 'hatali', new_password: 'phase6pass2' });
  assert.equal(wrongCurrent.status, 400);

  const changed = await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${personnelToken}`)
    .send({ current_password: 'phase6pass1', new_password: 'phase6pass2' });
  assert.equal(changed.status, 200);

  const relogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'phase6-personel', password: 'phase6pass2' });
  assert.equal(relogin.status, 200);
});

test('400-user load and critical API response times are acceptable', async () => {
  const userCountBefore = db.prepare(`SELECT COUNT(*) as c FROM users`).get().c;
  const needed = Math.max(0, 400 - userCountBefore);

  if (needed > 0) {
    const passHash = bcrypt.hashSync('PerfPass123', 10);
    const insertUsers = db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, department, is_active)
      VALUES (?, ?, ?, 'personnel', 'Perf', 1)
    `);
    const insertPersonnel = db.prepare(`
      INSERT INTO personnel (company_id, full_name, title, department, user_id, is_active)
      VALUES (NULL, ?, 'Perf User', 'Perf', ?, 1)
    `);
    for (let i = 0; i < needed; i++) {
      const uname = `perf-user-${Date.now()}-${i + 1}`;
      const fullName = `Perf User ${i + 1}`;
      const r = insertUsers.run(uname, passHash, fullName);
      insertPersonnel.run(fullName, r.lastInsertRowid);
    }
  }

  const personnelAny = db.prepare(`SELECT id, user_id, full_name FROM personnel WHERE is_active=1 ORDER BY id LIMIT 1`).get();
  assert.ok(personnelAny);

  const visitorCountBefore = db.prepare(`SELECT COUNT(*) as c FROM visitors`).get().c;
  const addVisitors = Math.max(0, 400 - visitorCountBefore);
  if (addVisitors > 0) {
    const insertVisitor = db.prepare(`
      INSERT INTO visitors (full_name, company_name, host_personnel_id, host_user_id, reason, status, is_approved, created_by, created_at)
      VALUES (?, ?, ?, ?, 'Perf Test', 'waiting', 1, ?, datetime('now','+3 hours'))
    `);
    for (let i = 0; i < addVisitors; i++) {
      insertVisitor.run(`Perf Visitor ${i + 1}`, 'PERF CO', personnelAny.id, personnelAny.user_id || null, 1);
    }
  }

  const apptCountBefore = db.prepare(`SELECT COUNT(*) as c FROM appointments`).get().c;
  const addAppts = Math.max(0, 400 - apptCountBefore);
  if (addAppts > 0) {
    const insertAppt = db.prepare(`
      INSERT INTO appointments (visitor_name, visitor_company, host_personnel_id, host_user_id, reason, planned_time, status, created_by, created_at)
      VALUES (?, 'PERF CO', ?, ?, 'Perf Appointment', ?, 'planned', ?, datetime('now','+3 hours'))
    `);
    for (let i = 0; i < addAppts; i++) {
      const offsetHours = (i % 24) + 1;
      const plannedTime = db.prepare(`SELECT datetime('now','+3 hours', ? || ' hours') as t`).get(offsetHours).t;
      insertAppt.run(`Perf Appointment ${i + 1}`, personnelAny.id, personnelAny.user_id || null, plannedTime, 1);
    }
  }

  const usersPerf = await timedGet('/api/users?limit=200&offset=0', adminToken);
  assert.equal(usersPerf.res.status, 200);
  assert.equal(Array.isArray(usersPerf.res.body), true);

  const personnelPerf = await timedGet('/api/personnel?active_only=true&limit=200', adminToken);
  assert.equal(personnelPerf.res.status, 200);
  assert.equal(Array.isArray(personnelPerf.res.body), true);

  const visitorsPerf = await timedGet('/api/visitors?date=today&limit=200', adminToken);
  assert.equal(visitorsPerf.res.status, 200);
  assert.equal(Array.isArray(visitorsPerf.res.body), true);

  const appointmentsPerf = await timedGet('/api/appointments?status=planned&limit=200', adminToken);
  assert.equal(appointmentsPerf.res.status, 200);
  assert.equal(Array.isArray(appointmentsPerf.res.body), true);

  // Conservative thresholds for low-end CI machines.
  assert.equal(usersPerf.durationMs < 2500, true, `users endpoint too slow: ${usersPerf.durationMs}ms`);
  assert.equal(personnelPerf.durationMs < 2500, true, `personnel endpoint too slow: ${personnelPerf.durationMs}ms`);
  assert.equal(visitorsPerf.durationMs < 2500, true, `visitors endpoint too slow: ${visitorsPerf.durationMs}ms`);
  assert.equal(appointmentsPerf.durationMs < 2500, true, `appointments endpoint too slow: ${appointmentsPerf.durationMs}ms`);
});
