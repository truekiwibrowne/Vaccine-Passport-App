// Run after `vite build` to inject Firebase config into the FCM service worker
import { writeFileSync } from 'fs'

const config = {
  apiKey:            process.env.VITE_FIREBASE_API_KEY            || '',
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN        || '',
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID         || '',
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET     || '',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID|| '',
  appId:             process.env.VITE_FIREBASE_APP_ID             || '',
}

const content = `// Firebase Messaging Service Worker — auto-generated at build time
importScripts('https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging-compat.js')

firebase.initializeApp(${JSON.stringify(config, null, 2)})
const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body, image } = payload.notification ?? {}
  if (!title) return
  self.registration.showNotification(title, {
    body: body || '',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    image,
    data: payload.data || {},
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(clients.openWindow(url))
})
`

writeFileSync('./dist/firebase-messaging-sw.js', content)
console.log('[build] firebase-messaging-sw.js generated')
