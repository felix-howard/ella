/**
 * Magic Link Service
 * Generate and validate magic links for portal access and Schedule C forms
 */
import { prisma } from '../lib/db'
import { customAlphabet } from 'nanoid'
import slugify from 'slugify'
import { PORTAL_URL } from '../lib/constants'
import type { MagicLinkType, MagicLinkScope } from '@ella/db'

// Custom alphabet for URL-safe tokens (no confusing characters)
const generateToken = customAlphabet(
  '0123456789abcdefghijklmnopqrstuvwxyz',
  12
)

// Random suffix for slug tokens (6 chars = 36^6 ≈ 2.1B combos per name)
const generateSuffix = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6)

/**
 * Generate a friendly token: "tuyet-nguyen-a7k3mz"
 * Falls back to random token if name is empty/invalid
 */
function generateSlugToken(clientName: string): string {
  const slug = slugify(clientName, { lower: true, strict: true })
  if (!slug) return generateToken()
  const trimmedSlug = slug.slice(0, 30).replace(/-$/, '')
  return `${trimmedSlug}-${generateSuffix()}`
}

/**
 * Resolve token based on link type and optional client name.
 * PORTAL links with a client name get friendly slug tokens; all others get random tokens.
 */
function resolveToken(type: MagicLinkType, clientName?: string): string {
  return (type === 'PORTAL' && clientName)
    ? generateSlugToken(clientName)
    : generateToken()
}

// All link types now have no expiry (null = never expires)
// Previously: Schedule C/E had 7-day TTL, now removed for better UX
// TTL constant kept for extendMagicLinkExpiry (1 year expiry for extended links)
const MAGIC_LINK_TTL_DAYS = 365

/**
 * Generate URL based on magic link type
 */
export function getMagicLinkUrl(token: string, type: MagicLinkType): string {
  switch (type) {
    case 'SCHEDULE_C':
      return `${PORTAL_URL}/expense/${token}`
    case 'SCHEDULE_E':
      return `${PORTAL_URL}/rental/${token}`
    case 'DRAFT_RETURN':
      return `${PORTAL_URL}/draft/${token}`
    case 'PORTAL':
    default:
      return `${PORTAL_URL}/upload/${token}`
  }
}

export interface CreateMagicLinkOptions {
  expiresAt?: Date
  type?: MagicLinkType
  // GROUP scope upgrades the link into a multi-entity portal — required when
  // the anchor case's client belongs to a multi-member ClientGroup so the
  // portal renders the entity picker instead of a solo upload page.
  scope?: MagicLinkScope
  clientGroupId?: string
}

/**
 * Create a new magic link for a tax case
 */
export async function createMagicLink(
  caseId: string,
  options?: CreateMagicLinkOptions & { clientName?: string }
): Promise<string> {
  const type: MagicLinkType = options?.type || 'PORTAL'
  const token = resolveToken(type, options?.clientName)

  // All link types never expire (null) unless explicitly provided
  const expiresAt: Date | null = options?.expiresAt ?? null

  const scope: MagicLinkScope = options?.scope ?? 'CASE'
  if (scope === 'GROUP' && !options?.clientGroupId) {
    throw new Error('createMagicLink: clientGroupId is required when scope=GROUP')
  }

  await prisma.magicLink.create({
    data: {
      caseId,
      token,
      type,
      expiresAt,
      isActive: true,
      scope,
      clientGroupId: scope === 'GROUP' ? options!.clientGroupId! : null,
    },
  })

  return getMagicLinkUrl(token, type)
}

/**
 * Create a new magic link with atomic deactivation of existing links
 * Uses transaction to ensure atomicity
 */
export async function createMagicLinkWithDeactivation(
  caseId: string,
  type: MagicLinkType = 'PORTAL',
  clientName?: string
): Promise<{ url: string; expiresAt: Date | null }> {
  const token = resolveToken(type, clientName)

  // All link types never expire (null)
  const expiresAt: Date | null = null

  await prisma.$transaction([
    // Deactivate all existing links of this type for this case
    prisma.magicLink.updateMany({
      where: {
        caseId,
        type,
        isActive: true,
      },
      data: { isActive: false },
    }),
    // Create new link
    prisma.magicLink.create({
      data: {
        caseId,
        token,
        type,
        expiresAt,
        isActive: true,
      },
    }),
  ])

  return {
    url: getMagicLinkUrl(token, type),
    expiresAt,
  }
}

