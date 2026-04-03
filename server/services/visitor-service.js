const { sendPushNotification } = require('../utils/push');
const { closeActiveScreenLog } = require('./screen-service');

function logVisitorActivity(db, userId, action, entityId, details) {
  db.prepare(`
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (?,?,?,?,?)
  `).run(userId, action, 'visitor', entityId, details);
}

function getVisitorWithHost(db, visitorId) {
  return db.prepare(`
    SELECT v.*, p.full_name as host_name
    FROM visitors v
    LEFT JOIN personnel p ON v.host_personnel_id=p.id
    WHERE v.id=?
  `).get(visitorId);
}

function emitSocket(eventName, payload) {
  if (global.io) {
    global.io.emit(eventName, payload);
  }
}

function emitScreenUpdate(payload) {
  emitSocket('screen:update', payload);
}

function notifyNewVisitor(fullName, hostUserId) {
  sendPushNotification(null, {
    title: 'Yeni Misafir Kaydı',
    body: `${fullName} giriş talebi oluşturdu.`,
    url: '/panel',
  });

  if (hostUserId) {
    sendPushNotification(hostUserId, {
      title: 'Misafiriniz Kapıda',
      body: `${fullName} sizi bekliyor.`,
      url: '/yonetici',
    });
  }
}

function notifyVisitorArrived(visitor) {
  if (!visitor || !visitor.host_user_id) return;
  sendPushNotification(visitor.host_user_id, {
    title: 'Misafiriniz Giriş Yaptı',
    body: `${visitor.full_name} kuruma giriş yaptı.`,
    url: '/personel',
  });
}

function closeActiveVisitorSession(db) {
  const prevActives = db.prepare('SELECT id, full_name FROM visitors WHERE is_screen_active=1').all();
  closeActiveScreenLog(db);
  db.prepare(`
    UPDATE visitors
    SET is_screen_active=0, status='left', checkout_time=datetime('now','+3 hours')
    WHERE is_screen_active=1
  `).run();
  return prevActives;
}

module.exports = {
  logVisitorActivity,
  getVisitorWithHost,
  emitSocket,
  emitScreenUpdate,
  notifyNewVisitor,
  notifyVisitorArrived,
  closeActiveVisitorSession,
};
