/**
 * Hook to auto-select the first Clerk organization when user has no active org.
 * MVP: single org per user; silently selects first available org on sign-in.
 * Returns hasOrg, isSelecting for loading gates in ClerkAuthProvider.
 */
import { useEffect, useState } from 'react'
import { useAuth, useOrganizationList } from '@clerk/clerk-react'

export function useAutoOrgSelection() {
  const { isSignedIn, orgId } = useAuth()
  const { isLoaded, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  })
  const [isSelecting, setIsSelecting] = useState(false)

  const membershipData = userMemberships?.data
  const isFetching = userMemberships?.isLoading ?? false
  const hasOrg = (membershipData?.length ?? 0) > 0
  // Only consider fully loaded when hook is loaded AND not fetching data
  const isFullyLoaded = isLoaded && !isFetching

  useEffect(() => {
    if (!isSignedIn || orgId || !setActive || !isLoaded) return
    const firstOrg = membershipData?.[0]
    if (firstOrg) {
      setIsSelecting(true)
      setActive({ organization: firstOrg.organization.id })
        .catch(() => {
          // Silent fail - user can manually select org later
        })
        .finally(() => setIsSelecting(false))
    }
  }, [isSignedIn, orgId, setActive, isLoaded, membershipData])

  return {
    isLoaded: isFullyLoaded,
    hasOrg,
    orgId,
    isSelecting,
  }
}
