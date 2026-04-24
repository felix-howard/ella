/**
 * ChatContext discriminator tests.
 *
 * `chatContextId` is the pure helper that drives polymorphic routing in
 * useChatMessages, useChatUnread, and useSendChatMessage. Testing it here
 * pins the discriminator contract without requiring jsdom + testing-library
 * for full hook render tests (YAGNI — workspace vitest env is node-only).
 */
import { describe, it, expect } from 'vitest'
import { chatContextId, type ChatContext } from './chat-context'

describe('chatContextId', () => {
  it('returns caseId when context.type === "case"', () => {
    const ctx: ChatContext = { type: 'case', caseId: 'case_abc', clientId: 'client_xyz' }
    expect(chatContextId(ctx)).toBe('case_abc')
  })

  it('returns leadId when context.type === "lead"', () => {
    const ctx: ChatContext = { type: 'lead', leadId: 'lead_123' }
    expect(chatContextId(ctx)).toBe('lead_123')
  })

  it('distinguishes same-id case vs lead contexts (polymorphic key safety)', () => {
    // Same scalar id but different context types MUST yield the same scalar,
    // so downstream query keys (['messages', context.type, id]) differentiate
    // via the `type` axis — not via id alone.
    const sameId = 'xyz'
    const caseCtx: ChatContext = { type: 'case', caseId: sameId, clientId: 'c1' }
    const leadCtx: ChatContext = { type: 'lead', leadId: sameId }
    expect(chatContextId(caseCtx)).toBe(sameId)
    expect(chatContextId(leadCtx)).toBe(sameId)
  })
})
