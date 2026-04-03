function buildHostUserFilterSql(recordAlias, personnelAlias) {
  return `(
    ${recordAlias}.host_user_id=?
    OR ${personnelAlias}.user_id=?
    OR lower(trim(coalesce(${personnelAlias}.full_name,''))) = lower(trim(coalesce((SELECT full_name FROM users WHERE id=?), '')))
  )`;
}

function resolveHostUserIdFromPersonnel(db, hostPersonnelId, options) {
  const opts = options || {};
  if (!hostPersonnelId) {
    return { found: false, hostUserId: null, personnel: null };
  }

  const whereActive = opts.requireActive ? ' AND is_active=1' : '';
  const personnel = db.prepare(`
    SELECT id, full_name, NULLIF(user_id,0) as user_id
    FROM personnel
    WHERE id=?${whereActive}
  `).get(hostPersonnelId);

  if (!personnel) {
    return { found: false, hostUserId: null, personnel: null };
  }

  let hostUserId = personnel.user_id || null;
  if (!hostUserId) {
    const linkedUser = db.prepare('SELECT id FROM users WHERE lower(trim(full_name))=lower(trim(?)) LIMIT 1').get(personnel.full_name);
    if (linkedUser && linkedUser.id) {
      hostUserId = linkedUser.id;
      db.prepare('UPDATE personnel SET user_id=? WHERE id=?').run(linkedUser.id, personnel.id);
    }
  }

  return {
    found: true,
    hostUserId,
    personnel,
  };
}

module.exports = {
  buildHostUserFilterSql,
  resolveHostUserIdFromPersonnel,
};
