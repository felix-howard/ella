/**
 * Action Counts Types
 * For client list action badges
 */

import type { ComputedStatus } from '../utils/computed-status'

/** Upload statistics per client for document notification tracking */
export interface ClientUploads {
  /** RawImages without DocumentView for current staff */
  newCount: number
  /** Total RawImages for client's cases */
  totalCount: number
  /** Most recent upload timestamp (ISO string) */
  latestAt: string | null
}

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
  firstName: string
  lastName: string | null
  name: string  // Computed: firstName + lastName (backward compat)
  phone: string
  email: string | null
  language: 'VI' | 'EN'
  createdAt: string
  updatedAt: string
  computedStatus: ComputedStatus | null
  actionCounts: ActionCounts | null
  /** Upload stats for notification badge (per-CPA tracking) */
  uploads?: ClientUploads
  /** Staff assigned to this client (admin-only, for list view) */
  assignedStaff?: { id: string; name: string }[]
  latestCase: {
    id: string
    taxYear: number
    taxTypes: string[]
    isInReview: boolean
    isFiled: boolean
    lastActivityAt: string
  } | null
}
