const express = require('express');
const { db } = require('../database');
const auth = require('../middleware/auth');
const { canCreateRoom, canManageRoom } = require('../policies/permissions');
const {
  getRoomsWithReservations,
  createRoomReservation,
  cancelRoomReservation,
} = require('../services/room-service');
const router = express.Router();

// GET /api/rooms
router.get('/', auth, (req, res) => {
  res.json(getRoomsWithReservations(db));
});

// POST /api/rooms
router.post('/', auth, (req, res) => {
  if (!canCreateRoom(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });
  const { name, capacity, floor, equipment } = req.body;
  if (!name) return res.status(400).json({ error: 'Oda adı zorunlu' });
  const r = db.prepare('INSERT INTO rooms (name, capacity, floor, equipment) VALUES (?,?,?,?)').run(name, capacity||10, floor||null, equipment||null);
  res.json(db.prepare('SELECT * FROM rooms WHERE id=?').get(r.lastInsertRowid));
});

// PUT /api/rooms/:id/status
router.put('/:id/status', auth, (req, res) => {
  const { status, current_visitor_id } = req.body;
  db.prepare('UPDATE rooms SET status=?, current_visitor_id=? WHERE id=?').run(status, current_visitor_id||null, req.params.id);
  res.json(db.prepare('SELECT * FROM rooms WHERE id=?').get(req.params.id));
});

// PUT /api/rooms/:id
router.put('/:id', auth, (req, res) => {
  if (!canManageRoom(req.user.role)) return res.status(403).json({ error: 'Yetkisiz' });
  const { name, capacity, floor, equipment, status } = req.body;
  db.prepare('UPDATE rooms SET name=?, capacity=?, floor=?, equipment=?, status=? WHERE id=?').run(name, capacity||10, floor||null, equipment||null, status||'available', req.params.id);
  res.json(db.prepare('SELECT * FROM rooms WHERE id=?').get(req.params.id));
});

// POST /api/rooms/:id/reserve
router.post('/:id/reserve', auth, (req, res) => {
  const { title, date, startTime, endTime } = req.body;
  try {
    const created = createRoomReservation(db, {
      roomId: req.params.id,
      userId: req.user.id,
      title,
      date,
      startTime,
      endTime,
    });
    res.json({ success: true, id: created.lastInsertRowid });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
});

// DELETE /api/rooms/reservations/:id
router.delete('/reservations/:id', auth, (req, res) => {
  cancelRoomReservation(db, req.params.id);
  res.json({success: true});
});

module.exports = router;
