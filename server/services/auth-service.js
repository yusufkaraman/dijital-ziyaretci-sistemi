const LEGACY_MANAGER_NAMES = ['İsmail Karaman', 'Ismail Karaman'];
const CANONICAL_MANAGER_NAME = 'İsmail Bıkmaz';

function isLegacyManagerUser(user) {
  if (!user) return false;
  return user.username === 'mudur' && LEGACY_MANAGER_NAMES.includes(user.full_name || user.fullName);
}

/**
 * Eğer 'mudur' kullanıcısının adı eski bir değerse Prisma ile günceller.
 * Plan §4.8: legacy manager-name normalization must not disappear silently.
 */
async function normalizeManagerUserRecord(prisma, user) {
  if (!isLegacyManagerUser(user)) return user;

  await prisma.user.update({
    where: { id: user.id },
    data: { fullName: CANONICAL_MANAGER_NAME },
  });
  user.full_name = CANONICAL_MANAGER_NAME;
  user.fullName  = CANONICAL_MANAGER_NAME;
  return user;
}

/**
 * Personel tablosundaki müdür kaydı adını da normalize eder.
 */
async function normalizeManagerPersonnelRecord(prisma) {
  await prisma.personnel.updateMany({
    where: {
      user: { username: 'mudur' },
      fullName: { in: LEGACY_MANAGER_NAMES },
    },
    data: { fullName: CANONICAL_MANAGER_NAME },
  });
}

module.exports = {
  LEGACY_MANAGER_NAMES,
  CANONICAL_MANAGER_NAME,
  normalizeManagerUserRecord,
  normalizeManagerPersonnelRecord,
};
