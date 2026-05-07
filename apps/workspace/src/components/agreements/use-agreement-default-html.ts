/**
 * Entity-agnostic TanStack Query hook for fetching built-in default HTML used
 * to seed the editor for NDA and Engagement Letter.
 */
import { useQuery } from '@tanstack/react-query'
import { agreementsApi } from './use-agreement-mutations'
import type { EntityRef } from './types'
import type { AgreementTemplateType } from '../../lib/api-client'

export const agreementDefaultHtmlKey = (entity: EntityRef, type: AgreementTemplateType) =>
  ['nda', entity.type, entity.id, 'default-html', type] as const

export function useAgreementDefaultHtml(entity: EntityRef, type: AgreementTemplateType, enabled: boolean) {
  return useQuery({
    queryKey: agreementDefaultHtmlKey(entity, type),
    queryFn: () => agreementsApi(entity).getDefaultHtml(entity.id, { type }),
    enabled: enabled && !!entity.id,
    // Pin the default HTML for the editor session — prevents a refocus refetch
    // from overwriting the user's in-progress edits with a fresh template.
    staleTime: Infinity,
  })
}
