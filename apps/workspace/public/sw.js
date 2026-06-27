const DEFAULT_NOTIFICATION = {
  title: 'Ella',
  body: 'New client message',
  icon: '/android-chrome-192x192.png',
  badge: '/android-chrome-192x192.png',
  tag: 'ella-message',
  url: '/',
}

function readPayload(data) {
  if (!data) return {}
  try {
    return JSON.parse(data.text())
  } catch {
    return {}
  }
}

function internalUrl(value) {
  try {
    const url = new URL(String(value || DEFAULT_NOTIFICATION.url), self.location.origin)
    if (url.origin !== self.location.origin) return DEFAULT_NOTIFICATION.url
    if (url.pathname !== '/' && !url.pathname.startsWith('/messages/')) {
      return DEFAULT_NOTIFICATION.url
    }
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return DEFAULT_NOTIFICATION.url
  }
}

self.addEventListener('push', (event) => {
  const payload = readPayload(event.data)
  const body = payload.body === 'Test notification' ? 'Test notification' : DEFAULT_NOTIFICATION.body
  const tag = typeof payload.tag === 'string' ? payload.tag : DEFAULT_NOTIFICATION.tag

  event.waitUntil(
    self.registration.showNotification(DEFAULT_NOTIFICATION.title, {
      body,
      icon: DEFAULT_NOTIFICATION.icon,
      badge: DEFAULT_NOTIFICATION.badge,
      tag,
      data: {
        url: internalUrl(payload.url),
      },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(focusOrOpen(event.notification.data?.url))
})

async function focusOrOpen(urlValue) {
  const targetPath = internalUrl(urlValue)
  const targetUrl = new URL(targetPath, self.location.origin).href
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

  for (const client of windows) {
    if ('navigate' in client) {
      await client.navigate(targetUrl)
    }
    if ('focus' in client) {
      return client.focus()
    }
  }

  if (self.clients.openWindow) {
    return self.clients.openWindow(targetUrl)
  }
}
