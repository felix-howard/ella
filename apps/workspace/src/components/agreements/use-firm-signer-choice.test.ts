import { describe, expect, it } from 'vitest'
import { resolveDefaultFirmSignerId } from './use-firm-signer-choice'

const signers = [
  { id: 'staff-andy', name: 'Andy Nguyen', title: 'Managing Partner' },
  { id: 'staff-tuyet', name: 'Tuyet Duong', title: 'Senior Account Advisor' },
]

describe('resolveDefaultFirmSignerId', () => {
  it('takes the first eligible candidate in priority order', () => {
    expect(
      resolveDefaultFirmSignerId({ signers, candidates: [null, 'staff-tuyet', 'staff-andy'] }),
    ).toBe('staff-tuyet')
  })

  it('skips candidates that are no longer eligible', () => {
    expect(
      resolveDefaultFirmSignerId({ signers, candidates: ['staff-gone', undefined, 'staff-andy'] }),
    ).toBe('staff-andy')
  })

  it('falls back to the first signer, or undefined when none are eligible', () => {
    expect(resolveDefaultFirmSignerId({ signers, candidates: ['staff-gone'] })).toBe('staff-andy')
    expect(resolveDefaultFirmSignerId({ signers: [], candidates: ['staff-andy'] })).toBeUndefined()
  })
})
