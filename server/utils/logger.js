const { db } = require('../database');

/**
 * Log levels: info, warn, error, debug
 */
function log(level, module, message, details = null, userId = null) {
  try {
    const detailStr = details ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : null;
    db.prepare(`
      INSERT INTO system_logs (level, module, message, details, user_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(level, module, message, detailStr, userId);
  } catch (e) {
    console.error('Logging to DB failed:', e.message);
  }
}

module.exports = {
  info: (mod, msg, det, uid) => log('info', mod, msg, det, uid),
  warn: (mod, msg, det, uid) => log('warn', mod, msg, det, uid),
  error: (mod, msg, det, uid) => log('error', mod, msg, det, uid),
  debug: (mod, msg, det, uid) => log('debug', mod, msg, det, uid)
};
