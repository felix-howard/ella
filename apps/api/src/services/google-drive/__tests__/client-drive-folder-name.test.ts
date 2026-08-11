import { describe, expect, it } from 'vitest'
import { buildClientDriveFolderName } from '../client-drive-folder-name'

describe('buildClientDriveFolderName', () => {
  it('builds normalized multi-business folder names', () => {
    expect(buildClientDriveFolderName({
      clientName: '  Linh   Nguyen ',
      ssnLast4: '1234',
      state: 'tx',
      businessMode: 'MULTI',
    })).toBe('Linh Nguyen 1234 - TX - Multi')
  })

  it('builds normalized single-business folder names', () => {
    expect(buildClientDriveFolderName({
      clientName: 'Linh Nguyen',
      ssnLast4: '1234',
      state: 'CA',
      businessMode: 'SINGLE_BUSINESS',
      businessName: '  Acme   LLC ',
    })).toBe('Linh Nguyen 1234 - CA - Acme LLC')
  })

  it('rejects invalid naming inputs', () => {
    expect(() => buildClientDriveFolderName({
      clientName: 'Linh Nguyen',
      ssnLast4: '12',
      state: 'CA',
      businessMode: 'MULTI',
    })).toThrow('Invalid Drive folder naming input.')

    expect(() => buildClientDriveFolderName({
      clientName: 'Linh Nguyen',
      ssnLast4: '1234',
      state: 'CA',
      businessMode: 'SINGLE_BUSINESS',
    })).toThrow('Business name is required.')
  })
})
