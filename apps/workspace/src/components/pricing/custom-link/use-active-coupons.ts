/**
 * Loads the org's active coupons for the custom-link discount picker.
 * Wraps `GET /coupons?active=true`; only active coupons can be pre-applied.
 */
import { useQuery } from '@tanstack/react-query'
import { api, type CouponSummary } from '../../../lib/api-client'

export interface UseActiveCouponsResult {
  coupons: CouponSummary[]
  loading: boolean
}

export function useActiveCoupons(enabled = true): UseActiveCouponsResult {
  const { data, isLoading } = useQuery({
    queryKey: ['coupons', 'active'],
    queryFn: () => api.coupons.list({ active: true }),
    enabled,
    staleTime: 60_000,
  })

  return { coupons: data?.coupons ?? [], loading: enabled && isLoading }
}
