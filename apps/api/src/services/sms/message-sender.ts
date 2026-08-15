/**
 * Message Sender Service
 * High-level service for sending SMS messages with database tracking
 */
import { prisma } from '../../lib/db'
import { sendSms, formatPhoneToE164, isTwilioConfigured } from './twilio-client'
import {
  generateWelcomeMessage,
  generateMissingDocsMessage,
  generateBlurryResendMessage,
  generateCompleteMessage,
  generateScheduleCMessage,
  generateScheduleEMessage,
  type TemplateName,
  type SmsLanguage,
} from './templates'
import type { MessageChannel, MessageDirection, Prisma } from '@ella/db'
import { publishMessageEventFromConversation } from '../realtime/message-publisher'

const DRIVE_SHARED_FOLDER_MESSAGE_PREFIX = 'This is your secure Google Drive upload folder:'

/**
 * Get the organization's SMS language preference
 * Falls back to 'EN' if org not found or no preference set
 */
export async function getOrgSmsLanguage(organizationId: string | null): Promise<SmsLanguage> {
  if (!organizationId) return 'EN'
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { smsLanguage: true },
  })
  return org?.smsLanguage === 'VI' ? 'VI' : 'EN'
}

export interface SendMessageResult {
  success: boolean
  messageId?: string
  error?: string
  smsSent: boolean
}

export type DriveSharedFolderMessageSkippedReason =
  | 'FOLDER_NOT_READY'
  | 'NO_SHARED_FOLDER_URL'
  | 'NO_TAX_CASE'
  | 'NO_PHONE'
  | 'ALREADY_SENT'
  | 'SMS_NOT_CONFIGURED'

export interface SendDriveSharedFolderMessageInput {
  organizationId: string
  ownerClientId?: string
  clientDriveFolderId: string
  sharedFolderId?: string | null
  sharedFolderWebUrl?: string | null
  actorStaffId?: string | null
}

export interface SendDriveSharedFolderMessageResult extends SendMessageResult {
  skipped: boolean
  skippedReason?: DriveSharedFolderMessageSkippedReason
}

/**
 * Replace placeholders in template content with actual values
 * Placeholders format: {placeholderName}
 */
function replacePlaceholders(
  content: string,
  values: Record<string, string | number>
): string {
  let result = content
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value))
  }
  return result
}

const CLIENT_NAME_PLACEHOLDER = /\{\{\s*client_name\s*\}\}/g
const TAX_YEAR_PLACEHOLDER = /\{\{\s*tax_year\s*\}\}/g
const PORTAL_LINK_PLACEHOLDER = /\{\{\s*portal_link\s*\}\}/g
const HAS_PORTAL_LINK_PLACEHOLDER = /\{\{\s*portal_link\s*\}\}/

export function buildWelcomeMessageFromTemplate(
  template: string,
  clientName: string,
  taxYear: number,
  magicLink: string
): string {
  const body = template
    .replace(CLIENT_NAME_PLACEHOLDER, clientName)
    .replace(TAX_YEAR_PLACEHOLDER, String(taxYear))
    .replace(PORTAL_LINK_PLACEHOLDER, magicLink)

  if (HAS_PORTAL_LINK_PLACEHOLDER.test(template)) {
    return body
  }

  const trimmedBody = body.trimEnd()
  return trimmedBody ? `${trimmedBody}\n${magicLink}` : magicLink
}

export function buildDriveSharedFolderMessage(sharedFolderWebUrl: string): string {
  return `${DRIVE_SHARED_FOLDER_MESSAGE_PREFIX}\n${sharedFolderWebUrl}`
}

function readPermissionSnapshot(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {}
}

function hasDriveSharedFolderSmsMarker(
  snapshot: Record<string, unknown>,
  input: { sharedFolderId: string | null; sharedFolderWebUrl: string }
): boolean {
  if (typeof snapshot.sharedFolderSmsMessageId !== 'string') return false
  if (snapshot.sharedFolderSmsFolderWebUrl !== input.sharedFolderWebUrl) return false
  return input.sharedFolderId
    ? snapshot.sharedFolderSmsFolderId === input.sharedFolderId
    : true
}

