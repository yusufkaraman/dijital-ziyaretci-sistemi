const LEGACY_MANAGER_NAMES = ['İsmail Karaman', 'Ismail Karaman'];
const CANONICAL_MANAGER_NAME = 'İsmail Bıkmaz';

function isLegacyManagerUser(user) {
  if (!user) return false;
  return user.username === 'mudur' && LEGACY_MANAGER_NAMES.includes(user.full_name);
}

function normalizeManagerUserRecord(db, user) {
  if (!isLegacyManagerUser(user)) return user;

  db.prepare('UPDATE users SET full_name=? WHERE id=?').run(CANONICAL_MANAGER_NAME, user.id);
  user.full_name = CANONICAL_MANAGER_NAME;
  return user;
}

function normalizeManagerPersonnelRecord(db) {
  db.prepare(`
    UPDATE personnel
    SET full_name=?
    WHERE user_id=(SELECT id FROM users WHERE username='mudur' LIMIT 1)
      AND full_name IN (${LEGACY_MANAGER_NAMES.map(() => '?').join(',')})
  `).run(CANONICAL_MANAGER_NAME, ...LEGACY_MANAGER_NAMES);
}

module.exports = {
  LEGACY_MANAGER_NAMES,
  CANONICAL_MANAGER_NAME,
  normalizeManagerUserRecord,
  normalizeManagerPersonnelRecord,
};
