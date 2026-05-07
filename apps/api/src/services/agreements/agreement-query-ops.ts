/**
 * Entity-aware agreement read operations: list agreements and resolve presigned PDF URL.
 */
import type { AgreementType } from '@ella/db'
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../lib/db'
import { getSignedDownloadUrl } from '../storage'
import { loadEntityWithOrg, type EntityType } from './entity-loader'
import { buildAgreementUrl, agreementScopeWhere } from './agreement-shared'

const PRESIGNED_PDF_TTL_SECONDS = 900 // 15 min

export async function listAgreementsForEntity(input: {
  entityType: EntityType
  entityId: string
  orgId: string
  /** Optional type filter — return only this AgreementType. */
  type?: AgreementType
}) {
  // Existence check is org-scoped on the entity itself.
  await loadEntityWithOrg(input)

  const items = await prisma.agreement.findMany({
    where: {
      ...agreementScopeWhere(input.entityType, input.entityId),
      organizationId: input.orgId,
      ...(input.type ? { type: input.type } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })
  return items.map((agreement) => ({ ...agreement, url: buildAgreementUrl(agreement.token) }))
}

export async function getPresignedPdfUrlForEntity(input: {
  entityType: EntityType
  entityId: string
  agreementId: string
  orgId: string
}): Promise<string> {
  const agreement = await prisma.agreement.findFirst({
    where: {
      id: input.agreementId,
      ...agreementScopeWhere(input.entityType, input.entityId),
      organizationId: input.orgId,
    },
    select: { signedPdfKey: true, status: true },
  })
  if (!agreement) throw new HTTPException(404, { message: 'Agreement not found' })
  if (agreement.status !== 'SIGNED' || !agreement.signedPdfKey) {
    throw new HTTPException(409, { message: 'Agreement is not signed yet' })
  }
  const url = await getSignedDownloadUrl(agreement.signedPdfKey, PRESIGNED_PDF_TTL_SECONDS)
  if (!url) throw new HTTPException(500, { message: 'Failed to generate download URL' })
  return url
}
