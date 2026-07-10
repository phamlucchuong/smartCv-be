// importScripts must run at top-level during SW installation — Chrome forbids
// calling importScripts() with new scripts after the SW is installed.
importScripts('/firebase/firebase-app-compat.js');
importScripts('/firebase/firebase-messaging-compat.js');

// Config is sent via postMessage from the main thread after the SW activates,
// so env vars don't need to be hardcoded here.
let firebaseApp;

self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG') {
    if (!firebaseApp) {
      firebaseApp = firebase.initializeApp(event.data.config);
      const messaging = firebase.messaging();
      messaging.onBackgroundMessage((payload) => {
        const { title = 'SmartCV', body = '', url } = payload.data ?? {};
        self.registration.showNotification(title, {
          body,
          icon: '/favicon.svg',
          data: { url },
        });
      });
    }
    // Always ACK so activateServiceWorker() doesn't time out on re-init.
    event.source?.postMessage({ type: 'FIREBASE_CONFIG_ACK' });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (url) event.waitUntil(clients.openWindow(url));
});
