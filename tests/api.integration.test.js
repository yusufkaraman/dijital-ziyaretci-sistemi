const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const request = require('supertest');

// ── Test ortamı: PostgreSQL (TEST_DATABASE_URL veya DATABASE_URL) ─────────
// Geliştirme DB'sinden izole etmek için TEST_DATABASE_URL kullanılır.
// CI ortamında TEST_DATABASE_URL environment variable olarak enjekte edilmelidir.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
if (process.env.TEST_DIRECT_URL) {
  process.env.DIRECT_URL = process.env.TEST_DIRECT_URL;
}

process.env.UPLOAD_PATH = process.env.UPLOAD_PATH || require('path').join(__dirname, '.tmp-test-uploads');
process.env.JWT_SECRET  = process.env.JWT_SECRET  || 'test-secret-key';
process.env.ALLOWED_ORIGINS = '*';

const prisma = require('../server/prisma');
const { app } = require('../server/index');

let adminToken     = '';
let managerToken   = '';
let secretaryToken = '';

const state = {
  personnelId:   null,
  companyId:     null,
  roomId:        null,
  contentId:     null,
  appointmentId: null,
  visitorIdA:    null,
  visitorIdB:    null,
  visitorIdC:    null,
  blacklistId:   null,
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

// ── Test DB bootstrap ─────────────────────────────────────────────────────
test('bootstrap test database and seed data', async () => {
  // Test başlamadan önce test tablolarını temizle (test izolasyonu)
  await prisma.$executeRawUnsafe('TRUNCATE TABLE screen_logs, activity_logs, appointments, visitors, room_reservations, blacklist, contents, system_settings, personnel, rooms, companies, users, push_subscriptions, system_logs RESTART IDENTITY CASCADE');

  // Seed verisi yükle
  const { seed } = require('../server/seed-test');
  await seed();

  adminToken     = await login('admin', 'admin123');
  managerToken   = await login('mudur', 'mudur123');
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
    .send({ username: 'sec-manager-denied', password: '12345678', full_name: 'Denied Manager', role: 'manager', department: 'Ops' });
  assert.equal(denyNonPersonnel.status, 403);

  const weakPassword = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${secretaryToken}`)
    .send({ username: 'sec-personel-weak', password: '1234567', full_name: 'Weak Password', role: 'personnel', department: 'Ops' });
  assert.equal(weakPassword.status, 400);

  const createPersonnel = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${secretaryToken}`)
    .send({ username: 'sec-personel-ok', password: '12345678', full_name: 'Sekreter Personel', role: 'personnel', company_id: 1, department: 'Ops' });
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
    .send({ username: 'sec-secretary-ok', password: '12345678', full_name: 'Sekreter Tarafindan Sekreter', role: 'secretary', company_id: 1, department: 'Ops' });
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
  const screenCompany = await prisma.company.create({
    data: { name: 'Screen Priority Co', isActive: true },
  });
  const screenPersonnel = await prisma.personnel.create({
    data: { fullName: 'Screen Priority Host', companyId: screenCompany.id, isActive: true },
  });
  const fastArrival = new Date(Date.now() - 5 * 60 * 1000);
  const appointmentTime = new Date(Date.now() - 1000);
  const fastVisitor = await prisma.visitor.create({
    data: {
      fullName: 'Fast Screen Visitor',
      status: 'inside',
      isApproved: true,
      isScreenActive: true,
      arrivalTime: fastArrival,
      visitedCompanyId: screenCompany.id,
      hostPersonnelId: screenPersonnel.id,
    },
  });
  const dueAppointment = await prisma.appointment.create({
    data: {
      visitorName: 'Due Screen Appointment',
      status: 'planned',
      plannedTime: appointmentTime,
      visitedCompanyId: screenCompany.id,
      hostPersonnelId: screenPersonnel.id,
    },
  });

  const current = await request(app).get('/api/screen/current');
  assert.equal(current.status, 200);
  assert.ok('settings' in current.body);
  assert.equal(current.body.visitor, null);
  assert.equal(current.body.host_media.source, 'appointment');
  assert.equal(current.body.host_media.id, dueAppointment.id);

  await prisma.appointment.delete({ where: { id: dueAppointment.id } });
  await prisma.visitor.delete({ where: { id: fastVisitor.id } });
  await prisma.personnel.delete({ where: { id: screenPersonnel.id } });
  await prisma.company.delete({ where: { id: screenCompany.id } });

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
    .send({ username: 'phase6-personel', password: 'phase6pass1', full_name: 'Phase6 Personel', role: 'personnel', company_id: 1, department: 'Test' });
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

// ── 400-kayıt performans testi (Prisma bulk insert) ───────────────────────
test('soft-deleted personnel usernames can be reused and linked personnel becomes inactive', async () => {
  const createOriginal = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: 'reusable-personel', password: 'ReusePass1', full_name: 'Reusable Personel One', role: 'personnel', company_id: 1, department: 'Ops' });
  assert.equal(createOriginal.status, 200);

  const originalUserId = createOriginal.body.id;

  const originalPersonnel = await prisma.personnel.findFirst({
    where: { userId: originalUserId },
    select: { isActive: true },
  });
  assert.ok(originalPersonnel);
  assert.equal(originalPersonnel.isActive, true);

  const softDelete = await request(app)
    .delete(`/api/users/${originalUserId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(softDelete.status, 200);

  const archivedUser = await prisma.user.findUnique({
    where: { id: originalUserId },
    select: { username: true, isActive: true },
  });
  assert.ok(String(archivedUser.username || '').startsWith('deleted__'));
  assert.equal(archivedUser.isActive, false);

  const inactivePersonnel = await prisma.personnel.findFirst({
    where: { userId: originalUserId },
    select: { isActive: true },
  });
  assert.ok(inactivePersonnel);
  assert.equal(inactivePersonnel.isActive, false);

  const createReplacement = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: 'reusable-personel', password: 'ReusePass2', full_name: 'Reusable Personel Two', role: 'personnel', company_id: 1, department: 'Ops' });
  assert.equal(createReplacement.status, 200);
  assert.notEqual(createReplacement.body.id, originalUserId);

  const replacementLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'reusable-personel', password: 'ReusePass2' });
  assert.equal(replacementLogin.status, 200);
});

test('400-user load and critical API response times are acceptable', async () => {
  const passHash = bcrypt.hashSync('PerfPass123', 10);

  // Mevcut sayıları al
  const userCount    = await prisma.user.count();
  const visitorCount = await prisma.visitor.count();
  const apptCount    = await prisma.appointment.count();

  // ── 400 kullanıcı + personel ──────────────────────────────────────────
  const neededUsers = Math.max(0, 400 - userCount);
  if (neededUsers > 0) {
    const userBatch = [];
    for (let i = 0; i < neededUsers; i++) {
      userBatch.push({
        username:     `perf-user-${Date.now()}-${i + 1}`,
        passwordHash: passHash,
        fullName:     `Perf User ${i + 1}`,
        role:         'personnel',
        department:   'Perf',
        isActive:     true,
      });
    }
    await prisma.user.createMany({ data: userBatch, skipDuplicates: true });

    // İlk personeli bul (personnel referansı için)
    const samplePersonnel = await prisma.personnel.findFirst({ where: { isActive: true }, select: { id: true, userId: true } });
    const personnelBatch = userBatch.map((u, i) => ({
      fullName:  u.fullName,
      title:     'Perf User',
      department:'Perf',
      isActive:  true,
    }));
    await prisma.personnel.createMany({ data: personnelBatch, skipDuplicates: true });
  }

  const personnelAny = await prisma.personnel.findFirst({ where: { isActive: true }, select: { id: true, userId: true } });
  assert.ok(personnelAny);

  // ── 400 ziyaretçi ────────────────────────────────────────────────────
  const neededVisitors = Math.max(0, 400 - visitorCount);
  if (neededVisitors > 0) {
    const visitorBatch = [];
    for (let i = 0; i < neededVisitors; i++) {
      visitorBatch.push({
        fullName:        `Perf Visitor ${i + 1}`,
        companyName:     'PERF CO',
        hostPersonnelId: personnelAny.id,
        hostUserId:      personnelAny.userId || null,
        reason:          'Perf Test',
        status:          'waiting',
        isApproved:      true,
        createdBy:       1,
      });
    }
    await prisma.visitor.createMany({ data: visitorBatch, skipDuplicates: true });
  }

  // ── 400 randevu ───────────────────────────────────────────────────────
  const neededAppts = Math.max(0, 400 - apptCount);
  if (neededAppts > 0) {
    const apptBatch = [];
    const now = Date.now();
    for (let i = 0; i < neededAppts; i++) {
      const offsetMs = ((i % 24) + 1) * 60 * 60 * 1000;
      apptBatch.push({
        visitorName:     `Perf Appointment ${i + 1}`,
        visitorCompany:  'PERF CO',
        hostPersonnelId: personnelAny.id,
        hostUserId:      personnelAny.userId || null,
        reason:          'Perf Appointment',
        plannedTime:     new Date(now + offsetMs),
        status:          'planned',
        createdBy:       1,
      });
    }
    await prisma.appointment.createMany({ data: apptBatch, skipDuplicates: true });
  }

  // ── Performans ölçümü ─────────────────────────────────────────────────
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
  assert.equal(usersPerf.durationMs < 2500,       true, `users endpoint too slow: ${usersPerf.durationMs}ms`);
  assert.equal(personnelPerf.durationMs < 2500,    true, `personnel endpoint too slow: ${personnelPerf.durationMs}ms`);
  assert.equal(visitorsPerf.durationMs < 2500,     true, `visitors endpoint too slow: ${visitorsPerf.durationMs}ms`);
  assert.equal(appointmentsPerf.durationMs < 2500, true, `appointments endpoint too slow: ${appointmentsPerf.durationMs}ms`);
});
