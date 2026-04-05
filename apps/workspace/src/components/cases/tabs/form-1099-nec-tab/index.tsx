/**
 * 1099-NEC Tab - Contractor management for business clients
 * Shows contractor table with CRUD operations
 * Supports Excel upload with review table for bulk import
 */
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, AlertCircle, RefreshCw, Plus, Upload, Trash2 } from 'lucide-react'
import { Button, Modal, ModalHeader, ModalTitle, ModalFooter } from '@ella/ui'
import { api, type Contractor, type CreateContractorInput, type UpdateContractorInput, type ParseResult, type ParsedContractor } from '../../../../lib/api-client'
import { toast } from '../../../../stores/toast-store'
import { ContractorTable } from './contractor-table'
import { ContractorFormModal } from './contractor-form-modal'
import { ContractorReviewTable } from './contractor-review-table'
import { FormActionsPanel } from './form-actions-panel'
import { FilingStatusPanel } from './filing-status-panel'

interface Form1099NECTabProps {
  businessId: string
  clientName: string
}

export function Form1099NECTab({ businessId, clientName }: Form1099NECTabProps) {
  const queryClient = useQueryClient()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['contractors', businessId],
    queryFn: () => api.contractors.list(businessId),
  })

  // Invalidate businesses list to update contractorCount on cards
  const invalidateBusinesses = () => queryClient.invalidateQueries({ queryKey: ['businesses'] })

  const createMutation = useMutation({
    mutationFn: (data: CreateContractorInput) => api.contractors.create(businessId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractors', businessId] })
      invalidateBusinesses()
      setIsFormOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateContractorInput }) =>
      api.contractors.update(businessId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractors', businessId] })
      setEditingContractor(null)
      setIsFormOpen(false)
    },
  })

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.contractors.delete(businessId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractors', businessId] })
      invalidateBusinesses()
      setDeletingId(null)
    },
    onError: () => {
      setDeletingId(null)
    },
  })

  const [showDeleteAll, setShowDeleteAll] = useState(false)

  const deleteAllMutation = useMutation({
    mutationFn: () => api.contractors.deleteAll(businessId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contractors', businessId] })
      queryClient.invalidateQueries({ queryKey: ['form-1099-status', businessId] })
      invalidateBusinesses()
      toast.success(`Deleted ${data.count} contractors`)
      setShowDeleteAll(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete contractors')
      setShowDeleteAll(false)
    },
  })

  const bulkSaveMutation = useMutation({
    mutationFn: (contractors: ParsedContractor[]) =>
      api.contractors.bulkSave(businessId, {
        contractors: contractors.map((c) => ({
          firstName: c.firstName,
          lastName: c.lastName,
          ssn: c.ssn,
          address: c.address,
          city: c.city,
          state: c.state,
          zip: c.zip,
          email: c.email || '',
          amountPaid: c.amountPaid,
        })),
        taxYear: contractors[0]?.taxYear ?? new Date().getFullYear(),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contractors', businessId] })
      invalidateBusinesses()
      setParseResult(null)
      toast.success(`${data.count} contractors saved`)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to save contractors')
    },
  })

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.name.match(/\.xlsx?$/i)) { toast.error('Only .xlsx/.xls files supported'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('File must be under 5MB'); return }

    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const result = await api.contractors.uploadExcel(businessId, formData)
      if (result.data.errors.length > 0) { toast.error(result.data.errors.join('. ')); return }
      if (result.data.contractors.length === 0) { toast.error('No contractors found in file. Check the Excel format.'); return }
      setParseResult(result.data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

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

  // Review table after Excel parse
  if (parseResult) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <ContractorReviewTable
          contractors={parseResult.contractors}
          taxYear={parseResult.taxYear}
          businessName={parseResult.businessName}
          onSave={(reviewed) => bulkSaveMutation.mutate(reviewed)}
          onCancel={() => setParseResult(null)}
          isSaving={bulkSaveMutation.isPending}
        />
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
            {contractors.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteAll(true)}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
                Delete All
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="gap-1.5"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {isUploading ? 'Uploading...' : 'Upload Excel'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
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
              Add contractors who received payments for {clientName}, or upload an Excel file to import them in bulk.
            </p>
          </div>
        ) : contractors.length > 0 ? (
          <ContractorTable
            contractors={contractors}
            businessId={businessId}
            onEdit={handleEdit}
            onDelete={(id) => {
              setDeletingId(id)
              deleteMutation.mutate(id)
            }}
            deletingId={deletingId}
          />
        ) : null}
      </div>

      {/* TaxBandits Actions Panel */}
      {contractors.length > 0 && (
        <FormActionsPanel businessId={businessId} />
      )}

      {/* Filing History */}
      {contractors.length > 0 && (
        <FilingStatusPanel businessId={businessId} />
      )}

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

      {/* Delete All Confirmation Modal */}
      <Modal open={showDeleteAll} onClose={() => setShowDeleteAll(false)}>
        <ModalHeader>
          <ModalTitle>Delete All Contractors</ModalTitle>
        </ModalHeader>
        <div className="p-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete all <span className="font-semibold text-foreground">{contractors.length}</span> contractors
            and their associated 1099-NEC forms? This action cannot be undone.
          </p>
        </div>
        <ModalFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteAll(false)}
            disabled={deleteAllMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteAllMutation.mutate()}
            disabled={deleteAllMutation.isPending}
            className="gap-1.5"
          >
            {deleteAllMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Delete All
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
