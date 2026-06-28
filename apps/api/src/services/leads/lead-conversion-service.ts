/**
 * Shared Lead → Client conversion transaction. Single source of truth for the
 * client-creation + history-migration steps so the admin convert route and the
 * webhook-driven auto-convert (first sent-quote payment) can never diverge.
 *
 * Owns ONLY the in-transaction conversion core: duplicate-phone guard, Client +
 * TaxEngagement + TaxCase + Conversation creation, message/agreement
 * reassignment, and marking the Lead CONVERTED. Manager assignment, staff
 * validation, welcome SMS and audit logging stay with the caller (those are
 * route-specific concerns the webhook deliberately skips).
 */
import type { ClientSource, Language, Prisma } from '@ella/db'
import { acquireLeadReplyActionLock } from '../sms/lead-reply-action-service'

/** Lead fields the conversion needs; both callers already have a full Lead row. */
export interface LeadConversionSource {
  id: string
  phone: string
  tags: string[]
  notes: string | null
  messagesLastReadAt?: Date | null
}

export interface ConvertLeadToClientParams {
  lead: LeadConversionSource
  organizationId: string
  /** Final values for the new Client (route may pass sanitized edits; webhook passes lead values). */
  firstName: string
  lastName: string
  email: string | null
  /** Omit to fall back to the Client schema default (VI). */
  language?: Language
  taxYear: number
  source?: ClientSource
  createdByStaffId?: string | null
  managedById?: string | null
  /** Applied to the Lead row on convert (route carries admin edits; webhook omits). */
  leadUpdateOverrides?: { firstName?: string; lastName?: string; email?: string | null }
}

export type ConvertLeadToClientResult =
  | { duplicate: true; existingClient: { id: string; firstName: string; lastName: string | null } }
  | {
      duplicate: false
      client: { id: string; firstName: string; lastName: string | null; phone: string }
      engagement: { id: string }
      taxCase: { id: string }
      conversation: { id: string }
      migratedCount: number
      agreementMigratedCount: number
    }

/**
 * Run the conversion core inside an existing transaction. Returns `duplicate`
 * (no mutations performed) when an INDIVIDUAL client already exists on the
 * lead's phone — the caller decides how to surface that.
 */
export async function convertLeadToClientCore(
  tx: Prisma.TransactionClient,
  params: ConvertLeadToClientParams,
): Promise<ConvertLeadToClientResult> {
  const { lead, organizationId, taxYear } = params

  // Duplicate guard inside the transaction (race-safe): an INDIVIDUAL client on
  // this phone means the lead is effectively already a client.
  const existingClient = await tx.client.findFirst({
    where: { phone: lead.phone, clientType: 'INDIVIDUAL', organizationId },
    select: { id: true, firstName: true, lastName: true },
  })
  if (existingClient) return { duplicate: true, existingClient }

  await acquireLeadReplyActionLock(tx, lead.id)

  const client = await tx.client.create({
    data: {
      firstName: params.firstName,
      lastName: params.lastName,
      name: `${params.firstName} ${params.lastName}`,
      phone: lead.phone,
      email: params.email,
      ...(params.language ? { language: params.language } : {}),
      source: params.source ?? 'CONVERTED',
      tags: lead.tags ?? [],
      notes: lead.notes,
      organizationId,
      managedById: params.managedById ?? null,
      createdById: params.createdByStaffId ?? null,
    },
  })

  const engagement = await tx.taxEngagement.create({
    data: { clientId: client.id, taxYear, status: 'DRAFT' },
  })

  const taxCase = await tx.taxCase.create({
    data: {
      clientId: client.id,
      engagementId: engagement.id,
      taxYear,
      taxTypes: ['FORM_1040'],
      status: 'INTAKE',
    },
  })

  const [latestLeadMessage, unreadLeadMessageCount] = await Promise.all([
    tx.message.findFirst({
      where: { leadId: lead.id },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    tx.message.count({
      where: {
        leadId: lead.id,
        direction: 'INBOUND',
        ...(lead.messagesLastReadAt
          ? { createdAt: { gt: lead.messagesLastReadAt } }
          : {}),
      },
    }),
  ])

  // Always create a conversation to host the reassigned lead messages.
  const conversation = await tx.conversation.create({
    data: {
      caseId: taxCase.id,
      lastMessageAt: latestLeadMessage?.createdAt ?? new Date(),
      unreadCount: unreadLeadMessageCount,
    },
  })

  // Reassign pre-conversion lead messages via UPDATE (not copy) so Message IDs
  // and createdAt are preserved for continuous thread history.
  const migrated = await tx.message.updateMany({
    where: { leadId: lead.id },
    data: { conversationId: conversation.id, leadId: null },
  })

  await tx.action.updateMany({
    where: {
      leadId: lead.id,
      type: 'LEAD_REPLIED',
      isCompleted: false,
    },
    data: {
      isCompleted: true,
      completedAt: new Date(),
    },
  })

  // Link all of the lead's agreements to the new client (org filter is
  // defense-in-depth; leadId is already org-scoped).
  const agreementMigrated = await tx.agreement.updateMany({
    where: { leadId: lead.id, organizationId },
    data: { clientId: client.id },
  })

  await tx.lead.update({
    where: { id: lead.id },
    data: {
      status: 'CONVERTED',
      convertedToId: client.id,
      convertedAt: new Date(),
      ...(params.leadUpdateOverrides?.firstName
        ? { firstName: params.leadUpdateOverrides.firstName }
        : {}),
      ...(params.leadUpdateOverrides?.lastName
        ? { lastName: params.leadUpdateOverrides.lastName }
        : {}),
      ...(params.leadUpdateOverrides?.email !== undefined
        ? { email: params.leadUpdateOverrides.email }
        : {}),
    },
  })

  return {
    duplicate: false,
    client,
    engagement,
    taxCase,
    conversation,
    migratedCount: migrated.count,
    agreementMigratedCount: agreementMigrated.count,
  }
}
