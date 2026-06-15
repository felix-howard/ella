export const ACTIVITY_CATEGORIES = {
  CLIENT: 'CLIENT',
  CASE: 'CASE',
  DOCUMENT: 'DOCUMENT',
  MESSAGE: 'MESSAGE',
  PROFILE: 'PROFILE',
  SETTINGS: 'SETTINGS',
  TEAM: 'TEAM',
  LEAD: 'LEAD',
  UPLOAD_LINK: 'UPLOAD_LINK',
  AUTH: 'AUTH',
  SYSTEM: 'SYSTEM',
} as const

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[keyof typeof ACTIVITY_CATEGORIES]

export const ACTIVITY_TARGET_TYPES = {
  CLIENT: 'CLIENT',
  CASE: 'CASE',
  RAW_IMAGE: 'RAW_IMAGE',
  MAGIC_LINK: 'MAGIC_LINK',
  MESSAGE: 'MESSAGE',
  CONVERSATION: 'CONVERSATION',
  STAFF: 'STAFF',
  STAFF_FILE: 'STAFF_FILE',
  ORGANIZATION: 'ORGANIZATION',
  LEAD: 'LEAD',
  TEMPLATE: 'TEMPLATE',
  CHECKLIST_ITEM: 'CHECKLIST_ITEM',
  UNKNOWN: 'UNKNOWN',
} as const

export type ActivityTargetType = (typeof ACTIVITY_TARGET_TYPES)[keyof typeof ACTIVITY_TARGET_TYPES]

export const ACTIVITY_ACTIONS = {
  CLIENT: {
    CREATED: 'client.created',
    UPDATED: 'client.updated',
    ARCHIVED: 'client.archived',
    DELETED: 'client.deleted',
    AVATAR_UPDATED: 'client.avatar_updated',
    AVATAR_DELETED: 'client.avatar_deleted',
    NOTES_UPDATED: 'client.notes_updated',
    MANAGER_CHANGED: 'client.manager_changed',
    BUSINESS_LINKED: 'client.business_linked',
  },
  CASE: {
    CREATED: 'case.created',
    UPDATED: 'case.updated',
    STATUS_CHANGED: 'case.status_changed',
  },
  DOCUMENT: {
    UPLOADED: 'document.uploaded',
    UPDATED: 'document.updated',
    CLASSIFICATION_APPROVED: 'document.classification_approved',
    CLASSIFICATION_REJECTED: 'document.classification_rejected',
    RECLASSIFY_TRIGGERED: 'document.reclassify_triggered',
    REUPLOAD_REQUESTED: 'document.reupload_requested',
    MOVED: 'document.moved',
    DELETED: 'document.deleted',
    FILE_PROXIED: 'document.file_proxied',
    MARKED_VIEWED: 'document.marked_viewed',
    SIGNED_URL_CREATED: 'document.signed_url_created',
    RETENTION_DELETED: 'document.retention_deleted',
    RETENTION_DELETE_FAILED: 'document.retention_delete_failed',
    RETENTION_EXTENDED: 'document.retention_extended',
    RETENTION_SCHEDULED: 'document.retention_scheduled',
    STAFF_FILE_UPLOADED: 'document.staff_file_uploaded',
    STAFF_FILE_RENAMED: 'document.staff_file_renamed',
    STAFF_FILE_DELETED: 'document.staff_file_deleted',
    STAFF_FILE_DOWNLOADED: 'document.staff_file_downloaded',
    STAFF_INVOICE_STATUS_UPDATED: 'document.staff_invoice_status_updated',
  },
  MESSAGE: {
    SENT: 'message.sent',
    RECEIVED: 'message.received',
    DELIVERY_UPDATED: 'message.delivery_updated',
    REMINDER_SENT: 'message.reminder_sent',
    BATCH_REMINDER_SENT: 'message.batch_reminder_sent',
  },
  PROFILE: {
    UPDATED: 'profile.updated',
    AVATAR_UPDATED: 'profile.avatar_updated',
    SIGNATURE_UPDATED: 'profile.signature_updated',
    SIGNATURE_DELETED: 'profile.signature_deleted',
  },
  SETTINGS: {
    ORGANIZATION_UPDATED: 'settings.organization_updated',
    STAFF_UPDATED: 'settings.staff_updated',
    ADMIN_TEMPLATE_CREATED: 'settings.admin_template_created',
    ADMIN_TEMPLATE_UPDATED: 'settings.admin_template_updated',
    ADMIN_TEMPLATE_DELETED: 'settings.admin_template_deleted',
  },
  TEAM: {
    MEMBER_INVITED: 'team.member_invited',
    MEMBER_UPDATED: 'team.member_updated',
    MEMBER_DEACTIVATED: 'team.member_deactivated',
    MEMBER_ARCHIVED: 'team.member_archived',
    MEMBER_UNARCHIVED: 'team.member_unarchived',
    INVITATION_REVOKED: 'team.invitation_revoked',
    NOTIFICATION_SUBSCRIPTIONS_UPDATED: 'team.notification_subscriptions_updated',
    PAYMENT_INFO_UPDATED: 'team.payment_info_updated',
    PAYMENT_INFO_CLEARED: 'team.payment_info_cleared',
  },
  LEAD: {
    CREATED: 'lead.created',
    UPDATED: 'lead.updated',
    CONVERTED: 'lead.converted',
    DELETED: 'lead.deleted',
    MESSAGE_SENT: 'lead.message_sent',
    MESSAGE_READ: 'lead.message_read',
  },
  UPLOAD_LINK: {
    GENERATED: 'upload_link.generated',
    EXTENDED: 'upload_link.extended',
    REVOKED: 'upload_link.revoked',
  },
  AUTH: {
    LOGIN_ACCEPTED: 'auth.login_accepted',
    LOGIN_DENIED: 'auth.login_denied',
  },
  SYSTEM: {
    JOB_STARTED: 'system.job_started',
    RATE_LIMITED: 'system.rate_limited',
  },
} as const

