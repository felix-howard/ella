/**
 * Hook to get current user's organization role from /staff/me
 * Returns orgRole ('org:admin' | 'org:member' | null) and isAdmin boolean
 */
import { useQuery } from '@tanstack/react-query'
import { api, type OrgRole } from '../lib/api-client'

export function useOrgRole() {
  const { data, isLoading } = useQuery({
    queryKey: ['staff-me'],
    queryFn: () => api.staff.me(),
    staleTime: 60000, // Cache for 1 min
  })

  const orgRole = (data?.orgRole as OrgRole) ?? null

  return {
    orgRole,
    isAdmin: orgRole === 'org:admin' || data?.role === 'ADMIN',
    isLoading,
    staffId: data?.id ?? null,
  }
}
