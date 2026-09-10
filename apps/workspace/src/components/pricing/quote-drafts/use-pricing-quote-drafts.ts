import { useAuth } from '@clerk/clerk-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  api,
  type CreatePricingQuoteDraftInput,
  type UpdatePricingQuoteDraftInput,
} from '../../../lib/api-client'

export const pricingQuoteDraftKeys = {
  list: (orgId: string | null | undefined) => ['pricing-quote-drafts', orgId] as const,
}

export function usePricingQuoteDrafts() {
  const { orgId } = useAuth()
  return useQuery({
    queryKey: pricingQuoteDraftKeys.list(orgId),
    queryFn: () => api.billing.listPricingQuoteDrafts(),
    enabled: Boolean(orgId),
    staleTime: 30_000,
  })
}

export function usePricingQuoteDraftMutations() {
  const { orgId } = useAuth()
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: pricingQuoteDraftKeys.list(orgId) })
  const create = useMutation({
    mutationFn: (input: CreatePricingQuoteDraftInput) => api.billing.createPricingQuoteDraft(input),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePricingQuoteDraftInput }) =>
      api.billing.updatePricingQuoteDraft(id, data),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.billing.deletePricingQuoteDraft(id),
    onSuccess: invalidate,
  })
  // Loading is an explicit fresh read, never a write or a cached snapshot replacement.
  const load = useMutation({ mutationFn: (id: string) => api.billing.getPricingQuoteDraft(id) })
  return { create, update, remove, load }
}
