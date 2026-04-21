process.env.TZ = 'Europe/Istanbul';
const bcrypt = require('bcryptjs');
const prisma = require('./prisma');

async function seed() {
  console.log('🌱 Demo verisi yükleniyor...');

  // ─── Kullanıcılar ─────────────────────────────────────────────────────────
  const users = [
    { username: 'admin',            password: 'admin123',    fullName: 'Sistem Yöneticisi',   role: 'admin',     department: 'BT' },
    { username: 'sekreter',         password: 'sekreter123', fullName: 'Gulmira Bakmaz',      role: 'secretary', department: 'Resepsiyon' },
    { username: 'mudur',            password: 'mudur123',    fullName: 'İsmail Bıkmaz',       role: 'manager',   department: 'Yönetim' },
    { username: 'personel',         password: 'personel123', fullName: 'Demo Personel',       role: 'personnel', department: 'Operasyon' },
    { username: 'aigerimbikmaz',    password: 'aigerim123',  fullName: 'Aigerim Sabit BIKMAZ',role: 'manager',   department: 'Yönetim' },
    { username: 'diclebagli',       password: 'dicle123',    fullName: 'Dicle Bagli',         role: 'manager',   department: 'Yönetim' },
    { username: 'ozlemkucukyilmaz', password: 'ozlem123',   fullName: 'Ozlem KucukYilmaz',   role: 'manager',   department: 'Yönetim' },
    { username: 'burcuoktem',       password: 'burcu123',    fullName: 'Burcu Oktem',         role: 'manager',   department: 'Yönetim' },
    { username: 'zeynepyilmaz',     password: 'zeynep123',   fullName: 'Zeynep Yilmaz',      role: 'manager',   department: 'Yönetim' },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where:  { username: u.username },
      update: {},
      create: {
        username:     u.username,
        passwordHash: bcrypt.hashSync(u.password, 10),
        fullName:     u.fullName,
        role:         u.role,
        department:   u.department,
      },
    });
  }
  console.log(`✅ ${users.length} kullanıcı upsert edildi.`);

  // ─── Firmalar ─────────────────────────────────────────────────────────────
  const companies = [
    { name: 'BIKMAZ GRUP', themeColor: '#0b3d2e', isDefault: true },
    { name: 'BETA',        themeColor: '#1a56db', isDefault: false },
    { name: 'TETA',        themeColor: '#0891b2', isDefault: false },
    { name: 'SIMSOFT',     themeColor: '#0f766e', isDefault: false },
    { name: 'SmartICT',    themeColor: '#7c3aed', isDefault: false },
    { name: 'Airobos',     themeColor: '#b45309', isDefault: false },
    { name: 'Agrobrain',   themeColor: '#166534', isDefault: false },
    { name: 'Avaitech',    themeColor: '#1d4ed8', isDefault: false },
  ];

  for (const c of companies) {
    const existing = await prisma.company.findFirst({ where: { name: c.name }, select: { id: true } });
    if (!existing) {
      await prisma.company.create({ data: { name: c.name, themeColor: c.themeColor, isDefault: c.isDefault, isActive: true } });
    }
  }
  console.log(`✅ ${companies.length} firma upsert edildi.`);

  // ─── Yardımcı fonksiyonlar ────────────────────────────────────────────────
  const getUser    = (username) => prisma.user.findUnique({ where: { username }, select: { id: true } });
  const getCompany = (name)     => prisma.company.findFirst({ where: { name },   select: { id: true } });

  const upsertPersonnel = async (companyName, fullName, title, department, phone, email, userId) => {
    const company = await getCompany(companyName);
    if (!company) return;
    const existing = await prisma.personnel.findFirst({
      where: { fullName, companyId: company.id },
      select: { id: true },
    });
    if (!existing) {
      await prisma.personnel.create({
        data: { companyId: company.id, fullName, title: title || null, department: department || null, phone: phone || null, email: email || null, userId: userId || null, isActive: true },
      });
    }
  };

  // ─── Personel ─────────────────────────────────────────────────────────────
  const uid = {
    ismail: (await getUser('mudur'))?.id            || null,
    aigerim:(await getUser('aigerimbikmaz'))?.id     || null,
    dicle:  (await getUser('diclebagli'))?.id        || null,
    ozlem:  (await getUser('ozlemkucukyilmaz'))?.id  || null,
    burcu:  (await getUser('burcuoktem'))?.id        || null,
    zeynep: (await getUser('zeynepyilmaz'))?.id      || null,
  };

  const personnelList = [
    ['BIKMAZ GRUP','İsmail Bıkmaz',       'Yonetici','Yönetim',null,'ismail@bikmazgrup.com', uid.ismail],
    ['BIKMAZ GRUP','Aigerim Sabit BIKMAZ','Yonetici','Yönetim',null,'aigerim@bikmazgrup.com',uid.aigerim],
    ['BIKMAZ GRUP','Dicle Bagli',         'Yonetici','Yönetim',null,'dicle@bikmazgrup.com',  uid.dicle],
    ['BIKMAZ GRUP','Ozlem KucukYilmaz',   'Yonetici','Yönetim',null,'ozlem@bikmazgrup.com',  uid.ozlem],
    ['BIKMAZ GRUP','Burcu Oktem',         'Yonetici','Yönetim',null,'burcu@bikmazgrup.com',  uid.burcu],
    ['BIKMAZ GRUP','Zeynep Yilmaz',       'Yonetici','Yönetim',null,'zeynep@bikmazgrup.com', uid.zeynep],
    ['BETA','İsmail Bıkmaz',              'Yonetici','Yönetim',null,'ismail@beta.com',        uid.ismail],
    ['BETA','Aigerim Sabit BIKMAZ',       'Yonetici','Yönetim',null,'aigerim@beta.com',       uid.aigerim],
    ['BETA','Dicle Bagli',                'Yonetici','Yönetim',null,'dicle@beta.com',         uid.dicle],
    ['BETA','Ozlem KucukYilmaz',          'Yonetici','Yönetim',null,'ozlem@beta.com',         uid.ozlem],
    ['TETA','İsmail Bıkmaz',              'Yonetici','Yönetim',null,'ismail@teta.com',        uid.ismail],
    ['TETA','Burcu Oktem',                'Yonetici','Yönetim',null,'burcu@teta.com',         uid.burcu],
    ['TETA','Aigerim Sabit BIKMAZ',       'Yonetici','Yönetim',null,'aigerim@teta.com',       uid.aigerim],
    ['TETA','Zeynep Yilmaz',              'Yonetici','Yönetim',null,'zeynep@teta.com',        uid.zeynep],
    ['SIMSOFT','İsmail Bıkmaz',           'Yonetici','Yönetim',null,'ismail@simsoft.com',     uid.ismail],
    ['SIMSOFT','Aigerim Sabit BIKMAZ',    'Yonetici','Yönetim',null,'aigerim@simsoft.com',    uid.aigerim],
    ['SmartICT','İsmail Bıkmaz',          'Yonetici','Yönetim',null,'ismail@smartict.com',    uid.ismail],
    ['Airobos','İsmail Bıkmaz',           'Yonetici','Yönetim',null,'ismail@airobos.com',     uid.ismail],
    ['Airobos','Aigerim Sabit BIKMAZ',    'Yonetici','Yönetim',null,'aigerim@airobos.com',    uid.aigerim],
    ['Agrobrain','İsmail Bıkmaz',         'Yonetici','Yönetim',null,'ismail@agrobrain.com',   uid.ismail],
    ['Agrobrain','Burcu Oktem',           'Yonetici','Yönetim',null,'burcu@agrobrain.com',    uid.burcu],
    ['Agrobrain','Aigerim Sabit BIKMAZ',  'Yonetici','Yönetim',null,'aigerim@agrobrain.com',  uid.aigerim],
    ['Avaitech','İsmail Bıkmaz',          'Yonetici','Yönetim',null,'ismail@avaitech.com',    uid.ismail],
    ['Avaitech','Burcu Oktem',            'Yonetici','Yönetim',null,'burcu@avaitech.com',     uid.burcu],
    ['Avaitech','Aigerim Sabit BIKMAZ',   'Yonetici','Yönetim',null,'aigerim@avaitech.com',   uid.aigerim],
  ];

  for (const p of personnelList) {
    await upsertPersonnel(...p);
  }
  console.log(`✅ ${personnelList.length} personel upsert edildi.`);

  // ─── Toplantı Odaları ─────────────────────────────────────────────────────
  const rooms = [
    { name: 'Boğaz Salonu',   capacity: 20, floor: '5. Kat', equipment: 'Projeksiyon, Whiteboard, Video Konferans' },
    { name: 'Marmara Odası',  capacity: 8,  floor: '3. Kat', equipment: 'TV, Whiteboard' },
    { name: 'Karadeniz Odası',capacity: 6,  floor: '3. Kat', equipment: 'TV' },
    { name: 'VIP Lounge',     capacity: 4,  floor: '6. Kat', equipment: 'Mini Bar, TV, Ses Sistemi' },
  ];

  for (const r of rooms) {
    const existing = await prisma.room.findFirst({ where: { name: r.name }, select: { id: true } });
    if (!existing) {
      await prisma.room.create({ data: { ...r, status: 'available' } });
    }
  }
  console.log(`✅ Toplantı odaları upsert edildi.`);

  // ─── Demo Ziyaretçiler ────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);

  const getPersonnelId = async (fullName, companyName) => {
    const company = await getCompany(companyName);
    if (!company) return null;
    const p = await prisma.personnel.findFirst({ where: { fullName, companyId: company.id }, select: { id: true } });
    return p?.id || null;
  };

  const visitorDefs = [
    { fullName: 'Ahmet Yıldız', tcNo: '12345678901', phone: '0555 123 45 67', companyName: 'BETA',     hostCompany: 'BETA',     hostPerson: 'İsmail Bıkmaz',       reason: 'İş Görüşmesi',   status: 'inside', arrivalTime: new Date(`${today}T09:15:00+03:00`) },
    { fullName: 'Burcu Ekici',  tcNo: '',             phone: '0544 987 65 43', companyName: 'TETA',     hostCompany: 'TETA',     hostPerson: 'Burcu Oktem',         reason: 'Yonetim Görüşmesi',status: 'waiting',arrivalTime: null },
    { fullName: 'Can Doğan',   tcNo: '98765432100',  phone: '0533 456 78 90', companyName: 'Avaitech', hostCompany: 'Avaitech', hostPerson: 'Aigerim Sabit BIKMAZ',reason: 'Toplantı',        status: 'left',   arrivalTime: new Date(`${today}T08:30:00+03:00`) },
  ];

  const sekreter = await getUser('sekreter');
  for (const v of visitorDefs) {
    const existing = await prisma.visitor.findFirst({
      where: { fullName: v.fullName, createdAt: { gte: new Date(`${today}T00:00:00Z`) } },
      select: { id: true },
    });
    if (!existing) {
      const hostPersonnelId = await getPersonnelId(v.hostPerson, v.hostCompany);
      await prisma.visitor.create({
        data: {
          fullName:        v.fullName,
          tcNo:            v.tcNo || null,
          phone:           v.phone || null,
          companyName:     v.companyName || null,
          hostPersonnelId: hostPersonnelId,
          reason:          v.reason || null,
          status:          v.status,
          arrivalTime:     v.arrivalTime,
          createdBy:       sekreter?.id || null,
        },
      });
    }
  }
  console.log(`✅ Demo ziyaretçiler upsert edildi.`);

  // ─── Demo Randevular ──────────────────────────────────────────────────────
  const h = (hr, min) => new Date(`${today}T${String(hr).padStart(2,'0')}:${String(min).padStart(2,'0')}:00+03:00`);

  const apptDefs = [
    { visitorName: 'Selin Aydın', visitorPhone: '0511 111 11 11', visitorCompany: 'SmartICT', hostCompany: 'SmartICT', hostPerson: 'İsmail Bıkmaz',       reason: 'Ortaklık Görüşmesi',  time: h(11,0)  },
    { visitorName: 'Tamer Koç',  visitorPhone: '0522 222 22 22', visitorCompany: 'Agrobrain', hostCompany: 'Agrobrain', hostPerson: 'Burcu Oktem',         reason: 'Finansal Raporlama', time: h(14,30) },
    { visitorName: 'Elif Çelik', visitorPhone: '0533 333 33 33', visitorCompany: 'SIMSOFT',   hostCompany: 'SIMSOFT',   hostPerson: 'Aigerim Sabit BIKMAZ',reason: 'Yazılım Demo',        time: h(16,0)  },
  ];

  for (const a of apptDefs) {
    const existing = await prisma.appointment.findFirst({
      where: { visitorName: a.visitorName, plannedTime: a.time },
      select: { id: true },
    });
    if (!existing) {
      const hostPersonnelId = await getPersonnelId(a.hostPerson, a.hostCompany);
      await prisma.appointment.create({
        data: {
          visitorName:     a.visitorName,
          visitorPhone:    a.visitorPhone || null,
          visitorCompany:  a.visitorCompany || null,
          hostPersonnelId: hostPersonnelId,
          reason:          a.reason || null,
          plannedTime:     a.time,
          status:          'planned',
          createdBy:       sekreter?.id || null,
        },
      });
    }
  }
  console.log(`✅ Demo randevular upsert edildi.`);

  // ─── Kara Liste ───────────────────────────────────────────────────────────
  const blExists = await prisma.blacklist.findFirst({ where: { tcNo: '11111111111' }, select: { id: true } });
  if (!blExists) {
    await prisma.blacklist.create({
      data: { fullName: 'Hırsız Hasan', tcNo: '11111111111', company: 'Kimlik Yok', reason: 'Hırsızlık girişimi', addedBy: 1 },
    });
  }
  console.log(`✅ Kara liste upsert edildi.`);

  console.log('\n✅ Demo veri yüklendi!\n');
  console.log('📋 Kullanıcılar:');
  console.log('  admin     / admin123    → Sistem Yöneticisi');
  console.log('  sekreter  / sekreter123 → Gulmira Bakmaz (Resepsiyon)');
  console.log('  mudur     / mudur123    → İsmail Bıkmaz (Genel Müdür)');
  console.log('  personel  / personel123 → Demo Personel');
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
