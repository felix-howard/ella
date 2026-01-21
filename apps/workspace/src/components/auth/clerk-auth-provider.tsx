/**
 * Clerk Auth Provider - Sets up auth token for API client
 * Waits for Clerk to be fully loaded before rendering children
 * to prevent 401 race conditions on initial page load
 * Clears query cache on sign out to prevent stale refetch requests
 */
import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQueryClient } from '@tanstack/react-query'
import { setAuthTokenGetter } from '../../lib/api-client'

interface ClerkAuthProviderProps {
  children: React.ReactNode
}

export function ClerkAuthProvider({ children }: ClerkAuthProviderProps) {
  const { getToken, isLoaded, isSignedIn } = useAuth()
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

  return <>{children}</>
}
