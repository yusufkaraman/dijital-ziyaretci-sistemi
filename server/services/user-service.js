function validatePasswordPolicy(password) {
  return typeof password === 'string' && password.length >= 8;
}

function normalizeCompanyId(rawCompanyId) {
  if (rawCompanyId === undefined || rawCompanyId === null || rawCompanyId === '') return null;
  const parsed = Number.parseInt(rawCompanyId, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getUserById(db, id) {
  return db.prepare(`
    SELECT
      u.id, u.username, u.full_name, u.role, u.department, u.is_active,
      p.company_id,
      c.name as company_name
    FROM users u
    LEFT JOIN personnel p ON p.user_id=u.id AND p.is_active=1
    LEFT JOIN companies c ON c.id=p.company_id
    WHERE u.id=?
  `).get(id);
}

function ensurePersonnelRecordsForUsers(db) {
  db.prepare(`
    INSERT INTO personnel (company_id, full_name, department, user_id, is_active)
    SELECT NULL, COALESCE(u.full_name, u.username, 'Kullanici'), u.department, u.id, u.is_active
    FROM users u
    WHERE NOT EXISTS (
      SELECT 1 FROM personnel p WHERE p.user_id=u.id
    )
  `).run();

  db.prepare(`
    UPDATE personnel
    SET
      full_name = COALESCE((SELECT u.full_name FROM users u WHERE u.id=personnel.user_id), full_name),
      department = COALESCE((SELECT u.department FROM users u WHERE u.id=personnel.user_id), department),
      is_active = COALESCE((SELECT u.is_active FROM users u WHERE u.id=personnel.user_id), is_active)
    WHERE user_id IS NOT NULL
  `).run();
}

function syncPersonnelCompanyForUser(db, payload) {
  const safeFullName = (typeof payload.fullName === 'string' && payload.fullName.trim())
    ? payload.fullName.trim()
    : 'Kullanici';

  const existing = db.prepare('SELECT id FROM personnel WHERE user_id=? ORDER BY id LIMIT 1').get(payload.userId);
  if (existing) {
    db.prepare(`
      UPDATE personnel
      SET company_id=COALESCE(?, company_id), full_name=?, department=?, is_active=1
      WHERE id=?
    `).run(payload.companyId, safeFullName, payload.department || null, existing.id);
    return;
  }

  db.prepare(`
    INSERT INTO personnel (company_id, full_name, department, user_id, is_active)
    VALUES (?, ?, ?, ?, 1)
  `).run(payload.companyId, safeFullName, payload.department || null, payload.userId);
}

module.exports = {
  validatePasswordPolicy,
  normalizeCompanyId,
  getUserById,
  ensurePersonnelRecordsForUsers,
  syncPersonnelCompanyForUser,
};
