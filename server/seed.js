const bcrypt = require('bcryptjs');
const { initDB, db } = require('./database');

async function seed() {
  await initDB();
  console.log('🌱 Demo verisi yükleniyor...');

  // Kullanıcılar
  const addUser = (username, password, full_name, role, department) => {
    const exists = db.prepare('SELECT id FROM users WHERE username=?').get(username);
    if (!exists) db.prepare(`INSERT INTO users (username, password_hash, full_name, role, department) VALUES (?,?,?,?,?)`).run(username, bcrypt.hashSync(password, 10), full_name, role, department);
  };
  const getUserId = (username) => {
    const row = db.prepare('SELECT id FROM users WHERE username=? LIMIT 1').get(username);
    return row ? row.id : null;
  };
  const getCompanyId = (name) => {
    const row = db.prepare('SELECT id FROM companies WHERE name=? LIMIT 1').get(name);
    return row ? row.id : null;
  };
  const getPersonnelId = (fullName, companyName) => {
    const row = db.prepare(`
      SELECT p.id
      FROM personnel p
      JOIN companies c ON c.id = p.company_id
      WHERE p.full_name=? AND c.name=?
      LIMIT 1
    `).get(fullName, companyName);
    return row ? row.id : null;
  };
  addUser('admin', 'admin123', 'Sistem Yöneticisi', 'admin', 'BT');
  addUser('sekreter', 'sekreter123', 'Gulmira Bakmaz', 'secretary', 'Resepsiyon');
  addUser('mudur', 'mudur123', 'İsmail Bıkmaz', 'manager', 'Yönetim');
  addUser('personel', 'personel123', 'Demo Personel', 'personnel', 'Operasyon');
  addUser('aigerimbikmaz', 'aigerim123', 'Aigerim Sabit BIKMAZ', 'manager', 'Yönetim');
  addUser('diclebagli', 'dicle123', 'Dicle Bagli', 'manager', 'Yönetim');
  addUser('ozlemkucukyilmaz', 'ozlem123', 'Ozlem KucukYilmaz', 'manager', 'Yönetim');
  addUser('burcuoktem', 'burcu123', 'Burcu Oktem', 'manager', 'Yönetim');
  addUser('zeynepyilmaz', 'zeynep123', 'Zeynep Yilmaz', 'manager', 'Yönetim');

  // Firmalar
  const addCompany = (name, color, isDefault) => {
    const exists = db.prepare('SELECT id FROM companies WHERE name=?').get(name);
    if (!exists) db.prepare(`INSERT INTO companies (name, theme_color, is_default, is_active) VALUES (?,?,?,1)`).run(name, color, isDefault?1:0);
  };
  addCompany('BIKMAZ GRUP', '#0b3d2e', true);
  addCompany('BETA', '#1a56db', false);
  addCompany('TETA', '#0891b2', false);
  addCompany('SIMSOFT', '#0f766e', false);
  addCompany('SmartICT', '#7c3aed', false);
  addCompany('Airobos', '#b45309', false);
  addCompany('Agrobrain', '#166534', false);
  addCompany('Avaitech', '#1d4ed8', false);

  // Personel
  const addPersonnel = (company_id, full_name, title, department, phone, email, user_id) => {
    const exists = db.prepare('SELECT id FROM personnel WHERE full_name=? AND company_id=?').get(full_name, company_id);
    if (!exists) db.prepare(`INSERT INTO personnel (company_id, full_name, title, department, phone, email, user_id, is_active) VALUES (?,?,?,?,?,?,?,1)`).run(company_id, full_name, title||null, department||null, phone||null, email||null, user_id||null);
  };
  const uid = {
    ismail: getUserId('mudur'),
    aigerim: getUserId('aigerimbikmaz'),
    dicle: getUserId('diclebagli'),
    ozlem: getUserId('ozlemkucukyilmaz'),
    burcu: getUserId('burcuoktem'),
    zeynep: getUserId('zeynepyilmaz'),
  };

  // BIKMAZ GRUP
  addPersonnel(getCompanyId('BIKMAZ GRUP'), 'İsmail Bıkmaz', 'Yonetici', 'Yönetim', null, 'ismail@bikmazgrup.com', uid.ismail);
  addPersonnel(getCompanyId('BIKMAZ GRUP'), 'Aigerim Sabit BIKMAZ', 'Yonetici', 'Yönetim', null, 'aigerim@bikmazgrup.com', uid.aigerim);
  addPersonnel(getCompanyId('BIKMAZ GRUP'), 'Dicle Bagli', 'Yonetici', 'Yönetim', null, 'dicle@bikmazgrup.com', uid.dicle);
  addPersonnel(getCompanyId('BIKMAZ GRUP'), 'Ozlem KucukYilmaz', 'Yonetici', 'Yönetim', null, 'ozlem@bikmazgrup.com', uid.ozlem);
  addPersonnel(getCompanyId('BIKMAZ GRUP'), 'Burcu Oktem', 'Yonetici', 'Yönetim', null, 'burcu@bikmazgrup.com', uid.burcu);
  addPersonnel(getCompanyId('BIKMAZ GRUP'), 'Zeynep Yilmaz', 'Yonetici', 'Yönetim', null, 'zeynep@bikmazgrup.com', uid.zeynep);

  // BETA
  addPersonnel(getCompanyId('BETA'), 'İsmail Bıkmaz', 'Yonetici', 'Yönetim', null, 'ismail@beta.com', uid.ismail);
  addPersonnel(getCompanyId('BETA'), 'Aigerim Sabit BIKMAZ', 'Yonetici', 'Yönetim', null, 'aigerim@beta.com', uid.aigerim);
  addPersonnel(getCompanyId('BETA'), 'Dicle Bagli', 'Yonetici', 'Yönetim', null, 'dicle@beta.com', uid.dicle);
  addPersonnel(getCompanyId('BETA'), 'Ozlem KucukYilmaz', 'Yonetici', 'Yönetim', null, 'ozlem@beta.com', uid.ozlem);

  // TETA
  addPersonnel(getCompanyId('TETA'), 'İsmail Bıkmaz', 'Yonetici', 'Yönetim', null, 'ismail@teta.com', uid.ismail);
  addPersonnel(getCompanyId('TETA'), 'Burcu Oktem', 'Yonetici', 'Yönetim', null, 'burcu@teta.com', uid.burcu);
  addPersonnel(getCompanyId('TETA'), 'Aigerim Sabit BIKMAZ', 'Yonetici', 'Yönetim', null, 'aigerim@teta.com', uid.aigerim);
  addPersonnel(getCompanyId('TETA'), 'Zeynep Yilmaz', 'Yonetici', 'Yönetim', null, 'zeynep@teta.com', uid.zeynep);

  // SIMSOFT
  addPersonnel(getCompanyId('SIMSOFT'), 'İsmail Bıkmaz', 'Yonetici', 'Yönetim', null, 'ismail@simsoft.com', uid.ismail);
  addPersonnel(getCompanyId('SIMSOFT'), 'Aigerim Sabit BIKMAZ', 'Yonetici', 'Yönetim', null, 'aigerim@simsoft.com', uid.aigerim);

  // SmartICT
  addPersonnel(getCompanyId('SmartICT'), 'İsmail Bıkmaz', 'Yonetici', 'Yönetim', null, 'ismail@smartict.com', uid.ismail);

  // Airobos
  addPersonnel(getCompanyId('Airobos'), 'İsmail Bıkmaz', 'Yonetici', 'Yönetim', null, 'ismail@airobos.com', uid.ismail);
  addPersonnel(getCompanyId('Airobos'), 'Aigerim Sabit BIKMAZ', 'Yonetici', 'Yönetim', null, 'aigerim@airobos.com', uid.aigerim);

  // Agrobrain
  addPersonnel(getCompanyId('Agrobrain'), 'İsmail Bıkmaz', 'Yonetici', 'Yönetim', null, 'ismail@agrobrain.com', uid.ismail);
  addPersonnel(getCompanyId('Agrobrain'), 'Burcu Oktem', 'Yonetici', 'Yönetim', null, 'burcu@agrobrain.com', uid.burcu);
  addPersonnel(getCompanyId('Agrobrain'), 'Aigerim Sabit BIKMAZ', 'Yonetici', 'Yönetim', null, 'aigerim@agrobrain.com', uid.aigerim);

  // Avaitech
  addPersonnel(getCompanyId('Avaitech'), 'İsmail Bıkmaz', 'Yonetici', 'Yönetim', null, 'ismail@avaitech.com', uid.ismail);
  addPersonnel(getCompanyId('Avaitech'), 'Burcu Oktem', 'Yonetici', 'Yönetim', null, 'burcu@avaitech.com', uid.burcu);
  addPersonnel(getCompanyId('Avaitech'), 'Aigerim Sabit BIKMAZ', 'Yonetici', 'Yönetim', null, 'aigerim@avaitech.com', uid.aigerim);

  // Toplantı Odaları
  const addRoom = (name, capacity, floor, equipment) => {
    const exists = db.prepare('SELECT id FROM rooms WHERE name=?').get(name);
    if (!exists) db.prepare(`INSERT INTO rooms (name, capacity, floor, equipment, status) VALUES (?,?,?,?,'available')`).run(name, capacity, floor, equipment);
  };
  addRoom('Boğaz Salonu', 20, '5. Kat', 'Projeksiyon, Whiteboard, Video Konferans');
  addRoom('Marmara Odası', 8, '3. Kat', 'TV, Whiteboard');
  addRoom('Karadeniz Odası', 6, '3. Kat', 'TV');
  addRoom('VIP Lounge', 4, '6. Kat', 'Mini Bar, TV, Ses Sistemi');

  // Demo Ziyaretçiler
  const today = new Date().toISOString().slice(0, 10);
  const addVisitor = (full_name, tc_no, phone, company_name, host_id, reason, status, arrival_time) => {
    const exists = db.prepare('SELECT id FROM visitors WHERE full_name=? AND created_at LIKE ?').get(full_name, `${today}%`);
    if (!exists) db.prepare(`INSERT INTO visitors (full_name, tc_no, phone, company_name, host_personnel_id, reason, status, arrival_time, created_by) VALUES (?,?,?,?,?,?,?,?,2)`).run(full_name, tc_no||null, phone||null, company_name||null, host_id||null, reason||null, status, arrival_time||null);
  };
  addVisitor('Ahmet Yıldız', '12345678901', '0555 123 45 67', 'BETA', getPersonnelId('İsmail Bıkmaz', 'BETA'), 'İş Görüşmesi', 'inside', `${today} 09:15:00`);
  addVisitor('Burcu Ekici', '', '0544 987 65 43', 'TETA', getPersonnelId('Burcu Oktem', 'TETA'), 'Yonetim Görüşmesi', 'waiting', null);
  addVisitor('Can Doğan', '98765432100', '0533 456 78 90', 'Avaitech', getPersonnelId('Aigerim Sabit BIKMAZ', 'Avaitech'), 'Toplantı', 'left', `${today} 08:30:00`);

  // Demo Randevular
  const h = (hr, min) => `${today} ${String(hr).padStart(2,'0')}:${String(min).padStart(2,'0')}:00`;
  const addAppt = (vn, vp, vc, host_id, reason, time) => {
    const exists = db.prepare('SELECT id FROM appointments WHERE visitor_name=? AND planned_time=?').get(vn, time);
    if (!exists) db.prepare(`INSERT INTO appointments (visitor_name, visitor_phone, visitor_company, host_personnel_id, reason, planned_time, status, created_by) VALUES (?,?,?,?,?,?,'planned',2)`).run(vn, vp||null, vc||null, host_id||null, reason||null, time);
  };
  addAppt('Selin Aydın', '0511 111 11 11', 'SmartICT', getPersonnelId('İsmail Bıkmaz', 'SmartICT'), 'Ortaklık Görüşmesi', h(11, 0));
  addAppt('Tamer Koç', '0522 222 22 22', 'Agrobrain', getPersonnelId('Burcu Oktem', 'Agrobrain'), 'Finansal Raporlama', h(14, 30));
  addAppt('Elif Çelik', '0533 333 33 33', 'SIMSOFT', getPersonnelId('Aigerim Sabit BIKMAZ', 'SIMSOFT'), 'Yazılım Demo', h(16, 0));

  // Kara Liste
  const blExists = db.prepare('SELECT id FROM blacklist WHERE tc_no=?').get('11111111111');
  if (!blExists) db.prepare(`INSERT INTO blacklist (full_name, tc_no, company, reason, added_by) VALUES (?,?,?,?,1)`).run('Hırsız Hasan', '11111111111', 'Kimlik Yok', 'Hırsızlık girişimi');

  console.log('✅ Demo veri yüklendi!\n');
  console.log('📋 Kullanıcılar:');
  console.log('  admin     / admin123    → Sistem Yöneticisi');
  console.log('  sekreter  / sekreter123 → Gulmira Bakmaz (Resepsiyon)');
  console.log('  mudur     / mudur123    → İsmail Bıkmaz (Genel Müdür)');
  console.log('  personel  / personel123 → Demo Personel');
}

seed().catch(console.error);
