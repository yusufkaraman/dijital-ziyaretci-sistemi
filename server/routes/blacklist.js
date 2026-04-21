const express = require('express');
const prisma = require('../prisma');
const auth = require('../middleware/auth');
const router = express.Router();

/** API contract helper */
function toApiShape(b) {
  return {
    id:         b.id,
    full_name:  b.fullName,
    tc_no:      b.tcNo,
    company:    b.company,
    reason:     b.reason,
    added_by:   b.addedBy,
    created_at: b.createdAt,
  };
}

// GET /api/blacklist
router.get('/', auth, async (req, res) => {
  try {
    const items = await prisma.blacklist.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(items.map(toApiShape));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/blacklist/check/:tc — auth gerektirmez (check-in ekranı)
router.get('/check/:tc', async (req, res) => {
  try {
    const entry = await prisma.blacklist.findFirst({ where: { tcNo: req.params.tc } });
    res.json({ blacklisted: !!entry, entry: entry ? toApiShape(entry) : null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/blacklist
router.post('/', auth, async (req, res) => {
  try {
    const { full_name, tc_no, company, reason } = req.body;
    if (!full_name) return res.status(400).json({ error: 'Ad soyad zorunlu' });
    if (tc_no && !/^\d{11}$/.test(tc_no)) {
      return res.status(400).json({ error: 'TC kimlik numarası 11 haneli olmalı' });
    }

    const created = await prisma.blacklist.create({
      data: {
        fullName: full_name,
        tcNo:     tc_no   || null,
        company:  company || null,
        reason:   reason  || null,
        addedBy:  req.user.id,
      },
    });
    const shaped = toApiShape(created);
    if (global.io) global.io.emit('blacklist:created', { entry: shaped });
    res.json(shaped);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/blacklist/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const deletedId = Number(req.params.id);
    await prisma.blacklist.delete({ where: { id: deletedId } });
    if (global.io) global.io.emit('blacklist:deleted', { id: deletedId });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
