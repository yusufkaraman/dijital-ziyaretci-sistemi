// İlk başlatmada otomatik seed — sadece users tablosu boşsa çalışır
const { db } = require('./database');
const bcrypt = require('bcryptjs');

const usersCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
if (!usersCount || usersCount.c === 0) {
  const addUser = (username, password, full_name, role, department) => {
    db.prepare(`INSERT INTO users (username, password_hash, full_name, role, department) VALUES (?,?,?,?,?)`).run(username, bcrypt.hashSync(password, 10), full_name, role, department);
  };
  const getUserId = (username) => {
    const row = db.prepare('SELECT id FROM users WHERE username=? LIMIT 1').get(username);
    return row ? row.id : null;
  };
  const getCompanyId = (name) => {
    const row = db.prepare('SELECT id FROM companies WHERE name=? LIMIT 1').get(name);
    return row ? row.id : null;
  };
  const addCompany = (name, color, isDefault) => {
    db.prepare(`INSERT INTO companies (name, theme_color, is_default, is_active) VALUES (?,?,?,1)`).run(name, color, isDefault ? 1 : 0);
  };
  const addPersonnel = (companyName, fullName, title, username, email) => {
    db.prepare(`
      INSERT INTO personnel (company_id, full_name, title, department, phone, email, user_id, is_active)
      VALUES (?,?,?,?,?,?,?,1)
    `).run(getCompanyId(companyName), fullName, title, 'Yönetim', null, email, username ? getUserId(username) : null);
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

  addCompany('BIKMAZ GRUP', '#0b3d2e', true);
  addCompany('BETA', '#1a56db', false);
  addCompany('TETA', '#0891b2', false);
  addCompany('SIMSOFT', '#0f766e', false);
  addCompany('SmartICT', '#7c3aed', false);
  addCompany('Airobos', '#b45309', false);
  addCompany('Agrobrain', '#166534', false);
  addCompany('Avaitech', '#1d4ed8', false);

  addPersonnel('BIKMAZ GRUP', 'İsmail Bıkmaz', 'Yonetici', 'mudur', 'ismail@bikmazgrup.com');
  addPersonnel('BIKMAZ GRUP', 'Aigerim Sabit BIKMAZ', 'Yonetici', 'aigerimbikmaz', 'aigerim@bikmazgrup.com');
  addPersonnel('BIKMAZ GRUP', 'Dicle Bagli', 'Yonetici', 'diclebagli', 'dicle@bikmazgrup.com');
  addPersonnel('BIKMAZ GRUP', 'Ozlem KucukYilmaz', 'Yonetici', 'ozlemkucukyilmaz', 'ozlem@bikmazgrup.com');
  addPersonnel('BIKMAZ GRUP', 'Burcu Oktem', 'Yonetici', 'burcuoktem', 'burcu@bikmazgrup.com');
  addPersonnel('BIKMAZ GRUP', 'Zeynep Yilmaz', 'Yonetici', 'zeynepyilmaz', 'zeynep@bikmazgrup.com');

  addPersonnel('BETA', 'İsmail Bıkmaz', 'Yonetici', 'mudur', 'ismail@beta.com');
  addPersonnel('BETA', 'Aigerim Sabit BIKMAZ', 'Yonetici', 'aigerimbikmaz', 'aigerim@beta.com');
  addPersonnel('BETA', 'Dicle Bagli', 'Yonetici', 'diclebagli', 'dicle@beta.com');
  addPersonnel('BETA', 'Ozlem KucukYilmaz', 'Yonetici', 'ozlemkucukyilmaz', 'ozlem@beta.com');

  addPersonnel('TETA', 'İsmail Bıkmaz', 'Yonetici', 'mudur', 'ismail@teta.com');
  addPersonnel('TETA', 'Burcu Oktem', 'Yonetici', 'burcuoktem', 'burcu@teta.com');
  addPersonnel('TETA', 'Aigerim Sabit BIKMAZ', 'Yonetici', 'aigerimbikmaz', 'aigerim@teta.com');
  addPersonnel('TETA', 'Zeynep Yilmaz', 'Yonetici', 'zeynepyilmaz', 'zeynep@teta.com');

  addPersonnel('SIMSOFT', 'İsmail Bıkmaz', 'Yonetici', 'mudur', 'ismail@simsoft.com');
  addPersonnel('SIMSOFT', 'Aigerim Sabit BIKMAZ', 'Yonetici', 'aigerimbikmaz', 'aigerim@simsoft.com');

  addPersonnel('SmartICT', 'İsmail Bıkmaz', 'Yonetici', 'mudur', 'ismail@smartict.com');

  addPersonnel('Airobos', 'İsmail Bıkmaz', 'Yonetici', 'mudur', 'ismail@airobos.com');
  addPersonnel('Airobos', 'Aigerim Sabit BIKMAZ', 'Yonetici', 'aigerimbikmaz', 'aigerim@airobos.com');

  addPersonnel('Agrobrain', 'İsmail Bıkmaz', 'Yonetici', 'mudur', 'ismail@agrobrain.com');
  addPersonnel('Agrobrain', 'Burcu Oktem', 'Yonetici', 'burcuoktem', 'burcu@agrobrain.com');
  addPersonnel('Agrobrain', 'Aigerim Sabit BIKMAZ', 'Yonetici', 'aigerimbikmaz', 'aigerim@agrobrain.com');

  addPersonnel('Avaitech', 'İsmail Bıkmaz', 'Yonetici', 'mudur', 'ismail@avaitech.com');
  addPersonnel('Avaitech', 'Burcu Oktem', 'Yonetici', 'burcuoktem', 'burcu@avaitech.com');
  addPersonnel('Avaitech', 'Aigerim Sabit BIKMAZ', 'Yonetici', 'aigerimbikmaz', 'aigerim@avaitech.com');

  db.prepare(`INSERT INTO rooms (name, capacity, floor, equipment, status) VALUES ('Boğaz Salonu',20,'5. Kat','Projeksiyon, Whiteboard, Video Konferans','available')`).run();
  db.prepare(`INSERT INTO rooms (name, capacity, floor, equipment, status) VALUES ('Marmara Odası',8,'3. Kat','TV, Whiteboard','available')`).run();
  db.prepare(`INSERT INTO rooms (name, capacity, floor, equipment, status) VALUES ('Karadeniz Odası',6,'3. Kat','TV','available')`).run();
  db.prepare(`INSERT INTO rooms (name, capacity, floor, equipment, status) VALUES ('VIP Lounge',4,'6. Kat','Mini Bar, TV, Ses Sistemi','available')`).run();

  db.prepare(`INSERT INTO blacklist (full_name, tc_no, company, reason, added_by) VALUES ('Hırsız Hasan','11111111111','Kimlik Yok','Hırsızlık girişimi',1)`).run();

  const today = new Date().toISOString().slice(0,10);
  db.prepare(`INSERT INTO visitors (full_name, tc_no, phone, company_name, host_personnel_id, host_user_id, reason, status, arrival_time, created_by) VALUES (?,?,?,?,?,?,?,'inside',?,2)`).run(
    'Ahmet Yıldız', '12345678901', '0555 123 45 67', 'BETA', getPersonnelId('İsmail Bıkmaz', 'BETA'), getUserId('mudur'), 'İş Görüşmesi', `${today} 09:15:00`
  );
  db.prepare(`INSERT INTO visitors (full_name, tc_no, phone, company_name, host_personnel_id, host_user_id, reason, status, created_by) VALUES (?,?,?,?,?,?,?,'waiting',2)`).run(
    'Burcu Ekici', '', '0544 987 65 43', 'TETA', getPersonnelId('Burcu Oktem', 'TETA'), getUserId('burcuoktem'), 'Yonetim Görüşmesi'
  );

  const h11 = `${today} 11:00:00`, h14 = `${today} 14:30:00`, h16 = `${today} 16:00:00`;
  db.prepare(`INSERT INTO appointments (visitor_name, visitor_phone, visitor_company, host_personnel_id, host_user_id, reason, planned_time, status, created_by) VALUES (?,?,?,?,?,?,?,'planned',2)`).run(
    'Selin Aydın', '0511 111 11 11', 'SmartICT', getPersonnelId('İsmail Bıkmaz', 'SmartICT'), getUserId('mudur'), 'Ortaklık Görüşmesi', h11
  );
  db.prepare(`INSERT INTO appointments (visitor_name, visitor_phone, visitor_company, host_personnel_id, host_user_id, reason, planned_time, status, created_by) VALUES (?,?,?,?,?,?,?,'planned',2)`).run(
    'Tamer Koç', '0522 222 22 22', 'Agrobrain', getPersonnelId('Burcu Oktem', 'Agrobrain'), getUserId('burcuoktem'), 'Finansal Raporlama', h14
  );
  db.prepare(`INSERT INTO appointments (visitor_name, visitor_phone, visitor_company, host_personnel_id, host_user_id, reason, planned_time, status, created_by) VALUES (?,?,?,?,?,?,?,'planned',2)`).run(
    'Elif Çelik', '0533 333 33 33', 'SIMSOFT', getPersonnelId('Aigerim Sabit BIKMAZ', 'SIMSOFT'), getUserId('aigerimbikmaz'), 'Yazılım Demo', h16
  );

  console.log('✅ Demo verisi otomatik yüklendi!');
}
