/**
 * Clerk Auth Provider - Sets up auth token for API client
 * Waits for Clerk to be fully loaded before rendering children
 * to prevent 401 race conditions on initial page load
 * Clears query cache on sign out to prevent stale refetch requests
 * Auto-selects first org for signed-in users with no active org
 */
import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { setAuthTokenGetter } from '../../lib/api-client'
import { useAutoOrgSelection } from '../../hooks/use-auto-org-selection'

interface ClerkAuthProviderProps {
  children: React.ReactNode
}

export function ClerkAuthProvider({ children }: ClerkAuthProviderProps) {
  const { t } = useTranslation()
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const { isLoaded: isOrgLoaded, hasOrg, orgId, isSelecting } = useAutoOrgSelection()
  const queryClient = useQueryClient()
  const wasSignedIn = useRef(false)

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

  // Clear query cache when user signs out
  // This prevents background refetch from making 401 requests
  useEffect(() => {
    if (isLoaded) {
      if (wasSignedIn.current && !isSignedIn) {
        // User just signed out - clear all queries
        queryClient.clear()
      }
      wasSignedIn.current = !!isSignedIn
    }
  }, [isLoaded, isSignedIn, queryClient])

  // Don't render children until Clerk is fully loaded
  // This prevents API calls from firing before auth token is available
  if (!isLoaded) {
    return null
  }

  // Wait for auto-org selection to complete before rendering the app
  // This prevents redirect loops where session is pending org selection
  if (isSignedIn && isOrgLoaded && hasOrg && !orgId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  // Show message if signed-in user has no organization
  if (isSignedIn && isOrgLoaded && !hasOrg) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-6 max-w-md">
          <h2 className="text-lg font-semibold mb-2">{t('org.noOrg')}</h2>
          <p className="text-muted-foreground">{t('org.noOrgDesc')}</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
