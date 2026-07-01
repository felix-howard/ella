import { describe, expect, it } from 'vitest'
import {
  REPLY_TRANSLATION_DEBOUNCE_MS,
  buildReplyTranslationMetadata,
  getReplyTranslationSendBlockReason,
} from './use-reply-translation-preview'

describe('reply translation preview helpers', () => {
  it('uses the planned debounce interval', () => {
    expect(REPLY_TRANSLATION_DEBOUNCE_MS).toBe(600)
  })

  it('builds staff-only English metadata for translated sends', () => {
    expect(buildReplyTranslationMetadata('  Please send your W-2.  ', true)).toEqual({
      sourceContent: 'Please send your W-2.',
      sourceLanguage: 'EN',
      targetLanguage: 'VI',
      edited: true,
    })
  })

  it('allows direct sends and attachment-only translated sends without a preview', () => {
    expect(getReplyTranslationSendBlockReason({
      enabled: false,
      sourceText: 'Hello',
      translatedText: '',
      sourceTextForPreview: '',
      isLoading: false,
      error: null,
    })).toBeNull()

    expect(getReplyTranslationSendBlockReason({
      enabled: true,
      sourceText: '   ',
      translatedText: '',
      sourceTextForPreview: '',
      isLoading: false,
      error: null,
    })).toBeNull()
  })

  it('blocks translated sends while preview is loading, failed, stale, or empty', () => {
    expect(getReplyTranslationSendBlockReason({
      enabled: true,
      sourceText: 'Please send your W-2.',
      translatedText: '',
      sourceTextForPreview: '',
      isLoading: true,
      error: null,
    })).toBe('loading')

    expect(getReplyTranslationSendBlockReason({
      enabled: true,
      sourceText: 'Please send your W-2.',
      translatedText: '',
      sourceTextForPreview: '',
      isLoading: false,
      error: 'messages.translationError',
    })).toBe('error')

    expect(getReplyTranslationSendBlockReason({
      enabled: true,
      sourceText: 'Please send your W-2.',
      translatedText: 'Anh/chi gui W-2 giup em.',
      sourceTextForPreview: 'Please send your 1099.',
      isLoading: false,
      error: null,
    })).toBe('stale')

    expect(getReplyTranslationSendBlockReason({
      enabled: true,
      sourceText: 'Please send your W-2.',
      translatedText: '   ',
      sourceTextForPreview: 'Please send your W-2.',
      isLoading: false,
      error: null,
    })).toBe('empty_preview')
  })

  it('allows translated sends only when preview matches the current English draft', () => {
    expect(getReplyTranslationSendBlockReason({
      enabled: true,
      sourceText: ' Please send your W-2. ',
      translatedText: 'Anh/chi gui W-2 giup em.',
      sourceTextForPreview: 'Please send your W-2.',
      isLoading: false,
      error: null,
    })).toBeNull()
  })
})
