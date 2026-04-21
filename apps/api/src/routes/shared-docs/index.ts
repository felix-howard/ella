/**
 * Shared Docs Routes (Workspace - Authenticated)
 * Multi-section document sharing per tax case — each section has its own magic link
 * and version history. Replaces the legacy `/draft-returns/*` route group.
 */
import { Hono } from 'hono'
import type { AuthVariables } from '../../middleware/auth'
import {
  createSection,
  listSections,
  getSection,
  renameSection,
  deleteSection,
} from './crud-handlers'
import {
  uploadVersion,
  getSignedUrl,
  getVersionSignedUrl,
} from './version-handlers'
import { revokeSection, extendSection } from './link-handlers'

const sharedDocsRoute = new Hono<{ Variables: AuthVariables }>()

// List sections for a case
sharedDocsRoute.get('/case/:caseId', listSections)

// Create new section
sharedDocsRoute.post('/:caseId', createSection)

// Section detail + rename + soft delete
sharedDocsRoute.get('/:id', getSection)
sharedDocsRoute.patch('/:id', renameSection)
sharedDocsRoute.delete('/:id', deleteSection)

// Versions
sharedDocsRoute.post('/:id/version', uploadVersion)
sharedDocsRoute.get('/:id/signed-url', getSignedUrl)
sharedDocsRoute.get('/:id/version/:version/signed-url', getVersionSignedUrl)

// Magic link lifecycle
sharedDocsRoute.post('/:id/revoke', revokeSection)
sharedDocsRoute.post('/:id/extend', extendSection)

export { sharedDocsRoute }
