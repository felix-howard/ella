const WORKSPACE_SERVICE_WORKER_URL = '/sw.js'

export async function registerWorkspaceServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  try {
    return await navigator.serviceWorker.register(WORKSPACE_SERVICE_WORKER_URL)
  } catch {
    return null
  }
}
