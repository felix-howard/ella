/**
 * Hook to auto-select the first Clerk organization when user has no active org.
 * MVP: single org per user; silently selects first available org on sign-in.
 * Returns hasOrg (user has at least one org) for zero-org edge case handling.
 */
import { useEffect } from 'react'
import { useAuth, useOrganizationList } from '@clerk/clerk-react'

export function useAutoOrgSelection() {
  const { isSignedIn, orgId } = useAuth()
  const { isLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  })

  const membershipData = userMemberships?.data
  const hasOrg = (membershipData?.length ?? 0) > 0

  useEffect(() => {
    if (!isSignedIn || orgId || !setActive || !isLoaded) return
    const firstOrg = membershipData?.[0]
    if (firstOrg) {
      setActive({ organization: firstOrg.organization.id }).catch(() => {
        // Silent fail - user can manually select org later
      })
    }
  }, [isSignedIn, orgId, setActive, isLoaded, membershipData])

  return {
    isLoaded,
    hasOrg,
    orgId,
  }
}
