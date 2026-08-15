import { renderToStaticMarkup } from 'react-dom/server'
import type * as ReactI18next from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmStep } from './confirm-step'
import {
  DEFAULT_CLIENT_SMS_TEMPLATE_ID,
  DEFAULT_NEW_CLIENT_SMS_LANGUAGE,
  getClientSmsTemplate,
} from './client-sms-templates'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactI18next>()

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => ({
        'confirmStep.templateLabel': 'Message template',
        'confirmStep.templateOfficialChannel': 'Official channel',
        'confirmStep.templateTaxDocuments': 'Tax document checklist',
      }[key] ?? key),
    }),
  }
})

const renderConfirmStep = (language: 'EN' | 'VI') => renderToStaticMarkup(
  <ConfirmStep
    clientName="Alex Client"
    phone="5551234567"
    taxYear={2025}
    language={language}
    onLanguageChange={() => undefined}
    onSubmit={() => undefined}
    isSubmitting={false}
    customMessage={getClientSmsTemplate(DEFAULT_CLIENT_SMS_TEMPLATE_ID, language)}
    onMessageChange={() => undefined}
    selectedTemplateId={DEFAULT_CLIENT_SMS_TEMPLATE_ID}
    onTemplateSelect={() => undefined}
  />
)

describe('New Client SMS template defaults', () => {
  it('defaults New Client messaging to English', () => {
    expect(DEFAULT_NEW_CLIENT_SMS_LANGUAGE).toBe('EN')
  })

  it('shows only the Official channel template in New Client', () => {
    const markup = renderConfirmStep('EN')

    expect(markup).toContain('Official channel')
    expect(markup).not.toContain('Tax document checklist')
    expect(markup).not.toContain('prior year 1040 tax return')
  })

  it('uses the official message for each language', () => {
    const englishMarkup = renderConfirmStep('EN')
    const vietnameseMarkup = renderConfirmStep('VI')

    expect(englishMarkup).toContain('official communication channel')
    expect(vietnameseMarkup).toContain('kênh liên lạc chính thức')
  })
})
