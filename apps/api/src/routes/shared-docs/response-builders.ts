/**
 * Response builders for shared-docs endpoints.
 * Keeps handler code DRY when serializing ShareableDocument + MagicLink to JSON.
 */
import { PORTAL_URL } from '../../lib/constants'

type DocLike = {
  id: string
  title: string
  version: number
  filename: string
  fileSize: number
  status: string
  viewCount: number
  lastViewedAt: Date | null
  createdAt: Date
  uploadedBy: { id: string; name: string }
}

type LinkLike = {
  token: string
  expiresAt: Date | null
  isActive: boolean
  usageCount: number
  lastUsedAt: Date | null
}

export function buildPortalUrl(token: string): string {
  return `${PORTAL_URL}/draft/${token}`
}

export function serializeDocument(doc: DocLike) {
  return {
    id: doc.id,
    title: doc.title,
    version: doc.version,
    filename: doc.filename,
    fileSize: doc.fileSize,
    status: doc.status,
    viewCount: doc.viewCount,
    lastViewedAt: doc.lastViewedAt?.toISOString() ?? null,
    uploadedAt: doc.createdAt.toISOString(),
    uploadedBy: doc.uploadedBy,
  }
}

export function serializeMagicLink(link: LinkLike) {
  return {
    token: link.token,
    url: buildPortalUrl(link.token),
    expiresAt: link.expiresAt?.toISOString() ?? null,
    isActive: link.isActive,
    usageCount: link.usageCount,
    lastUsedAt: link.lastUsedAt?.toISOString() ?? null,
  }
}
