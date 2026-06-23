import { describe, expect, it } from 'vitest'
import { recipientSearchQueryKey } from '../use-recipient-search'

describe('recipient search query key', () => {
  it('isolates cached recipient metadata by active organization', () => {
    expect(recipientSearchQueryKey('org_a', 'nguyen')).toEqual([
      'recipient-search',
      'org_a',
      'nguyen',
    ])
    expect(recipientSearchQueryKey('org_b', 'nguyen')).toEqual([
      'recipient-search',
      'org_b',
      'nguyen',
    ])
  })
})
