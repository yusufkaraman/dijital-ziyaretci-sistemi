const prisma = require('../prisma');

async function getRoomsWithReservations() {
  const rooms = await prisma.room.findMany({ orderBy: { name: 'asc' } });

  const reservations = await prisma.roomReservation.findMany({
    where: {
      status:  'active',
      endTime: { gte: new Date() },
    },
    orderBy: { startTime: 'asc' },
    include: { user: { select: { fullName: true } } },
  });

  // API contract: reservations nested inside each room
  return rooms.map(room => ({
    id:                 room.id,
    name:               room.name,
    capacity:           room.capacity,
    floor:              room.floor,
    equipment:          room.equipment,
    status:             room.status,
    current_visitor_id: room.currentVisitorId,
    created_at:         room.createdAt,
    reservations: reservations
      .filter(r => r.roomId === room.id)
      .map(r => ({
        id:         r.id,
        room_id:    r.roomId,
        user_id:    r.userId,
        title:      r.title,
        start_time: r.startTime,
        end_time:   r.endTime,
        status:     r.status,
        created_at: r.createdAt,
        user_name:  r.user?.fullName ?? null,
      })),
  }));
}

async function createRoomReservation(payload) {
  if (!payload.title || !payload.date || !payload.startTime || !payload.endTime) {
    const err = new Error('Tüm alanlar zorunlu');
    err.status = 400;
    throw err;
  }

  const startTime = new Date(`${payload.date}T${payload.startTime}:00`);
  const endTime   = new Date(`${payload.date}T${payload.endTime}:00`);
  const roomId    = Number(payload.roomId);

  // Plan §4.7: overlap check + insert SERIALIZABLE transaction ile
  const created = await prisma.$transaction(async (tx) => {
    const conflict = await tx.roomReservation.findFirst({
      where: {
        roomId,
        status: 'active',
        startTime: { lt: endTime },
        endTime:   { gt: startTime },
      },
      select: { id: true },
    });

    if (conflict) {
      const err = new Error('Bu saatler arasında odanın başka bir kaydı var!');
      err.status = 400;
      throw err;
    }

    return tx.roomReservation.create({
      data: {
        roomId,
        userId: payload.userId,
        title:  payload.title,
        startTime,
        endTime,
      },
    });
  }, { isolationLevel: 'Serializable' });

  return created;
}

async function cancelRoomReservation(reservationId) {
  await prisma.roomReservation.update({
    where: { id: Number(reservationId) },
    data:  { status: 'cancelled' },
  });
}

module.exports = {
  getRoomsWithReservations,
  createRoomReservation,
  cancelRoomReservation,
};
