import { describe, expect, it } from 'vitest'
import { getIdentityRetentionState, isRetentionStorageDeleted } from './identity-retention'

describe('identity retention helpers', () => {
  it('returns amber warning when delete date is within 14 days', () => {
    const state = getIdentityRetentionState(
      { retentionDeleteAt: '2026-05-28T00:00:00.000Z', retentionDeletedAt: null, isStorageDeleted: false },
      new Date('2026-05-18T00:00:00.000Z')
    )

    expect(state).toEqual({
      kind: 'active',
      deleteAt: new Date('2026-05-28T00:00:00.000Z'),
      daysRemaining: 10,
      tone: 'amber',
    })
  })

  it('returns red warning when delete date is within 3 days', () => {
    const state = getIdentityRetentionState(
      { retentionDeleteAt: '2026-05-20T00:00:00.000Z', retentionDeletedAt: null, isStorageDeleted: false },
      new Date('2026-05-18T00:00:00.000Z')
    )

    expect(state).toMatchObject({ kind: 'active', daysRemaining: 2, tone: 'red' })
  })

  it('treats retained metadata with deleted storage as deleted', () => {
    const image = {
      retentionDeleteAt: '2026-05-01T00:00:00.000Z',
      retentionDeletedAt: '2026-05-02T00:00:00.000Z',
      isStorageDeleted: true,
    }

    expect(isRetentionStorageDeleted(image)).toBe(true)
    expect(getIdentityRetentionState(image)).toMatchObject({
      kind: 'deleted',
      deletedAt: new Date('2026-05-02T00:00:00.000Z'),
    })
  })

  it('treats storageDeletedAt-only records as deleted', () => {
    const image = {
      retentionDeleteAt: null,
      retentionDeletedAt: null,
      storageDeletedAt: '2026-05-03T00:00:00.000Z',
      isStorageDeleted: false,
    }

    expect(isRetentionStorageDeleted(image)).toBe(true)
    expect(getIdentityRetentionState(image)).toMatchObject({
      kind: 'deleted',
      deletedAt: new Date('2026-05-03T00:00:00.000Z'),
    })
  })
})
