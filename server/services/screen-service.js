const prisma = require('../prisma');

/**
 * Aktif screen log'u kapatır.
 * visitor-service'deki closeActiveScreenLogPrisma ile aynı mantık;
 * screen-service, screen.js route'undan çağrılmaya devam ediyor.
 */
async function closeActiveScreenLog() {
  const active = await prisma.screenLog.findFirst({
    where: { endTime: null },
    orderBy: { startTime: 'desc' },
    select: { id: true, startTime: true },
  });
  if (!active) return null;

  const durationSeconds = Math.floor(
    (Date.now() - new Date(active.startTime).getTime()) / 1000
  );
  await prisma.screenLog.update({
    where: { id: active.id },
    data: { endTime: new Date(), durationSeconds },
  });
  return active.id;
}

/**
 * Yeni screen log kaydı açar.
 */
async function startScreenLog(visitorId, contentId, action) {
  await prisma.screenLog.create({
    data: {
      visitorId: visitorId || null,
      contentId: contentId || null,
      action: action || 'welcome_start',
      startTime: new Date(),
    },
  });
}

/**
 * Ekranın mevcut durumunu döndürür.
 */
async function loadCurrentScreenState() {
  const [defaultCompany, settingRows] = await Promise.all([
    prisma.company.findFirst({
      where: { isDefault: true, isActive: true },
    }),
    prisma.systemSetting.findMany(),
  ]);

  const activeVisitorRaw = await prisma.visitor.findFirst({
    where: {
      isScreenActive: true,
      status: { notIn: ['left', 'cancelled'] },
    },
    orderBy: [
      { arrivalTime: 'desc' },
      { createdAt: 'desc' },
    ],
    include: {
      hostPersonnel: {
        select: { fullName: true, company: { select: { id: true, name: true, logoPath: true } } },
      },
      visitedCompany: {
        select: { id: true, name: true, logoPath: true },
      },
    },
  });

  const now = new Date();
  const startsBefore = new Date(now.getTime() + 3 * 60 * 1000);
  const staleAfter = new Date(now.getTime() - 12 * 60 * 60 * 1000);

  const upcomingVisitorRaw = activeVisitorRaw ? null : await prisma.visitor.findFirst({
    where: {
      status: { notIn: ['left', 'cancelled'] },
      checkoutTime: null,
      plannedTime: {
        gte: staleAfter,
        lte: startsBefore,
      },
    },
    orderBy: [
      { plannedTime: 'asc' },
      { createdAt: 'asc' },
    ],
    include: {
      hostPersonnel: {
        select: { fullName: true, company: { select: { id: true, name: true, logoPath: true } } },
      },
      visitedCompany: {
        select: { id: true, name: true, logoPath: true },
      },
    },
  });

  const upcomingAppointmentRaw = (activeVisitorRaw || upcomingVisitorRaw) ? null : await prisma.appointment.findFirst({
    where: {
      status: 'planned',
      plannedTime: {
        gte: staleAfter,
        lte: startsBefore,
      },
    },
    orderBy: [
      { plannedTime: 'asc' },
      { createdAt: 'asc' },
    ],
    include: {
      hostPersonnel: {
        select: { fullName: true, company: { select: { id: true, name: true, logoPath: true } } },
      },
      visitedCompany: {
        select: { id: true, name: true, logoPath: true },
      },
    },
  });

  // Settings: key → value map
  const settings = {};
  for (const row of settingRows) settings[row.key] = row.value;

  // Content seçimi — öncelik: default şirkete ait default → global default → default şirkete ait herhangi → herhangi
  let content = null;
  if (defaultCompany) {
    content = await prisma.content.findFirst({
      where: { companyId: defaultCompany.id, isActive: true, isDefault: true },
    });
  }
  if (!content) {
    content = await prisma.content.findFirst({
      where: { isActive: true, isDefault: true },
      orderBy: { companyId: 'asc' },
    });
  }
  if (!content && defaultCompany) {
    content = await prisma.content.findFirst({
      where: { companyId: defaultCompany.id, isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
  }
  if (!content) {
    content = await prisma.content.findFirst({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  // API shape for activeVisitor
  const activeVisitor = activeVisitorRaw ? {
    id:               activeVisitorRaw.id,
    full_name:        activeVisitorRaw.fullName,
    tc_no:            activeVisitorRaw.tcNo,
    phone:            activeVisitorRaw.phone,
    company_name:     activeVisitorRaw.companyName,
    status:           activeVisitorRaw.status,
    is_screen_active: activeVisitorRaw.isScreenActive ? 1 : 0,
    arrival_time:     activeVisitorRaw.arrivalTime,
    host_name:         activeVisitorRaw.hostPersonnel?.fullName ?? null,
    visited_company_id: activeVisitorRaw.visitedCompanyId ?? null,
    host_company_id:   activeVisitorRaw.visitedCompany?.id ?? activeVisitorRaw.hostPersonnel?.company?.id ?? null,
    host_company_name: activeVisitorRaw.visitedCompany?.name ?? activeVisitorRaw.hostPersonnel?.company?.name ?? null,
    host_company_logo: activeVisitorRaw.visitedCompany?.logoPath ?? activeVisitorRaw.hostPersonnel?.company?.logoPath ?? null,
  } : null;

  const hostMedia = activeVisitorRaw ? {
    source: 'visitor',
    id: activeVisitorRaw.id,
    full_name: activeVisitorRaw.fullName,
    planned_time: activeVisitorRaw.plannedTime,
    arrival_time: activeVisitorRaw.arrivalTime,
    host_company_id: activeVisitorRaw.visitedCompany?.id ?? activeVisitorRaw.hostPersonnel?.company?.id ?? null,
    host_company_name: activeVisitorRaw.visitedCompany?.name ?? activeVisitorRaw.hostPersonnel?.company?.name ?? null,
    host_company_logo: activeVisitorRaw.visitedCompany?.logoPath ?? activeVisitorRaw.hostPersonnel?.company?.logoPath ?? null,
  } : upcomingVisitorRaw ? {
    source: 'visitor',
    id: upcomingVisitorRaw.id,
    full_name: upcomingVisitorRaw.fullName,
    planned_time: upcomingVisitorRaw.plannedTime,
    arrival_time: upcomingVisitorRaw.arrivalTime,
    host_company_id: upcomingVisitorRaw.visitedCompany?.id ?? upcomingVisitorRaw.hostPersonnel?.company?.id ?? null,
    host_company_name: upcomingVisitorRaw.visitedCompany?.name ?? upcomingVisitorRaw.hostPersonnel?.company?.name ?? null,
    host_company_logo: upcomingVisitorRaw.visitedCompany?.logoPath ?? upcomingVisitorRaw.hostPersonnel?.company?.logoPath ?? null,
  } : upcomingAppointmentRaw ? {
    source: 'appointment',
    id: upcomingAppointmentRaw.id,
    full_name: upcomingAppointmentRaw.visitorName,
    planned_time: upcomingAppointmentRaw.plannedTime,
    arrival_time: null,
    host_company_id: upcomingAppointmentRaw.visitedCompany?.id ?? upcomingAppointmentRaw.hostPersonnel?.company?.id ?? null,
    host_company_name: upcomingAppointmentRaw.visitedCompany?.name ?? upcomingAppointmentRaw.hostPersonnel?.company?.name ?? null,
    host_company_logo: upcomingAppointmentRaw.visitedCompany?.logoPath ?? upcomingAppointmentRaw.hostPersonnel?.company?.logoPath ?? null,
  } : null;

  // API shape for defaultCompany
  const companyShape = defaultCompany ? {
    id:          defaultCompany.id,
    name:        defaultCompany.name,
    logo_path:   defaultCompany.logoPath,
    theme_color: defaultCompany.themeColor,
    is_default:  defaultCompany.isDefault ? 1 : 0,
    is_active:   defaultCompany.isActive  ? 1 : 0,
    created_at:  defaultCompany.createdAt,
  } : null;

  // API shape for content
  const contentShape = content ? {
    id:            content.id,
    company_id:    content.companyId,
    type:          content.type,
    file_path:     content.filePath,
    title:         content.title,
    content_text:  content.contentText,
    display_order: content.displayOrder,
    is_default:    content.isDefault ? 1 : 0,
    is_active:     content.isActive  ? 1 : 0,
    created_at:    content.createdAt,
  } : null;

  return {
    visitor:   activeVisitor,
    host_media: hostMedia,
    company:   companyShape,
    content:   contentShape,
    settings,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  closeActiveScreenLog,
  startScreenLog,
  loadCurrentScreenState,
};