export interface PortalEntityPayload {
  caseId: string
  clientId: string
  name: string
  entityType: 'individual' | 'business'
  businessType: string | null
  uploadCount: number
  hasChecklist: boolean
  missingCount?: number
  taxYear: number
}

// Return type for validateMagicLink
export interface MagicLinkValidationResult {
  valid: boolean
  error?: string
  data?: {
    scope: MagicLinkScope
    clientGroupId: string | null
    entities: PortalEntityPayload[]
    // Present only for scope=CASE (back-compat with existing portal callers)
    taxCase?: {
      id: string
      taxYear: number
      status: string
      client: {
        id: string
        name: string
        language: string
        clientGroupId: string | null
      }
      checklistItems: Array<{
        id: string
        status: string
        template: {
          docType: string
          labelVi: string
        }
      }>
      rawImages: Array<{
        id: string
        status: string
        classifiedType: string | null
      }>
    }
    clientGroup?: {
      id: string
      name: string
      organizationId: string | null
    }
  }
}

/**
 * Resolve all entities (cases) within a ClientGroup for a given tax year.
 * Returns one payload per entity (client + their tax case for that year).
 * Sort: individuals first, then businesses by Client.createdAt asc.
 */
export async function resolveGroupEntities(
  clientGroupId: string,
  taxYear: number
): Promise<PortalEntityPayload[]> {
  const clients = await prisma.client.findMany({
    where: { clientGroupId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      clientType: true,
      businessType: true,
      createdAt: true,
      taxCases: {
        where: { taxYear },
        select: {
          id: true,
          taxYear: true,
          rawImages: { select: { id: true } },
          checklistItems: { select: { status: true } },
        },
      },
    },
  })

  const entities: PortalEntityPayload[] = []
  for (const client of clients) {
    // Each client may have at most one tax case for this year (unique [clientId, taxYear])
    const tc = client.taxCases[0]
    if (!tc) continue
    const hasChecklist = tc.checklistItems.length > 0
    entities.push({
      caseId: tc.id,
      clientId: client.id,
      name: client.name,
      entityType: client.clientType === 'BUSINESS' ? 'business' : 'individual',
      businessType: client.businessType ?? null,
      uploadCount: tc.rawImages.length,
      hasChecklist,
      missingCount: hasChecklist
        ? tc.checklistItems.filter((c) => c.status === 'MISSING').length
        : undefined,
      taxYear: tc.taxYear,
    })
  }

  // Individuals first, businesses after (createdAt order already applied within each group via outer orderBy)
  entities.sort((a, b) => {
    if (a.entityType === b.entityType) return 0
    return a.entityType === 'individual' ? -1 : 1
  })
  return entities
}

/**
 * Validate a magic link token and return associated data
 */
