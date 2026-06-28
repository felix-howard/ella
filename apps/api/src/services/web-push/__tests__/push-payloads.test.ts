import { describe, expect, it } from 'vitest'
import {
  buildClientMessagePushPayload,
  buildLeadMessagePushPayload,
  buildTestPushPayload,
} from '../push-payloads'

describe('web push payload builders', () => {
  it('builds privacy-safe lead reply payloads', () => {
    const payload = buildLeadMessagePushPayload('lead_123')

    expect(payload).toMatchObject({
      title: 'Ella',
      body: 'New lead reply',
      url: '/leads/lead_123',
      tag: 'lead-message:lead_123',
    })
    expect(Date.parse(payload.timestamp)).not.toBeNaN()
    expect(JSON.stringify(payload)).not.toContain('phone')
    expect(JSON.stringify(payload)).not.toContain('messageBody')
  })

  it('builds privacy-safe client and test payloads', () => {
    expect(buildClientMessagePushPayload('case_123')).toMatchObject({
      title: 'Ella',
      body: 'New client message',
      url: '/messages/case_123',
      tag: 'case-message:case_123',
    })

    expect(buildTestPushPayload()).toMatchObject({
      title: 'Ella',
      body: 'Test notification',
      url: '/',
      tag: 'test-notification',
    })
  })
})
