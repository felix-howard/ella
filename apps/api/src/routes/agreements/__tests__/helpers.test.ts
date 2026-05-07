/**
 * Unit tests for NDA route helpers: IP + UA extraction, deposit-transition
 * whitelist, and the signature-PNG decoder with anti-spoof checks.
 */
import { describe, it, expect } from 'vitest'
import { HTTPException } from 'hono/http-exception'
import type { Context } from 'hono'
import {
  extractIp,
  extractUserAgent,
  assertDepositTransition,
  decodeSignaturePng,
  type DepositStatus,
} from '../helpers'

// Minimal Context shim — we only need c.req.header(name)
function fakeContext(headers: Record<string, string | undefined>): Context {
  return {
    req: {
      header: (name: string) => headers[name.toLowerCase()],
    },
  } as unknown as Context
}

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function makePngDataUrl(payload: Buffer): string {
  return `data:image/png;base64,${payload.toString('base64')}`
}

describe('extractIp', () => {
  it('prefers cf-connecting-ip when present', () => {
    const c = fakeContext({
      'cf-connecting-ip': '203.0.113.1',
      'x-forwarded-for': '198.51.100.1, 10.0.0.1',
      'x-real-ip': '10.0.0.2',
    })
    expect(extractIp(c)).toBe('203.0.113.1')
  })

  it('falls back to first x-forwarded-for entry (trimmed)', () => {
    const c = fakeContext({
      'x-forwarded-for': '  198.51.100.77  ,  10.0.0.1  ',
    })
    expect(extractIp(c)).toBe('198.51.100.77')
  })

  it('falls back to x-real-ip when others absent', () => {
    expect(extractIp(fakeContext({ 'x-real-ip': '192.0.2.5' }))).toBe('192.0.2.5')
  })

  it('returns "unknown" when no headers present', () => {
    expect(extractIp(fakeContext({}))).toBe('unknown')
  })

  it('returns "unknown" when cf header is empty string (falsy)', () => {
    const c = fakeContext({ 'cf-connecting-ip': '', 'x-real-ip': '192.0.2.9' })
    expect(extractIp(c)).toBe('192.0.2.9')
  })
})

describe('extractUserAgent', () => {
  it('returns trimmed UA string', () => {
    expect(extractUserAgent(fakeContext({ 'user-agent': '  Mozilla/5.0  ' }))).toBe('Mozilla/5.0')
  })

  it('returns "unknown" for missing header', () => {
    expect(extractUserAgent(fakeContext({}))).toBe('unknown')
  })

  it('returns "unknown" for empty header', () => {
    expect(extractUserAgent(fakeContext({ 'user-agent': '   ' }))).toBe('unknown')
  })
})

describe('assertDepositTransition', () => {
  // Allowed transitions per implementation:
  //  PENDING -> PENDING | PAID | FORFEITED
  //  PAID -> PAID | REFUNDED
  //  REFUNDED -> REFUNDED
  //  FORFEITED -> FORFEITED
  it.each([
    ['PENDING', 'PENDING'],
    ['PENDING', 'PAID'],
    ['PENDING', 'FORFEITED'],
    ['PAID', 'PAID'],
    ['PAID', 'REFUNDED'],
    ['REFUNDED', 'REFUNDED'],
    ['FORFEITED', 'FORFEITED'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(() => assertDepositTransition(from as DepositStatus, to as DepositStatus)).not.toThrow()
  })

  it.each([
    ['PENDING', 'REFUNDED'],
    ['PAID', 'PENDING'],
    ['PAID', 'FORFEITED'],
    ['REFUNDED', 'PENDING'],
    ['REFUNDED', 'PAID'],
    ['FORFEITED', 'PENDING'],
    ['FORFEITED', 'PAID'],
    ['FORFEITED', 'REFUNDED'],
  ] as const)('blocks %s -> %s with 409', (from, to) => {
    const call = () => assertDepositTransition(from as DepositStatus, to as DepositStatus)
    expect(call).toThrow(HTTPException)
    expect(call).toThrow(new RegExp(`from ${from} to ${to}`))
    try {
      call()
    } catch (err) {
      expect((err as HTTPException).status).toBe(409)
    }
  })
})

describe('decodeSignaturePng', () => {
  function expectHttpStatus(fn: () => unknown, status: number, messagePattern?: RegExp): void {
    expect(fn).toThrow(HTTPException)
    try {
      fn()
    } catch (err) {
      expect((err as HTTPException).status).toBe(status)
      if (messagePattern) expect((err as HTTPException).message).toMatch(messagePattern)
    }
  }

  it('decodes a valid PNG data URL', () => {
    const payload = Buffer.concat([PNG_HEADER, Buffer.from('signature-bytes')])
    const result = decodeSignaturePng(makePngDataUrl(payload))
    expect(result.buffer).toBeInstanceOf(Buffer)
    expect(result.byteLength).toBe(payload.length)
    expect(Buffer.compare(result.buffer.subarray(0, 8), PNG_HEADER)).toBe(0)
  })

  it('rejects non-PNG data URLs (400)', () => {
    expectHttpStatus(() => decodeSignaturePng('data:image/jpeg;base64,AAAA'), 400)
  })

  it('rejects empty payload (400)', () => {
    expectHttpStatus(() => decodeSignaturePng('data:image/png;base64,'), 400)
  })

  it('rejects payload > 500KB (413)', () => {
    const big = Buffer.concat([PNG_HEADER, Buffer.alloc(500_001)])
    expectHttpStatus(() => decodeSignaturePng(makePngDataUrl(big)), 413)
  })

  it('rejects payload without PNG magic bytes (anti-spoof, 400)', () => {
    const fake = Buffer.from('NOT-A-PNG-HEADER-just-base64-padding-only')
    expectHttpStatus(() => decodeSignaturePng(makePngDataUrl(fake)), 400, /valid PNG/i)
  })

  it('rejects payload shorter than the 8-byte magic prefix', () => {
    const tooShort = Buffer.from([0x89, 0x50, 0x4e])
    expectHttpStatus(() => decodeSignaturePng(makePngDataUrl(tooShort)), 400)
  })
})
