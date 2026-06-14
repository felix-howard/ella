import { describe, expect, it } from 'vitest'
import { isMessageTranslationEligible } from './message-translation-eligibility'

const baseMessage = {
  channel: 'SMS' as const,
  content: 'chị gửi giấy thuế giúp em',
  attachmentUrls: [],
  leadId: null,
}

describe('message translation eligibility', () => {
  it('allows case text messages', () => {
    expect(isMessageTranslationEligible(baseMessage)).toBe(true)
  })

  it('rejects system, call, image-only, lead, optimistic, and failed messages', () => {
    expect(isMessageTranslationEligible({ ...baseMessage, channel: 'SYSTEM' })).toBe(false)
    expect(isMessageTranslationEligible({ ...baseMessage, channel: 'CALL' })).toBe(false)
    expect(isMessageTranslationEligible({
      ...baseMessage,
      content: '   ',
      attachmentUrls: ['/messages/media/msg_1/0'],
    })).toBe(false)
    expect(isMessageTranslationEligible({ ...baseMessage, leadId: 'lead_1' })).toBe(false)
    expect(isMessageTranslationEligible({ ...baseMessage, _optimistic: 'sending' })).toBe(false)
    expect(isMessageTranslationEligible({ ...baseMessage, _optimistic: 'failed' })).toBe(false)
  })
})
