const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const auth = require('../middleware/auth');
const {
  ALLOWED_USER_ROLES,
  canManageUsers,
  canSecretaryManageRole,
} = require('../policies/permissions');
const {
  validatePasswordPolicy,
  normalizeCompanyId,
  getUserById,
  ensurePersonnelRecordsForUsers,
  syncPersonnelCompanyForUser,
} = require('../services/user-service');
const router = express.Router();
const ARCHIVED_USERNAME_PREFIX = 'deleted__';

function buildArchivedUsername(username, userId) {
  return `${ARCHIVED_USERNAME_PREFIX}${Date.now()}__${userId}__${username}`;
}

function parseArchivedUsername(username) {
  const value = String(username || '');
  if (!value.startsWith(ARCHIVED_USERNAME_PREFIX)) return null;
  const match = value.match(/^deleted__\d+__\d+__(.+)$/);
  return match ? { originalUsername: match[1] } : null;
}

function getVisibleUsername(username) {
  const archived = parseArchivedUsername(username);
  return archived ? archived.originalUsername : username;
}

// GET /api/users
router.get('/', auth, async (req, res) => {
  try {
    if (!canManageUsers(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });

    await ensurePersonnelRecordsForUsers();

    const { limit, offset, all_roles, include_inactive } = req.query;
    const lim = Number.parseInt(limit, 10);
    const off = Number.parseInt(offset, 10);
    const hasLimit  = Number.isInteger(lim) && lim > 0;
    const hasOffset = Number.isInteger(off) && off >= 0;
    const canSeeInactive = req.user.role === 'admin' && include_inactive === 'true';

    // Secretary: all_roles=true ise tüm rolleri görebilir (read-only liste için),
    // aksi halde sadece secretary/personnel
    const roleFilter = req.user.role === 'secretary' && all_roles !== 'true'
      ? { role: { in: ['secretary', 'personnel'] } }
      : {};

    const users = await prisma.user.findMany({
      where: {
        ...roleFilter,
        ...(canSeeInactive ? {} : { isActive: true }),
      },
      orderBy: { id: 'asc' },
      take: hasLimit ? Math.min(lim, 500) : undefined,
      skip: hasLimit && hasOffset ? off : undefined,
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        department: true,
        isActive: true,
        createdAt: true,
        personnel: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            isActive: true,
            companyId: true,
            company: { select: { name: true } },
          },
        },
      },
    });

    // API contract: snake_case anahtarlar
    const result = users.map(u => {
      const activePersonnel = u.personnel.find((p) => p.isActive) || null;
      const firstPersonnel = u.personnel[0] || null;
      return {
        id: u.id,
        username: getVisibleUsername(u.username),
        full_name: u.fullName,
        role: u.role,
        department: u.department,
        is_active: u.isActive ? 1 : 0,
        created_at: u.createdAt,
        company_id: activePersonnel?.companyId ?? firstPersonnel?.companyId ?? null,
        company_name: activePersonnel?.company?.name ?? firstPersonnel?.company?.name ?? null,
        has_active_personnel: u.personnel.some((p) => p.isActive) ? 1 : 0,
        personnel_count: u.personnel.length,
      };
    });

    res.json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('GET /api/users hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/users
router.post('/', auth, async (req, res) => {
  try {
    if (!canManageUsers(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });

    const { username, password, full_name, role, department, company_id } = req.body;
    if (!username || !password || !full_name || !role) return res.status(400).json({ error: 'Eksik bilgi' });

    if (!ALLOWED_USER_ROLES.has(role)) return res.status(400).json({ error: 'Geçersiz rol' });

    if (req.user.role === 'secretary' && !canSecretaryManageRole(role)) {
      return res.status(403).json({ error: 'Sekreter sadece secretary/personnel kullanicilari yonetebilir' });
    }

    if (!validatePasswordPolicy(password)) {
      return res.status(400).json({ error: 'Şifre en az 8 karakter olmalıdır' });
    }

    const normalizedCompanyId = normalizeCompanyId(company_id);
    if (!normalizedCompanyId) {
      return res.status(400).json({ error: 'Yeni kullanıcı için şirket seçimi zorunludur' });
    }

    const hash = bcrypt.hashSync(password, 10);

    // Plan §4.7: user create + personnel sync atomik transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const existingSameUsername = await tx.user.findUnique({
        where: { username },
        select: { id: true, isActive: true, username: true },
      });

      if (existingSameUsername) {
        if (existingSameUsername.isActive) {
          throw Object.assign(new Error('Bu kullanÄ±cÄ± adÄ± zaten alÄ±nmÄ±ÅŸ'), { status: 400 });
        }

        await tx.user.update({
          where: { id: existingSameUsername.id },
          data: { username: buildArchivedUsername(existingSameUsername.username, existingSameUsername.id) },
        });
      }

      const created = await tx.user.create({
        data: {
          username,
          passwordHash: hash,
          fullName: full_name,
          role,
          department: department || null,
        },
      });

      // Personnel kaydını oluştur veya güncelle
      const existingPersonnel = await tx.personnel.findFirst({
        where: { userId: created.id },
        select: { id: true, companyId: true },
      });

      if (existingPersonnel) {
        await tx.personnel.update({
          where: { id: existingPersonnel.id },
          data: {
            companyId: normalizedCompanyId,
            fullName: full_name.trim() || 'Kullanici',
            department: department || null,
            isActive: true,
          },
        });
      } else {
        await tx.personnel.create({
          data: {
            userId: created.id,
            companyId: normalizedCompanyId,
            fullName: full_name.trim() || 'Kullanici',
            department: department || null,
            isActive: true,
          },
        });
      }

      return created;
    });

    const result = await getUserById(newUser.id);
    if (global.io) global.io.emit('user:created', { user: result });
    res.json(result);
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Bu kullanıcı adı zaten alınmış' });
    console.error('POST /api/users hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/users/:id
router.put('/:id', auth, async (req, res) => {
  try {
    if (!canManageUsers(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });

    const { full_name, role, department, is_active, password, company_id } = req.body;

    const targetUser = await getUserById(req.params.id);
    const rawTargetUser = await prisma.user.findUnique({
      where: { id: Number(req.params.id) },
      select: { id: true, username: true, role: true, isActive: true },
    });
    if (!targetUser) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

    if (role && !ALLOWED_USER_ROLES.has(role)) {
      return res.status(400).json({ error: 'Geçersiz rol' });
    }

    if (!rawTargetUser) return res.status(404).json({ error: 'KullanÄ±cÄ± bulunamadÄ±' });

    const nextFullName   = (full_name === undefined || full_name === null || full_name === '') ? targetUser.full_name : full_name;
    const nextRole       = role || targetUser.role;
    const nextDepartment = (department === undefined) ? targetUser.department : (department || null);
    const nextActive     = is_active === undefined ? Boolean(targetUser.is_active) : Boolean(is_active);
    const nextCompanyId  = normalizeCompanyId(company_id);

    if (req.user.role === 'secretary') {
      if (!canSecretaryManageRole(targetUser.role) || !canSecretaryManageRole(nextRole)) {
        return res.status(403).json({ error: 'Sekreter sadece secretary/personnel kullanicilari yonetebilir' });
      }
    }

    // Son aktif admin hesabının rolü değiştirilirse veya deaktif edilirse koru
    if (targetUser.role === 'admin' && (nextRole !== 'admin' || !nextActive)) {
      const activeAdminCount = await prisma.user.count({
        where: { role: 'admin', isActive: true },
      });
      if (activeAdminCount <= 1) {
        return res.status(400).json({ error: 'Sistemdeki son admin hesabının rolü değiştirilemez veya deaktif edilemez' });
      }
    }

    // Plan §4.7: user update + personnel sync atomik
    await prisma.$transaction(async (tx) => {
      const updateData = {
        fullName:   nextFullName,
        role:       nextRole,
        department: nextDepartment,
        isActive:   nextActive,
      };

      const archivedUsername = parseArchivedUsername(rawTargetUser.username);
      if (nextActive && archivedUsername) {
        const usernameConflict = await tx.user.findFirst({
          where: {
            username: archivedUsername.originalUsername,
            id: { not: Number(req.params.id) },
          },
          select: { id: true },
        });
        if (usernameConflict) {
          throw Object.assign(new Error('Bu kullanÄ±cÄ± geri etkinleÅŸtirilemedi; eski kullanÄ±cÄ± adÄ± baÅŸkasÄ± tarafÄ±ndan kullanÄ±lÄ±yor'), { status: 400 });
        }
        updateData.username = archivedUsername.originalUsername;
      } else if (!nextActive && !archivedUsername) {
        updateData.username = buildArchivedUsername(rawTargetUser.username, rawTargetUser.id);
      }

      if (password) {
        if (!validatePasswordPolicy(password)) throw Object.assign(new Error('Şifre en az 8 karakter olmalıdır'), { status: 400 });
        updateData.passwordHash = bcrypt.hashSync(password, 10);
      }

      await tx.user.update({ where: { id: Number(req.params.id) }, data: updateData });

      // Personnel senkronizasyonu
      const existingPersonnel = await tx.personnel.findFirst({
        where: { userId: Number(req.params.id) },
        orderBy: { id: 'asc' },
        select: { id: true, companyId: true },
      });

      if (existingPersonnel) {
        await tx.personnel.update({
          where: { id: existingPersonnel.id },
          data: {
            companyId: nextCompanyId ?? existingPersonnel.companyId,
            fullName:  (nextFullName || '').trim() || 'Kullanici',
            department: nextDepartment,
            isActive: nextActive,
          },
        });
      } else {
        await tx.personnel.create({
          data: {
            userId:    Number(req.params.id),
            companyId: nextCompanyId || null,
            fullName:  (nextFullName || '').trim() || 'Kullanici',
            department: nextDepartment,
            isActive: nextActive,
          },
        });
      }
    });

    const result = await getUserById(req.params.id);
    if (global.io) global.io.emit('user:updated', { user: result });
    res.json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('PUT /api/users hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/users/:id  (soft-delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!canManageUsers(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });

    const targetUser = await getUserById(req.params.id);
    if (!targetUser) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

    if (req.user.role === 'secretary' && !canSecretaryManageRole(targetUser.role)) {
      return res.status(403).json({ error: 'Sekreter sadece secretary/personnel kullanicilari yonetebilir' });
    }

    // Admin kendi kendini silemez
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz' });
    }

    // Son aktif admin hesabı koruması
    if (targetUser.role === 'admin') {
      const activeAdminCount = await prisma.user.count({
        where: { role: 'admin', isActive: true },
      });
      if (activeAdminCount <= 1) {
        return res.status(400).json({ error: 'Sistemdeki son admin hesabı silinemez' });
      }
    }

    const deletedId = Number(req.params.id);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: deletedId },
        data: {
          isActive: false,
          username: buildArchivedUsername(targetUser.username, deletedId),
        },
      });
      await tx.personnel.updateMany({
        where: { userId: deletedId },
        data: { isActive: false },
      });
    });

    if (global.io) global.io.emit('user:deleted', { id: deletedId });
    res.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/users hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/users/:id/purge  (hard-delete inactive junk users, admin only)
router.delete('/:id/purge', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Sadece admin kalıcı silme yapabilir' });

    const deletedId = Number(req.params.id);
    if (!Number.isInteger(deletedId) || deletedId <= 0) {
      return res.status(400).json({ error: 'Geçersiz kullanıcı id' });
    }

    if (deletedId === req.user.id) {
      return res.status(400).json({ error: 'Kendi hesabınızı kalıcı olarak silemezsiniz' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: deletedId },
      select: { id: true, isActive: true },
    });
    if (!targetUser) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    if (targetUser.isActive) {
      return res.status(400).json({ error: 'Önce kullanıcıyı pasif hale getirin, sonra kalıcı silin' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.personnel.deleteMany({
        where: { userId: deletedId, isActive: false },
      });
      await tx.pushSubscription.deleteMany({
        where: { userId: deletedId },
      });
      await tx.user.delete({
        where: { id: deletedId },
      });
    });

    if (global.io) global.io.emit('user:purged', { id: deletedId });
    res.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/users/:id/purge hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
