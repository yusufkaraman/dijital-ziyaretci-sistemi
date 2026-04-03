// ── Simdesk — Request Doğrulama Middleware ────────────────
// Kullanım: router.post('/', validate(['full_name', 'reason']), handler)

/**
 * Belirtilen alanların body'de bulunmasını zorunlu kılar.
 * @param {string[]} required - Zorunlu alan adları
 */
function requireFields(required = []) {
  return (req, res, next) => {
    const missing = required.filter(f => {
      const val = req.body[f];
      return val === undefined || val === null || String(val).trim() === '';
    });
    if (missing.length) {
      return res.status(400).json({
        error: `Zorunlu alanlar eksik: ${missing.join(', ')}`,
        missing
      });
    }
    next();
  };
}

/**
 * Alanların max uzunluğunu kontrol eder.
 * @param {Object} limits - { fieldName: maxLength }
 */
function maxLength(limits = {}) {
  return (req, res, next) => {
    for (const [field, max] of Object.entries(limits)) {
      const val = req.body[field];
      if (val && String(val).length > max) {
        return res.status(400).json({
          error: `'${field}' alanı en fazla ${max} karakter olabilir`
        });
      }
    }
    next();
  };
}

/**
 * TC Kimlik numarasının 11 haneli rakam olduğunu doğrular.
 */
function validateTC(field = 'tc_no') {
  return (req, res, next) => {
    const val = req.body[field];
    if (val && !/^\d{11}$/.test(val)) {
      return res.status(400).json({ error: `'${field}' 11 haneli rakam olmalıdır` });
    }
    next();
  };
}

/**
 * Bir alanın izin verilen değerlerden birini içerdiğini doğrular.
 * @param {string} field - Alan adı
 * @param {string[]} allowed - İzin verilen değerler
 */
function enumField(field, allowed = []) {
  return (req, res, next) => {
    const val = req.body[field];
    if (val !== undefined && !allowed.includes(val)) {
      return res.status(400).json({
        error: `'${field}' şu değerlerden biri olmalıdır: ${allowed.join(', ')}`
      });
    }
    next();
  };
}

/**
 * Tarih alanının geçerli bir ISO 8601 formatında olduğunu doğrular.
 */
function validateDate(field) {
  return (req, res, next) => {
    const val = req.body[field];
    if (val && isNaN(Date.parse(val))) {
      return res.status(400).json({ error: `'${field}' geçerli bir tarih değil` });
    }
    next();
  };
}

/**
 * Sayısal bir alanın tamsayı ve opsiyonel min/max sınırları içinde olduğunu doğrular.
 */
function intField(field, { min, max } = {}) {
  return (req, res, next) => {
    const val = req.body[field];
    if (val === undefined) return next();
    const n = Number(val);
    if (!Number.isInteger(n)) {
      return res.status(400).json({ error: `'${field}' tam sayı olmalıdır` });
    }
    if (min !== undefined && n < min) {
      return res.status(400).json({ error: `'${field}' en az ${min} olmalıdır` });
    }
    if (max !== undefined && n > max) {
      return res.status(400).json({ error: `'${field}' en fazla ${max} olabilir` });
    }
    next();
  };
}

/**
 * Birden fazla middleware'i zincirleme çalıştırır.
 * Kullanım: validate.chain(requireFields(['x']), validateTC())
 */
function chain(...middlewares) {
  return (req, res, next) => {
    let idx = 0;
    function run() {
      if (idx >= middlewares.length) return next();
      const mw = middlewares[idx++];
      mw(req, res, run);
    }
    run();
  };
}

module.exports = {
  requireFields,
  maxLength,
  validateTC,
  enumField,
  validateDate,
  intField,
  chain,
};
