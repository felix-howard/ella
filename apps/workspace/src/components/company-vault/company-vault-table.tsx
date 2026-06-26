import { useEffect, useRef, useState } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  sortableKeyboardCoordinates,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useTranslation } from 'react-i18next'
import { copyToClipboard } from '../../lib/clipboard'
import type { CompanyVaultCredential } from '../../lib/api-client'
import { CompanyVaultSortableRow } from './company-vault-sortable-row'

interface CompanyVaultTableProps {
  credentials: CompanyVaultCredential[]
  onEdit: (credential: CompanyVaultCredential) => void
  onDelete: (credential: CompanyVaultCredential) => void
  onReorder?: (credentialIds: string[]) => void
  reorderDisabled?: boolean
  reorderDisabledReason?: string
}

export function CompanyVaultTable({
  credentials,
  onEdit,
  onDelete,
  onReorder,
  reorderDisabled = false,
  reorderDisabledReason,
}: CompanyVaultTableProps) {
  const { t } = useTranslation()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current)
      }
    }
  }, [])

  const handleCopy = async (
    key: string,
    value: string,
    successMsg: string
  ) => {
    const copied = await copyToClipboard(value, { successMsg })
    if (!copied) return

    setCopiedKey(key)
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current)
    }
    copiedTimerRef.current = setTimeout(() => {
      setCopiedKey(null)
      copiedTimerRef.current = null
    }, 1500)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    if (!onReorder || reorderDisabled) return
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = credentials.findIndex((credential) => credential.id === active.id)
    const newIndex = credentials.findIndex((credential) => credential.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const nextCredentials = arrayMove(credentials, oldIndex, newIndex)
    onReorder(nextCredentials.map((credential) => credential.id))
  }

  const credentialIds = credentials.map((credential) => credential.id)
  const dragDisabled = reorderDisabled || !onReorder

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] table-fixed">
            <thead className="border-b border-border/50 bg-muted/40">
              <tr>
                <th className="w-[4%] px-3 py-3">
                  <span className="sr-only">{t('companyVault.reorder')}</span>
                </th>
                <th className="w-[19%] px-4 py-3 text-left text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  {t('companyVault.toolName')}
                </th>
                <th className="w-[20%] px-4 py-3 text-left text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  {t('companyVault.username')}
                </th>
                <th className="w-[19%] px-4 py-3 text-left text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  {t('companyVault.password')}
                </th>
                <th className="w-[29%] px-4 py-3 text-left text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  {t('companyVault.note')}
                </th>
                <th className="w-[9%] px-4 py-3 text-right text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  {t('companyVault.actions')}
                </th>
              </tr>
            </thead>
            <SortableContext items={credentialIds} strategy={verticalListSortingStrategy}>
              <tbody className="divide-y divide-border/50">
                {credentials.map((credential) => (
                  <CompanyVaultSortableRow
                    key={credential.id}
                    credential={credential}
                    copiedKey={copiedKey}
                    dragDisabled={dragDisabled}
                    dragDisabledReason={reorderDisabledReason}
                    onCopy={(key, value, successMsg) => void handleCopy(key, value, successMsg)}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </div>
      </div>
    </DndContext>
  )
}
