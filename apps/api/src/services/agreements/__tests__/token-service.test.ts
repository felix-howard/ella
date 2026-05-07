/**
 * Unit tests for NDA token generation + expiry math.
 * Pure module — no mocks, no DB.
 */
import { describe, it, expect } from 'vitest'
import {
  generateNdaToken,
  expiryDate,
  isExpired,
  AGREEMENT_EXPIRY_DAYS,
  MIN_EXPIRY_DAYS,
  MAX_EXPIRY_DAYS,
  clampExpiryDays,
} from '../token-service'

const TOKEN_ALPHABET = /^[a-zA-Z0-9]+$/ // no ambiguity chars (0/O, 1/l/I excluded at gen time)

describe('generateNdaToken', () => {
  it('returns a 28-char URL-safe token', () => {
    const token = generateNdaToken()
    expect(token).toHaveLength(28)
    expect(TOKEN_ALPHABET.test(token)).toBe(true)
  })

  it('excludes ambiguous characters (0, O, 1, l, I)', () => {
    // Sample 200 tokens to reduce flake from random collision to ~0
    for (let i = 0; i < 200; i++) {
      const token = generateNdaToken()
      expect(token).not.toMatch(/[0O1lI]/)
    }
  })

  it('produces unique tokens across many calls (collision-resistant)', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) seen.add(generateNdaToken())
    expect(seen.size).toBe(500)
  })
})

describe('expiryDate', () => {
  it('defaults to AGREEMENT_EXPIRY_DAYS (7 days) from now', () => {
    const from = new Date('2026-04-23T00:00:00.000Z')
    const out = expiryDate(undefined, from)
    expect(out.toISOString()).toBe('2026-04-30T00:00:00.000Z')
    expect(AGREEMENT_EXPIRY_DAYS).toBe(7)
  })

  it('accepts custom day count', () => {
    const from = new Date('2026-04-01T12:00:00.000Z')
    const out = expiryDate(3, from)
    expect(out.toISOString()).toBe('2026-04-04T12:00:00.000Z')
  })

  it('returns a new Date (does not mutate input)', () => {
    const from = new Date('2026-04-23T00:00:00.000Z')
    const snapshot = from.toISOString()
    expiryDate(7, from)
    expect(from.toISOString()).toBe(snapshot)
  })

  it('handles month rollover correctly (UTC-safe)', () => {
    const from = new Date('2026-04-28T00:00:00.000Z')
    const out = expiryDate(7, from)
    expect(out.toISOString()).toBe('2026-05-05T00:00:00.000Z')
  })
})

describe('isExpired', () => {
  const now = new Date('2026-04-23T12:00:00.000Z')

  it('returns false for null / undefined (never-expiring)', () => {
    expect(isExpired(null, now)).toBe(false)
    expect(isExpired(undefined, now)).toBe(false)
  })

  it('returns true when expiresAt equals now (boundary — inclusive)', () => {
    expect(isExpired(new Date('2026-04-23T12:00:00.000Z'), now)).toBe(true)
  })

  it('returns true when expiresAt is in the past', () => {
    expect(isExpired(new Date('2026-04-22T00:00:00.000Z'), now)).toBe(true)
  })

  it('returns false when expiresAt is in the future', () => {
    expect(isExpired(new Date('2026-04-24T00:00:00.000Z'), now)).toBe(false)
  })

  it('returns true 1ms past boundary', () => {
    expect(isExpired(new Date('2026-04-23T11:59:59.999Z'), now)).toBe(true)
  })
})

describe('clampExpiryDays', () => {
  it('returns default for null / undefined / NaN', () => {
    expect(clampExpiryDays(null)).toBe(AGREEMENT_EXPIRY_DAYS)
    expect(clampExpiryDays(undefined)).toBe(AGREEMENT_EXPIRY_DAYS)
    expect(clampExpiryDays(Number.NaN)).toBe(AGREEMENT_EXPIRY_DAYS)
  })

  it('floors to MIN when below range', () => {
    expect(clampExpiryDays(0)).toBe(MIN_EXPIRY_DAYS)
    expect(clampExpiryDays(-5)).toBe(MIN_EXPIRY_DAYS)
  })

  it('caps to MAX when above range', () => {
    expect(clampExpiryDays(MAX_EXPIRY_DAYS + 1)).toBe(MAX_EXPIRY_DAYS)
    expect(clampExpiryDays(10_000)).toBe(MAX_EXPIRY_DAYS)
  })

  it('truncates fractional days', () => {
    expect(clampExpiryDays(7.9)).toBe(7)
  })

  it('returns the value unchanged when in range', () => {
    expect(clampExpiryDays(14)).toBe(14)
    expect(clampExpiryDays(30)).toBe(30)
  })
})
