/**
 * 1099-NEC Tab - Contractor management for business clients
 * Shows contractor table with CRUD operations
 * Phase 1: Basic table + add/edit/delete
 * Phase 2+: Excel upload, Tax1099 integration, PDF generation
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, AlertCircle, RefreshCw, Plus } from 'lucide-react'
import { Button } from '@ella/ui'
import { api, type Contractor, type CreateContractorInput, type UpdateContractorInput } from '../../../../lib/api-client'
import { ContractorTable } from './contractor-table'
import { ContractorFormModal } from './contractor-form-modal'

interface Form1099NECTabProps {
  clientId: string
  clientName: string
}

export function Form1099NECTab({ clientId, clientName }: Form1099NECTabProps) {
  const queryClient = useQueryClient()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['contractors', clientId],
    queryFn: () => api.contractors.list(clientId),
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateContractorInput) => api.contractors.create(clientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractors', clientId] })
      setIsFormOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateContractorInput }) =>
      api.contractors.update(clientId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractors', clientId] })
      setEditingContractor(null)
      setIsFormOpen(false)
    },
  })

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.contractors.delete(clientId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractors', clientId] })
      setDeletingId(null)
    },
    onError: () => {
      setDeletingId(null)
    },
  })

  const contractors = data?.data ?? []

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
            {error instanceof Error ? error.message : 'Failed to load contractors'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const handleEdit = (contractor: Contractor) => {
    setEditingContractor(contractor)
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingContractor(null)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">1099-NEC Contractors</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {contractors.length === 0
                ? 'No contractors added yet'
                : `${contractors.length} contractor${contractors.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsFormOpen(true)}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Contractor
            </Button>
          </div>
        </div>

        {/* Contractor Table or Empty State */}
        {contractors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Plus className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-1">Add your first contractor</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Add contractors who received payments for {clientName}. You can also upload an Excel file with contractor data in the next phase.
            </p>
          </div>
        ) : (
          <ContractorTable
            contractors={contractors}
            onEdit={handleEdit}
            onDelete={(id) => {
              setDeletingId(id)
              deleteMutation.mutate(id)
            }}
            deletingId={deletingId}
          />
        )}
      </div>

      {/* Add/Edit Contractor Modal */}
      <ContractorFormModal
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSubmit={(data) => {
          if (editingContractor) {
            updateMutation.mutate({ id: editingContractor.id, data })
          } else {
            createMutation.mutate(data as CreateContractorInput)
          }
        }}
        contractor={editingContractor}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  )
}
