// İlk başlatmada otomatik seed — sadece users tablosu boşsa çalışır (async, fire-and-forget)
process.env.TZ = 'Europe/Istanbul';
const bcrypt = require('bcryptjs');
const prisma = require('./prisma');

async function autoSeed() {
  const count = await prisma.user.count();
  if (count > 0) return; // Zaten seed edilmiş

  console.log('İlk başlatma: admin hesabı ve varsayılan firma oluşturuluyor...');

  // ── Admin Kullanıcı ──────────────────────────────────────
  await prisma.user.create({
    data: {
      username:     'admin',
      passwordHash: bcrypt.hashSync('admin123', 10),
      fullName:     'Sistem Yöneticisi',
      role:         'admin',
      department:   'BT',
    },
  });

  // ── Varsayılan Firma ─────────────────────────────────────
  const existing = await prisma.company.findFirst({ where: { name: 'BIKMAZ GRUP' } });
  if (!existing) {
    await prisma.company.create({
      data: { name: 'BIKMAZ GRUP', themeColor: '#0b3d2e', isDefault: true, isActive: true },
    });
  }

  console.log('Admin hesabı oluşturuldu. İlk girişten sonra şifreyi değiştirin.');
}

// Fire-and-forget — server başlangıcını bloklamaz
autoSeed().catch(e => console.error('seed-auto error:', e.message));
