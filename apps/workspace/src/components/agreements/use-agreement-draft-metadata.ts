import { useMemo } from 'react'
import type { Agreement } from '../../lib/api-client'

interface UseAgreementDraftMetadataInput {
  savedAgreement: Agreement | null
  language: string
  t: (key: string, options?: Record<string, unknown>) => string
}

export function useAgreementDraftMetadata({
  savedAgreement,
  language,
  t,
}: UseAgreementDraftMetadataInput): string | null {
  return useMemo(() => {
    if (!savedAgreement) return null
    const actor = savedAgreement.lastEditedBy?.name ?? savedAgreement.createdBy?.name
    const updatedAt = new Date(savedAgreement.updatedAt)
    const timestamp = Number.isNaN(updatedAt.getTime())
      ? ''
      : updatedAt.toLocaleString(language, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
    if (!actor && !timestamp) return null
    if (!actor) return t('agreements.draft.metadataTime', { time: timestamp })
    if (!timestamp) return t('agreements.draft.metadataActor', { name: actor })
    return t('agreements.draft.metadata', { name: actor, time: timestamp })
  }, [language, savedAgreement, t])
}
