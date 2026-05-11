/**
 * Client Linked Entity Card - Shows linked business or owner info on overview tab
 * For individual clients: shows their linked businesses + add button
 * For business clients: shows the owner (individual client)
 */
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, User, Phone, Mail, FileText, ArrowRight, Plus, Trash2, Loader2 } from 'lucide-react'
import { Button, Modal, ModalDescription, ModalFooter, ModalHeader, ModalTitle, cn } from '@ella/ui'
import { type ClientPreview, type ClientType } from '../../../lib/api-client'
import { formatPhone } from '../../../lib/formatters'
import { getInitials, getAvatarColor } from '../../../lib/formatters'
import { BUSINESS_TYPE_LABELS } from '../../../lib/business-type-helpers'
import { toast } from '../../../stores/toast-store'
import { AddBusinessDrawer } from './add-business-drawer'
import { deleteLinkedBusinessClient } from './linked-business-delete'

interface ClientLinkedEntityCardProps {
  clientId: string
  clientGroupId?: string | null
  clientName: string
  clientPhone: string
  clientEmail?: string | null
  currentClientType: ClientType
  linkedClients: ClientPreview[]
  /** Parent individual's Schedule C summary, if any. Drives migration prompt on add. */
  parentScheduleC?: { id: string; taxYear: number } | null
  onBusinessAdded?: () => void
}

export function ClientLinkedEntityCard({
  clientId,
  clientGroupId,
  clientName,
  clientPhone,
  clientEmail,
  currentClientType,
  linkedClients,
  parentScheduleC,
  onBusinessAdded,
}: ClientLinkedEntityCardProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<ClientPreview | null>(null)
  const queryClient = useQueryClient()

  const isIndividual = currentClientType === 'INDIVIDUAL'
  const isBusiness = currentClientType === 'BUSINESS'
  const hasLinked = linkedClients && linkedClients.length > 0

  const deleteBusinessMutation = useMutation({
    mutationFn: async (businessId: string) => {
      return deleteLinkedBusinessClient(businessId)
    },
    onSuccess: (_data, businessId) => {
      toast.success('Business deleted')
      setRemoveTarget(null)
      queryClient.invalidateQueries({ queryKey: ['client', clientId] })
      queryClient.invalidateQueries({ queryKey: ['client', businessId] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      if (clientGroupId) {
        queryClient.invalidateQueries({ queryKey: ['client-group', clientGroupId] })
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete business')
    },
  })

  // Business clients with no linked owner — hide card
  if (isBusiness && !hasLinked) return null

  const title = isBusiness ? 'Business Owner' : 'Linked Business'
  const Icon = isBusiness ? User : Building2

  // Individual with no businesses — show empty state with add button
  if (isIndividual && !hasLinked) {
    return (
      <>
        <div className="bg-card rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-white/[0.06] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4.5 h-4.5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Linked Business</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">No businesses linked yet.</p>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-primary hover:border-primary transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Business
          </button>
        </div>
        {drawerOpen && (
          <AddBusinessDrawer
            clientId={clientId}
            clientName={clientName}
            clientPhone={clientPhone}
            clientEmail={clientEmail}
            parentScheduleC={parentScheduleC}
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            onSuccess={() => onBusinessAdded?.()}
          />
        )}
      </>
    )
  }

  return (
    <>
      <div className="bg-card rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-white/[0.06] p-6">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="w-4.5 h-4.5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>

        <div className="space-y-3">
          {linkedClients.map((linked) => {
            const avatarColor = getAvatarColor(linked.name)
            const isLinkedBusiness = linked.clientType === 'BUSINESS'

            return (
              <div
                key={linked.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/30 transition-all group"
              >
                <Link
                  to="/clients/$clientId"
                  params={{ clientId: linked.id }}
                  className="flex min-w-0 flex-1 items-center gap-4"
                >
                  {/* Avatar */}
                  <div className={cn(
                    'w-12 h-12 flex items-center justify-center flex-shrink-0 ring-1 ring-background shadow-sm',
                    isLinkedBusiness ? 'rounded-lg' : 'rounded-full',
                    avatarColor.bg,
                    avatarColor.text
                  )}>
                    <span className="font-bold text-sm">
                      {getInitials(linked.name)}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {linked.name}
                      </span>
                      {isLinkedBusiness && linked.businessType && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                          {BUSINESS_TYPE_LABELS[linked.businessType] || linked.businessType}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {formatPhone(linked.phone)}
                      </span>
                      {linked.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {linked.email}
                        </span>
                      )}
                      {isLinkedBusiness && linked.einMasked && (
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          EIN: ***-**-{linked.einMasked}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </Link>

                {isIndividual && isLinkedBusiness && (
                  <button
                    type="button"
                    onClick={() => setRemoveTarget(linked)}
                    disabled={deleteBusinessMutation.isPending}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    aria-label={`Delete business ${linked.name}`}
                    title="Delete business"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Add Business button for individuals with existing businesses */}
        {isIndividual && (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="w-full flex items-center justify-center gap-2 p-3 mt-3 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-primary hover:border-primary transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Business
          </button>
        )}
      </div>

      {isIndividual && drawerOpen && (
        <AddBusinessDrawer
          clientId={clientId}
          clientName={clientName}
          clientPhone={clientPhone}
          clientEmail={clientEmail}
          parentScheduleC={parentScheduleC}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onSuccess={() => onBusinessAdded?.()}
        />
      )}

      <Modal
        open={!!removeTarget}
        onClose={() => {
          if (!deleteBusinessMutation.isPending) setRemoveTarget(null)
        }}
      >
        <ModalHeader>
          <ModalTitle>Delete business</ModalTitle>
          <ModalDescription>
            Delete <span className="font-semibold text-foreground">{removeTarget?.name}</span> permanently.
            This removes the business from {clientName} and deletes its client record, tax cases, and linked data.
          </ModalDescription>
        </ModalHeader>
        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setRemoveTarget(null)}
            disabled={deleteBusinessMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (removeTarget) deleteBusinessMutation.mutate(removeTarget.id)
            }}
            disabled={deleteBusinessMutation.isPending}
          >
            {deleteBusinessMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete
              </>
            )}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
