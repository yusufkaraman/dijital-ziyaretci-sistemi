const express = require('express');
const prisma = require('../prisma');
const auth = require('../middleware/auth');
const { canCreateRoom, canManageRoom } = require('../policies/permissions');
const { getRoomsWithReservations, createRoomReservation, cancelRoomReservation } = require('../services/room-service');
const router = express.Router();

// GET /api/rooms
router.get('/', auth, async (req, res) => {
  try {
    res.json(await getRoomsWithReservations());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/rooms
router.post('/', auth, async (req, res) => {
  try {
    if (!canCreateRoom(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });
    const { name, capacity: rawCap, floor, equipment } = req.body;
    if (!name) return res.status(400).json({ error: 'Oda adı zorunlu' });
    const capacity = rawCap !== undefined && rawCap !== '' ? Number(rawCap) : undefined;
    if (capacity !== undefined && (isNaN(capacity) || capacity < 1 || capacity > 1000)) {
      return res.status(400).json({ error: 'Kapasite 1-1000 arasında olmalı' });
    }

    const created = await prisma.room.create({
      data: { name, capacity: capacity || 10, floor: floor || null, equipment: equipment || null },
    });
    const shaped = {
      id: created.id, name: created.name, capacity: created.capacity,
      floor: created.floor, equipment: created.equipment, status: created.status,
      current_visitor_id: created.currentVisitorId, created_at: created.createdAt,
    };
    if (global.io) global.io.emit('room:created', { room: shaped });
    res.json(shaped);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/rooms/:id/status
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status, current_visitor_id } = req.body;
    const updated = await prisma.room.update({
      where: { id: Number(req.params.id) },
      data:  { status, currentVisitorId: current_visitor_id || null },
    });
    const shaped = {
      id: updated.id, name: updated.name, capacity: updated.capacity,
      floor: updated.floor, equipment: updated.equipment, status: updated.status,
      current_visitor_id: updated.currentVisitorId, created_at: updated.createdAt,
    };
    if (global.io) global.io.emit('room:updated', { room: shaped });
    res.json(shaped);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/rooms/:id
router.put('/:id', auth, async (req, res) => {
  try {
    if (!canManageRoom(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });
    const { name, capacity: rawCap, floor, equipment, status } = req.body;
    const capacity = rawCap !== undefined && rawCap !== '' ? Number(rawCap) : undefined;
    if (capacity !== undefined && (isNaN(capacity) || capacity < 1 || capacity > 1000)) {
      return res.status(400).json({ error: 'Kapasite 1-1000 arasında olmalı' });
    }
    const updated = await prisma.room.update({
      where: { id: Number(req.params.id) },
      data:  { name, capacity: capacity || 10, floor: floor || null, equipment: equipment || null, status: status || 'available' },
    });
    const shaped = {
      id: updated.id, name: updated.name, capacity: updated.capacity,
      floor: updated.floor, equipment: updated.equipment, status: updated.status,
      current_visitor_id: updated.currentVisitorId, created_at: updated.createdAt,
    };
    if (global.io) global.io.emit('room:updated', { room: shaped });
    res.json(shaped);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/rooms/:id/reserve
router.post('/:id/reserve', auth, async (req, res) => {
  try {
    const { title, date, startTime, endTime } = req.body;
    const created = await createRoomReservation({
      roomId: req.params.id,
      userId: req.user.id,
      title, date, startTime, endTime,
    });
    if (global.io) global.io.emit('room:reserved', { room_id: Number(req.params.id), reservation_id: created.id });
    res.json({ success: true, id: created.id });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// DELETE /api/rooms/reservations/:id
router.delete('/reservations/:id', auth, async (req, res) => {
  try {
    const reservationId = Number(req.params.id);
    await cancelRoomReservation(req.params.id);
    if (global.io) global.io.emit('room:reservation_cancelled', { reservation_id: reservationId });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
