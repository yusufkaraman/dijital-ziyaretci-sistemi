const express = require('express');
const prisma = require('../prisma');
const auth = require('../middleware/auth');
const { canUseOutlook } = require('../policies/permissions');
const { resolveHostUserIdFromPersonnel, buildHostUserFilter } = require('../services/appointment-service');
const { emitSocket } = require('../services/visitor-service');
const router = express.Router();

/** API contract helper: Prisma camelCase → snake_case */
function toApiShape(a) {
  if (!a) return null;
  return {
    id:               a.id,
    visitor_name:     a.visitorName,
    visitor_tc:       a.visitorTc,
    visitor_phone:    a.visitorPhone,
    visitor_email:    a.visitorEmail,
    visitor_company:  a.visitorCompany,
    visited_company_id: a.visitedCompanyId,
    vehicle_plate:    a.vehiclePlate,
    visitor_count:    a.visitorCount,
    host_personnel_id: a.hostPersonnelId,
    host_user_id:     a.hostUserId,
    reason:           a.reason,
    notes:            a.notes,
    planned_time:     a.plannedTime,
    status:           a.status,
    visitor_id:       a.visitorId,
    created_by:       a.createdBy,
    created_at:       a.createdAt,
    host_name:        a.hostPersonnel?.fullName  ?? null,
    host_title:       a.hostPersonnel?.title     ?? null,
    host_email:       a.hostPersonnel?.email     ?? null,
    host_company_id:   a.visitedCompany?.id ?? a.hostPersonnel?.company?.id ?? null,
    host_company_name: a.visitedCompany?.name ?? a.hostPersonnel?.company?.name ?? null,
    host_company_logo: a.visitedCompany?.logoPath ?? a.hostPersonnel?.company?.logoPath ?? null,
  };
}

