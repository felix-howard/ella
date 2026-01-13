/**
 * Magic Link Service
 * Generate and validate magic links for portal access
 */
import { prisma } from '../lib/db'
import { customAlphabet } from 'nanoid'
import { PORTAL_URL } from '../lib/constants'

// Custom alphabet for URL-safe tokens (no confusing characters)
const generateToken = customAlphabet(
  '0123456789abcdefghijklmnopqrstuvwxyz',
  12
)

/**
 * Create a new magic link for a tax case
 */
export async function createMagicLink(caseId: string): Promise<string> {
  const token = generateToken()

  await prisma.magicLink.create({
    data: {
      caseId,
      token,
      isActive: true,
    },
  })

  return `${PORTAL_URL}/u/${token}`
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
