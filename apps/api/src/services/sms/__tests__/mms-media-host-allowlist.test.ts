/**
 * Tests for the Twilio media host allow-list (ELLA-SEC-004).
 * Only https Twilio-owned hosts may receive the Twilio Basic-Auth credentials;
 * everything else is rejected before any fetch happens (SSRF + credential-leak guard).
 */
import { describe, it, expect } from 'vitest'
import { isAllowedTwilioMediaUrl } from '../mms-media-handler'

describe('isAllowedTwilioMediaUrl', () => {
  it('allows genuine Twilio media hosts over https', () => {
    expect(isAllowedTwilioMediaUrl('https://api.twilio.com/2010-04-01/Accounts/AC1/Messages/MM1/Media/ME1')).toBe(true)
    expect(isAllowedTwilioMediaUrl('https://media.twiliocdn.com/abc')).toBe(true)
    expect(isAllowedTwilioMediaUrl('https://mcs.us1.twilio.com/Media/xyz')).toBe(true)
  })

  it('rejects non-Twilio hosts (SSRF / credential exfil)', () => {
    expect(isAllowedTwilioMediaUrl('https://attacker.example/collect')).toBe(false)
    expect(isAllowedTwilioMediaUrl('http://169.254.169.254/latest/meta-data/')).toBe(false)
    expect(isAllowedTwilioMediaUrl('https://localhost:3002/internal')).toBe(false)
  })

  it('rejects look-alike hosts that merely contain the Twilio domain', () => {
    expect(isAllowedTwilioMediaUrl('https://api.twilio.com.evil.com/x')).toBe(false)
    expect(isAllowedTwilioMediaUrl('https://eviltwilio.com/x')).toBe(false)
    expect(isAllowedTwilioMediaUrl('https://twilio.com.attacker.net/x')).toBe(false)
  })

  it('rejects non-https schemes even on a Twilio host', () => {
    expect(isAllowedTwilioMediaUrl('http://api.twilio.com/x')).toBe(false)
  })

  it('rejects malformed URLs', () => {
    expect(isAllowedTwilioMediaUrl('not-a-url')).toBe(false)
    expect(isAllowedTwilioMediaUrl('')).toBe(false)
  })
})
