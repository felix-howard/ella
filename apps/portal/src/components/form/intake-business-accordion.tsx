/**
 * Collapsible-card list for adding multiple businesses in the self-serve intake form.
 * Mirrors the workspace's BusinessAccordion (apps/workspace/src/components/clients/business-accordion.tsx)
 * but uses the portal's IntakeBusinessForm + IntakeBusinessData shape.
 */
import { useTranslation } from 'react-i18next'
import { Building2, Plus, X, ChevronDown } from 'lucide-react'
import { cn } from '@ella/ui'
import { IntakeBusinessForm, type IntakeBusinessData } from './intake-business-form'

export const MAX_BUSINESSES = 10

export interface IntakeBusinessEntry extends IntakeBusinessData {
  _key: string
}

interface IntakeBusinessAccordionProps {
  businesses: IntakeBusinessEntry[]
  expandedIndex: number
  onExpandedChange: (index: number) => void
  onUpdate: (index: number, updates: Partial<IntakeBusinessData>) => void
  onAdd: () => void
  onRemove: (index: number) => void
}

export function IntakeBusinessAccordion({
  businesses,
  expandedIndex,
  onExpandedChange,
  onUpdate,
  onAdd,
  onRemove,
}: IntakeBusinessAccordionProps) {
  const { t } = useTranslation()
  const atLimit = businesses.length >= MAX_BUSINESSES

  return (
    <div className="space-y-3">
      {businesses.map((biz, index) => {
        const isOpen = expandedIndex === index
        return (
          <div key={biz._key} className="bg-card rounded-xl border border-border">
            <button
              type="button"
              onClick={() => onExpandedChange(isOpen ? -1 : index)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="font-medium">
                  {biz.businessName || `${t('form.businessLabel', 'Business')} ${index + 1}`}
                </span>
                {biz.businessType && (
                  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                    {biz.businessType.replace('_', ' ')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {businesses.length > 1 && (
                  <button
                    type="button"
                    aria-label={t('form.removeBusiness', 'Remove business')}
                    onClick={(e) => { e.stopPropagation(); onRemove(index) }}
                    className="text-muted-foreground hover:text-destructive p-1 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
              </div>
            </button>
            {isOpen && (
              <div className="p-4 pt-0 border-t border-border">
                <IntakeBusinessForm
                  data={biz}
                  onChange={(updates) => onUpdate(index, updates)}
                  idPrefix={`intake-${index}-`}
                  hideTitle
                />
              </div>
            )}
          </div>
        )
      })}
      <button
        type="button"
        onClick={onAdd}
        disabled={atLimit}
        className={cn(
          'w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed text-sm transition-colors',
          atLimit
            ? 'border-border/50 text-muted-foreground/50 cursor-not-allowed'
            : 'border-border text-muted-foreground hover:text-primary hover:border-primary'
        )}
      >
        <Plus className="w-4 h-4" />
        {t('form.addAnotherBusiness', 'Add Another Business')}
      </button>
    </div>
  )
}
