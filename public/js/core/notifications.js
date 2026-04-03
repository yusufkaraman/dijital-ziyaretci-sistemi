(function() {
  if (window.__vdNotificationsLoaded) return;
  window.__vdNotificationsLoaded = true;

  const VAPID_PUBLIC_KEY = 'BIrwpqdM38o4wqqOu45fghK_nKy6cac8YT9jIdjkhm56Yfq8z_fg_0YbZ6tBE3R7xufSRmgcTMLpKiAwtue-CiQ';

  async function vdInitNotifications() {
    if (!('Notification' in window)) {
      console.warn('Native notifications not supported');
      return;
    }

    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('SW Registered:', registration.scope);

        if (Notification.permission === 'default') {
          await vdRequestNotificationPermission();
        } else if (Notification.permission === 'granted') {
          await vdSubscribeUserToPush();
        }
      } catch (e) {
        console.error('SW Registration Failed:', e);
      }
    }
  }

  async function vdRequestNotificationPermission() {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');
      await vdSubscribeUserToPush();
      return true;
    }
    return false;
  }

  async function vdSubscribeUserToPush() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vdUrlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      if (window.api && typeof window.api.subscribePush === 'function') {
        await window.api.subscribePush(subscription);
      } else if (typeof api !== 'undefined' && api && typeof api.subscribePush === 'function') {
        await api.subscribePush(subscription);
      } else {
        throw new Error('Push API wrapper bulunamadi');
      }
      console.log('Push Subscription Successful');
    } catch (e) {
      console.error('Push Subscription Failed:', e);
    }
  }

  function vdShowWindowsNotification(title, body, url) {
    const targetUrl = url || '/';
    if (Notification.permission === 'granted') {
      const options = {
        body: body,
        icon: '/Assets/sitelogo.png',
        badge: '/Assets/sitelogo.png',
        data: { url: targetUrl }
      };
      const n = new Notification(title, options);
      n.onclick = function(e) {
        e.preventDefault();
        window.focus();
        if (targetUrl !== '/') window.location.hash = targetUrl;
        n.close();
      };
    }
  }

  function vdUrlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  window.vdInitNotifications = vdInitNotifications;
  window.vdRequestNotificationPermission = vdRequestNotificationPermission;
  window.vdSubscribeUserToPush = vdSubscribeUserToPush;
  window.vdShowWindowsNotification = vdShowWindowsNotification;

  if (typeof window.initNotifications !== 'function') window.initNotifications = vdInitNotifications;
  if (typeof window.requestNotificationPermission !== 'function') window.requestNotificationPermission = vdRequestNotificationPermission;
  if (typeof window.subscribeUserToPush !== 'function') window.subscribeUserToPush = vdSubscribeUserToPush;
  if (typeof window.showWindowsNotification !== 'function') window.showWindowsNotification = vdShowWindowsNotification;
})();
