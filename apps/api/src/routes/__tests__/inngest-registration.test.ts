import { describe, expect, it } from 'vitest'

import { deleteExpiredIdentityDocsJob } from '../../jobs'
import { registeredInngestFunctions } from '../inngest'

describe('Inngest route registration', () => {
  it('registers the identity document retention deletion cron', () => {
    expect(registeredInngestFunctions).toContain(deleteExpiredIdentityDocsJob)
  })
})
