/**
 * Hook to get current user's organization role from /staff/me
 * Returns orgRole ('org:admin' | 'org:member' | null), role booleans,
 * and semantic capability flags. Components should consume the capability
 * flags (canManageClients, canManageOrganizationSettings, canManagePayments, canManageAgreements,
 * canViewPhone, canViewTeam, canManageTeam) — never compare
 * role string literals directly.
 */
import { useQuery } from '@tanstack/react-query'
import { api, type OrgRole } from '../lib/api-client'

type StaffMe = Awaited<ReturnType<typeof api.staff.me>>

export function deriveOrgRoleCapabilities(data?: StaffMe) {
  const orgRole = (data?.orgRole as OrgRole) ?? null
  const hasStaffRecord = Boolean(data?.id)
  // App-level Staff.role is source of truth ('ADMIN' | 'MANAGER' | 'STAFF' | 'CPA')
  const isAdmin = orgRole === 'org:admin' || data?.role === 'ADMIN'
  const isManager = data?.role === 'MANAGER'

  return {
    orgRole,
    isAdmin,
    isManager,
    hasStaffRecord,
    canManageClients: isAdmin || isManager,
    canManageOrganizationSettings: isAdmin,
    canManageOwnIntakeLink: hasStaffRecord,
    canManageAnyIntakeLink: isAdmin,
    canManagePayments: isAdmin,
    canManageAgreements: isAdmin,
    canViewPhone: isAdmin,
    canViewTeam: hasStaffRecord,
    canManageTeam: isAdmin,
  }
}

export function useOrgRole() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['staff-me'],
    queryFn: () => api.staff.me(),
    staleTime: 60000, // Cache for 1 min
  })

  const capabilities = deriveOrgRoleCapabilities(data)

  return {
    orgRole: capabilities.orgRole,
    isAdmin: capabilities.isAdmin,
    isManager: capabilities.isManager,
    /** Create/edit/assign clients and leads (mirrors server admin-or-manager gates) */
    canManageClients: capabilities.canManageClients,
    /** Organization-wide settings such as firm info, org slug, defaults, and missed-call automation — ADMIN only */
    canManageOrganizationSettings: capabilities.canManageOrganizationSettings,
    /** Current active staff can edit their own personal intake link settings */
    canManageOwnIntakeLink: capabilities.canManageOwnIntakeLink,
    /** Admin can manage intake link settings for any active staff member */
    canManageAnyIntakeLink: capabilities.canManageAnyIntakeLink,
    /** Payment pages, quotes, payment links, and payment history — ADMIN only */
    canManagePayments: capabilities.canManagePayments,
    /** Agreement tab, send/manage actions, and agreement history — ADMIN only */
    canManageAgreements: capabilities.canManageAgreements,
    /** Full client phone numbers — ADMIN only (mirrors server canViewFullPhone; server masks for others) */
    canViewPhone: capabilities.canViewPhone,
    /** Team nav/page profile access — any active org staff record */
    canViewTeam: capabilities.canViewTeam,
    /** Team invite, role change, archive — ADMIN only */
    canManageTeam: capabilities.canManageTeam,
    isLoading,
    isError,
    staffId: data?.id ?? null,
    avatarUrl: data?.avatarUrl ?? null,
  }
}
