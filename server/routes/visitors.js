const express = require('express');
const prisma = require('../prisma');
const auth = require('../middleware/auth');
const v = require('../middleware/validate');
const router = express.Router();
const {
  canAssignSelfAsHost,
  canDeleteVisitors,
  canUseOutlook,
} = require('../policies/permissions');
const {
  resolveHostUserIdFromPersonnel,
  buildHostUserFilter,
} = require('../services/appointment-service');
const { closeActiveScreenLog, startScreenLog } = require('../services/screen-service');
const {
  logVisitorActivity,
  getVisitorWithHost,
  emitSocket,
  emitScreenUpdate,
  notifyVisitorArrived,
  closeActiveVisitorSession,
  toApiShape,
} = require('../services/visitor-service');

// ── GET /api/visitors ──────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { status, date, search, host_user_id, limit, offset } = req.query;
    const lim = Number.parseInt(limit, 10);
    const off = Number.parseInt(offset, 10);
    const hasLimit  = Number.isInteger(lim) && lim > 0;
    const hasOffset = Number.isInteger(off) && off >= 0;

    const where = {};
    if (status) where.status = status;

    // Tarih filtresi
    const now = new Date();
    if (date === 'today') {
      const startOfDay = new Date(now); startOfDay.setHours(0,0,0,0);
      const endOfDay   = new Date(now); endOfDay.setHours(23,59,59,999);
      where.createdAt = { gte: startOfDay, lte: endOfDay };
    } else if (date === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      where.createdAt = { gte: weekAgo };
    }

    if (search) {
      where.OR = [
        { fullName:    { contains: search, mode: 'insensitive' } },
        { tcNo:        { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (host_user_id) {
      const hId = Number(host_user_id);
      where.OR = [
        ...(where.OR || []),
        { hostUserId: hId },
        { hostPersonnel: { userId: hId } },
      ];
    }

    const visitors = await prisma.visitor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: hasLimit ? Math.min(lim, 500) : undefined,
      skip: hasLimit && hasOffset ? off : undefined,
      include: {
        hostPersonnel: {
          select: { fullName: true, title: true, company: { select: { name: true } } },
        },
        visitedCompany: {
          select: { id: true, name: true, logoPath: true },
        },
      },
    });

    res.json(visitors.map(toApiShape));
  } catch (e) {
    console.error('GET /api/visitors hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/visitors/active ───────────────────────────────────────
router.get('/active', async (req, res) => {
  try {
    const visitor = await prisma.visitor.findFirst({
      where: {
        isScreenActive: true,
        status: { notIn: ['left', 'cancelled'] },
      },
      orderBy: [
        { arrivalTime: 'desc' },
        { createdAt: 'desc' },
      ],
      include: { hostPersonnel: { select: { fullName: true } } },
    });
    res.json(visitor ? toApiShape(visitor) : null);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/visitors/stats ───────────────────────────────────────
router.get('/stats', auth, async (req, res) => {
  try {
    const { host_user_id } = req.query;
    const hId = host_user_id ? Number(host_user_id) : null;

    const hostFilter = hId ? { hostUserId: hId } : {};

    const today = new Date();
    const startOfToday = new Date(today); startOfToday.setHours(0,0,0,0);
    const endOfToday   = new Date(today); endOfToday.setHours(23,59,59,999);

    const [today_total, inside, waiting, appts_today] = await Promise.all([
      prisma.visitor.count({ where: { ...hostFilter, createdAt: { gte: startOfToday, lte: endOfToday } } }),
      prisma.visitor.count({ where: { ...hostFilter, status: 'inside' } }),
      prisma.visitor.count({ where: { ...hostFilter, status: 'waiting' } }),
      prisma.appointment.count({ where: { ...hostFilter, status: 'planned', plannedTime: { gte: startOfToday, lte: endOfToday } } }),
    ]);

    // Son 30 günlük günlük istatistikler
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 3600 * 1000);

    const [visitorsByDay, apptsByDay] = await Promise.all([
      prisma.visitor.groupBy({
        by: ['arrivalTime'],
        where: { ...hostFilter, arrivalTime: { gte: thirtyDaysAgo } },
        _count: true,
      }),
      prisma.appointment.groupBy({
        by: ['plannedTime'],
        where: { ...hostFilter, plannedTime: { gte: thirtyDaysAgo }, status: { not: 'cancelled' } },
        _count: true,
      }),
    ]);

    // Günlük bucket'lara dönüştür
    const entriesMap = {};
    for (const r of visitorsByDay) {
      if (!r.arrivalTime) continue;
      const d = r.arrivalTime.toISOString().split('T')[0];
      entriesMap[d] = (entriesMap[d] || 0) + r._count;
    }
    const appointmentsMap = {};
    for (const r of apptsByDay) {
      if (!r.plannedTime) continue;
      const d = r.plannedTime.toISOString().split('T')[0];
      appointmentsMap[d] = (appointmentsMap[d] || 0) + r._count;
    }

    const days = [], entries = [], appointments = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 3600 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      days.push(d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }));
      entries.push(entriesMap[dateStr] || 0);
      appointments.push(appointmentsMap[dateStr] || 0);
    }

    res.json({ today_total, inside, waiting, appts_today, weekly: { days, entries, appointments, exits: [] } });
  } catch (e) {
    console.error('GET /api/visitors/stats hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/visitors/:id ─────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const visitor = await prisma.visitor.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        hostPersonnel: { select: { fullName: true } },
        visitedCompany: { select: { id: true, name: true, logoPath: true } },
      },
    });
    if (!visitor) return res.status(404).json({ error: 'Bulunamadı' });
    res.json(toApiShape(visitor));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/visitors ────────────────────────────────────────────
router.post(
  '/',
  auth,
  v.chain(
    v.requireFields(['full_name']),
    v.maxLength({ full_name: 120, phone: 30, email: 120, company_name: 120, vehicle_plate: 20, reason: 200, notes: 500 }),
    v.validateTC('tc_no'),
    v.intField('visitor_count', { min: 1, max: 50 }),
    v.intField('visited_company_id', { min: 1 }),
    v.validateDate('planned_time'),
  ),
  async (req, res) => {
    try {
      const { full_name, tc_no, phone, email, company_name, vehicle_plate, visitor_count,
              host_personnel_id, visited_company_id, reason, notes, planned_time, send_email } = req.body;

      // Kara liste kontrolü
      if (tc_no) {
        const bl = await prisma.blacklist.findFirst({ where: { tcNo: tc_no } });
        if (bl) return res.status(400).json({ error: `KARALİSTE: ${bl.reason}`, blacklisted: true });
      }

      // host_user_id çözümle
      let host_user_id = null;
      if (host_personnel_id) {
        const hostResolution = await resolveHostUserIdFromPersonnel(host_personnel_id, { requireActive: true });
        if (!hostResolution.found) return res.status(400).json({ error: 'Geçersiz veya pasif personel' });
        host_user_id = hostResolution.hostUserId;
      } else if (canAssignSelfAsHost(req.user.role)) {
        host_user_id = req.user.id;
      }

      const prevActives = await closeActiveVisitorSession();

      const created = await prisma.visitor.create({
        data: {
          fullName:        full_name,
          tcNo:            tc_no        || null,
          phone:           phone         || null,
          email:           email         || null,
          companyName:     company_name  || null,
          vehiclePlate:    vehicle_plate || null,
          visitorCount:    visitor_count ? Number(visitor_count) : 1,
          visitedCompanyId: visited_company_id ? Number(visited_company_id) : null,
          hostPersonnelId: host_personnel_id ? Number(host_personnel_id) : null,
          hostUserId:      host_user_id,
          reason:          reason || null,
          notes:           notes  || null,
          plannedTime:     planned_time ? new Date(planned_time) : null,
          status:          'inside',
          isApproved:      true,
          isScreenActive:  true,
          arrivalTime:     new Date(),
          createdBy:       req.user.id,
        },
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

      const newVisitor = toApiShape(created);
      await logVisitorActivity(req.user.id, 'visitor_created', created.id, `${full_name} kaydı oluşturuldu`);

      await logVisitorActivity(req.user.id, 'visitor_arrived', created.id, `${full_name} hÄ±zlÄ± check-in ile geldi`);
      await startScreenLog(created.id, null, 'welcome_start');

      for (const pa of prevActives) {
        if (pa.id === created.id) continue;
        await logVisitorActivity(req.user.id, 'visitor_autoclose', pa.id, `${pa.full_name} Ã¶nceki aktif ziyaretÃ§i tamamlandÄ±`);
      }

      emitSocket('visitor:arrived', { visitor: newVisitor, host_user_id });
      emitScreenUpdate({ visitor: newVisitor, action: 'arrived' });
      notifyVisitorArrived(newVisitor);

      if ((send_email || canUseOutlook(req.user.role)) && process.env.AZURE_CLIENT_ID) {
        console.log(`[Outlook Sync] Ziyaretçi (${full_name}) Outlook'a push ediliyor...`);
      }

      res.json(newVisitor);
    } catch (e) {
      console.error('POST /api/visitors hatası:', e.message);
      let msg = 'Ziyaretçi kaydı oluşturulamadı. Lütfen bilgileri kontrol edip tekrar deneyin.';
      if (e.code === 'P2003') msg = 'Seçilen personel veya şirket bulunamadı.';
      if (e.code === 'P2002') msg = 'Bu ziyaretçi zaten kayıtlı.';
      res.status(500).json({ error: msg });
    }
  }
);

// ── PUT /api/visitors/:id/verify ──────────────────────────────────
router.put('/:id/verify', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const visitor = await prisma.visitor.findUnique({ where: { id } });
    if (!visitor) return res.status(404).json({ error: 'Bulunamadı' });

    await prisma.visitor.update({ where: { id }, data: { isApproved: true } });
    const updated = await getVisitorWithHost(id);

    await logVisitorActivity(req.user.id, 'visitor_verified', id, `${visitor.fullName} sekreter tarafından onaylandı`);
    emitSocket('visitor:approved', { visitor: updated, by: req.user.full_name, host_user_id: updated?.host_user_id ?? null });
    emitScreenUpdate({ visitor: updated, action: 'approved' });

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/visitors/:id/arrived ─────────────────────────────────
router.put('/:id/arrived', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const visitor = await prisma.visitor.findUnique({ where: { id } });
    if (!visitor) return res.status(404).json({ error: 'Bulunamadı' });
    if (visitor.status === 'cancelled' || visitor.status === 'left') {
      return res.status(400).json({ error: 'Bu ziyaretçi için akış sonlandırılmış' });
    }

    // Plan §4.7: active visitor close + arrived update atomik
    const prevActives = await closeActiveVisitorSession();

    await prisma.visitor.update({
      where: { id },
      data: { status: 'inside', arrivalTime: new Date(), isScreenActive: true, isApproved: true },
    });
    const updated = await getVisitorWithHost(id);

    await logVisitorActivity(req.user.id, 'visitor_arrived', id, `${visitor.fullName} içeri girdi`);
    await startScreenLog(visitor.id, null, 'welcome_start');

    for (const pa of prevActives) {
      if (pa.id === visitor.id) continue;
      await logVisitorActivity(req.user.id, 'visitor_autoclose', pa.id, `${pa.full_name} önceki aktif ziyaretçi tamamlandı`);
    }

    emitSocket('visitor:arrived', { visitor: updated, host_user_id: updated?.host_user_id ?? null });
    emitScreenUpdate({ visitor: updated, action: 'arrived' });
    notifyVisitorArrived(updated);

    res.json(updated);
  } catch (e) {
    console.error('PUT arrived hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/visitors/:id/approve ─────────────────────────────────
router.put('/:id/approve', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const visitor = await prisma.visitor.findUnique({ where: { id } });
    if (!visitor) return res.status(404).json({ error: 'Bulunamadı' });
    if (visitor.status === 'cancelled' || visitor.status === 'left') {
      return res.status(400).json({ error: 'Bu ziyaretçi için akış sonlandırılmış' });
    }

    await closeActiveVisitorSession();

    await prisma.visitor.update({
      where: { id },
      data: {
        isApproved:    true,
        status:        'inside',
        isScreenActive: true,
        arrivalTime:   visitor.arrivalTime || new Date(),
      },
    });
    const updated = await getVisitorWithHost(id);

    await logVisitorActivity(req.user.id, 'visitor_approved', id, `${visitor.fullName} onaylandı`);
    await startScreenLog(visitor.id, null, 'welcome_start');

    emitSocket('visitor:approved', { visitor: updated, by: req.user.full_name, host_user_id: updated?.host_user_id ?? null });
    emitScreenUpdate({ visitor: updated, action: 'approved' });

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/visitors/:id/reject ──────────────────────────────────
router.put(
  '/:id/reject',
  auth,
  v.chain(v.maxLength({ reason: 200 })),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { reason } = req.body;
      const visitor = await prisma.visitor.findUnique({ where: { id } });
      if (!visitor) return res.status(404).json({ error: 'Bulunamadı' });
      if (visitor.status === 'cancelled' || visitor.status === 'left') {
        return res.status(400).json({ error: 'Bu ziyaretçi için akış sonlandırılmış' });
      }

      await prisma.visitor.update({
        where: { id },
        data: { status: 'cancelled', isApproved: false, isScreenActive: false },
      });

      await logVisitorActivity(req.user.id, 'visitor_rejected', id, `${visitor.fullName} reddedildi: ${reason || ''}`);
      emitSocket('visitor:rejected', { visitor_id: id, visitor: toApiShape(visitor), reason, by: req.user.full_name });

      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

// ── PUT /api/visitors/:id/checkout ────────────────────────────────
router.put('/:id/checkout', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const visitor = await prisma.visitor.findUnique({ where: { id } });
    if (!visitor) return res.status(404).json({ error: 'Bulunamadı' });
    if (visitor.status === 'left' || visitor.status === 'cancelled') {
      return res.status(400).json({ error: 'Bu ziyaretçi için akış sonlandırılmış' });
    }

    if (visitor.isScreenActive) await closeActiveScreenLog();

    await prisma.visitor.update({
      where: { id },
      data: { status: 'left', checkoutTime: new Date(), isScreenActive: false },
    });
    const updated = await getVisitorWithHost(id);

    emitSocket('visitor:checkout', { visitor: updated, host_user_id: updated?.host_user_id ?? null });
    emitScreenUpdate({ visitor: updated, action: 'checkout' });

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/visitors/:id/cancel ──────────────────────────────────
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const visitor = await prisma.visitor.findUnique({ where: { id } });
    if (!visitor) return res.status(404).json({ error: 'Bulunamadı' });
    if (visitor.status === 'cancelled' || visitor.status === 'left') {
      return res.status(400).json({ error: 'Bu ziyaretçi için akış sonlandırılmış' });
    }

    if (visitor.isScreenActive) await closeActiveScreenLog();

    await prisma.visitor.update({
      where: { id },
      data: { status: 'cancelled', isScreenActive: false },
    });
    const updated = await getVisitorWithHost(id);

    await logVisitorActivity(req.user.id, 'visitor_cancelled', id, `${visitor.fullName} iptal edildi`);
    emitSocket('visitor:cancelled', { id });
    emitScreenUpdate({ visitor: updated, action: 'cancel' });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/visitors/:id ──────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!canDeleteVisitors(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });
    const deletedId = Number(req.params.id);
    await prisma.visitor.delete({ where: { id: deletedId } });
    if (global.io) global.io.emit('visitor:deleted', { id: deletedId });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
