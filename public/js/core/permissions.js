(function () {
  const ROLE_LABELS = {
    admin: 'Admin',
    manager: 'Yönetici',
    secretary: 'Sekreter',
    personnel: 'Personel',
  };

  const HOME_BY_ROLE = {
    admin: '/panel',
    secretary: '/panel',
    manager: '/yonetici',
    personnel: '/personel.html',
  };

  const ASSIGNABLE_ROLES_BY_ACTOR = {
    admin: ['admin', 'manager', 'secretary', 'personnel'],
    secretary: ['secretary', 'personnel'],
  };

  function roleOf(userOrRole) {
    if (!userOrRole) return null;
    return typeof userOrRole === 'string' ? userOrRole : userOrRole.role || null;
  }

  function userIdOf(user) {
    if (!user || user.id === undefined || user.id === null) return null;
    const parsed = Number(user.id);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function isAdmin(userOrRole) {
    return roleOf(userOrRole) === 'admin';
  }

  function isSecretary(userOrRole) {
    return roleOf(userOrRole) === 'secretary';
  }

  function isManager(userOrRole) {
    return roleOf(userOrRole) === 'manager';
  }

  function isPersonnel(userOrRole) {
    return roleOf(userOrRole) === 'personnel';
  }

  function canManagePersonnel(userOrRole) {
    const role = roleOf(userOrRole);
    return role === 'admin' || role === 'manager';
  }

  function getHomePathForRole(userOrRole) {
    const role = roleOf(userOrRole);
    return HOME_BY_ROLE[role] || '/';
  }

  function hasRoleAccess(userOrRole, allowedRoles) {
    const role = roleOf(userOrRole);
    if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) return true;
    return allowedRoles.includes(role);
  }

  function canAccessPanel(userOrRole) {
    const role = roleOf(userOrRole);
    return role === 'admin' || role === 'secretary';
  }

  function canManageUsers(userOrRole) {
    const role = roleOf(userOrRole);
    return role === 'admin' || role === 'secretary';
  }

  function canAccessSettingsTab(userOrRole, tabName) {
    const role = roleOf(userOrRole);
    if (role === 'secretary') return tabName === 'users';
    return true;
  }

  function canManageRooms(userOrRole) {
    const role = roleOf(userOrRole);
    return role !== 'secretary';
  }

  function getAssignableRoles(userOrRole) {
    const role = roleOf(userOrRole);
    return ASSIGNABLE_ROLES_BY_ACTOR[role] || [];
  }

  function canAssignRole(userOrRole, targetRole) {
    return getAssignableRoles(userOrRole).includes(targetRole);
  }

  function canDeletePersonnel(userOrRole) {
    const role = roleOf(userOrRole);
    return role === 'admin';
  }

  function shouldScopeHostUser(userOrRole) {
    const role = roleOf(userOrRole);
    return role !== 'admin';
  }

  function canCancelReservation(user, reservationUserId) {
    const role = roleOf(user);
    const userId = userIdOf(user);
    return role === 'admin' || role === 'secretary' || (userId !== null && userId === Number(reservationUserId));
  }

  function canSeeHostScopedData(user, hostUserId) {
    if (!user) return false;
    if (isAdmin(user)) return true;
    const userId = userIdOf(user);
    return userId !== null && Number(hostUserId) === userId;
  }

  function canSeeHostScopedEvent(user, hostUserId, options) {
    const opts = options || {};
    if (!user) return false;
    if (opts.allowUnassigned && (hostUserId === null || hostUserId === undefined || hostUserId === '')) {
      return true;
    }
    return canSeeHostScopedData(user, hostUserId);
  }

  window.vdPermissions = {
    ROLE_LABELS,
    roleOf,
    userIdOf,
    isAdmin,
    isSecretary,
    isManager,
    isPersonnel,
    getHomePathForRole,
    hasRoleAccess,
    canAccessPanel,
    canManageUsers,
    canManagePersonnel,
    canAccessSettingsTab,
    canManageRooms,
    getAssignableRoles,
    canAssignRole,
    canDeletePersonnel,
    shouldScopeHostUser,
    canCancelReservation,
    canSeeHostScopedData,
    canSeeHostScopedEvent,
  };
})();