type ValueOf<T> = T[keyof T]
type ValuesOfUnion<T> = T extends unknown ? ValueOf<T> : never
export type ActivityAction = ValuesOfUnion<ValueOf<typeof ACTIVITY_ACTIONS>>

export const LEGACY_ACTIVITY_ACTIONS = {
  DOCUMENT_DELETED: ACTIVITY_ACTIONS.DOCUMENT.DELETED,
  DOCUMENT_FILE_PROXIED: ACTIVITY_ACTIONS.DOCUMENT.FILE_PROXIED,
  DOCUMENT_MARKED_VIEWED: ACTIVITY_ACTIONS.DOCUMENT.MARKED_VIEWED,
  DOCUMENT_DOWNLOAD_URL_CREATED: ACTIVITY_ACTIONS.DOCUMENT.SIGNED_URL_CREATED,
  DOCUMENT_SIGNED_URL_CREATED: ACTIVITY_ACTIONS.DOCUMENT.SIGNED_URL_CREATED,
  IDENTITY_DOCUMENT_RETENTION_DELETED: ACTIVITY_ACTIONS.DOCUMENT.RETENTION_DELETED,
  IDENTITY_DOCUMENT_RETENTION_DELETE_FAILED: ACTIVITY_ACTIONS.DOCUMENT.RETENTION_DELETE_FAILED,
  IDENTITY_DOCUMENT_RETENTION_EXTENDED: ACTIVITY_ACTIONS.DOCUMENT.RETENTION_EXTENDED,
  IDENTITY_DOCUMENT_RETENTION_SCHEDULED: ACTIVITY_ACTIONS.DOCUMENT.RETENTION_SCHEDULED,
  RETENTION_JOB_STARTED: ACTIVITY_ACTIONS.SYSTEM.JOB_STARTED,
  'portal.read.rate_limited': ACTIVITY_ACTIONS.SYSTEM.RATE_LIMITED,
  'portal.upload.rate_limited': ACTIVITY_ACTIONS.SYSTEM.RATE_LIMITED,
} as const satisfies Record<string, ActivityAction>

export function normalizeActivityAction(action: string): ActivityAction | string {
  return LEGACY_ACTIVITY_ACTIONS[action as keyof typeof LEGACY_ACTIVITY_ACTIONS] ?? action
}

export function isActivityCategory(value: string | null | undefined): value is ActivityCategory {
  return Boolean(value && Object.values(ACTIVITY_CATEGORIES).includes(value as ActivityCategory))
}

export function isActivityTargetType(value: string | null | undefined): value is ActivityTargetType {
  return Boolean(value && Object.values(ACTIVITY_TARGET_TYPES).includes(value as ActivityTargetType))
}

export function categoryForAction(action: string): ActivityCategory {
  const normalizedAction = normalizeActivityAction(action)
  for (const [category, actions] of Object.entries(ACTIVITY_ACTIONS)) {
    if (Object.values(actions).includes(normalizedAction as ActivityAction)) {
      return category as ActivityCategory
    }
  }
  return ACTIVITY_CATEGORIES.SYSTEM
}
