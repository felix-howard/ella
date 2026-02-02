/**
 * Bulk Assign Dialog - Multi-select clients to assign to a staff member
 * Shows all org clients with search, excludes already-assigned ones
 */
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Search, Check } from 'lucide-react'
import { Modal, ModalHeader, ModalTitle, ModalDescription, ModalBody, ModalFooter, Button, Input, cn } from '@ella/ui'
import { api, type ClientAssignment } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'

interface BulkAssignDialogProps {
  isOpen: boolean
  onClose: () => void
  staffId: string
  staffName: string
  existingAssignments: ClientAssignment[]
}

export function BulkAssignDialog({ isOpen, onClose, staffId, staffName, existingAssignments }: BulkAssignDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Fetch all org clients
  const { data: clientsData, isLoading } = useQuery({
    queryKey: ['clients-for-assign'],
    queryFn: () => api.clients.list(),
    enabled: isOpen,
  })

  // IDs already assigned to this staff
  const assignedIds = useMemo(
    () => new Set(existingAssignments.map((a) => a.clientId)),
    [existingAssignments]
  )

  // Filter available clients (not already assigned + search)
  const availableClients = useMemo(() => {
    const all = clientsData?.data ?? []
    return all.filter((c) => {
      if (assignedIds.has(c.id)) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return c.name.toLowerCase().includes(q) || c.phone.includes(q)
      }
      return true
    })
  }, [clientsData, assignedIds, search])

  // Bulk assign mutation
  const bulkMutation = useMutation({
    mutationFn: () => api.clientAssignments.bulkCreate({ clientIds: [...selected], staffId }),
    onSuccess: (res) => {
      toast.success(t('team.bulkAssignResult', { created: res.data.created, skipped: res.data.skipped }))
      queryClient.invalidateQueries({ queryKey: ['member-assignments', staffId] })
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
      handleClose()
    },
  })

  const handleClose = () => {
    setSearch('')
    setSelected(new Set())
    onClose()
  }

  const toggleClient = (clientId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(clientId)) next.delete(clientId)
      else next.add(clientId)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === availableClients.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(availableClients.map((c) => c.id)))
    }
  }

  return (
    <Modal open={isOpen} onClose={handleClose} size="lg">
      <ModalHeader>
        <ModalTitle>{t('team.bulkAssignTitle', { name: staffName })}</ModalTitle>
        <ModalDescription>
          {t('team.selectedCount', { count: selected.size })}
        </ModalDescription>
      </ModalHeader>
      <ModalBody className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('team.searchClients')}
            className="pl-9"
            aria-label={t('team.searchClients')}
          />
        </div>

        {/* Select all */}
        {availableClients.length > 0 && (
          <button
            onClick={toggleAll}
            className="text-xs text-primary hover:underline"
          >
            {selected.size === availableClients.length ? t('common.cancel') : t('team.selectAll')} ({availableClients.length})
          </button>
        )}

        {/* Client list */}
        <div className="max-h-[300px] overflow-y-auto space-y-1" role="listbox" aria-label={t('team.searchClients')}>
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading && availableClients.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">{t('team.emptyAssignments')}</p>
          )}
          {availableClients.map((client) => {
            const isSelected = selected.has(client.id)
            return (
              <button
                key={client.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => toggleClient(client.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                  isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted border border-transparent'
                )}
              >
                <div className={cn(
                  'w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                  isSelected ? 'bg-primary border-primary text-white' : 'border-border'
                )}>
                  {isSelected && <Check className="w-3 h-3" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{client.name}</p>
                  <p className="text-xs text-muted-foreground">{client.phone}</p>
                </div>
              </button>
            )
          })}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={handleClose}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={() => bulkMutation.mutate()}
          disabled={selected.size === 0 || bulkMutation.isPending}
        >
          {bulkMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {t('team.assignClients')} ({selected.size})
        </Button>
      </ModalFooter>
    </Modal>
  )
}
