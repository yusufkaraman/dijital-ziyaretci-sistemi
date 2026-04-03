const jwt = require('jsonwebtoken');
const { db } = require('../database');

module.exports = (req, res, next) => {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token gerekli' });
  }
  const token = auth.slice(7);

  // 1️⃣ JWT doğrulama — sadece JWT hatası 401 döndürür
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token' });
  }

  // 2️⃣ DB sorgusu — DB hatası 500 döndürür (401 değil)
  try {
    const user = db.prepare(
      'SELECT id, username, full_name, role, department FROM users WHERE id=? AND is_active=1'
    ).get(payload.id);

    if (!user) return res.status(401).json({ error: 'Kullanıcı bulunamadı veya devre dışı' });

    req.user = user;
    next();
  } catch (e) {
    console.error('Auth DB hatası:', e.message);
    return res.status(500).json({ error: 'Sunucu hatası: veritabanı sorgusu başarısız' });
  }
};
