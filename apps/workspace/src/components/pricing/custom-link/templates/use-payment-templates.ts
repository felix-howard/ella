import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  api,
  type CreatePaymentTemplateInput,
  type PaymentTemplateSummary,
  type UpdatePaymentTemplateInput,
} from '../../../../lib/api-client'

export interface UsePaymentTemplatesResult {
  templates: PaymentTemplateSummary[]
  loading: boolean
  error: Error | null
}

export function usePaymentTemplates(): UsePaymentTemplatesResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['payment-templates'],
    queryFn: () => api.billing.listPaymentTemplates(),
    staleTime: 30_000,
  })

  return {
    templates: data?.templates ?? [],
    loading: isLoading,
    error: error instanceof Error ? error : null,
  }
}

export function useCreatePaymentTemplate() {
  const queryClient = useQueryClient()
  return useMutation<PaymentTemplateSummary, Error, CreatePaymentTemplateInput>({
    mutationFn: (input) => api.billing.createPaymentTemplate(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payment-templates'] }),
  })
}

export function useUpdatePaymentTemplate() {
  const queryClient = useQueryClient()
  return useMutation<
    PaymentTemplateSummary,
    Error,
    { id: string; data: UpdatePaymentTemplateInput }
  >({
    mutationFn: ({ id, data }) => api.billing.updatePaymentTemplate(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payment-templates'] }),
  })
}

export function useArchivePaymentTemplate() {
  const queryClient = useQueryClient()
  return useMutation<PaymentTemplateSummary, Error, string>({
    mutationFn: (id) => api.billing.archivePaymentTemplate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payment-templates'] }),
  })
}
