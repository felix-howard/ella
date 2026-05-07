/**
 * Unit tests for the generic agreement invite SMS template.
 * Verifies EN + VI substitution, language fallback, URL preservation, and
 * type-agnostic title interpolation across NDA / Engagement Letter / Custom.
 */
import { describe, it, expect } from 'vitest'
import {
  generateAgreementInviteMessage,
  AGREEMENT_INVITE_TEMPLATE_NAME,
  type AgreementInviteTemplateParams,
} from '../agreement-invite'

function buildParams(
  overrides: Partial<AgreementInviteTemplateParams> = {},
): AgreementInviteTemplateParams {
  return {
    firstName: 'Jane',
    title: 'Non-Disclosure Agreement',
    orgName: 'Acme Tax LLC',
    url: 'https://portal.ellatax.com/agreements/abc123',
    language: 'EN',
    ...overrides,
  }
}

describe('generateAgreementInviteMessage', () => {
  describe('English (EN)', () => {
    it('includes firstName, title, orgName, url', () => {
      const msg = generateAgreementInviteMessage(buildParams({ firstName: 'Alice' }))
      expect(msg).toContain('Hi Alice')
      expect(msg).toContain('Non-Disclosure Agreement')
      expect(msg).toContain('Acme Tax LLC')
      expect(msg).toContain('https://portal.ellatax.com/agreements/abc123')
      expect(msg).not.toContain('Valid for 7 days')
      expect(msg).not.toContain('Reply HELP')
    })

    it('interpolates Engagement Letter title verbatim', () => {
      const msg = generateAgreementInviteMessage(
        buildParams({ title: 'Engagement Letter 2025' }),
      )
      expect(msg).toContain('sign the Engagement Letter 2025')
      expect(msg).toContain('from Acme Tax LLC')
    })

    it('interpolates an arbitrary CUSTOM title verbatim', () => {
      const msg = generateAgreementInviteMessage(
        buildParams({ title: 'Mutual Non-Compete Addendum' }),
      )
      expect(msg).toContain('sign the Mutual Non-Compete Addendum')
    })
  })

  describe('Vietnamese (VI)', () => {
    it('includes Vietnamese greeting + title + orgName + url', () => {
      const msg = generateAgreementInviteMessage(
        buildParams({
          firstName: 'Nguyễn',
          language: 'VI',
          title: 'Thỏa thuận Bảo mật',
          orgName: 'Ella Tax',
          url: 'https://x.test/agreements/tok',
        }),
      )
      expect(msg).toContain('Chào Nguyễn')
      expect(msg).toContain('Thỏa thuận Bảo mật')
      expect(msg).toContain('Ella Tax')
      expect(msg).toContain('https://x.test/agreements/tok')
      expect(msg).not.toContain('hiệu lực 7 ngày')
      expect(msg).not.toContain('Soạn HELP')
    })

    it('preserves diacritics in name', () => {
      const msg = generateAgreementInviteMessage(
        buildParams({ firstName: 'Phạm Hồng', language: 'VI' }),
      )
      expect(msg).toContain('Phạm Hồng')
    })
  })

  describe('Language fallback', () => {
    it('falls back to EN for an unknown language code', () => {
      const msg = generateAgreementInviteMessage({
        ...buildParams(),
        language: 'FR' as unknown as AgreementInviteTemplateParams['language'],
      })
      expect(msg.startsWith('Hi Jane')).toBe(true)
    })
  })

  describe('Formatting / constraints', () => {
    it('preserves full URL without truncation', () => {
      const longUrl = 'https://portal.ellatax.com/agreements/' + 'x'.repeat(50)
      const msg = generateAgreementInviteMessage(buildParams({ url: longUrl }))
      expect(msg).toContain(longUrl)
    })

    it('produces distinct outputs per language', () => {
      const en = generateAgreementInviteMessage(buildParams({ language: 'EN' }))
      const vi = generateAgreementInviteMessage(buildParams({ language: 'VI' }))
      expect(en).not.toEqual(vi)
    })

    it('typical NDA EN message fits in a single GSM-7 segment (160 chars)', () => {
      const msg = generateAgreementInviteMessage(
        buildParams({
          firstName: 'Jane',
          title: 'NDA',
          orgName: 'Ella',
          url: 'https://portal.ellatax.com/a/abcdefgh',
        }),
      )
      expect(msg.length).toBeLessThanOrEqual(160)
    })
  })

  it('exports stable template name constant', () => {
    expect(AGREEMENT_INVITE_TEMPLATE_NAME).toBe('agreement_invite')
  })
})
