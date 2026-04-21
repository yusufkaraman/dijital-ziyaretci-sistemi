const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

module.exports = async (req, res, next) => {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token gerekli' });
  }
  const token = auth.slice(7);

  // 1️⃣ JWT doğrulama — sadece JWT hatası 401 döndürür
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (e) {
    return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token' });
  }

  // 2️⃣ DB sorgusu — DB hatası 500 döndürür (401 değil)
  try {
    const user = await prisma.user.findFirst({
      where: { id: payload.id, isActive: true },
      select: { id: true, username: true, fullName: true, role: true, department: true },
    });

    if (!user) return res.status(401).json({ error: 'Kullanıcı bulunamadı veya devre dışı' });

    // API contract: frontend full_name anahtarını bekliyor
    req.user = { ...user, full_name: user.fullName };
    next();
  } catch (e) {
    console.error('Auth DB hatası:', e.message);
    return res.status(500).json({ error: 'Sunucu hatası: veritabanı sorgusu başarısız' });
  }
};
