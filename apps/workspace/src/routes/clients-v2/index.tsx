import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/clients-v2/')({
  component: ClientListPageV2,
})

function ClientListPageV2() {
  return (
    <main className="ml-[var(--sidebar-width)] p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">
          Khách hàng (V2 Beta)
        </h1>
        <p className="text-muted-foreground">
          Đang phát triển...
        </p>
      </div>
    </main>
  )
}
