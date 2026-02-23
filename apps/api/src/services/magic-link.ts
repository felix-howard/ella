/**
 * Magic Link Service
 * Generate and validate magic links for portal access and Schedule C forms
 */
import { prisma } from '../lib/db'
import { customAlphabet } from 'nanoid'
import { PORTAL_URL } from '../lib/constants'
import type { MagicLinkType } from '@ella/db'

// Custom alphabet for URL-safe tokens (no confusing characters)
const generateToken = customAlphabet(
  '0123456789abcdefghijklmnopqrstuvwxyz',
  12
)

// All link types now have no expiry (null = never expires)
// Previously: Schedule C/E had 7-day TTL, now removed for better UX
// TTL constant kept for extendMagicLinkExpiry (1 year expiry for extended links)
const MAGIC_LINK_TTL_DAYS = 365

/**
 * Generate URL based on magic link type
 */
function getMagicLinkUrl(token: string, type: MagicLinkType): string {
  switch (type) {
    case 'SCHEDULE_C':
      return `${PORTAL_URL}/expense/${token}`
    case 'SCHEDULE_E':
      return `${PORTAL_URL}/rental/${token}`
    case 'DRAFT_RETURN':
      return `${PORTAL_URL}/draft/${token}`
    case 'PORTAL':
    default:
      return `${PORTAL_URL}/u/${token}`
  }
}

export interface CreateMagicLinkOptions {
  expiresAt?: Date
  type?: MagicLinkType
}

/**
 * Create a new magic link for a tax case
 */
export async function createMagicLink(
  caseId: string,
  options?: CreateMagicLinkOptions
): Promise<string> {
  const token = generateToken()
  const type: MagicLinkType = options?.type || 'PORTAL'

  // All link types never expire (null) unless explicitly provided
  const expiresAt: Date | null = options?.expiresAt ?? null

  await prisma.magicLink.create({
    data: {
      caseId,
      token,
      type,
      expiresAt,
      isActive: true,
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
  type: MagicLinkType = 'PORTAL'
): Promise<{ url: string; expiresAt: Date | null }> {
  const token = generateToken()

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

// Return type for validateMagicLink
export interface MagicLinkValidationResult {
  valid: boolean
  error?: string
  data?: {
    taxCase: {
      id: string
      taxYear: number
      status: string
      client: {
        id: string
        name: string
        language: string
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
  }
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

  return {
    valid: true,
    data: {
      taxCase: {
        id: link.taxCase.id,
        taxYear: link.taxCase.taxYear,
        status: link.taxCase.status,
        client: {
          id: link.taxCase.client.id,
          name: link.taxCase.client.name,
          language: link.taxCase.client.language,
        },
        checklistItems: link.taxCase.checklistItems.map((item) => ({
          id: item.id,
          status: item.status,
          template: {
            docType: item.template.docType,
            labelVi: item.template.labelVi,
          },
        })),
        rawImages: link.taxCase.rawImages.map((img) => ({
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
