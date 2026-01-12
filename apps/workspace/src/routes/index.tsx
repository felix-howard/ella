import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@ella/ui'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold text-foreground mb-4">Ella Workspace</h1>
      <p className="text-muted-foreground mb-6">Staff and CPA dashboard</p>
      <Button variant="secondary">Sign In</Button>
    </main>
  )
}
