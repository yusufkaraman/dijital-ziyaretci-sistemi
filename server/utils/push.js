const webpush = require('web-push');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY
};

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  console.warn('VAPID keys not found in .env. Push notifications will not work.');
} else {
  webpush.setVapidDetails(
    'mailto:admin@bikmazdesk.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
}

const { db } = require('../database');

/**
 * Belirli bir kullanıcıya veya tüm sekreterlere push bildirimi gönderir
 * @param {number|null} userId - Hedef kullanıcı ID (null ise tüm sekreterler/adminler)
 * @param {object} payload - { title, body, url }
 */
async function sendPushNotification(userId, payload) {
  let query = 'SELECT subscription FROM push_subscriptions';
  let params = [];
  
  if (userId) {
    query += ' WHERE user_id = ?';
    params.push(userId);
  }

  const subscriptions = db.prepare(query).all(...params);
  
  const jsonPayload = JSON.stringify(payload);

  const results = await Promise.allSettled(subscriptions.map(sub => {
    try {
      const subObj = JSON.parse(sub.subscription);
      return webpush.sendNotification(subObj, jsonPayload);
    } catch (e) {
      return Promise.reject(e);
    }
  }));

  // Hatalı (süresi dolmuş) abonelikleri temizle
  results.forEach((res, index) => {
    if (res.status === 'rejected' && (res.reason.statusCode === 410 || res.reason.statusCode === 404)) {
      db.prepare('DELETE FROM push_subscriptions WHERE subscription = ?').run(subscriptions[index].subscription);
    }
  });
}

module.exports = { sendPushNotification };
