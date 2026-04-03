const express = require('express');
const router = express.Router();
const { db } = require('../database');
const authenticateToken = require('../middleware/auth');

// Kullanıcıyı push bildirimlerine abone et
router.post('/subscribe', authenticateToken, (req, res) => {
  const subscription = JSON.stringify(req.body);
  const userId = req.user.id;

  try {
    db.prepare(`
      INSERT OR REPLACE INTO push_subscriptions (user_id, subscription) 
      VALUES (?, ?)
    `).run(userId, subscription);
    res.status(201).json({ message: 'Push subscription saved' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
