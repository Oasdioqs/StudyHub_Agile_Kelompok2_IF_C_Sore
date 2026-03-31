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
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          client.navigate(url)
          return
        }
      }
      return clients.openWindow(url)
    })
  )
})
