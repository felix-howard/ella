import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { UploadLinkMessageSettings } from '../upload-link-message-settings'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      'settings.messageLanguageEnglishUs': 'English US',
      'settings.messageLanguageVietnamese': 'Vietnamese',
      'settings.sendUploadLinkAfterIntake': 'Send upload link',
      'settings.sendUploadLinkAfterIntakeDescription': 'Text a secure document upload link after intake.',
      'settings.uploadLinkMessage': 'Upload link message',
      'settings.uploadLinkMessageDisabled': 'Upload-link SMS is off.',
      'settings.uploadLinkMessageLanguage': 'Message language',
    }[key] ?? key),
  }),
}))

vi.mock('../../clients/client-sms-template-selector', () => ({
  ClientSmsTemplateSelector: ({ labelKey }: { labelKey: string }) => <div>{labelKey}</div>,
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
})