async function markDriveSharedFolderSmsSent(input: {
  organizationId: string
  ownerClientId: string
  clientDriveFolderId: string
  sharedFolderId: string | null
  sharedFolderWebUrl: string
  messageId: string
  sentAt: Date
}): Promise<void> {
  const latestFolder = await prisma.clientDriveFolder.findFirst({
    where: {
      id: input.clientDriveFolderId,
      organizationId: input.organizationId,
      ownerClientId: input.ownerClientId,
    },
    select: { permissionSnapshot: true },
  })
  if (!latestFolder) return

  await prisma.clientDriveFolder.updateMany({
    where: {
      id: input.clientDriveFolderId,
      organizationId: input.organizationId,
      ownerClientId: input.ownerClientId,
    },
    data: {
      permissionSnapshot: {
        ...readPermissionSnapshot(latestFolder.permissionSnapshot),
        sharedFolderSmsFolderId: input.sharedFolderId,
        sharedFolderSmsFolderWebUrl: input.sharedFolderWebUrl,
        sharedFolderSmsMessageId: input.messageId,
        sharedFolderSmsSentAt: input.sentAt.toISOString(),
      } as unknown as Prisma.InputJsonObject,
    },
  })
}

export async function sendDriveSharedFolderMessage(
  input: SendDriveSharedFolderMessageInput
): Promise<SendDriveSharedFolderMessageResult> {
  const folder = await prisma.clientDriveFolder.findFirst({
    where: {
      id: input.clientDriveFolderId,
      organizationId: input.organizationId,
      ...(input.ownerClientId ? { ownerClientId: input.ownerClientId } : {}),
    },
    select: {
      ownerClientId: true,
      status: true,
      sharedFolderId: true,
      sharedFolderWebUrl: true,
      permissionSnapshot: true,
    },
  })

  if (!folder || folder.status !== 'READY') {
    return { success: true, skipped: true, skippedReason: 'FOLDER_NOT_READY', smsSent: false }
  }

  const sharedFolderWebUrl = (input.sharedFolderWebUrl ?? folder.sharedFolderWebUrl ?? '').trim()
  if (!sharedFolderWebUrl) {
    return { success: true, skipped: true, skippedReason: 'NO_SHARED_FOLDER_URL', smsSent: false }
  }

  const ownerClientId = input.ownerClientId ?? folder.ownerClientId
  const sharedFolderId = input.sharedFolderId ?? folder.sharedFolderId ?? null
  const permissionSnapshot = readPermissionSnapshot(folder.permissionSnapshot)
  if (hasDriveSharedFolderSmsMarker(permissionSnapshot, { sharedFolderId, sharedFolderWebUrl })) {
    return {
      success: true,
      skipped: true,
      skippedReason: 'ALREADY_SENT',
      messageId: permissionSnapshot.sharedFolderSmsMessageId as string,
      smsSent: false,
    }
  }

  const latestCase = await prisma.taxCase.findFirst({
    where: {
      clientId: ownerClientId,
      client: { organizationId: input.organizationId },
    },
    orderBy: [{ taxYear: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      client: { select: { phone: true } },
    },
  })
  if (!latestCase) {
    return { success: true, skipped: true, skippedReason: 'NO_TAX_CASE', smsSent: false }
  }
  if (!latestCase.client.phone.trim()) {
    return { success: true, skipped: true, skippedReason: 'NO_PHONE', smsSent: false }
  }

  const body = buildDriveSharedFolderMessage(sharedFolderWebUrl)
  const existingMessage = await prisma.message.findFirst({
    where: {
      conversation: { caseId: latestCase.id },
      channel: 'SMS',
      direction: 'OUTBOUND',
      content: body,
      twilioSid: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true },
  })
  if (existingMessage) {
    await markDriveSharedFolderSmsSent({
      organizationId: input.organizationId,
      ownerClientId,
      clientDriveFolderId: input.clientDriveFolderId,
      sharedFolderId,
      sharedFolderWebUrl,
      messageId: existingMessage.id,
      sentAt: existingMessage.createdAt,
    })
    return {
      success: true,
      skipped: true,
      skippedReason: 'ALREADY_SENT',
      messageId: existingMessage.id,
      smsSent: true,
    }
  }

  const result = await sendAndRecordMessage(
    latestCase.id,
    latestCase.client.phone,
    body,
    undefined,
    input.actorStaffId
  )
  if (!result.messageId) {
    const skippedResult: SendDriveSharedFolderMessageResult = {
      ...result,
      skipped: true,
    }
    if (result.error === 'SMS_NOT_CONFIGURED') {
      skippedResult.skippedReason = 'SMS_NOT_CONFIGURED'
    }
    return skippedResult
  }
  if (!result.smsSent) {
    throw new Error(result.error ?? 'Drive shared folder SMS failed')
  }

  await markDriveSharedFolderSmsSent({
    organizationId: input.organizationId,
    ownerClientId,
    clientDriveFolderId: input.clientDriveFolderId,
    sharedFolderId,
    sharedFolderWebUrl,
    messageId: result.messageId,
    sentAt: new Date(),
  })

  return { ...result, skipped: false }
}

/**
 * Send welcome message with magic link to new client
 * Priority: customMessage > database template > hardcoded template
 */
export async function sendWelcomeMessage(
  caseId: string,
  clientName: string,
  clientPhone: string,
  magicLink: string,
  taxYear: number,
  language: SmsLanguage = 'EN',
  customMessage?: string,
  staffId?: string | null
): Promise<SendMessageResult> {
  let body: string

  if (customMessage) {
    // Use custom message from form with placeholder replacement
    body = buildWelcomeMessageFromTemplate(customMessage, clientName, taxYear, magicLink)
  } else {
    // Try to get portal link template from database
    const dbTemplate = await prisma.messageTemplate.findFirst({
      where: {
        category: 'PORTAL_LINK',
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    })

    if (dbTemplate) {
      // Use database template with placeholder replacement
      body = replacePlaceholders(dbTemplate.content, {
        clientName,
        portalUrl: magicLink,
        taxYear,
      })
    } else {
      // Fallback to hardcoded template
      body = generateWelcomeMessage({
        clientName,
        magicLink,
        taxYear,
        language,
      })
    }
  }

  return sendAndRecordMessage(caseId, clientPhone, body, 'welcome', staffId)
}

/**
 * Send missing documents reminder
 */
export async function sendMissingDocsReminder(
  caseId: string,
  clientName: string,
  clientPhone: string,
  magicLink: string,
  missingDocs: string[],
  language: SmsLanguage = 'EN',
  staffId?: string | null
): Promise<SendMessageResult> {
  if (missingDocs.length === 0) {
    return { success: false, error: 'NO_MISSING_DOCS', smsSent: false }
  }

  const body = generateMissingDocsMessage({
    clientName,
    magicLink,
    missingDocs,
    language,
  })

  return sendAndRecordMessage(caseId, clientPhone, body, 'missing_docs', staffId)
}

/**
 * Send blurry image resend request
 */
export async function sendBlurryResendRequest(
  caseId: string,
  clientName: string,
  clientPhone: string,
  magicLink: string,
  docTypes: string[],
  language: SmsLanguage = 'EN',
  staffId?: string | null
): Promise<SendMessageResult> {
  if (docTypes.length === 0) {
    return { success: false, error: 'NO_BLURRY_DOCS', smsSent: false }
  }

  const body = generateBlurryResendMessage({
    clientName,
    magicLink,
    docTypes,
    language,
  })

  return sendAndRecordMessage(caseId, clientPhone, body, 'blurry_resend', staffId)
}

/**
 * Send documents complete notification
 */
export async function sendDocsCompleteMessage(
  caseId: string,
  clientName: string,
  clientPhone: string,
  taxYear: number,
  language: SmsLanguage = 'EN',
  staffId?: string | null
): Promise<SendMessageResult> {
  const body = generateCompleteMessage({
    clientName,
    taxYear,
    language,
  })

  return sendAndRecordMessage(caseId, clientPhone, body, 'complete', staffId)
}

/**
 * Send custom message (for staff-initiated messages)
 * NOTE: This creates a message record - use sendSmsOnly if record already exists
 */
export async function sendCustomMessage(
  caseId: string,
  clientPhone: string,
  content: string,
  staffId?: string | null
): Promise<SendMessageResult> {
  return sendAndRecordMessage(caseId, clientPhone, content, undefined, staffId)
}

/**
 * Send SMS only without creating a message record
 * Use this when the message record is already created (e.g., by API route)
 * Returns the Twilio SID and status for updating the existing record
 */
export async function sendSmsOnly(
  phone: string,
  content: string,
  options: { mediaUrls?: string[] } = {}
): Promise<{ success: boolean; sid?: string; status?: string; error?: string }> {
  if (!isTwilioConfigured()) {
    return { success: false, error: 'SMS_NOT_CONFIGURED' }
  }

  const formattedPhone = formatPhoneToE164(phone)
  const result = await sendSms({
    to: formattedPhone,
    body: content,
    mediaUrl: options.mediaUrls,
  })

  return {
    success: result.success,
    sid: result.sid,
    status: result.status,
    error: result.error,
  }
}

/**
 * Internal: Send SMS via Twilio, then record in database regardless of outcome.
 * Failed messages are stored with error status so they appear in the chat panel
 * with an error indicator instead of being silently hidden.
 */
async function sendAndRecordMessage(
  caseId: string,
  phone: string,
  content: string,
  templateName: TemplateName | undefined,
  staffId?: string | null
): Promise<SendMessageResult> {
  if (!isTwilioConfigured()) {
    return { success: true, smsSent: false, error: 'SMS_NOT_CONFIGURED' }
  }

  const formattedPhone = formatPhoneToE164(phone)
  const result = await sendSms({
    to: formattedPhone,
    body: content,
  })

  // Always create conversation and message record (even on failure)
  const conversation = await prisma.conversation.upsert({
    where: { caseId },
    update: {},
    create: { caseId },
  })

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      channel: 'SMS' as MessageChannel,
      direction: 'OUTBOUND' as MessageDirection,
      content,
      templateUsed: templateName,
      sentById: staffId || undefined,
      twilioSid: result.success ? (result.sid ?? null) : null,
      twilioStatus: result.success
        ? (result.status ?? null)
        : `ERROR: ${result.error || 'Unknown error'}`,
    },
  })

  // Publish realtime event (non-blocking)
  publishMessageEventFromConversation(conversation.id, {
    id: message.id,
    direction: 'OUTBOUND',
    channel: 'SMS',
  }).catch(() => {})

  // Update conversation timestamp
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  })

  // Update case last contact
  await prisma.taxCase.update({
    where: { id: caseId },
    data: { lastContactAt: new Date() },
  })

  return {
    success: true,
    messageId: message.id,
    smsSent: result.success,
    error: result.success ? undefined : result.error,
  }
}

