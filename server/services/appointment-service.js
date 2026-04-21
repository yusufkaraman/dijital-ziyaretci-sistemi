const prisma = require('../prisma');

/**
 * host_personnel_id'den host_user_id'yi çözer.
 * Prisma versiyonu: db parametresi kaldırıldı.
 * Plan §4.8: legacy name-based fallback korunuyor.
 */
async function resolveHostUserIdFromPersonnel(hostPersonnelId, options) {
  const opts = options || {};
  if (!hostPersonnelId) {
    return { found: false, hostUserId: null, personnel: null };
  }

  const where = { id: Number(hostPersonnelId) };
  if (opts.requireActive) where.isActive = true;

  const personnel = await prisma.personnel.findFirst({
    where,
    select: { id: true, fullName: true, userId: true },
  });

  if (!personnel) {
    return { found: false, hostUserId: null, personnel: null };
  }

  let hostUserId = personnel.userId || null;

  // İsim bazlı fallback: personelin user_id'si yoksa full_name eşleşmesiyle bul
  if (!hostUserId) {
    const linkedUser = await prisma.user.findFirst({
      where: { fullName: { equals: personnel.fullName, mode: 'insensitive' } },
      select: { id: true },
    });
    if (linkedUser) {
      hostUserId = linkedUser.id;
      // Kalıcı olarak güncelle
      await prisma.personnel.update({
        where: { id: personnel.id },
        data: { userId: linkedUser.id },
      });
    }
  }

  return { found: true, hostUserId, personnel };
}

/**
 * Prisma where clause'u olarak host_user_id filtresi üretir.
 * buildHostUserFilterSql'in Prisma ORM karşılığı.
 * @param {number} hostUserId
 * @returns {object} Prisma where condition
 */
function buildHostUserFilter(hostUserId) {
  const id = Number(hostUserId);
  return {
    OR: [
      { hostUserId: id },
      { hostPersonnel: { userId: id } },
      {
        hostPersonnel: {
          fullName: {
            equals: { equals: id },
          },
        },
      },
    ],
  };
}

module.exports = {
  resolveHostUserIdFromPersonnel,
  buildHostUserFilter,
};
