import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadReplyTranslationTestHarness,
} from './message-reply-translation-test-helpers'

describe('message reply translation compose routes', () => {
  let harness: Awaited<ReturnType<typeof loadReplyTranslationTestHarness>>

  beforeEach(async () => {
    harness = await loadReplyTranslationTestHarness()
    harness.setupReplyTranslationMocks()
  })

  it('translates an org-scoped English draft to Vietnamese', async () => {
    const res = await harness.createApp().request('/messages/compose-translation', {
      method: 'POST',
      body: JSON.stringify({
        caseId: 'case_1',
        sourceText: 'Please send your 2025 W-2.',
        sourceLanguage: 'EN',
        targetLanguage: 'VI',
      }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      caseId: 'case_1',
      sourceLanguage: 'EN',
      targetLanguage: 'VI',
      translatedText: 'Em cần anh/chị gửi W-2 năm 2025.',
    })
    expect(harness.prisma.taxCase.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'case_1',
          client: expect.any(Object),
        }),
      })
    )
    expect(harness.translateReplyToVietnamese).toHaveBeenCalledWith('Please send your 2025 W-2.')
  })

  it('does not translate drafts for cases outside org scope', async () => {
    vi.mocked(harness.prisma.taxCase.findFirst).mockResolvedValueOnce(null)

    const res = await harness.createApp().request('/messages/compose-translation', {
      method: 'POST',
      body: JSON.stringify({
        caseId: 'case_other',
        sourceText: 'Please send your W-2.',
        sourceLanguage: 'EN',
        targetLanguage: 'VI',
      }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.status).toBe(404)
    expect(harness.translateReplyToVietnamese).not.toHaveBeenCalled()
  })

  it('does not translate drafts for grouped business cases', async () => {
    vi.mocked(harness.prisma.taxCase.findFirst).mockResolvedValueOnce({
      id: 'case_1',
      client: { clientType: 'BUSINESS', clientGroupId: 'group_1' },
    } as never)

    const res = await harness.createApp().request('/messages/compose-translation', {
      method: 'POST',
      body: JSON.stringify({
        caseId: 'case_1',
        sourceText: 'Please send your W-2.',
        sourceLanguage: 'EN',
        targetLanguage: 'VI',
      }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: 'BUSINESS_CASE' })
    expect(harness.translateReplyToVietnamese).not.toHaveBeenCalled()
  })

  it('returns 503 when reply translation is not configured', async () => {
    vi.mocked(harness.translateReplyToVietnamese).mockResolvedValueOnce({
      success: false,
      error: 'AI_NOT_CONFIGURED',
    })

    const res = await harness.createApp().request('/messages/compose-translation', {
      method: 'POST',
      body: JSON.stringify({
        caseId: 'case_1',
        sourceText: 'Please send your W-2.',
        sourceLanguage: 'EN',
        targetLanguage: 'VI',
      }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.status).toBe(503)
    await expect(res.json()).resolves.toMatchObject({ error: 'AI_NOT_CONFIGURED' })
  })

  it('rate-limits compose translation separately from message translation', async () => {
    const app = harness.createApp()

    for (let i = 0; i < 10; i++) {
      const allowed = await app.request('/messages/compose-translation', {
        method: 'POST',
        body: JSON.stringify({
          caseId: 'case_1',
          sourceText: `Please send document ${i}.`,
          sourceLanguage: 'EN',
          targetLanguage: 'VI',
        }),
        headers: { 'content-type': 'application/json' },
      })
      expect(allowed.status).toBe(200)
    }

    const limited = await app.request('/messages/compose-translation', {
      method: 'POST',
      body: JSON.stringify({
        caseId: 'case_1',
        sourceText: 'Please send one more document.',
        sourceLanguage: 'EN',
        targetLanguage: 'VI',
      }),
      headers: { 'content-type': 'application/json' },
    })

    expect(limited.status).toBe(429)
    await expect(limited.json()).resolves.toMatchObject({ error: 'RATE_LIMIT_EXCEEDED' })
  })

  it('updates reply mode with org-scoped conversation upsert', async () => {
    vi.mocked(harness.prisma.conversation.upsert).mockResolvedValueOnce({
      caseId: 'case_1',
      replyMode: 'EN_TO_VI',
    } as never)

    const res = await harness.createApp().request('/messages/case_1/reply-mode', {
      method: 'PATCH',
      body: JSON.stringify({ replyMode: 'EN_TO_VI' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      caseId: 'case_1',
      replyMode: 'EN_TO_VI',
    })
    expect(harness.prisma.conversation.upsert).toHaveBeenCalledWith({
      where: { caseId: 'case_1' },
      update: { replyMode: 'EN_TO_VI' },
      create: { caseId: 'case_1', replyMode: 'EN_TO_VI' },
      select: { caseId: true, replyMode: true },
    })
  })

  it('does not update reply mode for cases outside org scope', async () => {
    vi.mocked(harness.prisma.taxCase.findFirst).mockResolvedValueOnce(null)

    const res = await harness.createApp().request('/messages/case_other/reply-mode', {
      method: 'PATCH',
      body: JSON.stringify({ replyMode: 'EN_TO_VI' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.status).toBe(404)
    expect(harness.prisma.conversation.upsert).not.toHaveBeenCalled()
  })

  it('does not update reply mode for grouped business cases', async () => {
    vi.mocked(harness.prisma.taxCase.findFirst).mockResolvedValueOnce({
      id: 'case_1',
      client: { clientType: 'BUSINESS', clientGroupId: 'group_1' },
    } as never)

    const res = await harness.createApp().request('/messages/case_1/reply-mode', {
      method: 'PATCH',
      body: JSON.stringify({ replyMode: 'EN_TO_VI' }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: 'BUSINESS_CASE' })
    expect(harness.prisma.conversation.upsert).not.toHaveBeenCalled()
  })
})
