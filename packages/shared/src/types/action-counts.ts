/**
 * Action Counts Types
 * For client list action badges
 */

import type { ComputedStatus } from '../utils/computed-status'

export interface ActionCounts {
  /** ChecklistItem.status = MISSING */
  missingDocs: number
  /** DigitalDoc.status = EXTRACTED (needs verification) */
  toVerify: number
  /** DigitalDoc.status = VERIFIED && entryCompleted = false */
  toEnter: number
  /** Days since lastActivityAt (null if < threshold) */
  staleDays: number | null
  /** Has unread messages */
  hasNewActivity: boolean
}

export interface ClientWithActions {
  id: string
  name: string
  phone: string
  email: string | null
  language: 'VI' | 'EN'
  createdAt: string
  updatedAt: string
  computedStatus: ComputedStatus | null
  actionCounts: ActionCounts | null
  latestCase: {
    id: string
    taxYear: number
    taxTypes: string[]
    isInReview: boolean
    isFiled: boolean
    lastActivityAt: string
  } | null
}
