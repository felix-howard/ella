import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { UploadLinkMessageSettings } from '../upload-link-message-settings'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) => {
      if (key === 'settings.useDefaultUploadMessage') return `Backend default: ${options?.template}`
      return ({
        'confirmStep.templateOfficialChannel': 'Official channel',
        'confirmStep.templateTaxDocuments': 'Tax document checklist',
        'settings.messageLanguageEnglishUs': 'English US',
        'settings.messageLanguageVietnamese': 'Vietnamese',
        'settings.sendUploadLinkAfterIntake': 'Send upload link',
        'settings.sendUploadLinkAfterIntakeDescription': 'Text a secure document upload link after intake.',
        'settings.uploadLinkMessage': 'Upload link message',
        'settings.uploadLinkMessageDisabled': 'Upload-link SMS is off.',
        'settings.uploadLinkMessageLanguage': 'Message language',
        'settings.useDefaultUploadMessageDescription': 'Used when no template is saved. Current backend default message:',
      }[key] ?? key)
    },
  }),
}))

describe('UploadLinkMessageSettings', () => {
  it('renders explicit language choices without auto language', () => {
    const markup = renderToStaticMarkup(
      <UploadLinkMessageSettings
        autoSend
        language="EN"
        templateId={null}
        name="upload-link-message-test"
        onAutoSendChange={() => undefined}
        onLanguageChange={() => undefined}
        onTemplateChange={() => undefined}
      />
    )

    expect(markup).toContain('English US')
    expect(markup).toContain('Vietnamese')
    expect(markup).not.toContain('Auto')
  })

  it('shows the current backend default upload-link message instead of a vague default option', () => {
    const markup = renderToStaticMarkup(
      <UploadLinkMessageSettings
        autoSend
        language="EN"
        templateId={null}
        name="upload-link-message-test"
        allowDefaultTemplate
        onAutoSendChange={() => undefined}
        onLanguageChange={() => undefined}
        onTemplateChange={() => undefined}
      />
    )

    expect(markup).toContain('Backend default: Official channel')
    expect(markup).toContain('official communication channel')
    expect(markup).not.toContain('Default message')
  })
})
