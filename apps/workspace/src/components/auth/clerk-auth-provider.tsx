/**
 * Clerk Auth Provider - Sets up auth token for API client
 */
import { useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { setAuthTokenGetter } from '../../lib/api-client'

interface ClerkAuthProviderProps {
  children: React.ReactNode
}

export function ClerkAuthProvider({ children }: ClerkAuthProviderProps) {
  const { getToken } = useAuth()

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

  return <>{children}</>
}
