const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const authenticateToken = require('../middleware/auth');

// POST /api/push/subscribe — Kullanıcıyı push bildirimlerine abone et
router.post('/subscribe', authenticateToken, async (req, res) => {
  try {
    const subscription = JSON.stringify(req.body);
    const userId = req.user.id;

    // upsert: aynı (userId, subscription) çifti tekrar eklenmesin
    await prisma.pushSubscription.upsert({
      where: { userId_subscription: { userId, subscription } },
      update: {},
      create: { userId, subscription },
    });

    res.status(201).json({ message: 'Push subscription saved' });
  } catch (e) {
    console.error('POST /api/push/subscribe hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
