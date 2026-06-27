const allowedWebPushHosts = new Set([
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'web.push.apple.com',
])
const allowedWebPushHostSuffixes = ['.notify.windows.com']

export function isAllowedWebPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint)
    const hostname = url.hostname.toLowerCase()
    return (
      url.protocol === 'https:' &&
      (allowedWebPushHosts.has(hostname) ||
        allowedWebPushHostSuffixes.some((suffix) => hostname.endsWith(suffix)))
    )
  } catch {
    return false
  }
}
