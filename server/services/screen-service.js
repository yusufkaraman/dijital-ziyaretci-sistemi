function closeActiveScreenLog(db) {
  const active = db.prepare(`
    SELECT id, start_time
    FROM screen_logs
    WHERE end_time IS NULL
    ORDER BY start_time DESC
    LIMIT 1
  `).get();

  if (!active) return null;

  db.prepare(`
    UPDATE screen_logs
    SET end_time=datetime('now','+3 hours'),
        duration_seconds=CAST((julianday('now','+3 hours') - julianday(start_time)) * 86400 AS INTEGER)
    WHERE id=?
  `).run(active.id);

  return active.id;
}

function startScreenLog(db, visitorId, contentId, action) {
  db.prepare(`
    INSERT INTO screen_logs (visitor_id, content_id, action, start_time)
    VALUES (?,?,?,datetime('now','+3 hours'))
  `).run(visitorId || null, contentId || null, action || 'welcome_start');
}

function loadCurrentScreenState(db) {
  const activeVisitor = db.prepare(`
    SELECT v.*, p.full_name as host_name, c.name as host_company_name
    FROM visitors v
    LEFT JOIN personnel p ON v.host_personnel_id=p.id
    LEFT JOIN companies c ON p.company_id=c.id
    WHERE v.status='inside' AND v.is_screen_active=1
    ORDER BY v.arrival_time DESC LIMIT 1
  `).get();

  const defaultCompany = db.prepare('SELECT * FROM companies WHERE is_default=1 AND is_active=1 LIMIT 1').get();
  const settings = {};
  const settingRows = db.prepare('SELECT key, value FROM system_settings').all();
  for (const row of settingRows) {
    settings[row.key] = row.value;
  }

  if (settings.company_name && /(visidesk|simdesk|simsoft)/i.test(settings.company_name)) {
    settings.company_name = 'Bıkmaz Grup Lobi Ekranı';
    db.prepare(`UPDATE system_settings SET value='Bıkmaz Grup Lobi Ekranı' WHERE key='company_name'`).run();
  }

  let content = null;
  if (defaultCompany) {
    content = db.prepare(`SELECT * FROM contents WHERE company_id=? AND is_active=1 AND is_default=1 LIMIT 1`).get(defaultCompany.id);
  }

  if (!content) {
    content = db.prepare(`SELECT * FROM contents WHERE is_active=1 AND is_default=1 ORDER BY company_id ASC LIMIT 1`).get();
  }

  if (!content && defaultCompany) {
    content = db.prepare(`SELECT * FROM contents WHERE company_id=? AND is_active=1 ORDER BY display_order LIMIT 1`).get(defaultCompany.id);
  }

  if (!content) {
    content = db.prepare(`SELECT * FROM contents WHERE is_active=1 ORDER BY display_order LIMIT 1`).get();
  }

  return {
    visitor: activeVisitor || null,
    company: defaultCompany || null,
    content: content || null,
    settings,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  closeActiveScreenLog,
  startScreenLog,
  loadCurrentScreenState,
};
