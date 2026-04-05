/**
 * Contractor table with edit/delete actions and per-row PDF view buttons
 * Displays contractors with masked SSN (***-**-1234)
 */
import { useState } from 'react'
import { Pencil, Trash2, Loader2, FileText, Eye } from 'lucide-react'
import { Button, Modal, ModalHeader, ModalTitle, ModalDescription, ModalFooter, cn } from '@ella/ui'
import { api, type Contractor } from '../../../../lib/api-client'
import { toast } from '../../../../stores/toast-store'

interface ContractorTableProps {
  contractors: Contractor[]
  businessId: string
  onEdit: (contractor: Contractor) => void
  onDelete: (id: string) => void
  deletingId: string | null
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  IMPORTED: { label: 'Created', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  PDF_READY: { label: 'Ready', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  SUBMITTED: { label: 'Transmitted', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' },
  ACCEPTED: { label: 'Accepted', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
}

export function ContractorTable({ contractors, businessId, onEdit, onDelete, deletingId }: ContractorTableProps) {
  const [confirmDelete, setConfirmDelete] = useState<Contractor | null>(null)
  const [loadingPdf, setLoadingPdf] = useState<string | null>(null)

  const handleViewPdf = async (formId: string, type: 'copyA' | 'copyB') => {
    setLoadingPdf(`${formId}-${type}`)
    try {
      const result = type === 'copyA'
        ? await api.form1099nec.downloadPdf(businessId, formId)
        : await api.form1099nec.downloadRecipientPdf(businessId, formId)
      window.open(result.url, '_blank')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load PDF')
    } finally {
      setLoadingPdf(null)
    }
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">SSN</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Address</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">City</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">State</th>
              <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {contractors.map((c) => {
              const isDeleting = deletingId === c.id
              const badge = c.formStatus ? STATUS_BADGE[c.formStatus] : null
              return (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-foreground">
                    {c.firstName} {c.lastName}
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground font-mono text-xs">
                    ***-**-{c.ssnLast4}
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground hidden sm:table-cell truncate max-w-[200px]">
                    {c.address}
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground hidden md:table-cell">
                    {c.city}
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground hidden md:table-cell">
                    {c.state}
                  </td>
                  <td className="py-2.5 px-3">
                    {badge ? (
                      <span className={cn('px-1.5 py-0.5 text-[10px] font-medium rounded', badge.className)}>
                        {badge.label}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* View Copy A (Payer Copy) */}
                      {c.hasCopyA && c.formId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewPdf(c.formId!, 'copyA')}
                          disabled={loadingPdf === `${c.formId}-copyA`}
                          className="h-7 px-1.5 text-xs gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                          title="View Copy A (Payer)"
                        >
                          {loadingPdf === `${c.formId}-copyA` ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <FileText className="w-3 h-3" />
                          )}
                          A
                        </Button>
                      )}
                      {/* View Copy B (Recipient Copy) */}
                      {c.hasCopyB && c.formId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewPdf(c.formId!, 'copyB')}
                          disabled={loadingPdf === `${c.formId}-copyB`}
                          className="h-7 px-1.5 text-xs gap-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                          title="View Copy B (Recipient)"
                        >
                          {loadingPdf === `${c.formId}-copyB` ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Eye className="w-3 h-3" />
                          )}
                          B
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(c)}
                        className="h-7 w-7 p-0"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDelete(c)}
                        disabled={isDeleting}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <ModalHeader>
          <ModalTitle>Delete Contractor</ModalTitle>
          <ModalDescription>
            Are you sure you want to delete <span className="font-semibold">{confirmDelete?.firstName} {confirmDelete?.lastName}</span>? This action cannot be undone.
          </ModalDescription>
        </ModalHeader>
        <ModalFooter>
          <Button variant="outline" onClick={() => setConfirmDelete(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirmDelete) {
                onDelete(confirmDelete.id)
                setConfirmDelete(null)
              }
            }}
          >
            Delete
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
