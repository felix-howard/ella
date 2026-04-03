/**
 * Businesses tab - lists all businesses for a client
 * Shows empty state when no businesses, Add Business button
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, AlertCircle, RefreshCw, Plus, Building2 } from 'lucide-react'
import { Button } from '@ella/ui'
import { api } from '../../lib/api-client'
import { BusinessCard } from './business-card'
import { BusinessFormModal } from './business-form-modal'

interface BusinessesTabProps {
  clientId: string
  clientName: string
}

export function BusinessesTab({ clientId, clientName }: BusinessesTabProps) {
  const [isAddOpen, setIsAddOpen] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['businesses', clientId],
    queryFn: () => api.businesses.list(clientId),
  })

  const businesses = data?.data ?? []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-card rounded-xl border border-destructive/30 p-6">
        <div className="flex flex-col items-center text-center py-6">
          <AlertCircle className="w-10 h-10 text-destructive mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'Failed to load businesses'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with Add button */}
      {businesses.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {businesses.length} business{businesses.length !== 1 ? 'es' : ''}
          </p>
          <Button size="sm" onClick={() => setIsAddOpen(true)} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Add Business
          </Button>
        </div>
      )}

      {/* Empty State */}
      {businesses.length === 0 && (
        <div className="bg-card rounded-xl border border-border p-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <Building2 className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">No businesses yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm mb-4">
              Add a business to manage contractors and file 1099-NECs for {clientName}.
            </p>
            <Button size="sm" onClick={() => setIsAddOpen(true)} className="gap-1.5">
              <Plus className="w-4 h-4" />
              Add Business
            </Button>
          </div>
        </div>
      )}

      {/* Business Cards */}
      {businesses.map((business, idx) => (
        <BusinessCard
          key={business.id}
          business={business}
          clientId={clientId}
          clientName={clientName}
          defaultExpanded={businesses.length === 1 || idx === 0}
        />
      ))}

      {/* Add Business Modal */}
      <BusinessFormModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        clientId={clientId}
      />
    </div>
  )
}
