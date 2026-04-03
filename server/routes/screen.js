const express = require('express');
const { db } = require('../database');
const {
  closeActiveScreenLog,
  startScreenLog,
  loadCurrentScreenState,
} = require('../services/screen-service');
const router = express.Router();

const SCREEN_API_KEY = process.env.SCREEN_API_KEY || '';

const screenAuth = (req, res, next) => {
  if (!SCREEN_API_KEY) return next();
  const key = req.headers['x-screen-key'] || req.query.key;
  if (key && key === SCREEN_API_KEY) return next();
  return res.status(401).json({ error: 'Yetkisiz ekran erişimi' });
};

// GET /api/screen/current — lobi ekranı için mevcut durum
router.get('/current', (req, res) => {
  res.json(loadCurrentScreenState(db));
});

// POST /api/screen/log — içerik başlangıç/bitiş kaydı
router.post('/log', screenAuth, (req, res) => {
  const { visitor_id, content_id, action } = req.body || {};
  if (!action || !['content_start', 'content_end'].includes(action)) {
    return res.status(400).json({ error: 'Geçersiz action' });
  }

  if (action === 'content_start') {
    closeActiveScreenLog(db);
    startScreenLog(db, visitor_id, content_id, action);
    return res.json({ ok: true, started: true });
  }

  // content_end
  const closedId = closeActiveScreenLog(db);
  return res.json({ ok: true, closed: closedId || null });
});

module.exports = router;
