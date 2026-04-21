const prisma = require('../prisma');

/**
 * System logger — Prisma'ya geçirildi.
 * Log levels: info, warn, error, debug
 */
function log(level, module, message, details = null, userId = null) {
  const detailStr = details
    ? (typeof details === 'object' ? JSON.stringify(details) : String(details))
    : null;

  // fire-and-forget: logger asla bir route'u bloklamamalı
  prisma.systemLog.create({
    data: { level, module, message, details: detailStr, userId: userId || null },
  }).catch(e => console.error('Logging to DB failed:', e.message));
}

module.exports = {
  info:  (mod, msg, det, uid) => log('info',  mod, msg, det, uid),
  warn:  (mod, msg, det, uid) => log('warn',  mod, msg, det, uid),
  error: (mod, msg, det, uid) => log('error', mod, msg, det, uid),
  debug: (mod, msg, det, uid) => log('debug', mod, msg, det, uid),
};
