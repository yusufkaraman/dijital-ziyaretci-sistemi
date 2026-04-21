const webpush = require('web-push');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const prisma = require('../prisma');

const vapidKeys = {
  publicKey:  process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
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

/**
 * Belirli bir kullanıcıya veya belirli rollere push bildirimi gönderir.
 * @param {number|null} userId - Hedef kullanıcı ID (null ise roles parametresine bakılır)
 * @param {object} payload - { title, body, url }
 * @param {object} [options] - { roles: ['secretary','admin',...] } — userId null iken rol filtresi
 */
async function sendPushNotification(userId, payload, options) {
  let where;
  if (userId) {
    where = { userId: Number(userId) };
  } else if (options && Array.isArray(options.roles) && options.roles.length) {
    // Sadece belirtilen rollerdeki kullanıcıların aboneliklerini getir
    const users = await prisma.user.findMany({
      where: { role: { in: options.roles }, isActive: true },
      select: { id: true },
    });
    const userIds = users.map(u => u.id);
    if (!userIds.length) return;
    where = { userId: { in: userIds } };
  } else {
    where = {};
  }
  const subscriptions = await prisma.pushSubscription.findMany({
    where,
    select: { id: true, subscription: true },
  });

  if (!subscriptions.length) return;

  const jsonPayload = JSON.stringify(payload);

  const results = await Promise.allSettled(
    subscriptions.map(sub => {
      try {
        const subObj = JSON.parse(sub.subscription);
        return webpush.sendNotification(subObj, jsonPayload);
      } catch (e) {
        return Promise.reject(e);
      }
    })
  );

  // Hatalı (süresi dolmuş) abonelikleri temizle — fire-and-forget
  const expired = [];
  results.forEach((res, i) => {
    if (res.status === 'rejected' && (res.reason?.statusCode === 410 || res.reason?.statusCode === 404)) {
      expired.push(subscriptions[i].id);
    }
  });

  if (expired.length) {
    prisma.pushSubscription.deleteMany({
      where: { id: { in: expired } },
    }).catch(() => {});
  }
}

module.exports = { sendPushNotification };