export async function validateMagicLink(token: string): Promise<MagicLinkValidationResult> {
  const link = await prisma.magicLink.findUnique({
    where: { token },
    include: {
      taxCase: {
        include: {
          client: true,
          checklistItems: {
            include: { template: true },
          },
          rawImages: true,
        },
      },
      clientGroup: true,
    },
  })

  if (!link) {
    return { valid: false, error: 'INVALID_TOKEN' }
  }

  if (!link.isActive) {
    return { valid: false, error: 'INVALID_TOKEN' }
  }

  if (link.expiresAt && link.expiresAt < new Date()) {
    return { valid: false, error: 'EXPIRED_TOKEN' }
  }

  // Update usage stats
  await prisma.magicLink.update({
    where: { id: link.id },
    data: {
      lastUsedAt: new Date(),
      usageCount: { increment: 1 },
    },
  })

  if (link.scope === 'GROUP') {
    if (!link.clientGroupId || !link.clientGroup) {
      return { valid: false, error: 'INVALID_TOKEN' }
    }
    // GROUP tokens may still anchor to a TaxCase (used to derive taxYear); fall back to most recent case in group
    let taxYear = link.taxCase?.taxYear
    if (!taxYear) {
      const anchor = await prisma.taxCase.findFirst({
        where: { client: { clientGroupId: link.clientGroupId } },
        orderBy: { taxYear: 'desc' },
        select: { taxYear: true },
      })
      taxYear = anchor?.taxYear
    }
    if (!taxYear) {
      return { valid: false, error: 'INVALID_TOKEN' }
    }
    const entities = await resolveGroupEntities(link.clientGroupId, taxYear)
    return {
      valid: true,
      data: {
        scope: 'GROUP',
        clientGroupId: link.clientGroupId,
        entities,
        clientGroup: {
          id: link.clientGroup.id,
          name: link.clientGroup.name,
          organizationId: link.clientGroup.organizationId,
        },
      },
    }
  }

  // scope === 'CASE' (legacy)
  if (!link.taxCase) {
    return { valid: false, error: 'INVALID_TOKEN' }
  }

  const tc = link.taxCase
  const missingCount = tc.checklistItems.filter((c) => c.status === 'MISSING').length
  const singleEntity: PortalEntityPayload = {
    caseId: tc.id,
    clientId: tc.client.id,
    name: tc.client.name,
    entityType: tc.client.clientType === 'BUSINESS' ? 'business' : 'individual',
    businessType: tc.client.businessType ?? null,
    uploadCount: tc.rawImages.length,
    hasChecklist: tc.checklistItems.length > 0,
    missingCount: tc.checklistItems.length > 0 ? missingCount : undefined,
    taxYear: tc.taxYear,
  }

  return {
    valid: true,
    data: {
      scope: 'CASE',
      clientGroupId: tc.client.clientGroupId,
      entities: [singleEntity],
      taxCase: {
        id: tc.id,
        taxYear: tc.taxYear,
        status: tc.status,
        client: {
          id: tc.client.id,
          name: tc.client.name,
          language: tc.client.language,
          clientGroupId: tc.client.clientGroupId,
        },
        checklistItems: tc.checklistItems.map((item) => ({
          id: item.id,
          status: item.status,
          template: {
            docType: item.template.docType,
            labelVi: item.template.labelVi,
          },
        })),
        rawImages: tc.rawImages.map((img) => ({
          id: img.id,
          status: img.status,
          classifiedType: img.classifiedType,
        })),
      },
    },
  }
}

/**
 * Deactivate a magic link
 */
export async function deactivateMagicLink(token: string): Promise<void> {
  await prisma.magicLink.update({
    where: { token },
    data: { isActive: false },
  })
}

/**
 * Get all magic links for a case
 */
