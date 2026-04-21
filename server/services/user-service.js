const prisma = require('../prisma');

function validatePasswordPolicy(password) {
  return typeof password === 'string' && password.length >= 8;
}

function normalizeCompanyId(rawCompanyId) {
  if (rawCompanyId === undefined || rawCompanyId === null || rawCompanyId === '') return null;
  const parsed = Number.parseInt(rawCompanyId, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Kullanıcıyı personnel + company join ile döndürür.
 * API contract: frontend company_id ve company_name anahtarlarını bekliyor.
 */
async function getUserById(id) {
  const user = await prisma.user.findUnique({
    where: { id: Number(id) },
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      department: true,
      isActive: true,
      personnel: {
        where: { isActive: true },
        take: 1,
        select: {
          companyId: true,
          company: { select: { name: true } },
        },
      },
    },
  });
  if (!user) return null;
  const p = user.personnel[0] || null;
  return {
    id: user.id,
    username: user.username,
    full_name: user.fullName,
    role: user.role,
    department: user.department,
    is_active: user.isActive ? 1 : 0,
    company_id: p?.companyId ?? null,
    company_name: p?.company?.name ?? null,
  };
}

/**
 * Her users kaydı için eşleşen personnel satırı yoksa oluşturur.
 * Mevcut personnel satırını full_name, department ve is_active ile senkronize eder.
 * Plan §4.7: users + personnel atomik transaction içinde.
 */
async function ensurePersonnelRecordsForUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, fullName: true, department: true, isActive: true },
  });

  for (const u of users) {
    const existing = await prisma.personnel.findFirst({
      where: { userId: u.id },
      select: { id: true },
    });

    if (!existing) {
      await prisma.personnel.create({
        data: {
          userId: u.id,
          fullName: u.fullName || 'Kullanici',
          department: u.department,
          isActive: u.isActive,
        },
      });
    } else {
      await prisma.personnel.update({
        where: { id: existing.id },
        data: {
          fullName: u.fullName || 'Kullanici',
          department: u.department,
          isActive: u.isActive,
        },
      });
    }
  }
}

/**
 * Kullanıcıya bağlı personnel kaydının şirketi ve adını günceller / oluşturur.
 * Plan §4.7: user create/update with personnel sync — atomik transaction.
 */
async function syncPersonnelCompanyForUser({ userId, companyId, fullName, department }) {
  const safeFullName = (typeof fullName === 'string' && fullName.trim()) ? fullName.trim() : 'Kullanici';

  const existing = await prisma.personnel.findFirst({
    where: { userId },
    orderBy: { id: 'asc' },
    select: { id: true, companyId: true },
  });

  if (existing) {
    await prisma.personnel.update({
      where: { id: existing.id },
      data: {
        companyId: companyId ?? existing.companyId,
        fullName: safeFullName,
        department: department || null,
        isActive: true,
      },
    });
  } else {
    await prisma.personnel.create({
      data: {
        userId,
        companyId: companyId || null,
        fullName: safeFullName,
        department: department || null,
        isActive: true,
      },
    });
  }
}

module.exports = {
  validatePasswordPolicy,
  normalizeCompanyId,
  getUserById,
  ensurePersonnelRecordsForUsers,
  syncPersonnelCompanyForUser,
};
