import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Agreement } from '../../../lib/api-client'
import {
  getConsentErrorVisibility,
  normalizeTinLastFour,
} from '../../../../../portal/src/components/agreements/agreement-consent-fields'
import { buildConsentAgreementPayload } from '../agreement-send-wizard'
import { Step1TypePicker } from './step1-type-picker'

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('consent agreement wizard', () => {
  it('renders the CONSENT_7216 type picker option', () => {
    const markup = renderToStaticMarkup(<Step1TypePicker agreements={[]} onSelect={vi.fn()} />)

    expect(markup).toContain('agreements.type.CONSENT_7216')
    expect(markup).toContain('agreements.wizard.typeDescription.CONSENT_7216')
  })

  it('hides service agreement from the staff send type picker', () => {
    const markup = renderToStaticMarkup(<Step1TypePicker agreements={[]} onSelect={vi.fn()} />)

    expect(markup).not.toContain('agreements.type.SERVICE_AGREEMENT')
    expect(markup).not.toContain('agreements.wizard.typeDescription.SERVICE_AGREEMENT')
  })

  it('keeps consent selectable when an active NDA blocks only NDA sends', () => {
    const agreements = [
      {
        type: 'NDA',
        status: 'SENT',
        isActive: true,
        depositStatus: null,
      },
    ] as unknown as Agreement[]

    const markup = renderToStaticMarkup(
      <Step1TypePicker agreements={agreements} onSelect={vi.fn()} />
    )

    expect(markup).toContain('nda.send.disabled.pendingSent')
    expect(markup).toContain('agreements.type.CONSENT_7216')
    expect(markup).toContain('agreements.wizard.typeDescription.CONSENT_7216')
  })

  it('builds consent send payload without content, template, title, or deposit', () => {
    expect(buildConsentAgreementPayload({ expiryDays: 45 })).toEqual({
      type: 'CONSENT_7216',
      depositAmount: null,
      expiryDays: 45,
    })
  })

  it('does not silently truncate a pasted full TIN to a valid last-four value', () => {
    expect(normalizeTinLastFour('123-45-6789')).toBe('123456789')
    expect(normalizeTinLastFour('1234')).toBe('1234')
  })

  it('does not show consent validation errors before fields are touched', () => {
    expect(
      getConsentErrorVisibility(true, {
        taxpayerName: false,
        tinLastFour: false,
      })
    ).toEqual({
      taxpayerName: false,
      tinLastFour: false,
    })
  })
})
