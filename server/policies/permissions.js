const ALLOWED_USER_ROLES = new Set(['admin', 'manager', 'secretary', 'personnel']);
const SECRETARY_ALLOWED_USER_ROLES = new Set(['secretary', 'personnel']);

function deny(res, message) {
  return res.status(403).json({ error: message || 'Yetkisiz' });
}

function requirePermission(checkFn, message) {
  return function permissionMiddleware(req, res, next) {
    if (checkFn(req.user ? req.user.role : null, req)) return next();
    return deny(res, message);
  };
}

function canManageUsers(role) {
  return role === 'admin' || role === 'manager' || role === 'secretary';
}

function canSecretaryManageRole(role) {
  return SECRETARY_ALLOWED_USER_ROLES.has(role);
}

function canCreateRoom(role) {
  return role !== 'secretary';
}

function canManageRoom(role) {
  return role !== 'secretary';
}

function canDeletePersonnel(role) {
  return role === 'admin';
}

function canManageSettings(role) {
  return role === 'admin';
}

function canManageCompanies(role) {
  return role !== 'secretary';
}

function canDeleteCompany(role) {
  return role === 'admin';
}

function canViewActivityLogs(role) {
  return role !== 'manager';
}

function canViewSystemLogs(role) {
  return role === 'admin' || role === 'manager';
}

function canUseOutlook(role) {
  return role === 'manager';
}

function canDeleteVisitors(role) {
  return role === 'admin';
}

function canAssignSelfAsHost(role) {
  return role === 'manager' || role === 'personnel';
}

function canAutoApproveVisitor(role) {
  return role === 'admin' || role === 'manager';
}

module.exports = {
  ALLOWED_USER_ROLES,
  SECRETARY_ALLOWED_USER_ROLES,
  deny,
  requirePermission,
  canManageUsers,
  canSecretaryManageRole,
  canCreateRoom,
  canManageRoom,
  canDeletePersonnel,
  canManageSettings,
  canManageCompanies,
  canDeleteCompany,
  canViewActivityLogs,
  canViewSystemLogs,
  canUseOutlook,
  canDeleteVisitors,
  canAssignSelfAsHost,
  canAutoApproveVisitor,
};
