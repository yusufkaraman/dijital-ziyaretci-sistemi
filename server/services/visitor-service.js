const prisma = require('../prisma');
const { sendPushNotification } = require('../utils/push');

/**
 * Screen-service'e bağımlılığı döngüsel hale getirmemek için
 * screen_logs işlemleri burada inline Prisma ile yapılır.
 */

async function closeActiveScreenLogPrisma(tx) {
  const db = tx || prisma;
  const active = await db.screenLog.findFirst({
    where: { endTime: null },
    orderBy: { startTime: 'desc' },
    select: { id: true, startTime: true },
  });
  if (!active) return null;

  const durationSeconds = Math.floor((Date.now() - new Date(active.startTime).getTime()) / 1000);
  await db.screenLog.update({
    where: { id: active.id },
    data: {
      endTime: new Date(),
      durationSeconds,
    },
  });
  return active.id;
}

async function logVisitorActivity(userId, action, entityId, details) {
  await prisma.activityLog.create({
    data: {
      userId:     userId || null,
      action,
      entityType: 'visitor',
      entityId:   Number(entityId),
      details,
    },
  });
}

async function getVisitorWithHost(visitorId) {
  const v = await prisma.visitor.findUnique({
    where: { id: Number(visitorId) },
    include: {
      hostPersonnel: {
        select: {
          fullName: true,
          title: true,
          company: { select: { id: true, name: true, logoPath: true } },
        },
      },
      visitedCompany: {
        select: { id: true, name: true, logoPath: true },
      },
    },
  });
  if (!v) return null;
  return toApiShape(v);
}

function emitSocket(eventName, payload) {
  if (global.io) global.io.emit(eventName, payload);
}

function emitScreenUpdate(payload) {
  emitSocket('screen:update', payload);
}

function buildVisitorNotificationDetails(visitor) {
  if (!visitor || typeof visitor !== 'object') return '';
  const company = (visitor.company_name || visitor.companyName || '').trim();
  const reason = (visitor.reason || '').trim();
  const countValue = visitor.visitor_count ?? visitor.visitorCount;
  const count = Number(countValue) > 0 ? Number(countValue) : 1;
  const parts = [];
  if (company) parts.push(`Sirket: ${company}`);
  if (reason) parts.push(`Sebep: ${reason}`);
  parts.push(`Kisi: ${count}`);
  return parts.join(' | ');
}

function notifyNewVisitor(fullName, hostUserId) {
  const visitor = fullName && typeof fullName === 'object' ? fullName : null;
  const fullNameText = visitor ? (visitor.full_name || visitor.fullName || 'Yeni misafir') : fullName;
  const details = buildVisitorNotificationDetails(visitor);
  sendPushNotification(null, {
    title: 'Yeni Misafir Kaydı',
    body: `${fullNameText} giriş talebi oluşturdu.`,
    url: '/panel',
  }, { roles: ['secretary', 'admin'] });
  if (hostUserId) {
    sendPushNotification(hostUserId, {
      title: 'Misafiriniz Kapıda',
      body: `${fullNameText} sizi bekliyor.`,
      url: '/yonetici',
    });
  }
}

function notifyNewVisitorDetailed(fullName, hostUserId) {
  const visitor = fullName && typeof fullName === 'object' ? fullName : null;
  const fullNameText = visitor ? (visitor.full_name || visitor.fullName || 'Yeni misafir') : fullName;
  const details = buildVisitorNotificationDetails(visitor);
  const createBody = details
    ? `${fullNameText} giriş talebi oluşturdu. ${details}`
    : `${fullNameText} giriş talebi oluşturdu.`;
  const waitingBody = details
    ? `${fullNameText} sizi bekliyor. ${details}`
    : `${fullNameText} sizi bekliyor.`;

  // Sadece sekreter ve admin rollerine broadcast push gönder
  sendPushNotification(null, {
    title: 'Yeni Misafir Kaydı',
    body: createBody,
    url: '/panel',
  }, { roles: ['secretary', 'admin'] });

  // Host kullanıcıya kişisel push gönder
  if (hostUserId) {
    sendPushNotification(hostUserId, {
      title: 'Misafiriniz Kapıda',
      body: waitingBody,
      url: '/yonetici',
    });
  }
}

function notifyVisitorArrived(visitor) {
  const huid = visitor?.host_user_id ?? visitor?.hostUserId;
  if (!visitor || !huid) return;
  sendPushNotification(huid, {
    title: 'Misafiriniz Giriş Yaptı',
    body: `${visitor.full_name || visitor.fullName} kuruma giriş yaptı.`,
    url: '/personel',
  });
}

async function closeActiveVisitorSession() {
  // Plan §4.7: visitor session close atomik transaction içinde
  return prisma.$transaction(async (tx) => {
    const prevActives = await tx.visitor.findMany({
      where: { isScreenActive: true },
      select: { id: true, fullName: true },
    });

    await closeActiveScreenLogPrisma(tx);

    await tx.visitor.updateMany({
      where: { isScreenActive: true },
      data: {
        isScreenActive: false,
        status: 'left',
        checkoutTime: new Date(),
      },
    });

    return prevActives.map(v => ({ id: v.id, full_name: v.fullName }));
  });
}

/** Prisma camelCase → API snake_case */
function toApiShape(v) {
  if (!v) return null;
  return {
    id:               v.id,
    full_name:        v.fullName,
    tc_no:            v.tcNo,
    phone:            v.phone,
    email:            v.email,
    company_name:     v.companyName,
    vehicle_plate:    v.vehiclePlate,
    visitor_count:    v.visitorCount,
    host_personnel_id: v.hostPersonnelId,
    host_user_id:     v.hostUserId,
    reason:           v.reason,
    notes:            v.notes,
    status:           v.status,
    is_approved:      v.isApproved ? 1 : 0,
    is_screen_active: v.isScreenActive ? 1 : 0,
    planned_time:     v.plannedTime,
    arrival_time:     v.arrivalTime,
    checkout_time:    v.checkoutTime,
    created_by:       v.createdBy,
    created_at:       v.createdAt,
    host_name:         v.hostPersonnel?.fullName ?? null,
    host_title:        v.hostPersonnel?.title    ?? null,
    visited_company_id: v.visitedCompanyId ?? null,
    host_company_id:   v.visitedCompany?.id ?? v.hostPersonnel?.company?.id ?? null,
    host_company_name: v.visitedCompany?.name ?? v.hostPersonnel?.company?.name ?? null,
    host_company_logo: v.visitedCompany?.logoPath ?? v.hostPersonnel?.company?.logoPath ?? null,
  };
}

module.exports = {
  logVisitorActivity,
  getVisitorWithHost,
  emitSocket,
  emitScreenUpdate,
  notifyNewVisitor: notifyNewVisitorDetailed,
  notifyVisitorArrived,
  closeActiveVisitorSession,
  closeActiveScreenLogPrisma,
  toApiShape,
};
