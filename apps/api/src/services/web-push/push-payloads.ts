export type ClientMessagePushUrl = `/messages/${string}`

export type SafePushPayload = {
  title: 'Ella'
  body: 'New client message' | 'Test notification'
  url: ClientMessagePushUrl | '/'
  tag?: string
  timestamp: string
}

export function buildClientMessagePushPayload(caseId: string): SafePushPayload {
  return {
    title: 'Ella',
    body: 'New client message',
    url: `/messages/${caseId}`,
    tag: `case-message:${caseId}`,
    timestamp: new Date().toISOString(),
  }
}

export function buildTestPushPayload(): SafePushPayload {
  return {
    title: 'Ella',
    body: 'Test notification',
    url: '/',
    tag: 'test-notification',
    timestamp: new Date().toISOString(),
  }
}
