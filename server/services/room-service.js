function getRoomsWithReservations(db) {
  const rooms = db.prepare('SELECT * FROM rooms ORDER BY name').all();
  const reservations = db.prepare(`
    SELECT rr.*, u.full_name as user_name
    FROM room_reservations rr
    LEFT JOIN users u ON rr.user_id = u.id
    WHERE rr.status='active' AND rr.end_time >= datetime('now', '+3 hours')
    ORDER BY rr.start_time
  `).all();

  for (const room of rooms) {
    room.reservations = reservations.filter((reservation) => reservation.room_id === room.id);
  }

  return rooms;
}

function createRoomReservation(db, payload) {
  if (!payload.title || !payload.date || !payload.startTime || !payload.endTime) {
    const err = new Error('Tüm alanlar zorunlu');
    err.status = 400;
    throw err;
  }

  const startTime = `${payload.date} ${payload.startTime}:00`;
  const endTime = `${payload.date} ${payload.endTime}:00`;

  const conflict = db.prepare(`
    SELECT id
    FROM room_reservations
    WHERE room_id=? AND status='active'
      AND (start_time < ? AND end_time > ?)
  `).get(payload.roomId, endTime, startTime);

  if (conflict) {
    const err = new Error('Bu saatler arasında odanın başka bir kaydı var!');
    err.status = 400;
    throw err;
  }

  return db.prepare(`
    INSERT INTO room_reservations (room_id, user_id, title, start_time, end_time)
    VALUES (?, ?, ?, ?, ?)
  `).run(payload.roomId, payload.userId, payload.title, startTime, endTime);
}

function cancelRoomReservation(db, reservationId) {
  db.prepare("UPDATE room_reservations SET status='cancelled' WHERE id=?").run(reservationId);
}

module.exports = {
  getRoomsWithReservations,
  createRoomReservation,
  cancelRoomReservation,
};
