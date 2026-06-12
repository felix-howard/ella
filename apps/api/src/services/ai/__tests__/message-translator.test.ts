import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanTranslatedText,
  translateMessageToEnglish,
} from '../message-translator'
import { generateContent } from '../gemini-client'

vi.mock('../gemini-client', () => ({
  generateContent: vi.fn(),
  isGeminiConfigured: true,
}))

const mockGenerateContent = vi.mocked(generateContent)

describe('message translator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('strips enclosing quotes from Gemini output', () => {
    expect(cleanTranslatedText('"Please send the tax documents."')).toBe(
      'Please send the tax documents.'
    )
    expect(cleanTranslatedText('“Please send the tax documents.”')).toBe(
      'Please send the tax documents.'
    )
  })

  it('translates message text with Gemini', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      success: true,
      data: '"Please send your tax documents."',
    })

    const result = await translateMessageToEnglish('chị gửi giấy thuế giúp em')

    expect(result).toEqual({
      success: true,
      sourceLanguage: 'unknown',
      targetLanguage: 'EN',
      translatedText: 'Please send your tax documents.',
    })
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.stringContaining('chị gửi giấy thuế giúp em')
    )
  })

  it('rejects empty messages before calling Gemini', async () => {
    await expect(translateMessageToEnglish('   ')).resolves.toEqual({
      success: false,
      error: 'EMPTY_MESSAGE',
    })
    expect(mockGenerateContent).not.toHaveBeenCalled()
  })

  it('returns translation failure for empty Gemini output', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      success: true,
      data: '   ',
    })

    await expect(translateMessageToEnglish('xin chào chị')).resolves.toEqual({
      success: false,
      error: 'TRANSLATION_FAILED',
    })
  })
})
