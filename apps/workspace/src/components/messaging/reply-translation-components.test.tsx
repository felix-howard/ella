import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ReplyTranslationModeToggle } from './reply-translation-mode-toggle'
import { ReplyTranslationPreview } from './reply-translation-preview'
import { StaffAuthoredSourcePanel } from './staff-authored-source-panel'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      'messages.regenerateTranslation': 'Regenerate',
      'messages.replyModeDirect': 'Direct',
      'messages.replyModeEnToVi': 'EN -> VI',
      'messages.replyModeLabel': 'Reply mode',
      'messages.replyTranslationPreviewLabel': 'Vietnamese SMS',
      'messages.replyTranslationPreviewPlaceholder': 'Vietnamese preview...',
      'messages.replyTranslationStale': 'Regenerate before sending.',
      'messages.retryTranslation': 'Retry',
      'messages.showEnglishSource': 'Show English',
      'messages.hideEnglishSource': 'Hide English',
      'messages.englishSourceLabel': 'English source',
      'messages.translating': 'Translating...',
      'messages.translationError': 'Translation failed. Try again.',
    }[key] ?? key),
  }),
}))

describe('reply translation composer components', () => {
  it('renders direct and EN to VI mode options', () => {
    const markup = renderToStaticMarkup(
      <ReplyTranslationModeToggle
        replyMode="EN_TO_VI"
        onReplyModeChange={() => undefined}
      />
    )

    expect(markup).toContain('Direct')
    expect(markup).toContain('EN -&gt; VI')
    expect(markup).toContain('aria-pressed="true"')
  })

  it('renders editable Vietnamese preview with stale regenerate affordance', () => {
    const markup = renderToStaticMarkup(
      <ReplyTranslationPreview
        value="Anh/chi gui W-2 giup em."
        isLoading={false}
        isEdited
        isStale
        error={null}
        onChange={() => undefined}
        onRegenerate={() => undefined}
      />
    )

    expect(markup).toContain('Vietnamese SMS')
    expect(markup).toContain('Anh/chi gui W-2 giup em.')
    expect(markup).toContain('Regenerate')
    expect(markup).toContain('Regenerate before sending.')
  })

  it('shows retry when translation fails', () => {
    const markup = renderToStaticMarkup(
      <ReplyTranslationPreview
        value=""
        isLoading={false}
        isEdited={false}
        isStale={false}
        error="messages.translationError"
        onChange={() => undefined}
        onRegenerate={() => undefined}
      />
    )

    expect(markup).toContain('Retry')
    expect(markup).toContain('Translation failed. Try again.')
  })

  it('renders collapsed staff English source toggle without exposing source text', () => {
    const markup = renderToStaticMarkup(
      <StaffAuthoredSourcePanel content="Please send your 2025 W-2." />
    )

    expect(markup).toContain('Show English')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).not.toContain('Please send your 2025 W-2.')
  })

  it('omits staff English source toggle when source text is blank', () => {
    const markup = renderToStaticMarkup(
      <StaffAuthoredSourcePanel content="   " />
    )

    expect(markup).toBe('')
  })
})
