// Firebase Cloud Messaging Service Worker
// File ini harus ada di /public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "AIzaSyCNBD6ujsem9MB6As7--wFeRNjAcWTz1sY",
  authDomain: "studyhub-8e93e.firebaseapp.com",
  projectId: "studyhub-8e93e",
  storageBucket: "studyhub-8e93e.firebasestorage.app",
  messagingSenderId: "108950489599",
  appId: "1:108950489599:web:d7ee5cf24a2de199973fca",
})

const messaging = firebase.messaging()

// Handle background messages (saat app tidak di foreground)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message:', payload)

  const notificationTitle = payload.notification?.title || 'StudyHub'
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: { url: payload.fcmOptions?.link || payload.data?.url || '/' },
    vibrate: [200, 100, 200],
    tag: payload.data?.tag || 'studyhub-notif',
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const rawUrl = event.notification.data?.url || '/'
  // Resolve relative URL ke absolute
  const fullUrl = rawUrl.startsWith('http') ? rawUrl : (self.location.origin + rawUrl)
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Coba focus window yang sudah ada
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then((c) => {
            if (c && 'navigate' in c) c.navigate(fullUrl)
            return c
          })
        }
      }
      // Buka window baru jika tidak ada
      return clients.openWindow(fullUrl)
    })
  )
})
