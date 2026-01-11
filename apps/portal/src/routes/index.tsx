import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@ella/ui'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold text-foreground mb-4">
        Ella Portal
      </h1>
      <p className="text-muted-foreground mb-6">
        Client document upload portal
      </p>
      <Button>Get Started</Button>
    </main>
  )
}
