import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadReplyTranslationTestHarness,
  translationForm,
} from './message-reply-translation-test-helpers'

describe('message reply translation send routes', () => {
  let harness: Awaited<ReturnType<typeof loadReplyTranslationTestHarness>>

  beforeEach(async () => {
    harness = await loadReplyTranslationTestHarness()
    harness.setupReplyTranslationMocks()
  })

  it('stores staff-authored English metadata when sending translated JSON SMS', async () => {
    const res = await harness.createApp().request('/messages/send', {
      method: 'POST',
      body: JSON.stringify({
        caseId: 'case_1',
        content: 'Em cần anh/chị gửi W-2 năm 2025.',
        channel: 'SMS',
        translation: {
          sourceContent: 'Please send your 2025 W-2.',
          sourceLanguage: 'EN',
          targetLanguage: 'VI',
          edited: true,
        },
      }),
      headers: { 'content-type': 'application/json' },
    })

    expect(res.status).toBe(201)
    expect(harness.prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: 'Em cần anh/chị gửi W-2 năm 2025.',
          contentLanguage: 'VI',
          staffAuthoredContent: 'Please send your 2025 W-2.',
          staffAuthoredLanguage: 'EN',
          translationEdited: true,
        }),
      })
    )
    expect(harness.sendSmsOnly).toHaveBeenCalledWith(
      '+15551234567',
      'Em cần anh/chị gửi W-2 năm 2025.'
    )

    const activity = vi.mocked(harness.logStaffActivity).mock.calls[0]?.[0] as { metadata: unknown }
    expect(JSON.stringify(activity.metadata)).not.toContain('Please send your 2025 W-2.')
    expect(JSON.stringify(activity.metadata)).not.toContain('Em cần anh/chị gửi W-2 năm 2025.')
  })

  it('stores staff-authored English metadata when sending translated multipart SMS', async () => {
    const res = await harness.createApp().request('/messages/send-with-attachments', {
      method: 'POST',
      body: translationForm(),
    })

    expect(res.status).toBe(201)
    expect(harness.prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: 'Em cần anh/chị gửi W-2 năm 2025.',
          contentLanguage: 'VI',
          staffAuthoredContent: 'Please send your 2025 W-2.',
          staffAuthoredLanguage: 'EN',
          translationEdited: false,
        }),
      })
    )
    expect(harness.sendSmsOnly).toHaveBeenCalledWith(
      '+15551234567',
      'Em cần anh/chị gửi W-2 năm 2025.',
      undefined
    )
  })

  it('rejects partial multipart translation metadata before case lookup', async () => {
    const form = new FormData()
    form.append('caseId', 'case_1')
    form.append('content', 'Em cần anh/chị gửi W-2 năm 2025.')
    form.append('staffAuthoredContent', 'Please send your 2025 W-2.')

    const res = await harness.createApp().request('/messages/send-with-attachments', {
      method: 'POST',
      body: form,
    })

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      error: 'VALIDATION_ERROR',
      message: 'All translation metadata fields are required',
    })
    expect(harness.prisma.taxCase.findFirst).not.toHaveBeenCalled()
  })
})
