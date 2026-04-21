const express = require('express');
const path = require('path');
const multer = require('multer');
const prisma = require('../prisma');
const auth = require('../middleware/auth');
const { canManageCompanies, canDeleteCompany } = require('../policies/permissions');
const router = express.Router();

const UPLOAD_PATH = process.env.UPLOAD_PATH || './server/uploads';
const DEFAULT_LOGO_PATH = '/Assets/sitelogo.png';

function normalizeLogoPath(logoPath) {
  if (!logoPath) return logoPath;
  const value = String(logoPath);
  if (/B%C4%B1kmazGrup\.jpg|BıkmazGrup\.jpg|BikmazGrup\.jpg/i.test(value)) {
    return DEFAULT_LOGO_PATH;
  }
  return value;
}

const logoStorage = multer.diskStorage({
  destination: UPLOAD_PATH,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo-${Date.now()}${ext}`);
  },
});
const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|gif|svg\+xml|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Sadece resim dosyaları yüklenebilir'));
  },
});

/** API contract helper: Prisma camelCase → API snake_case */
function toApiShape(c) {
  return {
    id:          c.id,
    name:        c.name,
    logo_path:   normalizeLogoPath(c.logoPath),
    theme_color: c.themeColor,
    is_default:  c.isDefault ? 1 : 0,
    is_active:   c.isActive  ? 1 : 0,
    created_at:  c.createdAt,
  };
}

// GET /api/companies
router.get('/', auth, async (req, res) => {
  try {
    const { active_only, limit, offset } = req.query;
    const lim = Number.parseInt(limit, 10);
    const off = Number.parseInt(offset, 10);
    const hasLimit  = Number.isInteger(lim) && lim > 0;
    const hasOffset = Number.isInteger(off) && off >= 0;

    const where = {};
    if (active_only !== 'false') where.isActive = true;

    const companies = await prisma.company.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      take: hasLimit ? Math.min(lim, 500) : undefined,
      skip: hasLimit && hasOffset ? off : undefined,
    });

    res.json(companies.map(toApiShape));
  } catch (e) {
    console.error('GET /api/companies hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/companies
router.post('/', auth, async (req, res) => {
  try {
    if (!canManageCompanies(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });

    const { name, theme_color, is_default } = req.body;
    if (!name) return res.status(400).json({ error: 'Firma adı zorunlu' });

    // Plan §4.7: company default switch atomik transaction
    const created = await prisma.$transaction(async (tx) => {
      if (is_default) {
        await tx.company.updateMany({ data: { isDefault: false } });
      }
      return tx.company.create({
        data: {
          name,
          themeColor: theme_color || '#1a56db',
          isDefault:  Boolean(is_default),
        },
      });
    });

    const shaped = toApiShape(created);
    if (global.io) global.io.emit('company:created', { company: shaped });
    res.json(shaped);
  } catch (e) {
    console.error('POST /api/companies hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/companies/:id
router.put('/:id', auth, async (req, res) => {
  try {
    if (!canManageCompanies(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });

    const { name, theme_color, is_default, is_active, logo_path } = req.body;

    // Plan §4.7: company default switch atomik transaction
    const updated = await prisma.$transaction(async (tx) => {
      if (is_default) {
        await tx.company.updateMany({ data: { isDefault: false } });
      }
      const data = {
        name,
        themeColor: theme_color || '#1a56db',
        isDefault:  Boolean(is_default),
        isActive:   is_active !== undefined ? Boolean(is_active) : true,
      };
      if (logo_path !== undefined) data.logoPath = logo_path || null;
      return tx.company.update({
        where: { id: Number(req.params.id) },
        data,
      });
    });

    const shaped = toApiShape(updated);
    if (global.io) global.io.emit('company:updated', { company: shaped });
    res.json(shaped);
  } catch (e) {
    console.error('PUT /api/companies/:id hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/companies/:id/logo — Logo yükleme
router.post('/:id/logo', auth, (req, res) => {
  if (!canManageCompanies(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });

  logoUpload.single('logo')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Dosya seçilmedi' });

    try {
      const logoPath = `/uploads/${req.file.filename}`;
      const updated = await prisma.company.update({
        where: { id: Number(req.params.id) },
        data: { logoPath },
      });
      res.json(toApiShape(updated));
    } catch (e) {
      console.error('POST /api/companies/:id/logo hatası:', e.message);
      res.status(500).json({ error: e.message });
    }
  });
});

// PUT /api/companies/:id/default
router.put('/:id/default', auth, async (req, res) => {
  try {
    if (!canManageCompanies(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });

    // Plan §4.7: clear previous default and set new default atomically
    await prisma.$transaction([
      prisma.company.updateMany({ data: { isDefault: false } }),
      prisma.company.update({
        where: { id: Number(req.params.id) },
        data:  { isDefault: true },
      }),
    ]);

    if (global.io) global.io.emit('company:updated', { id: Number(req.params.id), is_default: true });
    res.json({ success: true });
  } catch (e) {
    console.error('PUT /api/companies/:id/default hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/companies/:id  (soft-delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!canDeleteCompany(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });

    const company = await prisma.company.findUnique({
      where: { id: Number(req.params.id) },
      select: { id: true, isActive: true, isDefault: true },
    });
    if (!company) return res.status(404).json({ error: 'Firma bulunamadı' });
    if (!company.isActive) return res.json({ success: true });

    const activeCount = await prisma.company.count({ where: { isActive: true } });
    if (activeCount <= 1) return res.status(400).json({ error: 'En az bir aktif firma kalmalıdır' });

    // Plan §4.7: default switch + soft-delete atomik
    await prisma.$transaction(async (tx) => {
      if (company.isDefault) {
        const fallback = await tx.company.findFirst({
          where: { isActive: true, id: { not: company.id } },
          orderBy: { name: 'asc' },
          select: { id: true },
        });
        if (!fallback) throw Object.assign(new Error('Varsayılan firma değiştirilemedi'), { status: 400 });

        await tx.company.update({ where: { id: company.id  }, data: { isDefault: false } });
        await tx.company.update({ where: { id: fallback.id }, data: { isDefault: true  } });
      }
      await tx.company.update({ where: { id: company.id }, data: { isActive: false } });
    });

    if (global.io) global.io.emit('company:deleted', { id: Number(req.params.id) });
    res.json({ success: true });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('DELETE /api/companies/:id hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
