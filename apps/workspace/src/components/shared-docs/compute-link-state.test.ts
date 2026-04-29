import { describe, it, expect } from 'vitest'
import { computeLinkState, NEAR_EXPIRY_THRESHOLD_DAYS } from './compute-link-state'

const NOW = new Date('2026-04-22T12:00:00.000Z')

function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000)
}

describe('computeLinkState', () => {
  it('returns state="none" when linkExists=false', () => {
    const result = computeLinkState({ linkExists: false, now: NOW })
    expect(result.state).toBe('none')
    expect(result.daysUntilExpiry).toBeNull()
    expect(result.isNearExpiry).toBe(false)
  })

  it('returns state="none" even when isActive=true and linkExists=false', () => {
    const result = computeLinkState({
      linkExists: false,
      isActive: true,
      expiresAt: daysFromNow(7),
      now: NOW,
    })
    expect(result.state).toBe('none')
  })

  it('returns state="paused" when linkExists and isActive=false', () => {
    const result = computeLinkState({
      linkExists: true,
      isActive: false,
      expiresAt: daysFromNow(7),
      now: NOW,
    })
    expect(result.state).toBe('paused')
    expect(result.daysUntilExpiry).toBeNull()
    expect(result.isNearExpiry).toBe(false)
  })

  it('returns state="expired" when active but expiresAt is in the past', () => {
    const result = computeLinkState({
      linkExists: true,
      isActive: true,
      expiresAt: daysFromNow(-1),
      now: NOW,
    })
    expect(result.state).toBe('expired')
    expect(result.daysUntilExpiry).toBeNull()
    expect(result.isNearExpiry).toBe(false)
  })

  it('returns state="expired" at exact boundary (expiresAt === now)', () => {
    const result = computeLinkState({
      linkExists: true,
      isActive: true,
      expiresAt: NOW,
      now: NOW,
    })
    expect(result.state).toBe('expired')
  })

  it('returns state="active" when active and expiresAt is in the future', () => {
    const result = computeLinkState({
      linkExists: true,
      isActive: true,
      expiresAt: daysFromNow(7),
      now: NOW,
    })
    expect(result.state).toBe('active')
    expect(result.daysUntilExpiry).toBe(7)
    expect(result.isNearExpiry).toBe(false)
  })

  it('returns state="active" with isNearExpiry=false when expiresAt is null (never)', () => {
    const result = computeLinkState({
      linkExists: true,
      isActive: true,
      expiresAt: null,
      now: NOW,
    })
    expect(result.state).toBe('active')
    expect(result.daysUntilExpiry).toBeNull()
    expect(result.isNearExpiry).toBe(false)
  })

  it('returns isNearExpiry=true when expiresAt is 2 days away', () => {
    const result = computeLinkState({
      linkExists: true,
      isActive: true,
      expiresAt: daysFromNow(2),
      now: NOW,
    })
    expect(result.state).toBe('active')
    expect(result.daysUntilExpiry).toBe(2)
    expect(result.isNearExpiry).toBe(true)
  })

  it('returns isNearExpiry=false when expiresAt is 4 days away', () => {
    const result = computeLinkState({
      linkExists: true,
      isActive: true,
      expiresAt: daysFromNow(4),
      now: NOW,
    })
    expect(result.state).toBe('active')
    expect(result.daysUntilExpiry).toBe(4)
    expect(result.isNearExpiry).toBe(false)
  })

  it('returns isNearExpiry=true for small positive delta (1 day away)', () => {
    const result = computeLinkState({
      linkExists: true,
      isActive: true,
      expiresAt: daysFromNow(1),
      now: NOW,
    })
    expect(result.state).toBe('active')
    expect(result.daysUntilExpiry).toBe(1)
    expect(result.isNearExpiry).toBe(true)
  })

  it('returns isNearExpiry=true at exact threshold boundary (3 days)', () => {
    const result = computeLinkState({
      linkExists: true,
      isActive: true,
      expiresAt: daysFromNow(NEAR_EXPIRY_THRESHOLD_DAYS),
      now: NOW,
    })
    expect(result.state).toBe('active')
    expect(result.daysUntilExpiry).toBe(NEAR_EXPIRY_THRESHOLD_DAYS)
    expect(result.isNearExpiry).toBe(true)
  })

  it('accepts expiresAt as a string (ISO) and parses correctly', () => {
    const originalDate = daysFromNow(7)
    const iso = originalDate.toISOString()
    const result = computeLinkState({
      linkExists: true,
      isActive: true,
      expiresAt: iso,
      now: NOW,
    })
    expect(result.state).toBe('active')
    expect(result.daysUntilExpiry).toBe(7)
    expect(result.expiresAt).toBeInstanceOf(Date)
    expect(result.expiresAt?.getTime()).toBe(originalDate.getTime())
  })

  it('treats invalid expiresAt string as null (never expires)', () => {
    const result = computeLinkState({
      linkExists: true,
      isActive: true,
      expiresAt: 'not-a-date',
      now: NOW,
    })
    expect(result.state).toBe('active')
    expect(result.expiresAt).toBeNull()
  })
})
