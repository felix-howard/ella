import { beforeEach, describe, expect, it, vi } from 'vitest'
import { translateReplyToVietnamese } from '../reply-translator'
import { generateContent } from '../gemini-client'

vi.mock('../gemini-client', () => ({
  generateContent: vi.fn(),
  isGeminiConfigured: true,
}))

const mockGenerateContent = vi.mocked(generateContent)

describe('reply translator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('translates an English staff draft to Vietnamese with Gemini', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      success: true,
      data: '"Em cần anh/chị gửi W-2 năm 2025."',
    })

    const result = await translateReplyToVietnamese('Please send your 2025 W-2.')

    expect(result).toEqual({
      success: true,
      sourceLanguage: 'EN',
      targetLanguage: 'VI',
      translatedText: 'Em cần anh/chị gửi W-2 năm 2025.',
    })
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.stringContaining('Please send your 2025 W-2.')
    )
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.stringContaining('The staff member speaks as "em".')
    )
  })

  it('rejects empty drafts before calling Gemini', async () => {
    await expect(translateReplyToVietnamese('   ')).resolves.toEqual({
      success: false,
      error: 'EMPTY_MESSAGE',
    })
    expect(mockGenerateContent).not.toHaveBeenCalled()
  })

  it('rejects drafts above the send limit before calling Gemini', async () => {
    await expect(translateReplyToVietnamese('a'.repeat(1001))).resolves.toEqual({
      success: false,
      error: 'MESSAGE_TOO_LONG',
    })
    expect(mockGenerateContent).not.toHaveBeenCalled()
  })

  it('returns translation failure for empty Gemini output', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      success: true,
      data: '   ',
    })

    await expect(translateReplyToVietnamese('Please send your tax documents.')).resolves.toEqual({
      success: false,
      error: 'TRANSLATION_FAILED',
    })
  })
})
