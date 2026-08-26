import { describe, expect, it } from 'vitest'
import { getClientDriveSharedToClientFolderName } from '../client-drive-folder-tree'

describe('getClientDriveSharedToClientFolderName', () => {
  it('appends the client name and last 4 SSN digits to the base name', () => {
    expect(getClientDriveSharedToClientFolderName('Chaoyang You', '7863')).toBe(
      'SHARED TO CLIENT - Chaoyang You 7863'
    )
  })

  it('normalizes surrounding and repeated whitespace in the client name', () => {
    expect(getClientDriveSharedToClientFolderName('  Linh   Nguyen ', '1234')).toBe(
      'SHARED TO CLIENT - Linh Nguyen 1234'
    )
  })

  it('omits a missing SSN without leaving a dangling separator', () => {
    expect(getClientDriveSharedToClientFolderName('Chaoyang You', null)).toBe(
      'SHARED TO CLIENT - Chaoyang You'
    )
  })

  it('falls back to the base name when no name or SSN is available', () => {
    expect(getClientDriveSharedToClientFolderName('   ', null)).toBe('SHARED TO CLIENT')
  })
})