/**
 * Send Schedule C expense form link to client
 * If customMessage provided, use it with placeholder replacement
 * Otherwise falls back to hardcoded template (database templates are deprecated)
 */
export async function sendScheduleCFormMessage(
  caseId: string,
  clientName: string,
  clientPhone: string,
  magicLink: string,
  language: SmsLanguage = 'EN',
  customMessage?: string,
  businessName?: string | null,
  staffId?: string | null
): Promise<SendMessageResult> {
  let body: string

  if (customMessage) {
    // Use custom message from frontend with placeholder replacement
    body = customMessage
      .replace(/\{\{client_name\}\}/g, clientName)
      .replace(/\{\{form_link\}\}/g, magicLink)
      .replace(/\{\{business_name\}\}/g, businessName?.trim() ?? '')
  } else {
    // Fallback to hardcoded template
    body = generateScheduleCMessage({ clientName, businessName, magicLink, language })
  }

  return sendAndRecordMessage(caseId, clientPhone, body, 'schedule_c', staffId)
}

/**
 * Check if SMS sending is available
 */
export function isSmsEnabled(): boolean {
  return isTwilioConfigured()
}

/**
 * Send Schedule E rental property form link to client
 * If customMessage provided, use it with placeholder replacement
 * Otherwise falls back to hardcoded template (database templates are deprecated)
 */
export async function sendScheduleEFormMessage(
  caseId: string,
  clientName: string,
  clientPhone: string,
  magicLink: string,
  language: SmsLanguage = 'EN',
  customMessage?: string,
  staffId?: string | null
): Promise<SendMessageResult> {
  let body: string

  if (customMessage) {
    // Use custom message from frontend with placeholder replacement
    body = customMessage
      .replace(/\{\{client_name\}\}/g, clientName)
      .replace(/\{\{form_link\}\}/g, magicLink)
  } else {
    // Fallback to hardcoded template
    body = generateScheduleEMessage({ clientName, magicLink, language })
  }

  return sendAndRecordMessage(caseId, clientPhone, body, 'schedule_e', staffId)
}