// GET /api/appointments
router.get('/', auth, async (req, res) => {
  try {
    const { date, month, range, status, host_user_id, company, limit, offset } = req.query;
    const lim = Number.parseInt(limit, 10);
    const off = Number.parseInt(offset, 10);
    const hasLimit  = Number.isInteger(lim) && lim > 0;
    const hasOffset = Number.isInteger(off) && off >= 0;

    const now = new Date();
    const where = { status: { not: 'cancelled' } };

    // Tarih filtresi
    if (range === 'all') {
      // plannedTime filtresi yok
    } else if (range === 'future') {
      where.plannedTime = { gte: now };
    } else if (range === 'this_week') {
      const dayOfWeek = now.getDay() || 7;
      const start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek + 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      where.plannedTime = { gte: start, lte: end };
    } else if (range === 'prev_week') {
      const dayOfWeek = now.getDay() || 7;
      const start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek - 6);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      where.plannedTime = { gte: start, lte: end };
    } else if (range === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      where.plannedTime = { gte: start, lte: end };
    } else if (range === 'prev_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      where.plannedTime = { gte: start, lte: end };
    } else if (range === 'this_year') {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      where.plannedTime = { gte: start, lte: end };
    } else if (range === 'prev_year') {
      const start = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      where.plannedTime = { gte: start, lte: end };
    } else if (date === 'today') {
      const s = new Date(now); s.setHours(0,0,0,0);
      const e = new Date(now); e.setHours(23,59,59,999);
      where.plannedTime = { gte: s, lte: e };
    } else if (date === 'week') {
      const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
      const nextWeek  = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
      where.plannedTime = { gte: yesterday, lte: nextWeek };
    } else if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const day = new Date(date);
      const dayEnd = new Date(date); dayEnd.setHours(23,59,59,999);
      where.plannedTime = { gte: day, lte: dayEnd };
    } else if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, monthIndex] = month.split('-').map(Number);
      const monthStart = new Date(year, monthIndex - 1, 1, 0, 0, 0, 0);
      const monthEnd = new Date(year, monthIndex, 0, 23, 59, 59, 999);
      where.plannedTime = { gte: monthStart, lte: monthEnd };
    } else {
      // Gelecek randevular
      where.plannedTime = { gte: now };
    }

    if (status) where.status = status;

    if (host_user_id) {
      const hId = Number(host_user_id);
      where.OR = [
        { hostUserId: hId },
        { hostPersonnel: { userId: hId } },
      ];
    }

    if (company && company !== 'all') {
      where.visitedCompany = { name: { equals: company, mode: 'insensitive' } };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { plannedTime: 'asc' },
      take: hasLimit ? Math.min(lim, 500) : undefined,
      skip: hasLimit && hasOffset ? off : undefined,
      include: {
        hostPersonnel: {
          select: { fullName: true, title: true, email: true, company: { select: { id: true, name: true, logoPath: true } } },
        },
        visitedCompany: {
          select: { id: true, name: true, logoPath: true },
        },
      },
    });

    res.json(appointments.map(toApiShape));
  } catch (e) {
    console.error('GET /api/appointments hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/appointments
router.post('/', auth, async (req, res) => {
  try {
    const { visitor_name, visitor_tc, visitor_phone, visitor_email, visitor_company,
            visited_company_id, vehicle_plate, visitor_count, host_personnel_id, reason, notes, planned_time } = req.body;
    if (!visitor_name || !planned_time) return res.status(400).json({ error: 'Ad ve zaman zorunlu' });

    const hostResolution = await resolveHostUserIdFromPersonnel(host_personnel_id);
    const host_user_id = hostResolution.hostUserId;

    // Personnel rolü oluşturduğunda sekreter onayı gerekir
    const needsApproval = req.user.role === 'personnel';
    const initialStatus = needsApproval ? 'pending_approval' : 'planned';

    const created = await prisma.appointment.create({
      data: {
        visitorName:     visitor_name,
        visitorTc:       visitor_tc      || null,
        visitorPhone:    visitor_phone   || null,
        visitorEmail:    visitor_email   || null,
        visitorCompany:  visitor_company || null,
        visitedCompanyId: visited_company_id ? Number(visited_company_id) : null,
        vehiclePlate:    vehicle_plate   || null,
        visitorCount:    visitor_count   || 1,
        hostPersonnelId: host_personnel_id ? Number(host_personnel_id) : null,
        hostUserId:      host_user_id,
        reason:          reason          || null,
        notes:           notes           || null,
        plannedTime:     new Date(planned_time),
        status:          initialStatus,
        createdBy:       req.user.id,
      },
      include: {
        hostPersonnel: {
          select: { fullName: true, title: true, email: true, company: { select: { id: true, name: true, logoPath: true } } },
        },
        visitedCompany: {
          select: { id: true, name: true, logoPath: true },
        },
      },
    });

    if (canUseOutlook(req.user.role) && process.env.AZURE_CLIENT_ID) {
      console.log(`[Outlook Sync] Randevu (${created.visitorName}) Outlook'a push ediliyor...`);
    }

    const shaped = toApiShape(created);
    if (global.io) global.io.emit('appointment:created', { appointment: shaped });
    res.json(shaped);
  } catch (e) {
    console.error('POST /api/appointments hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/appointments/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const allowedRoles = ['admin', 'manager', 'secretary'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Randevu düzenleme yetkiniz yok' });
    }

    const { visitor_name, visitor_tc, visitor_phone, visitor_email, visitor_company,
            visited_company_id, vehicle_plate, visitor_count, host_personnel_id, reason, notes, planned_time, status } = req.body;

    if (!visitor_name || !planned_time) {
      return res.status(400).json({ error: 'Ad ve zaman zorunlu' });
    }

    const hostResolution = await resolveHostUserIdFromPersonnel(host_personnel_id);
    const host_user_id = hostResolution.hostUserId;

    const updated = await prisma.appointment.update({
      where: { id: Number(req.params.id) },
      data: {
        visitorName:     visitor_name,
        visitorTc:       visitor_tc      || null,
        visitorPhone:    visitor_phone   || null,
        visitorEmail:    visitor_email   || null,
        visitorCompany:  visitor_company || null,
        visitedCompanyId: visited_company_id ? Number(visited_company_id) : null,
        vehiclePlate:    vehicle_plate   || null,
        visitorCount:    visitor_count   || 1,
        hostPersonnelId: host_personnel_id ? Number(host_personnel_id) : null,
        hostUserId:      host_user_id,
        reason:          reason          || null,
        notes:           notes           || null,
        plannedTime:     new Date(planned_time),
        status:          status          || 'planned',
      },
      include: {
        hostPersonnel: {
          select: { fullName: true, title: true, email: true, company: { select: { id: true, name: true, logoPath: true } } },
        },
        visitedCompany: {
          select: { id: true, name: true, logoPath: true },
        },
      },
    });

    const shaped = toApiShape(updated);
    if (global.io) global.io.emit('appointment:updated', { appointment: shaped });
    res.json(shaped);
  } catch (e) {
    console.error('PUT /api/appointments/:id hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/appointments/:id/cancel
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    await prisma.appointment.update({
      where: { id: Number(req.params.id) },
      data: { status: 'cancelled' },
    });
    if (global.io) global.io.emit('appointment:cancelled', { id: Number(req.params.id) });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/appointments/:id/approve — Sekreter onayı
router.put('/:id/approve', auth, async (req, res) => {
  try {
    const allowedRoles = ['admin', 'manager', 'secretary'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Randevu onaylama yetkiniz yok' });
    }

    const appt = await prisma.appointment.findFirst({
      where: { id: Number(req.params.id), status: 'pending_approval' },
    });
    if (!appt) return res.status(404).json({ error: 'Onay bekleyen randevu bulunamadı' });

    const updated = await prisma.appointment.update({
      where: { id: appt.id },
      data: { status: 'planned' },
      include: {
        hostPersonnel: {
          select: { fullName: true, title: true, email: true, company: { select: { id: true, name: true, logoPath: true } } },
        },
        visitedCompany: {
          select: { id: true, name: true, logoPath: true },
        },
      },
    });

    const shaped = toApiShape(updated);
    if (global.io) global.io.emit('appointment:approved', { appointment: shaped });
    res.json(shaped);
  } catch (e) {
    console.error('PUT /api/appointments/:id/approve hatası:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/appointments/:id/checkin — Randevu → Ziyaretçi (Atomik)
router.post('/:id/checkin', auth, async (req, res) => {
  try {
    const appt = await prisma.appointment.findFirst({
      where: { id: Number(req.params.id), status: 'planned' },
    });
    if (!appt) return res.status(404).json({ error: 'Randevu bulunamadı veya daha önceden işlem yapılmış' });

    // Plan §4.7: appointment-to-visitor atomik transaction
    const visitorObj = await prisma.$transaction(async (tx) => {
      const created = await tx.visitor.create({
        data: {
          fullName:        appt.visitorName,
          tcNo:            appt.visitorTc,
          phone:           appt.visitorPhone,
          email:           appt.visitorEmail,
          companyName:     appt.visitorCompany,
          visitedCompanyId: appt.visitedCompanyId,
          hostPersonnelId: appt.hostPersonnelId,
          hostUserId:      appt.hostUserId,
          reason:          appt.reason || `Randevu: ${appt.visitorName}`,
          status:          'waiting',
          isApproved:      false,
          isScreenActive:  false,
          createdBy:       req.user.id,
          visitorCount:    appt.visitorCount || 1,
        },
        include: {
          hostPersonnel: { select: { fullName: true } },
          visitedCompany: { select: { id: true, name: true, logoPath: true } },
        },
      });

      await tx.appointment.update({
        where: { id: appt.id },
        data: { status: 'arrived', visitorId: created.id },
      });

      return created;
    });

    const shaped = {
      id:               visitorObj.id,
      full_name:        visitorObj.fullName,
      tc_no:            visitorObj.tcNo,
      phone:            visitorObj.phone,
      email:            visitorObj.email,
      company_name:     visitorObj.companyName,
      visited_company_id: visitorObj.visitedCompanyId,
      host_personnel_id: visitorObj.hostPersonnelId,
      host_user_id:     visitorObj.hostUserId,
      reason:           visitorObj.reason,
      status:           visitorObj.status,
      is_approved:      visitorObj.isApproved ? 1 : 0,
      is_screen_active: visitorObj.isScreenActive ? 1 : 0,
      created_by:       visitorObj.createdBy,
      visitor_count:    visitorObj.visitorCount,
      created_at:       visitorObj.createdAt,
      host_name:        visitorObj.hostPersonnel?.fullName ?? null,
      host_company_id:   visitorObj.visitedCompany?.id ?? null,
      host_company_name: visitorObj.visitedCompany?.name ?? null,
      host_company_logo: visitorObj.visitedCompany?.logoPath ?? null,
    };

    if (global.io) {
      global.io.emit('visitor:waiting', { visitor: shaped, host_user_id: shaped.host_user_id });
    }

    res.json(shaped);
  } catch (e) {
    console.error('POST /api/appointments/:id/checkin hatası:', e.message);
    res.status(500).json({ error: 'Atomik check-in işlemi başarısız', details: e.message });
  }
});

// DELETE /api/appointments/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const deletedId = Number(req.params.id);
    await prisma.appointment.delete({ where: { id: deletedId } });
    if (global.io) global.io.emit('appointment:deleted', { id: deletedId });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
