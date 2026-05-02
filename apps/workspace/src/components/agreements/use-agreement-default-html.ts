/**
 * Entity-agnostic TanStack Query hook for fetching the default NDA HTML used
 * to seed the editor. Server endpoint only returns NDA template content; for
 * non-NDA types the wizard seeds from a templateId or empty editor instead.
 * Lazily enabled — only fires once the editor opens with NDA type.
 */
import { useQuery } from '@tanstack/react-query'
import { agreementsApi } from './use-agreement-mutations'
import type { EntityRef } from './types'

export const agreementDefaultHtmlKey = (entity: EntityRef) =>
  ['nda', entity.type, entity.id, 'default-html'] as const

export function useAgreementDefaultHtml(entity: EntityRef, enabled: boolean) {
  return useQuery({
    queryKey: agreementDefaultHtmlKey(entity),
    queryFn: () => agreementsApi(entity).getDefaultHtml(entity.id),
    enabled: enabled && !!entity.id,
    // Pin the default HTML for the editor session — prevents a refocus refetch
    // from overwriting the user's in-progress edits with a fresh template.
    staleTime: Infinity,
  })
}
