export type ClientMessagePushUrl = `/messages/${string}`
export type LeadMessagePushUrl = `/leads/${string}`

export type SafePushPayload = {
  title: 'Ella'
  body: 'New client message' | 'New lead reply' | 'Test notification'
  url: ClientMessagePushUrl | LeadMessagePushUrl | '/'
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

export function buildLeadMessagePushPayload(leadId: string): SafePushPayload {
  return {
    title: 'Ella',
    body: 'New lead reply',
    url: `/leads/${leadId}`,
    tag: `lead-message:${leadId}`,
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
