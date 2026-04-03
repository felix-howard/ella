/**
 * Card showing a single business with its contractors and 1099 status
 * Embeds Form1099NECTab for contractor management per business
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Pencil, Trash2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { Button, Modal, ModalHeader, ModalTitle, ModalFooter } from '@ella/ui'
import { api, type Business } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { Form1099NECTab } from '../cases/tabs/form-1099-nec-tab'
import { BusinessFormModal } from './business-form-modal'

const TYPE_LABELS: Record<string, string> = {
  SOLE_PROPRIETORSHIP: 'Sole Prop',
  LLC: 'LLC',
  PARTNERSHIP: 'Partnership',
  S_CORP: 'S-Corp',
  C_CORP: 'C-Corp',
}

interface BusinessCardProps {
  business: Business
  clientId: string
  clientName: string
  defaultExpanded?: boolean
}

export function BusinessCard({ business, clientId, clientName, defaultExpanded = false }: BusinessCardProps) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => api.businesses.delete(clientId, business.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses', clientId] })
      toast.success('Business deleted')
      setIsDeleteOpen(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete business')
    },
  })

  return (
    <>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Business Header */}
        <div
          role="button"
          tabIndex={0}
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => setExpanded(!expanded)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded) } }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="w-4.5 h-4.5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-foreground truncate">{business.name}</span>
                <span className="text-xs text-muted-foreground">EIN: {business.einMasked}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>{TYPE_LABELS[business.type] || business.type}</span>
                <span>·</span>
                <span>{business.address}, {business.city}, {business.state} {business.zip}</span>
                {business.contractorCount > 0 && (
                  <>
                    <span>·</span>
                    <span>{business.contractorCount} contractor{business.contractorCount !== 1 ? 's' : ''}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => { e.stopPropagation(); setIsEditOpen(true) }}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); setIsDeleteOpen(true) }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Contractor/1099 Content */}
        {expanded && (
          <div className="border-t border-border p-4">
            <Form1099NECTab businessId={business.id} clientName={clientName} />
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <BusinessFormModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        clientId={clientId}
        business={business}
      />

      {/* Delete Confirmation */}
      <Modal open={isDeleteOpen} onClose={() => setIsDeleteOpen(false)}>
        <ModalHeader>
          <ModalTitle>Delete Business</ModalTitle>
        </ModalHeader>
        <div className="px-6 pb-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-semibold text-foreground">{business.name}</span>?
            {business.contractorCount > 0 && (
              <> This will also delete <span className="font-semibold text-destructive">{business.contractorCount} contractor{business.contractorCount !== 1 ? 's' : ''}</span> and their 1099-NEC forms.</>
            )}
          </p>
        </div>
        <ModalFooter>
          <Button variant="outline" size="sm" onClick={() => setIsDeleteOpen(false)} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="gap-1.5"
          >
            {deleteMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Delete
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
