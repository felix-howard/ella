/**
 * 1099-NEC Tab - Contractor management for business clients
 * Shows contractor table with CRUD operations
 * Supports Excel upload with review table for bulk import
 */
import { useState, useRef, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, AlertCircle, RefreshCw, Plus, Upload, Trash2, Link2, Search, ExternalLink, Copy } from 'lucide-react'
import { Button, Modal, ModalHeader, ModalTitle, ModalFooter, cn } from '@ella/ui'
import { api, type Contractor, type CreateContractorInput, type UpdateContractorInput, type ParseResult, type ParsedContractor } from '../../../../lib/api-client'
import { toast } from '../../../../stores/toast-store'
import { PORTAL_BASE_URL } from '../../../../lib/constants'
import { ContractorTable } from './contractor-table'
import { ContractorFormModal } from './contractor-form-modal'
import { ContractorReviewTable } from './contractor-review-table'
import { FormActionsPanel } from './form-actions-panel'
import { FilingStatusPanel } from './filing-status-panel'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  IMPORTED: 'Created',
  PDF_READY: 'Ready',
  SUBMITTED: 'Transmitted',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
}

const STATUS_ORDER = ['DRAFT', 'IMPORTED', 'PDF_READY', 'SUBMITTED', 'ACCEPTED', 'REJECTED']

const PAGE_SIZE = 10

interface Form1099NECTabProps {
  businessId: string
  clientId: string
  clientName: string
}

export function Form1099NECTab({ businessId, clientId, clientName }: Form1099NECTabProps) {
  const queryClient = useQueryClient()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isShareLoading, setIsShareLoading] = useState(false)
  const [intakeFormUrl, setIntakeFormUrl] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortField, setSortField] = useState<'name' | 'city' | 'state' | 'status' | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

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

  const handleShareIntakeLink = async () => {
    if (intakeFormUrl) {
      setIntakeFormUrl(null)
      return
    }
    setIsShareLoading(true)
    try {
      // Check for existing active token
      let tokenData = await api.businesses.intakeToken.get(clientId, businessId)

      // If no active token, create one
      if (!tokenData.data) {
        tokenData = await api.businesses.intakeToken.create(clientId, businessId)
      }

      const portalUrl = PORTAL_BASE_URL + '/contractor-intake/' + tokenData.data!.token
      setIntakeFormUrl(portalUrl)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate intake link')
    } finally {
      setIsShareLoading(false)
    }
  }

  const handleCopyIntakeLink = async () => {
    if (!intakeFormUrl) return
    await navigator.clipboard.writeText(intakeFormUrl)
    toast.success('Intake form link copied to clipboard')
  }

  const contractors = data?.data ?? []

  const filteredContractors = useMemo(() => {
    let result = contractors
    if (statusFilter) {
      result = result.filter(c => (c.formStatus || 'DRAFT') === statusFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(c =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.ssnLast4?.includes(q) ||
        c.city?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q)
      )
    }
    if (sortField) {
      result = [...result].sort((a, b) => {
        let aVal: string, bVal: string
        switch (sortField) {
          case 'name': aVal = `${a.firstName} ${a.lastName}`; bVal = `${b.firstName} ${b.lastName}`; break
          case 'city': aVal = a.city || ''; bVal = b.city || ''; break
          case 'state': aVal = a.state || ''; bVal = b.state || ''; break
          case 'status': aVal = a.formStatus || ''; bVal = b.formStatus || ''; break
          default: return 0
        }
        const cmp = aVal.localeCompare(bVal)
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return result
  }, [contractors, searchQuery, statusFilter, sortField, sortDir])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of contractors) {
      const s = c.formStatus || 'DRAFT'
      counts[s] = (counts[s] || 0) + 1
    }
    return counts
  }, [contractors])

  useEffect(() => { setCurrentPage(1) }, [searchQuery, statusFilter])

  const totalPages = Math.ceil(filteredContractors.length / PAGE_SIZE) || 1
  const safePage = Math.min(currentPage, totalPages)
  const paginatedContractors = filteredContractors.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  )

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
                : filteredContractors.length !== contractors.length
                  ? `Showing ${filteredContractors.length} of ${contractors.length} contractors`
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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShareIntakeLink}
                disabled={isShareLoading}
                className="gap-1.5"
              >
                {isShareLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Intake Form
              </Button>
              {intakeFormUrl && (
                <div className="flex items-center gap-1.5">
                  <a
                    href={intakeFormUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-primary hover:underline font-medium"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Link
                  </a>
                  <button
                    onClick={handleCopyIntakeLink}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy to clipboard"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
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

        {/* Search & Status Filters */}
        {contractors.length > 0 && (
          <div className="space-y-3 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, SSN, city, address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setStatusFilter(null)}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
                  !statusFilter
                    ? 'bg-primary text-white border-primary'
                    : 'bg-background text-muted-foreground border-border hover:bg-muted'
                )}
              >
                All ({contractors.length})
              </button>
              {STATUS_ORDER.filter(s => statusCounts[s]).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(statusFilter === status ? null : status)}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
                    statusFilter === status
                      ? 'bg-primary text-white border-primary'
                      : 'bg-background text-muted-foreground border-border hover:bg-muted'
                  )}
                >
                  {STATUS_LABELS[status] || status} ({statusCounts[status]})
                </button>
              ))}
            </div>
          </div>
        )}

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
        ) : paginatedContractors.length > 0 ? (
          <ContractorTable
            contractors={paginatedContractors}
            businessId={businessId}
            onEdit={handleEdit}
            onDelete={(id) => {
              setDeletingId(id)
              deleteMutation.mutate(id)
            }}
            deletingId={deletingId}
            sortField={sortField}
            sortDir={sortDir}
            onSort={(field) => {
              if (sortField === field) {
                setSortDir(d => d === 'asc' ? 'desc' : 'asc')
              } else {
                setSortField(field)
                setSortDir('asc')
              }
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Search className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No contractors match your search</p>
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter(null) }}
              className="text-xs text-primary hover:underline mt-1"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-border mt-3">
            <span className="text-xs text-muted-foreground">
              Showing {(safePage - 1) * PAGE_SIZE + 1}-{Math.min(safePage * PAGE_SIZE, filteredContractors.length)} of {filteredContractors.length}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={safePage === 1}>
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={safePage === totalPages}>
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Sticky Workflow Bar */}
        {contractors.length > 0 && (
          <div className="sticky bottom-0 mt-4 -mx-4 -mb-4">
            <FormActionsPanel businessId={businessId} />
          </div>
        )}
      </div>

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
