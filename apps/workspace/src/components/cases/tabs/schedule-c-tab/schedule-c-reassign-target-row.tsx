/**
 * Single radio row used by ScheduleCReassignModal — entity name + type chip.
 * Disabled when target case already owns a Schedule C (locked Q4 — no overwrite).
 */
import { useTranslation } from 'react-i18next'
import { SimpleTooltip } from '@ella/ui'
import type { ClientType } from '../../../../lib/api-client'
import { getBusinessTypeLabel } from '../../../../lib/business-type-helpers'
import type { BusinessType } from '../../../../lib/api-client'

export interface ScheduleCReassignTarget {
  clientId: string
  name: string
  clientType: ClientType
  businessType?: BusinessType | null
  targetCaseId: string
  hasSC: boolean
}

interface ScheduleCReassignTargetRowProps {
  target: ScheduleCReassignTarget
  selected: boolean
  disabled: boolean
  onSelect: (caseId: string) => void
}

export function ScheduleCReassignTargetRow({ target, selected, disabled, onSelect }: ScheduleCReassignTargetRowProps) {
  const { t } = useTranslation()
  const isDisabled = disabled || target.hasSC
  const typeChip =
    target.clientType === 'INDIVIDUAL'
      ? t('scheduleC.reassign.individualChip')
      : getBusinessTypeLabel(target.businessType)

  const row = (
    <button
      type="button"
      onClick={() => !isDisabled && onSelect(target.targetCaseId)}
      disabled={isDisabled}
      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
        selected
          ? 'border-primary bg-primary/5'
          : isDisabled
            ? 'border-border bg-muted/30 cursor-not-allowed opacity-60'
            : 'border-border hover:bg-muted/50 cursor-pointer'
      }`}
      role="radio"
      aria-checked={selected}
    >
      <span
        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
          selected ? 'border-primary' : 'border-muted-foreground'
        }`}
        aria-hidden="true"
      >
        {selected && <span className="w-2 h-2 rounded-full bg-primary" />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{target.name}</div>
        {typeChip && (
          <div className="text-xs text-muted-foreground">{typeChip}</div>
        )}
      </div>
      {target.hasSC && (
        <span className="text-xs text-muted-foreground italic flex-shrink-0">
          {t('scheduleC.reassign.alreadyHasSC')}
        </span>
      )}
    </button>
  )

  if (target.hasSC) {
    return (
      <SimpleTooltip text={t('scheduleC.reassign.alreadyHasSCTooltip')}>
        {row}
      </SimpleTooltip>
    )
  }
  return row
}
