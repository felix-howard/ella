import type { Prisma } from '@ella/db'
import { sanitizeSearchInput } from '../../lib/validation'

export type LeadFilterInput = {
  organizationId: string
  status?: 'NEW' | 'SENT' | 'CONTACTED' | 'CONVERTED' | 'LOST'
  search?: string
  tag?: string
  includeConverted?: boolean
}

export function buildLeadWhere(input: LeadFilterInput): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = { organizationId: input.organizationId }

  if (input.status) {
    where.status = input.status
  } else if (!input.includeConverted) {
    where.status = { not: 'CONVERTED' }
  }

  if (input.tag) {
    where.tags = { has: input.tag }
  }

  if (input.search) {
    const sanitized = sanitizeSearchInput(input.search)
    where.OR = [
      { firstName: { contains: sanitized, mode: 'insensitive' } },
      { lastName: { contains: sanitized, mode: 'insensitive' } },
      { phone: { contains: sanitized } },
      { businessName: { contains: sanitized, mode: 'insensitive' } },
    ]
  }

  return where
}

export function buildSelectableLeadWhere(input: LeadFilterInput): Prisma.LeadWhereInput {
  const where = buildLeadWhere(input)

  if (input.status === 'CONVERTED') {
    return { ...where, id: { in: [] } }
  }

  if (!input.status) {
    return { ...where, status: { not: 'CONVERTED' } }
  }

  return where
}
