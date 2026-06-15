/**
 * Hook to get current user's organization role from /staff/me
 * Returns orgRole ('org:admin' | 'org:member' | null), role booleans,
 * and semantic capability flags. Components should consume the capability
 * flags (canManageClients, canManagePayments, canViewPhone, canViewTeam, canManageTeam) — never compare
 * role string literals directly.
 */
import { useQuery } from '@tanstack/react-query'
import { api, type OrgRole } from '../lib/api-client'

export function useOrgRole() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['staff-me'],
    queryFn: () => api.staff.me(),
    staleTime: 60000, // Cache for 1 min
  })

  const orgRole = (data?.orgRole as OrgRole) ?? null
  // App-level Staff.role is source of truth ('ADMIN' | 'MANAGER' | 'STAFF' | 'CPA')
  const isAdmin = orgRole === 'org:admin' || data?.role === 'ADMIN'
  const isManager = data?.role === 'MANAGER'

  return {
    orgRole,
    isAdmin,
    isManager,
    /** Create/edit/assign clients, leads, org config UI (mirrors server admin-or-manager gates) */
    canManageClients: isAdmin || isManager,
    /** Payment pages, quotes, payment links, and payment history — ADMIN only */
    canManagePayments: isAdmin,
    /** Full client phone numbers — ADMIN only (mirrors server canViewFullPhone; server masks for others) */
    canViewPhone: isAdmin,
    /** Team nav/page profile access — any active org staff record */
    canViewTeam: Boolean(data?.id),
    /** Team invite, role change, archive — ADMIN only */
    canManageTeam: isAdmin,
    isLoading,
    isError,
    staffId: data?.id ?? null,
    avatarUrl: data?.avatarUrl ?? null,
  }
}
