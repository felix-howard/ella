/**
 * React-query hooks for the coupon management panel.
 * - `useCoupons()` loads the full list (all statuses) for the table.
 * - `useCreateCoupon()` / `useDisableCoupon()` mutate then invalidate the whole
 *   `['coupons']` key, which also refreshes the Phase 5 active-coupon picker
 *   (queryKey `['coupons', 'active']`).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type CouponSummary, type CreateCouponInput } from '../../../../lib/api-client'

export interface UseCouponsResult {
  coupons: CouponSummary[]
  loading: boolean
  error: Error | null
}

export function useCoupons(): UseCouponsResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['coupons', 'all'],
    queryFn: () => api.coupons.list(),
    staleTime: 30_000,
  })

  return {
    coupons: data?.coupons ?? [],
    loading: isLoading,
    error: error instanceof Error ? error : null,
  }
}

export function useCreateCoupon() {
  const queryClient = useQueryClient()
  return useMutation<CouponSummary, Error, CreateCouponInput>({
    mutationFn: (input) => api.coupons.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coupons'] }),
  })
}

export function useDisableCoupon() {
  const queryClient = useQueryClient()
  return useMutation<CouponSummary, Error, string>({
    mutationFn: (id) => api.coupons.disable(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coupons'] }),
  })
}
