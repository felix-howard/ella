/**
 * Entity Upload Route (/u/$token/e/$caseId)
 * Renders the per-entity upload + uploaded files page.
 */
import { createFileRoute } from '@tanstack/react-router'
import { EntityUploadPage } from '../../../../../components/entity-upload-page'

function EntityUploadRoute() {
  const { token, caseId } = Route.useParams()
  return <EntityUploadPage token={token} caseId={caseId} />
}

export const Route = createFileRoute('/u/$token/e/$caseId/')({
  component: EntityUploadRoute,
})
