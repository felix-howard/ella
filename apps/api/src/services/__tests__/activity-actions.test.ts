import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_CATEGORIES,
  ACTIVITY_TARGET_TYPES,
  categoryForAction,
  normalizeActivityAction,
} from '../activity-actions'

describe('Activity Actions', () => {
  it('normalizes legacy document actions to canonical action names', () => {
    expect(normalizeActivityAction('DOCUMENT_SIGNED_URL_CREATED')).toBe(
      ACTIVITY_ACTIONS.DOCUMENT.SIGNED_URL_CREATED
    )
    expect(normalizeActivityAction('IDENTITY_DOCUMENT_RETENTION_DELETED')).toBe(
      ACTIVITY_ACTIONS.DOCUMENT.RETENTION_DELETED
    )
  })

  it('resolves categories from canonical and legacy actions', () => {
    expect(categoryForAction(ACTIVITY_ACTIONS.MESSAGE.SENT)).toBe(ACTIVITY_CATEGORIES.MESSAGE)
    expect(categoryForAction('upload_link.generated')).toBe(ACTIVITY_CATEGORIES.UPLOAD_LINK)
    expect(categoryForAction('UNKNOWN_ACTION')).toBe(ACTIVITY_CATEGORIES.SYSTEM)
  })

  it('categorizes staff file actions as document activity', () => {
    expect(categoryForAction(ACTIVITY_ACTIONS.DOCUMENT.STAFF_FILE_UPLOADED)).toBe(
      ACTIVITY_CATEGORIES.DOCUMENT
    )
    expect(categoryForAction(ACTIVITY_ACTIONS.DOCUMENT.STAFF_INVOICE_STATUS_UPDATED)).toBe(
      ACTIVITY_CATEGORIES.DOCUMENT
    )
    expect(ACTIVITY_TARGET_TYPES.STAFF_FILE).toBe('STAFF_FILE')
  })
})