export async function getMagicLinksForCase(caseId: string) {
  return prisma.magicLink.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Get Schedule C magic link for a case (most recent active)
 */
export async function getScheduleCMagicLink(caseId: string) {
  return prisma.magicLink.findFirst({
    where: {
      caseId,
      type: 'SCHEDULE_C',
      isActive: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

// Return type for validateScheduleCToken
export interface ScheduleCValidationResult {
  valid: boolean
  error?: string
  linkId?: string
  caseId?: string
  clientName?: string
  clientLanguage?: string
  taxYear?: number
  isLocked?: boolean
}

// Auto-extend disabled: links no longer expire

/**
 * Validate Schedule C token and return minimal data needed for expense form
 * Auto-extends expiry if accessed within threshold
 */
export async function validateScheduleCToken(token: string): Promise<ScheduleCValidationResult> {
  const link = await prisma.magicLink.findUnique({
    where: { token },
    include: {
      taxCase: {
        include: {
          client: true,
          scheduleCExpense: true,
        },
      },
    },
  })

  if (!link) {
    return { valid: false, error: 'INVALID_TOKEN' }
  }

  // Check type
  if (link.type !== 'SCHEDULE_C') {
    return { valid: false, error: 'INVALID_TOKEN_TYPE' }
  }

  if (!link.isActive) {
    return { valid: false, error: 'LINK_DEACTIVATED' }
  }

  if (link.expiresAt && link.expiresAt < new Date()) {
    return { valid: false, error: 'EXPIRED_TOKEN' }
  }

  // SCHEDULE_C tokens always anchor to a TaxCase
  if (!link.taxCase) {
    return { valid: false, error: 'INVALID_TOKEN' }
  }

  // Check if expense is locked
  const isLocked = link.taxCase.scheduleCExpense?.status === 'LOCKED'
  if (isLocked) {
    return { valid: false, error: 'FORM_LOCKED' }
  }

  // Update usage stats
  await prisma.magicLink.update({
    where: { id: link.id },
    data: {
      lastUsedAt: new Date(),
      usageCount: { increment: 1 },
    },
  })

  return {
    valid: true,
    linkId: link.id,
    caseId: link.taxCase.id,
    clientName: link.taxCase.client.name,
    clientLanguage: link.taxCase.client.language,
    taxYear: link.taxCase.taxYear,
    isLocked: false,
  }
}

/**
 * Extend magic link expiry by 7 days
 */
export async function extendMagicLinkExpiry(linkId: string): Promise<Date> {
  const newExpiry = new Date(Date.now() + MAGIC_LINK_TTL_DAYS * 24 * 60 * 60 * 1000)
  await prisma.magicLink.update({
    where: { id: linkId },
    data: { expiresAt: newExpiry },
  })
  return newExpiry
}

/**
 * Deactivate magic link by ID
 */
export async function deactivateMagicLinkById(linkId: string): Promise<void> {
  await prisma.magicLink.update({
    where: { id: linkId },
    data: { isActive: false },
  })
}

/**
 * Get Schedule E magic link for a case (most recent active)
 */
export async function getScheduleEMagicLink(caseId: string) {
  return prisma.magicLink.findFirst({
    where: {
      caseId,
      type: 'SCHEDULE_E',
      isActive: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

// Return type for validateScheduleEToken
export interface ScheduleEValidationResult {
  valid: boolean
  error?: string
  linkId?: string
  caseId?: string
  clientName?: string
  clientLanguage?: string
  taxYear?: number
  isLocked?: boolean
}

/**
 * Validate Schedule E token and return minimal data needed for rental form
 * Auto-extends expiry if accessed within threshold
 */
export async function validateScheduleEToken(token: string): Promise<ScheduleEValidationResult> {
  const link = await prisma.magicLink.findUnique({
    where: { token },
    include: {
      taxCase: {
        include: {
          client: true,
          scheduleEExpense: true,
        },
      },
    },
  })

  if (!link) {
    return { valid: false, error: 'INVALID_TOKEN' }
  }

  // Check type
  if (link.type !== 'SCHEDULE_E') {
    return { valid: false, error: 'INVALID_TOKEN_TYPE' }
  }

  if (!link.isActive) {
    return { valid: false, error: 'LINK_DEACTIVATED' }
  }

  if (link.expiresAt && link.expiresAt < new Date()) {
    return { valid: false, error: 'EXPIRED_TOKEN' }
  }

  // SCHEDULE_E tokens always anchor to a TaxCase
  if (!link.taxCase) {
    return { valid: false, error: 'INVALID_TOKEN' }
  }

  // Check if expense is locked
  const isLocked = link.taxCase.scheduleEExpense?.status === 'LOCKED'
  if (isLocked) {
    return { valid: false, error: 'FORM_LOCKED' }
  }

  // Update usage stats
  await prisma.magicLink.update({
    where: { id: link.id },
    data: {
      lastUsedAt: new Date(),
      usageCount: { increment: 1 },
    },
  })

  return {
    valid: true,
    linkId: link.id,
    caseId: link.taxCase.id,
    clientName: link.taxCase.client.name,
    clientLanguage: link.taxCase.client.language,
    taxYear: link.taxCase.taxYear,
    isLocked: false,
  }
}
