/**
 * Org-level agreement template CRUD operations.
 *
 * All queries are scoped by `organizationId` to prevent cross-org leak.
 * Other-org access returns 404 (not 403) to avoid leaking template existence.
 *
 * `contentHtml` is sanitized at write boundary; the same allowlist used for
 * agreement bodies (`sanitize-html.ts`) keeps template content safe to
 * snapshot into Agreement.customContentHtml at send time without re-checking.
 *
 * Archive is soft (`isArchived=true`) to preserve historical FK references
 * from already-sent Agreements (`Agreement.templateId`).
 *
 * `type` is immutable post-create. Mutating type would invalidate the
 * type-vs-content invariant for future sends snapshotting from this template;
 * users must create a new template and archive the old one.
 */
import type { Prisma, AgreementType, AgreementTemplate } from '@ella/db'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../lib/db'
import { sanitizeAgreementHtml } from '../../lib/agreements/sanitize-html'

interface CreateInput {
  orgId: string
  staffId: string
  name: string
  type: AgreementType
  contentHtml: string
  defaultDepositAmount?: string | null
}

interface UpdateInput {
  orgId: string
  id: string
  name?: string
  contentHtml?: string
  /** Pass `null` to clear; omit to leave unchanged. */
  defaultDepositAmount?: string | null
}

export async function createTemplate(input: CreateInput): Promise<AgreementTemplate> {
  const sanitized = sanitizeAgreementHtml(input.contentHtml)
  if (!sanitized) {
    throw new HTTPException(422, { message: 'contentHtml is empty after sanitization' })
  }
  return prisma.agreementTemplate.create({
    data: {
      organizationId: input.orgId,
      createdByUserId: input.staffId,
      name: input.name.trim(),
      type: input.type,
      contentHtml: sanitized,
      defaultDepositAmount: input.defaultDepositAmount ?? null,
    },
  })
}

export async function listTemplates(input: {
  orgId: string
  type?: AgreementType
  includeArchived?: boolean
}): Promise<AgreementTemplate[]> {
  const where: Prisma.AgreementTemplateWhereInput = {
    organizationId: input.orgId,
  }
  if (input.type) where.type = input.type
  if (!input.includeArchived) where.isArchived = false

  return prisma.agreementTemplate.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
  })
}

export async function getTemplate(input: {
  orgId: string
  id: string
}): Promise<AgreementTemplate> {
  const tpl = await prisma.agreementTemplate.findFirst({
    where: { id: input.id, organizationId: input.orgId },
  })
  if (!tpl) {
    // Returning 404 (not 403) avoids leaking template existence cross-org.
    throw new HTTPException(404, { message: 'Template not found' })
  }
  return tpl
}

/**
 * Single-statement org-scoped update closes the TOCTOU window between an
 * ownership pre-check and the write. `updateMany` returns count=0 if the row
 * doesn't exist OR belongs to another org — we surface 404 in either case.
 * After confirming the write, fetch the updated row to return.
 */
async function applyOrgScopedUpdate(input: {
  orgId: string
  id: string
  data: Prisma.AgreementTemplateUpdateManyMutationInput
}): Promise<AgreementTemplate> {
  const result = await prisma.agreementTemplate.updateMany({
    where: { id: input.id, organizationId: input.orgId },
    data: input.data,
  })
  if (result.count !== 1) {
    throw new HTTPException(404, { message: 'Template not found' })
  }
  // findUnique is safe — we just verified the row exists for this org.
  const updated = await prisma.agreementTemplate.findUnique({
    where: { id: input.id },
  })
  if (!updated) {
    // Race: row deleted between updateMany and findUnique. Treat as 404.
    throw new HTTPException(404, { message: 'Template not found' })
  }
  return updated
}

export async function updateTemplate(input: UpdateInput): Promise<AgreementTemplate> {
  const data: Prisma.AgreementTemplateUpdateManyMutationInput = {}
  if (input.name !== undefined) data.name = input.name.trim()
  if (input.contentHtml !== undefined) {
    const sanitized = sanitizeAgreementHtml(input.contentHtml)
    if (!sanitized) {
      throw new HTTPException(422, { message: 'contentHtml is empty after sanitization' })
    }
    data.contentHtml = sanitized
  }
  if (input.defaultDepositAmount !== undefined) {
    data.defaultDepositAmount = input.defaultDepositAmount
  }
  return applyOrgScopedUpdate({ orgId: input.orgId, id: input.id, data })
}

export async function archiveTemplate(input: {
  orgId: string
  id: string
}): Promise<AgreementTemplate> {
  return applyOrgScopedUpdate({
    orgId: input.orgId,
    id: input.id,
    data: { isArchived: true },
  })
}

export async function unarchiveTemplate(input: {
  orgId: string
  id: string
}): Promise<AgreementTemplate> {
  return applyOrgScopedUpdate({
    orgId: input.orgId,
    id: input.id,
    data: { isArchived: false },
  })
}
