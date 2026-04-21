const express = require('express');
const prisma = require('../prisma');
const auth = require('../middleware/auth');
const { canDeletePersonnel } = require('../policies/permissions');
const { getOrCreateCompany, normalizeManagerPersonnelRecord } = require('../services/personnel-service');
const router = express.Router();

/** API contract helper: Prisma camelCase → API snake_case */
function toApiShape(p) {
  return {
    id:           p.id,
    company_id:   p.companyId,
    full_name:    p.fullName,
    title:        p.title,
    department:   p.department,
    phone:        p.phone,
    email:        p.email,
    user_id:      p.userId,
    is_active:    p.isActive ? 1 : 0,
    created_at:   p.createdAt,
    company_name: p.company?.name ?? null,
  };
}

// GET /api/personnel
router.get('/', auth, async (req, res) => {
  try {
    await normalizeManagerPersonnelRecord();

    const { company_id, active_only, limit, offset } = req.query;
    const lim = Number.parseInt(limit, 10);
    const off = Number.parseInt(offset, 10);
    const hasLimit  = Number.isInteger(lim) && lim > 0;
    const hasOffset = Number.isInteger(off) && off >= 0;

    const where = {};
    if (company_id) where.companyId = Number(company_id);
    if (active_only !== 'false') where.isActive = true;

    const records = await prisma.personnel.findMany({
      where,
      orderBy: { fullName: 'asc' },
      take:  hasLimit ? Math.min(lim, 500) : undefined,
      skip:  hasLimit && hasOffset ? off : undefined,
      include: { company: { select: { name: true } } },
    });

    res.json(records.map(toApiShape));
  } catch (e) {
    console.error('GET /api/personnel hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/personnel/:id
router.get('/:id', auth, async (req, res) => {
  try {
    await normalizeManagerPersonnelRecord();
    const p = await prisma.personnel.findUnique({
      where: { id: Number(req.params.id) },
      include: { company: { select: { name: true } } },
    });
    if (!p) return res.status(404).json({ error: 'Bulunamadı' });
    res.json(toApiShape(p));
  } catch (e) {
    console.error('GET /api/personnel/:id hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/personnel
router.post('/', auth, async (req, res) => {
  try {
    const { company_name, full_name, title, department, phone, email, user_id } = req.body;
    if (!full_name) return res.status(400).json({ error: 'Ad soyad zorunlu' });

    const cid = await getOrCreateCompany(company_name);

    const created = await prisma.personnel.create({
      data: {
        companyId:  cid,
        fullName:   full_name,
        title:      title  || null,
        department: department || null,
        phone:      phone  || null,
        email:      email  || null,
        userId:     user_id ? Number(user_id) : null,
      },
      include: { company: { select: { name: true } } },
    });

    const shaped = toApiShape(created);
    if (global.io) global.io.emit('personnel:created', { personnel: shaped });
    res.json(shaped);
  } catch (e) {
    console.error('POST /api/personnel hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/personnel/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { company_name, full_name, title, department, phone, email, is_active, user_id } = req.body;
    const cid = await getOrCreateCompany(company_name);

    const updated = await prisma.personnel.update({
      where: { id: Number(req.params.id) },
      data: {
        companyId:  cid,
        fullName:   full_name,
        title:      title  || null,
        department: department || null,
        phone:      phone  || null,
        email:      email  || null,
        isActive:   is_active !== undefined ? Boolean(is_active) : true,
        userId:     user_id ? Number(user_id) : null,
      },
      include: { company: { select: { name: true } } },
    });

    const shaped = toApiShape(updated);
    if (global.io) global.io.emit('personnel:updated', { personnel: shaped });
    res.json(shaped);
  } catch (e) {
    console.error('PUT /api/personnel/:id hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/personnel/:id  (soft-delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!canDeletePersonnel(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });

    const deletedId = Number(req.params.id);
    await prisma.personnel.update({
      where: { id: deletedId },
      data:  { isActive: false },
    });

    if (global.io) global.io.emit('personnel:deleted', { id: deletedId });
    res.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/personnel/:id hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
