/**
 * Portal Home/Landing Page
 * Redirects to magic link or shows error for direct access
 */
import { createFileRoute } from '@tanstack/react-router'
import { FileQuestion } from 'lucide-react'

export const Route = createFileRoute('/')({
  component: PortalHomePage,
})

function PortalHomePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      {/* Logo */}
      <div className="mb-6">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <span className="text-4xl font-bold text-primary">E</span>
        </div>
      </div>

      {/* Message */}
      <div className="mb-8">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <FileQuestion className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">
          Ella Portal
        </h1>
        <p className="text-muted-foreground max-w-xs">
          Vui lòng sử dụng link được gửi qua tin nhắn để truy cập portal.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Please use the link sent via SMS to access the portal.
        </p>
      </div>

      {/* Footer */}
      <footer className="text-xs text-muted-foreground">
        © 2026 Ella Tax Document System
      </footer>
    </main>
  )
}
