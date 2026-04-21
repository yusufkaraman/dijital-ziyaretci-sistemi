// Test bootstrap seed — minimal, hızlı, sadece test ortamı için
const bcrypt = require('bcryptjs');
const prisma = require('./prisma');

async function seed() {
  // Temel kullanıcılar
  const users = [
    { username: 'admin',         password: 'admin123',    fullName: 'Sistem Yöneticisi',    role: 'admin',     department: 'BT' },
    { username: 'sekreter',      password: 'sekreter123', fullName: 'Gulmira Bakmaz',       role: 'secretary', department: 'Resepsiyon' },
    { username: 'mudur',         password: 'mudur123',    fullName: 'İsmail Bıkmaz',        role: 'manager',   department: 'Yönetim' },
    { username: 'aigerimbikmaz', password: 'aigerim123',  fullName: 'Aigerim Sabit BIKMAZ', role: 'manager',   department: 'Yönetim' },
    { username: 'burcuoktem',    password: 'burcu123',    fullName: 'Burcu Oktem',          role: 'manager',   department: 'Yönetim' },
  ];
  for (const u of users) {
    await prisma.user.create({
      data: { username: u.username, passwordHash: bcrypt.hashSync(u.password, 10), fullName: u.fullName, role: u.role, department: u.department },
    });
  }

  // Temel firmalar
  const companies = [
    { name: 'BIKMAZ GRUP', themeColor: '#0b3d2e', isDefault: true },
    { name: 'BETA',        themeColor: '#1a56db', isDefault: false },
    { name: 'TETA',        themeColor: '#0891b2', isDefault: false },
  ];
  for (const c of companies) {
    await prisma.company.create({ data: { name: c.name, themeColor: c.themeColor, isDefault: c.isDefault, isActive: true } });
  }

  // Temel personel
  const bikmazId = (await prisma.company.findFirst({ where: { name: 'BIKMAZ GRUP' } }))?.id;
  const mudurId  = (await prisma.user.findUnique({ where: { username: 'mudur' } }))?.id;
  if (bikmazId) {
    await prisma.personnel.create({ data: { companyId: bikmazId, fullName: 'İsmail Bıkmaz', title: 'Yonetici', department: 'Yönetim', userId: mudurId || null, isActive: true } });
  }

  // Temel sistem ayarları (screen/settings testleri için)
  const settings = [
    { key: 'welcome_message',       value: 'Hoş Geldiniz',     label: 'Karşılama Mesajı' },
    { key: 'company_name',          value: 'BIKMAZ GRUP',      label: 'Şirket Adı' },
    { key: 'weather_city',          value: 'Ankara',           label: 'Hava Durumu Şehri' },
    { key: 'visitor_form_tc',       value: '1',                label: 'TC Zorunlu' },
    { key: 'visitor_form_phone',    value: '1',                label: 'Telefon Zorunlu' },
    { key: 'visitor_form_company',  value: '0',                label: 'Şirket Zorunlu' },
    { key: 'visitor_form_vehicle',  value: '0',                label: 'Araç Zorunlu' },
    { key: 'visitor_form_reason',   value: '1',                label: 'Ziyaret Sebebi Zorunlu' },
    { key: 'auto_approve',          value: '0',                label: 'Otomatik Onay' },
    { key: 'screen_refresh_rate',   value: '30',               label: 'Ekran Yenileme (sn)' },
    { key: 'logo_path',             value: '',                 label: 'Logo Yolu' },
    { key: 'favicon_path',          value: '',                 label: 'Favicon Yolu' },
  ];
  for (const s of settings) {
    await prisma.systemSetting.create({ data: s });
  }

  // Kara liste (blacklist check testi için)
  await prisma.blacklist.create({ data: { fullName: 'Hırsız Hasan', tcNo: '11111111111', company: 'Kimlik Yok', reason: 'Hırsızlık girişimi', addedBy: 1 } });
}

module.exports = { seed };
