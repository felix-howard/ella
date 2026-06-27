import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, Copy, GripVertical, KeyRound, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, cn } from '@ella/ui'
import type { CompanyVaultCredential } from '../../lib/api-client'

interface CompanyVaultSortableRowProps {
  credential: CompanyVaultCredential
  copiedKey: string | null
  dragDisabled: boolean
  dragDisabledReason?: string
  onCopy: (key: string, value: string, successMsg: string) => void
  onEdit: (credential: CompanyVaultCredential) => void
  onDelete: (credential: CompanyVaultCredential) => void
}

function displayValue(value: string | null): string {
  return value === null || value === '' ? '-' : value
}

function hasValue(value: string | null): value is string {
  return value !== null && value !== ''
}

export function CompanyVaultSortableRow({
  credential,
  copiedKey,
  dragDisabled,
  dragDisabledReason,
  onCopy,
  onEdit,
  onDelete,
}: CompanyVaultSortableRowProps) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: credential.id,
    disabled: dragDisabled,
  })
  const dragLabel = dragDisabled
    ? dragDisabledReason ?? t('companyVault.reorderDisabled')
    : t('companyVault.dragHandle')

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'transition-colors hover:bg-muted/30',
        isDragging && 'relative z-10 bg-primary/5 opacity-80 shadow-sm'
      )}
    >
      <td className="px-3 py-3 align-top">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'h-11 w-11 text-muted-foreground hover:bg-transparent hover:text-primary',
            !dragDisabled && 'cursor-grab active:cursor-grabbing'
          )}
          aria-label={dragLabel}
          title={dragLabel}
          disabled={dragDisabled}
          {...(dragDisabled ? {} : attributes)}
          {...(dragDisabled ? {} : listeners)}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </Button>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-light">
            <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
          <span className="truncate text-sm font-medium text-foreground">
            {credential.toolName}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex min-w-0 items-center gap-2">
          <span className="block min-w-0 flex-1 truncate font-mono text-sm text-foreground">
            {displayValue(credential.username)}
          </span>
          {hasValue(credential.username) && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 flex-shrink-0 text-muted-foreground hover:bg-transparent hover:text-primary"
              aria-label={t('companyVault.copyUsername')}
              title={t('companyVault.copyUsername')}
              onClick={() => onCopy(
                `${credential.id}:username`,
                credential.username!,
                t('companyVault.usernameCopied')
              )}
            >
              {copiedKey === `${credential.id}:username` ? (
                <Check className="h-4 w-4 text-primary" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          )}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex min-w-0 items-center gap-2">
          <span className="block min-w-0 flex-1 truncate font-mono text-sm text-foreground">
            {displayValue(credential.password)}
          </span>
          {hasValue(credential.password) && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 flex-shrink-0 text-muted-foreground hover:bg-transparent hover:text-primary"
              aria-label={t('companyVault.copyPassword')}
              title={t('companyVault.copyPassword')}
              onClick={() => onCopy(
                `${credential.id}:password`,
                credential.password!,
                t('companyVault.passwordCopied')
              )}
            >
              {copiedKey === `${credential.id}:password` ? (
                <Check className="h-4 w-4 text-primary" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          )}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <span className="block whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
          {displayValue(credential.note)}
        </span>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            aria-label={t('companyVault.editCredential', { toolName: credential.toolName })}
            title={t('common.edit')}
            onClick={() => onEdit(credential)}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label={t('companyVault.deleteCredential', { toolName: credential.toolName })}
            title={t('common.delete')}
            onClick={() => onDelete(credential)}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
