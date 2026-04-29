/**
 * Entity Upload Route (/upload/$token/e/$caseId)
 * Mirror of /u/$token/e/$caseId — renders the per-entity upload page.
 */
import { createFileRoute } from '@tanstack/react-router'
import { EntityUploadPage } from '../../../../../components/entity-upload-page'

function EntityUploadRoute() {
  const { token, caseId } = Route.useParams()
  return <EntityUploadPage token={token} caseId={caseId} />
}

export const Route = createFileRoute('/upload/$token/e/$caseId/')({
  component: EntityUploadRoute,
})
