/**
 * TanStack Query hook for fetching the default NDA HTML to seed the editor.
 * Lazily enabled — only fires once the editor modal is opened.
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../lib/api-client'

export const ndaDefaultHtmlKey = (leadId: string) =>
  ['lead', leadId, 'nda', 'default-html'] as const

export function useNdaDefaultHtml(leadId: string, enabled: boolean) {
  return useQuery({
    queryKey: ndaDefaultHtmlKey(leadId),
    queryFn: () => api.leads.nda.getDefaultHtml(leadId),
    enabled: enabled && !!leadId,
    // Pin the default HTML for the editor session — prevents a refocus refetch
    // from overwriting the user's in-progress edits with a fresh template.
    staleTime: Infinity,
  })
}
