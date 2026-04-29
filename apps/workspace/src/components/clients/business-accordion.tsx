/**
 * Accordion UI for adding/removing multiple businesses in the creation wizard.
 * Used in the INDIVIDUAL_WITH_BUSINESS flow.
 */
import { useTranslation } from 'react-i18next'
import { Building2, Plus, X, ChevronDown } from 'lucide-react'
import { cn } from '@ella/ui'
import { BusinessInfoForm, type BusinessInfoData } from './business-info-form'

const MAX_BUSINESSES = 10

interface BusinessEntry extends BusinessInfoData {
  _key: string
}

interface BusinessAccordionProps {
  businesses: BusinessEntry[]
  expandedIndex: number
  onExpandedChange: (index: number) => void
  onUpdate: (index: number, updates: Partial<BusinessInfoData>) => void
  onAdd: () => void
  onRemove: (index: number) => void
  errors?: Partial<Record<keyof BusinessInfoData, string>>[]
}

export function BusinessAccordion({
  businesses,
  expandedIndex,
  onExpandedChange,
  onUpdate,
  onAdd,
  onRemove,
  errors,
}: BusinessAccordionProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      {businesses.map((biz, index) => (
        <div key={biz._key} className="bg-card rounded-xl border border-border">
          <button
            type="button"
            onClick={() => onExpandedChange(expandedIndex === index ? -1 : index)}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="font-medium">
                {biz.name || `Business ${index + 1}`}
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
                  aria-label={t('newClient.removeBusiness', 'Remove business')}
                  onClick={(e) => { e.stopPropagation(); onRemove(index) }}
                  className="text-muted-foreground hover:text-destructive p-1 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <ChevronDown className={cn('w-4 h-4 transition-transform', expandedIndex === index && 'rotate-180')} />
            </div>
          </button>
          {expandedIndex === index && (
            <div className="p-4 pt-0 border-t border-border">
              <BusinessInfoForm
                data={biz}
                onChange={(updates) => onUpdate(index, updates)}
                errors={errors?.[index]}
                phoneRequired={false}
                idPrefix={`biz-${index}-`}
                hideTitle
              />
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        disabled={businesses.length >= MAX_BUSINESSES}
        className={cn(
          'w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed text-sm transition-colors',
          businesses.length >= MAX_BUSINESSES
            ? 'border-border/50 text-muted-foreground/50 cursor-not-allowed'
            : 'border-border text-muted-foreground hover:text-primary hover:border-primary'
        )}
      >
        <Plus className="w-4 h-4" />
        {t('newClient.addAnotherBusiness', 'Add Another Business')}
      </button>
    </div>
  )
}
