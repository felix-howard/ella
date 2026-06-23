import { describe, expect, it } from 'vitest'
import { ndaReadinessQueryKey } from './use-nda-readiness'

describe('nda readiness query key', () => {
  it('isolates cached readiness by active organization and agreement type', () => {
    expect(ndaReadinessQueryKey('ENGAGEMENT_LETTER', 'org_a')).toEqual([
      'nda-readiness',
      'org_a',
      'ENGAGEMENT_LETTER',
    ])
    expect(ndaReadinessQueryKey('ENGAGEMENT_LETTER', 'org_b')).toEqual([
      'nda-readiness',
      'org_b',
      'ENGAGEMENT_LETTER',
    ])
  })
})
