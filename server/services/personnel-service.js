const prisma = require('../prisma');
const { normalizeManagerPersonnelRecord: normalizeManagerPersonnelFromAuth } = require('./auth-service');

/**
 * Verilen isimde şirket varsa id'sini döndürür, yoksa oluşturur.
 * Plan §4.8: personnel-service legacy coupling korunmalı.
 */
async function getOrCreateCompany(name) {
  if (!name) return null;
  const existing = await prisma.company.findFirst({
    where: { name },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.company.create({
    data: { name },
    select: { id: true },
  });
  return created.id;
}

/**
 * Müdür personel kaydını normalize eder.
 * auth-service'teki Prisma versiyonuna delege eder.
 */
async function normalizeManagerPersonnelRecord() {
  await normalizeManagerPersonnelFromAuth(prisma);
}

module.exports = {
  getOrCreateCompany,
  normalizeManagerPersonnelRecord,
};
