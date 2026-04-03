const { normalizeManagerPersonnelRecord: normalizeManagerPersonnelFromAuth } = require('./auth-service');

function getOrCreateCompany(db, name) {
  if (!name) return null;
  const existing = db.prepare('SELECT id FROM companies WHERE name=?').get(name);
  if (existing) return existing.id;
  const created = db.prepare('INSERT INTO companies (name) VALUES (?)').run(name);
  return created.lastInsertRowid;
}

function normalizeManagerPersonnelRecord(db) {
  normalizeManagerPersonnelFromAuth(db);
}

module.exports = {
  getOrCreateCompany,
  normalizeManagerPersonnelRecord,
};
