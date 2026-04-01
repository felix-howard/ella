/**
 * Contractor table with edit/delete actions
 * Displays contractors with masked SSN (***-**-1234)
 */
import { useState } from 'react'
import { Pencil, Trash2, Loader2 } from 'lucide-react'
import { Button, Modal, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from '@ella/ui'
import type { Contractor } from '../../../../lib/api-client'

interface ContractorTableProps {
  contractors: Contractor[]
  onEdit: (contractor: Contractor) => void
  onDelete: (id: string) => void
  deletingId: string | null
}

export function ContractorTable({ contractors, onEdit, onDelete, deletingId }: ContractorTableProps) {
  const [confirmDelete, setConfirmDelete] = useState<Contractor | null>(null)

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
              <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Email</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {contractors.map((c) => {
              const isDeleting = deletingId === c.id
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
                  <td className="py-2.5 px-3 text-muted-foreground hidden lg:table-cell truncate max-w-[180px]">
                    {c.email || '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
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
