// Minapp service worker: gjør at appen åpner uten nett.
// - Sider (navigasjon): nett først, ellers siste lagrede versjon.
// - Byggfiler (/assets/*, har innholdshash i navnet): cache først – de endres aldri.
// - Øvrige egne filer og skrifter: vis lagret versjon, oppdater i bakgrunnen.
// Supabase-kall går rett til nettet; dataene lagres uansett lokalt av appen.

const CACHE = 'minapp-v2'
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/apple-touch-icon.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function networkFirst(request) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put('/', response.clone())
    return response
  } catch {
    return (await cache.match('/')) ?? Response.error()
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) (await caches.open(CACHE)).put(request, response.clone())
  return response
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)
  const fresh = fetch(request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone())
      return response
    })
    .catch(() => cached)
  return cached ?? fresh
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
  } else if (url.origin === location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request))
  } else if (url.origin === location.origin || url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request))
  }
})

// Påminnelser: vis varselet som serveren sender.
self.addEventListener('push', (event) => {
  let data = { title: 'Minapp', body: '', url: '/' }
  try {
    data = { ...data, ...event.data.json() }
  } catch {
    // Ugyldig innhold – vis standardvarsel.
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url },
    }),
  )
})

// Trykk på varselet: åpne appen (eller bruk et åpent vindu) på riktig oppgave.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url ?? '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => w.url.startsWith(self.location.origin))
      if (win) return win.navigate(url).then((w) => (w ?? win).focus())
      return self.clients.openWindow(url)
    }),
  )
})
