/**
 * Clerk Auth Provider - Sets up auth token for API client
 * Waits for Clerk to be fully loaded AND token to be available before rendering children
 * to prevent 401 race conditions on initial page load
 * Clears query cache on sign out to prevent stale refetch requests
 * Auto-selects first org for signed-in users with no active org
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth, useClerk } from '@clerk/clerk-react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { setAuthTokenGetter, setDisabledAccountHandler } from '../../lib/api-client'
import { useAutoOrgSelection } from '../../hooks/use-auto-org-selection'
import { DisabledAccountScreen } from './disabled-account-screen'

interface ClerkAuthProviderProps {
  children: React.ReactNode
}

export function ClerkAuthProvider({ children }: ClerkAuthProviderProps) {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const { signOut } = useClerk()
  const { isLoaded: isOrgLoaded, hasOrg, orgId, isSelecting } = useAutoOrgSelection()
  const queryClient = useQueryClient()
  const wasSignedIn = useRef(false)
  const [isTokenReady, setIsTokenReady] = useState(false)
  const [isDisabledAccount, setIsDisabledAccount] = useState(false)

  useEffect(() => {
    // Set the token getter for the API client
    setAuthTokenGetter(async () => {
      try {
        return await getToken()
      } catch {
        return null
      }
    })
  }, [getToken])

  useEffect(() => {
    setDisabledAccountHandler(() => setIsDisabledAccount(true))
    return () => setDisabledAccountHandler(null)
  }, [])

  const handleDisabledAccountSignOut = useCallback(async () => {
    queryClient.clear()
    setIsDisabledAccount(false)
    await signOut()
    window.location.assign('/login')
  }, [queryClient, signOut])

  // Verify token is obtainable when signed in
  // This prevents 401 errors during login transition
  // CRITICAL: When isSignedIn transitions false→true, we must wait for token
  // before rendering children. When false, render immediately so login page shows.
  useEffect(() => {
    if (!isLoaded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsTokenReady(false)
      return
    }

    if (!isSignedIn) {
      // Not signed in - allow rendering for public pages (login)
      // Also handles sign-out: clear cache if user was previously signed in
      if (wasSignedIn.current) {
        queryClient.clear()
      }
      wasSignedIn.current = false
      setIsDisabledAccount(false)
      setIsTokenReady(true)
      return
    }

    // Signed in - always re-verify token before rendering children
    // This catches the login transition where isSignedIn just became true
    // Clear stale query cache (e.g. 401 errors from pre-login requests)
    // so dashboard doesn't throw cached errors via useSuspenseQuery
    if (!wasSignedIn.current) {
      queryClient.clear()
    }
    wasSignedIn.current = true
    setIsTokenReady(false)
    let cancelled = false
    const verifyToken = async () => {
      try {
        const token = await getToken()
        if (!cancelled && token) {
          setIsTokenReady(true)
        } else if (!cancelled) {
          // Token not ready yet, retry after short delay
          setTimeout(verifyToken, 100)
        }
      } catch {
        if (!cancelled) {
          // Retry on error
          setTimeout(verifyToken, 100)
        }
      }
    }
    verifyToken()

    return () => {
      cancelled = true
    }
  }, [isLoaded, isSignedIn, getToken, queryClient])

  // Don't render children until Clerk is fully loaded AND token is verified
  // This prevents API calls from firing before auth token is available
  if (!isLoaded || !isTokenReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (isSignedIn && isDisabledAccount) {
    return <DisabledAccountScreen onSignOut={handleDisabledAccountSignOut} />
  }

  // Wait for org data to load and auto-selection to complete
  // This prevents flash of "No Organization" during initial load
  if (isSignedIn && (!isOrgLoaded || isSelecting || (hasOrg && !orgId))) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  // Internal workspace: signed-in users without the only Clerk org no longer have app access.
  if (isSignedIn && isOrgLoaded && !hasOrg) {
    return <DisabledAccountScreen onSignOut={handleDisabledAccountSignOut} />
  }

  return <>{children}</>
}
