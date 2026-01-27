import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/clients-v2/$clientId')({
  component: ClientDetailPageV2,
})

function ClientDetailPageV2() {
  const { clientId } = Route.useParams()

  return (
    <main className="ml-[var(--sidebar-width)] p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">
          Chi tiết khách hàng (V2)
        </h1>
        <p className="text-muted-foreground">
          Client ID: {clientId}
        </p>
      </div>
    </main>
  )
}
