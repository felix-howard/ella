import './lib/i18n'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClerkProvider } from '@clerk/clerk-react'
import { ClerkAuthProvider } from './components/auth/clerk-auth-provider'
import { routeTree } from './routeTree.gen'
import './styles.css'

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY environment variable')
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't retry auth errors (401/403) — they aren't transient
      retry: (failureCount, error) => {
        if (error && 'status' in error && (error.status === 401 || error.status === 403)) {
          return false
        }
        return failureCount < 3
      },
    },
  },
})
const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <QueryClientProvider client={queryClient}>
        <ClerkAuthProvider>
          <RouterProvider router={router} />
        </ClerkAuthProvider>
      </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>
)
