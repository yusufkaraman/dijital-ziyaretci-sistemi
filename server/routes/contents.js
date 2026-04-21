const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const prisma = require('../prisma');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const { ensureUploadPath, cleanupContentFile } = require('../services/content-service');
const { requirePermission, canManageCompanies } = require('../policies/permissions');

const UPLOAD_PATH = process.env.UPLOAD_PATH || './server/uploads';
ensureUploadPath(UPLOAD_PATH);

function emitContentUpdated(action, contentId) {
  if (global.io) global.io.emit('content:updated', { action, content_id: contentId || null });
}

const ALLOWED_MIME = {
  'image/png': 'image', 'image/jpeg': 'image',
  'image/jpg': 'image',  'image/webp': 'image',
  'video/mp4': 'video',  'video/webm': 'video',
};

const EXT_MAP = {
  'image/png': '.png', 'image/jpeg': '.jpg',
  'image/jpg': '.jpg', 'image/webp': '.webp',
  'video/mp4': '.mp4', 'video/webm': '.webm',
};

const MAX_FILE_SIZE = Infinity;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_PATH),
  filename: (req, file, cb) => {
    const ext = EXT_MAP[file.mimetype] || path.extname(file.originalname).toLowerCase();
    const safeExt = Object.values(EXT_MAP).includes(ext) ? ext : '.bin';
    const name = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random()*1e9)}`;
    cb(null, `media-${name}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME[file.mimetype]) {
      return cb(new Error('Yalnızca PNG, JPG, WEBP, MP4, WEBM yükleyebilirsiniz'));
    }
    cb(null, true);
  },
});

/** API contract helper */
function toApiShape(c) {
  if (!c) return null;
  return {
    id:            c.id,
    company_id:    c.companyId,
    type:          c.type,
    file_path:     c.filePath,
    title:         c.title,
    content_text:  c.contentText,
    display_order: c.displayOrder,
    is_default:    c.isDefault ? 1 : 0,
    is_active:     c.isActive  ? 1 : 0,
    created_at:    c.createdAt,
    company_name:  c.company?.name ?? null,
    company_logo:  c.company?.logoPath ?? null,
  };
}

// GET /api/contents
router.get('/', async (req, res) => {
  try {
    const { company_id } = req.query;
    const where = company_id ? { companyId: Number(company_id) } : {};
    const results = await prisma.content.findMany({
      where,
      orderBy: { displayOrder: 'asc' },
      include: { company: { select: { id: true, name: true, logoPath: true } } },
    });
    res.json(results.map(c => {
      const shape = toApiShape(c);
      if (c.filePath) {
        try {
          const fullPath = path.resolve(UPLOAD_PATH, path.basename(c.filePath));
          const stat = fs.statSync(fullPath);
          shape.file_size = stat.size;
        } catch (_) { shape.file_size = null; }
      } else { shape.file_size = null; }
      return shape;
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contents/:id
router.get('/:id', async (req, res) => {
  try {
    const content = await prisma.content.findUnique({ where: { id: Number(req.params.id) } });
    if (!content) return res.status(404).json({ error: 'İçerik bulunamadı' });
    res.json(toApiShape(content));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contents/upload — Dosya yükleme
router.post('/upload', auth, requirePermission(canManageCompanies, 'İçerik yükleme yetkiniz yok'), (req, res) => {
  upload.single('media')(req, res, async (err) => {
    if (err) {
      logger.error('UPLOAD', 'Multer upload error', { error: err.message, body: req.body }, req.user ? req.user.id : null);
      return res.status(400).json({ error: err.message || 'Yükleme hatası' });
    }

    try {
      const { company_id, type, title, display_order, is_default, is_active } = req.body;
      if (!req.file) return res.status(400).json({ error: 'Dosya yüklenmedi.' });

      const detectedType = ALLOWED_MIME[req.file.mimetype];
      if (type && type !== detectedType) {
        return res.status(400).json({ error: `Dosya türü '${detectedType}' olarak algılandı, 'type' ile eşleşmiyor` });
      }

      const filePath = `/uploads/${req.file.filename}`;

      const created = await prisma.content.create({
        data: {
          companyId:    company_id ? Number(company_id) : null,
          type:         type || detectedType,
          filePath,
          title:        title || req.file.originalname,
          displayOrder: display_order ? Number(display_order) : 0,
          isDefault:    Boolean(is_default),
          isActive:     is_active !== undefined ? Boolean(Number(is_active)) : true,
        },
      });

      emitContentUpdated('upload', created.id);
      res.status(201).json({ id: created.id, file_path: filePath, message: 'Yükleme başarılı' });
    } catch (e) {
      // Temizlik: DB ekleme hatasında dosyayı sil
      if (req.file) {
        const fullPath = path.join(UPLOAD_PATH, req.file.filename);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      }
      res.status(500).json({ error: e.message });
    }
  });
});

// POST /api/contents — Metin/web içeriği oluştur
router.post('/', auth, requirePermission(canManageCompanies, 'İçerik oluşturma yetkiniz yok'), async (req, res) => {
  try {
    const { company_id, type, title, content_text, display_order, is_default, is_active } = req.body;

    if (!type || !type.trim()) return res.status(400).json({ error: 'İçerik türü (type) zorunlu' });
    if (!title || !title.trim()) return res.status(400).json({ error: 'Başlık (title) zorunlu' });

    const created = await prisma.content.create({
      data: {
        companyId:    company_id ? Number(company_id) : null,
        type:         type || 'text',
        title:        title || '',
        contentText:  content_text || '',
        displayOrder: display_order ? Number(display_order) : 0,
        isDefault:    Boolean(is_default),
        isActive:     is_active !== undefined ? Boolean(Number(is_active)) : true,
      },
    });

    emitContentUpdated('create', created.id);
    res.status(201).json({ id: created.id, message: 'Başarıyla oluşturuldu' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/contents/:id
router.put('/:id', auth, requirePermission(canManageCompanies, 'İçerik güncelleme yetkiniz yok'), async (req, res) => {
  try {
    const { title, content_text, display_order, is_default, is_active, company_id } = req.body;

    const existing = await prisma.content.findUnique({ where: { id: Number(req.params.id) } });
    if (!existing) return res.status(404).json({ error: 'İçerik bulunamadı' });

    // COALESCE mantığı: undefined ise mevcut değeri koru
    const updated = await prisma.content.update({
      where: { id: Number(req.params.id) },
      data: {
        title:        title        !== undefined ? title        : existing.title,
        contentText:  content_text !== undefined ? content_text : existing.contentText,
        displayOrder: display_order !== undefined ? Number(display_order) : existing.displayOrder,
        isDefault:    is_default   !== undefined ? Boolean(Number(is_default)) : existing.isDefault,
        isActive:     is_active    !== undefined ? Boolean(Number(is_active))  : existing.isActive,
        companyId:    company_id   !== undefined ? (company_id ? Number(company_id) : null) : existing.companyId,
      },
    });

    emitContentUpdated('update', updated.id);
    res.json({ message: 'İçerik güncellendi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/contents/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const allowedRoles = ['admin', 'manager'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'İçerik silme yetkiniz yok' });
    }

    const content = await prisma.content.findUnique({ where: { id: Number(req.params.id) } });
    if (!content) return res.status(404).json({ error: 'İçerik bulunamadı' });

    // Dosyayı disk'ten temizle (snake_case uyumu için manuel mapping)
    cleanupContentFile({ file_path: content.filePath }, UPLOAD_PATH);

    await prisma.content.delete({ where: { id: Number(req.params.id) } });
    emitContentUpdated('delete', content.id);
    res.json({ message: 'İçerik silindi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
