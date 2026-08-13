import { describe, expect, it } from 'vitest'

import { createClientDriveStructureJob, deleteExpiredIdentityDocsJob } from '../../jobs'
import { registeredInngestFunctions } from '../inngest'

describe('Inngest route registration', () => {
  it('registers the identity document retention deletion cron', () => {
    expect(registeredInngestFunctions).toContain(deleteExpiredIdentityDocsJob)
  })

  it('registers the asynchronous client Drive structure job', () => {
    expect(registeredInngestFunctions).toContain(createClientDriveStructureJob)
  })
})
