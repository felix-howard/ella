/**
 * Entity-aware NDA read operations: list NDAs and resolve presigned PDF URL.
 */
import { HTTPException } from 'hono/http-exception'
import { prisma } from '../../lib/db'
import { getSignedDownloadUrl } from '../storage'
import { loadEntityWithOrg, type EntityType } from './entity-loader'
import { buildNdaUrl, ndaScopeWhere } from './nda-shared'

const PRESIGNED_PDF_TTL_SECONDS = 900 // 15 min

export async function listNdasForEntity(input: {
  entityType: EntityType
  entityId: string
  orgId: string
}) {
  // Existence check is org-scoped on the entity itself.
  await loadEntityWithOrg(input)

  const items = await prisma.ndaAgreement.findMany({
    where: {
      ...ndaScopeWhere(input.entityType, input.entityId),
      organizationId: input.orgId,
    },
    orderBy: { createdAt: 'desc' },
  })
  return items.map((nda) => ({ ...nda, url: buildNdaUrl(nda.token) }))
}

export async function getPresignedPdfUrlForEntity(input: {
  entityType: EntityType
  entityId: string
  ndaId: string
  orgId: string
}): Promise<string> {
  const nda = await prisma.ndaAgreement.findFirst({
    where: {
      id: input.ndaId,
      ...ndaScopeWhere(input.entityType, input.entityId),
      organizationId: input.orgId,
    },
    select: { signedPdfKey: true, status: true },
  })
  if (!nda) throw new HTTPException(404, { message: 'NDA not found' })
  if (nda.status !== 'SIGNED' || !nda.signedPdfKey) {
    throw new HTTPException(409, { message: 'NDA is not signed yet' })
  }
  const url = await getSignedDownloadUrl(nda.signedPdfKey, PRESIGNED_PDF_TTL_SECONDS)
  if (!url) throw new HTTPException(500, { message: 'Failed to generate download URL' })
  return url
}
