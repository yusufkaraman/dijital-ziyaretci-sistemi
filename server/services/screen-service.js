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
async function loadCurrentScreenState(options = {}) {
  const debugEnabled = Boolean(options.debug);
  const [defaultCompany, settingRows] = await Promise.all([
    prisma.company.findFirst({
      where: { isDefault: true, isActive: true },
    }),
    prisma.systemSetting.findMany(),
  ]);

  const visitorInclude = {
    hostPersonnel: {
      select: { fullName: true, company: { select: { id: true, name: true, logoPath: true } } },
    },
    visitedCompany: {
      select: { id: true, name: true, logoPath: true },
    },
  };

  const activeVisitorRaw = await prisma.visitor.findFirst({
    where: {
      isScreenActive: true,
      status: { notIn: ['left', 'cancelled'] },
    },
    orderBy: [
      { arrivalTime: 'desc' },
      { createdAt: 'desc' },
    ],
    include: visitorInclude,
  });

  const now = new Date();
  const startsBefore = new Date(now.getTime() + 3 * 60 * 1000);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const staleAfter = new Date(now.getTime() - 12 * 60 * 60 * 1000);

  const upcomingVisitorRows = await prisma.visitor.findMany({
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
    take: 20,
    include: visitorInclude,
  });

  const upcomingAppointmentForMediaRows = await prisma.appointment.findMany({
    where: {
      status: 'planned',
      plannedTime: {
        gte: startOfToday,
        lte: startsBefore,
      },
    },
    orderBy: [
      { plannedTime: 'asc' },
      { createdAt: 'asc' },
    ],
    take: 20,
    include: {
      hostPersonnel: {
        select: { fullName: true, company: { select: { id: true, name: true, logoPath: true } } },
      },
      visitedCompany: {
        select: { id: true, name: true, logoPath: true },
      },
    },
  });

  const toTime = (value) => value ? new Date(value).getTime() : 0;
  const isDue = (plannedTime) => {
    const plannedMs = toTime(plannedTime);
    return plannedMs > 0 && plannedMs <= now.getTime();
  };
  const visitorActivationTime = (visitor) => toTime(visitor?.arrivalTime) || toTime(visitor?.createdAt);
  const scheduledActivationTime = (item) => toTime(item?.plannedTime) || toTime(item?.createdAt);
  const hostMediaCandidates = [];

  if (activeVisitorRaw) {
    hostMediaCandidates.push({
      type: 'activeVisitor',
      raw: activeVisitorRaw,
      activationTime: visitorActivationTime(activeVisitorRaw),
      isDue: true,
    });
  }
  for (const upcomingVisitorRaw of upcomingVisitorRows) {
    hostMediaCandidates.push({
      type: 'upcomingVisitor',
      raw: upcomingVisitorRaw,
      activationTime: scheduledActivationTime(upcomingVisitorRaw),
      isDue: isDue(upcomingVisitorRaw.plannedTime),
    });
  }
  for (const upcomingAppointmentForMediaRaw of upcomingAppointmentForMediaRows) {
    hostMediaCandidates.push({
      type: 'appointment',
      raw: upcomingAppointmentForMediaRaw,
      activationTime: scheduledActivationTime(upcomingAppointmentForMediaRaw),
      isDue: isDue(upcomingAppointmentForMediaRaw.plannedTime),
    });
  }

  const dueHostMedia = hostMediaCandidates
    .filter((candidate) => candidate.isDue)
    .sort((a, b) => b.activationTime - a.activationTime)[0] || null;
  const hostMediaWinner = dueHostMedia
    || (!activeVisitorRaw
      ? hostMediaCandidates
        .filter((candidate) => candidate.activationTime > now.getTime())
        .sort((a, b) => a.activationTime - b.activationTime)[0] || null
      : null);
  const selectedActiveVisitorRaw = hostMediaWinner?.type === 'activeVisitor' ? activeVisitorRaw : null;
  const debugCandidateShape = (candidate) => candidate ? {
    type: candidate.type,
    id: candidate.raw?.id ?? null,
    name: candidate.raw?.fullName || candidate.raw?.visitorName || null,
    status: candidate.raw?.status || null,
    planned_time: candidate.raw?.plannedTime || null,
    arrival_time: candidate.raw?.arrivalTime || null,
    created_at: candidate.raw?.createdAt || null,
    activation_time: candidate.activationTime ? new Date(candidate.activationTime).toISOString() : null,
    is_due: candidate.isDue,
    host_company_id: candidate.raw?.visitedCompany?.id ?? candidate.raw?.hostPersonnel?.company?.id ?? null,
    host_company_name: candidate.raw?.visitedCompany?.name ?? candidate.raw?.hostPersonnel?.company?.name ?? null,
  } : null;

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
  const activeVisitor = selectedActiveVisitorRaw ? {
    id:               selectedActiveVisitorRaw.id,
    full_name:        selectedActiveVisitorRaw.fullName,
    tc_no:            selectedActiveVisitorRaw.tcNo,
    phone:            selectedActiveVisitorRaw.phone,
    company_name:     selectedActiveVisitorRaw.companyName,
    status:           selectedActiveVisitorRaw.status,
    is_screen_active: selectedActiveVisitorRaw.isScreenActive ? 1 : 0,
    planned_time:     selectedActiveVisitorRaw.plannedTime,
    arrival_time:     selectedActiveVisitorRaw.arrivalTime,
    created_at:       selectedActiveVisitorRaw.createdAt,
    host_name:         selectedActiveVisitorRaw.hostPersonnel?.fullName ?? null,
    visited_company_id: selectedActiveVisitorRaw.visitedCompanyId ?? null,
    host_company_id:   selectedActiveVisitorRaw.visitedCompany?.id ?? selectedActiveVisitorRaw.hostPersonnel?.company?.id ?? null,
    host_company_name: selectedActiveVisitorRaw.visitedCompany?.name ?? selectedActiveVisitorRaw.hostPersonnel?.company?.name ?? null,
    host_company_logo: selectedActiveVisitorRaw.visitedCompany?.logoPath ?? selectedActiveVisitorRaw.hostPersonnel?.company?.logoPath ?? null,
  } : null;

  const hostMediaSource = hostMediaWinner?.raw || null;
  const hostMedia = hostMediaWinner?.type === 'activeVisitor' ? {
    source: 'visitor',
    id: hostMediaSource.id,
    full_name: hostMediaSource.fullName,
    company_name: hostMediaSource.companyName || null,
    planned_time: hostMediaSource.plannedTime,
    arrival_time: hostMediaSource.arrivalTime,
    activated_at: new Date(hostMediaWinner.activationTime).toISOString(),
    host_name: hostMediaSource.hostPersonnel?.fullName ?? null,
    host_company_id: hostMediaSource.visitedCompany?.id ?? hostMediaSource.hostPersonnel?.company?.id ?? null,
    host_company_name: hostMediaSource.visitedCompany?.name ?? hostMediaSource.hostPersonnel?.company?.name ?? null,
    host_company_logo: hostMediaSource.visitedCompany?.logoPath ?? hostMediaSource.hostPersonnel?.company?.logoPath ?? null,
  } : hostMediaWinner?.type === 'upcomingVisitor' ? {
    source: 'visitor',
    id: hostMediaSource.id,
    full_name: hostMediaSource.fullName,
    company_name: hostMediaSource.companyName || null,
    planned_time: hostMediaSource.plannedTime,
    arrival_time: hostMediaSource.arrivalTime,
    activated_at: new Date(hostMediaWinner.activationTime).toISOString(),
    host_name: hostMediaSource.hostPersonnel?.fullName ?? null,
    host_company_id: hostMediaSource.visitedCompany?.id ?? hostMediaSource.hostPersonnel?.company?.id ?? null,
    host_company_name: hostMediaSource.visitedCompany?.name ?? hostMediaSource.hostPersonnel?.company?.name ?? null,
    host_company_logo: hostMediaSource.visitedCompany?.logoPath ?? hostMediaSource.hostPersonnel?.company?.logoPath ?? null,
  } : hostMediaWinner?.type === 'appointment' ? {
    source: 'appointment',
    id: hostMediaSource.id,
    full_name: hostMediaSource.visitorName,
    company_name: hostMediaSource.visitorCompany || null,
    planned_time: hostMediaSource.plannedTime,
    arrival_time: null,
    activated_at: new Date(hostMediaWinner.activationTime).toISOString(),
    host_name: hostMediaSource.hostPersonnel?.fullName ?? null,
    host_company_id: hostMediaSource.visitedCompany?.id ?? hostMediaSource.hostPersonnel?.company?.id ?? null,
    host_company_name: hostMediaSource.visitedCompany?.name ?? hostMediaSource.hostPersonnel?.company?.name ?? null,
    host_company_logo: hostMediaSource.visitedCompany?.logoPath ?? hostMediaSource.hostPersonnel?.company?.logoPath ?? null,
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

  const response = {
    visitor:   activeVisitor,
    pending_appointments: activeVisitor ? [activeVisitor] : [],
    host_media: hostMedia,
    company:   companyShape,
    content:   contentShape,
    settings,
    timestamp: new Date().toISOString(),
  };

  if (debugEnabled) {
    response.debug = {
      now: now.toISOString(),
      starts_before: startsBefore.toISOString(),
      stale_after: staleAfter.toISOString(),
      active_visitor_id: activeVisitorRaw?.id ?? null,
      upcoming_visitor_count: upcomingVisitorRows.length,
      appointment_count: upcomingAppointmentForMediaRows.length,
      candidates: hostMediaCandidates.map(debugCandidateShape),
      winner: debugCandidateShape(hostMediaWinner),
      selected_visitor_id: selectedActiveVisitorRaw?.id ?? null,
    };
  }

  return response;
}

module.exports = {
  closeActiveScreenLog,
  startScreenLog,
  loadCurrentScreenState,
};
