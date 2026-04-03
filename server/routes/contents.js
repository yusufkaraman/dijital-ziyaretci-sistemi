const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { db } = require('../database');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const { ensureUploadPath, cleanupContentFile } = require('../services/content-service');

const UPLOAD_PATH = process.env.UPLOAD_PATH || './server/uploads';
ensureUploadPath(UPLOAD_PATH);

const ALLOWED_MIME = {
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/webp': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
};

const EXT_MAP = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB sınır

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_PATH),
  filename: (req, file, cb) => {
    const ext = EXT_MAP[file.mimetype] || path.extname(file.originalname).toLowerCase();
    const safeExt = Object.values(EXT_MAP).includes(ext) ? ext : '.bin';
    const name = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random()*1e9)}`;
    cb(null, `media-${name}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME[file.mimetype]) {
      return cb(new Error('Yalnızca PNG, JPG, WEBP, MP4, WEBM yükleyebilirsiniz'));
    }
    cb(null, true);
  }
});

// GET /api/contents (list all contents, optionally filter by company_id)
router.get('/', (req, res) => {
  try {
    const { company_id } = req.query;
    let results;
    if (company_id) {
      results = db.prepare('SELECT * FROM contents WHERE company_id = ? ORDER BY display_order ASC').all(company_id);
    } else {
      results = db.prepare('SELECT * FROM contents ORDER BY display_order ASC').all();
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contents/:id
router.get('/:id', (req, res) => {
  try {
    const content = db.prepare('SELECT * FROM contents WHERE id = ?').get(req.params.id);
    if (!content) return res.status(404).json({ error: 'İçerik bulunamadı' });
    res.json(content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contents/upload (File upload with validation)
router.post('/upload', auth, (req, res) => {
  upload.single('media')(req, res, (err) => {
    if (err) {
      logger.error('UPLOAD', 'Multer upload error', { error: err.message, body: req.body }, req.user ? req.user.id : null);
      return res.status(400).json({ error: err.message || 'Yükleme hatası' });
    }

    try {
      const { company_id, type, title, display_order, is_default, is_active } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'Dosya yüklenmedi.' });
      }

      const detectedType = ALLOWED_MIME[req.file.mimetype];
      if (type && type !== detectedType) {
        return res.status(400).json({ error: `Dosya türü '${detectedType}' olarak algılandı, 'type' ile eşleşmiyor` });
      }

      const filePath = `/uploads/${req.file.filename}`;

      const result = db.prepare(`
        INSERT INTO contents (company_id, type, file_path, title, display_order, is_default, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        company_id || null,
        type || detectedType,
        filePath,
        title || req.file.originalname,
        display_order || 0,
        is_default || 0,
        is_active !== undefined ? is_active : 1
      );

      res.status(201).json({ id: result.lastInsertRowid, file_path: filePath, message: 'Yükleme başarılı' });
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

// POST /api/contents (Create text/web content without file)
router.post('/', auth, (req, res) => {
  try {
    const { company_id, type, title, content_text, display_order, is_default, is_active } = req.body;

    const result = db.prepare(`
      INSERT INTO contents (company_id, type, title, content_text, display_order, is_default, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      company_id || null,
      type || 'text',
      title || '',
      content_text || '',
      display_order || 0,
      is_default || 0,
      is_active !== undefined ? is_active : 1
    );

    res.status(201).json({ id: result.lastInsertRowid, message: 'Başarıyla oluşturuldu' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/contents/:id
router.put('/:id', auth, (req, res) => {
  try {
    const { title, content_text, display_order, is_default, is_active } = req.body;

    const content = db.prepare('SELECT * FROM contents WHERE id = ?').get(req.params.id);
    if (!content) return res.status(404).json({ error: 'İçerik bulunamadı' });

    db.prepare(`
      UPDATE contents
      SET title = COALESCE(?, title),
          content_text = COALESCE(?, content_text),
          display_order = COALESCE(?, display_order),
          is_default = COALESCE(?, is_default),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(title, content_text, display_order, is_default, is_active, req.params.id);

    res.json({ message: 'İçerik güncellendi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/contents/:id
router.delete('/:id', auth, (req, res) => {
  try {
    const content = db.prepare('SELECT * FROM contents WHERE id = ?').get(req.params.id);
    if (!content) return res.status(404).json({ error: 'İçerik bulunamadı' });

    cleanupContentFile(content, UPLOAD_PATH);

    db.prepare('DELETE FROM contents WHERE id = ?').run(req.params.id);
    res.json({ message: 'İçerik silindi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
