/**
 * Entity-agnostic TanStack Query hook for fetching the default NDA HTML used
 * to seed the editor. Lazily enabled — only fires once the editor modal opens.
 */
import { useQuery } from '@tanstack/react-query'
import { ndaApi } from './use-nda-mutations'
import type { EntityRef } from './types'

export const ndaDefaultHtmlKey = (entity: EntityRef) =>
  ['nda', entity.type, entity.id, 'default-html'] as const

export function useNdaDefaultHtml(entity: EntityRef, enabled: boolean) {
  return useQuery({
    queryKey: ndaDefaultHtmlKey(entity),
    queryFn: () => ndaApi(entity).getDefaultHtml(entity.id),
    enabled: enabled && !!entity.id,
    // Pin the default HTML for the editor session — prevents a refocus refetch
    // from overwriting the user's in-progress edits with a fresh template.
    staleTime: Infinity,
  })
}
