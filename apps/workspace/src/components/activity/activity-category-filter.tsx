import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import type { ActivityCategory } from '../../lib/api-client'
import { ACTIVITY_CATEGORY_OPTIONS } from './activity-icons'

type ActivityCategoryFilterProps = {
  value?: ActivityCategory
  onChange: (value?: ActivityCategory) => void
  disabled?: boolean
}

export function ActivityCategoryFilter({ value, onChange, disabled }: ActivityCategoryFilterProps) {
  const { t } = useTranslation()

  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t('activity.filters.category')}>
      <FilterButton active={!value} disabled={disabled} onClick={() => onChange(undefined)}>
        {t('activity.filters.all')}
      </FilterButton>
      {ACTIVITY_CATEGORY_OPTIONS.map((category) => (
        <FilterButton
          key={category}
          active={value === category}
          disabled={disabled}
          onClick={() => onChange(category)}
        >
          {t(`activity.category.${category}`)}
        </FilterButton>
      ))}
    </div>
  )
}

type FilterButtonProps = {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: string
}

function FilterButton({ active, disabled, onClick, children }: FilterButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'h-9 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      {children}
    </button>
  )
}
