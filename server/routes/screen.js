const express = require('express');
const {
  closeActiveScreenLog,
  startScreenLog,
  loadCurrentScreenState,
} = require('../services/screen-service');
const router = express.Router();

const SCREEN_API_KEY = (process.env.SCREEN_API_KEY || '').trim();

const screenAuth = (req, res, next) => {
  if (!SCREEN_API_KEY) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({ error: 'SCREEN_API_KEY tanimli degil' });
    }
    return next();
  }
  const key = req.headers['x-screen-key'];
  if (key && key === SCREEN_API_KEY) return next();
  return res.status(401).json({ error: 'Yetkisiz ekran erişimi' });
};

// GET /api/screen/current — lobi ekranı için mevcut durum
router.get('/current', async (req, res) => {
  try {
    res.json(await loadCurrentScreenState());
  } catch (e) {
    console.error('GET /api/screen/current hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/screen/log — içerik başlangıç/bitiş kaydı
router.post('/log', screenAuth, async (req, res) => {
  try {
    const { visitor_id, content_id, action } = req.body || {};
    if (!action || !['content_start', 'content_end'].includes(action)) {
      return res.status(400).json({ error: 'Geçersiz action' });
    }

    if (action === 'content_start') {
      await closeActiveScreenLog();
      await startScreenLog(visitor_id, content_id, action);
      return res.json({ ok: true, started: true });
    }

    // content_end
    const closedId = await closeActiveScreenLog();
    return res.json({ ok: true, closed: closedId || null });
  } catch (e) {
    console.error('POST /api/screen/log hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
