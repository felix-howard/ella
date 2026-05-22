/**
 * WizardStep2Income - Income information step
 * Checkbox-based income type selection with conditional detail fields
 */

import { cn } from '@ella/ui'
import { ChevronDown, Briefcase, Building2, TrendingUp, Coins, Home } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCategoryToggle } from './use-category-toggle'
import type { TaxType } from '../../../lib/api-client'
import type { IntakeAnswers } from './wizard-container'

interface WizardStep2IncomeProps {
  answers: IntakeAnswers
  onChange: (key: string, value: unknown) => void
  taxTypes: TaxType[]
  errors?: Record<string, string>
}

// Income category config
interface IncomeCategory {
  id: string
  labelKey: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  items: IncomeItem[]
}

interface IncomeItem {
  key: string
  labelKey: string
  hintKey?: string
  detailFields?: DetailField[]
}

interface DetailField {
  key: string
  labelKey: string
  type: 'number' | 'text' | 'currency'
  placeholder?: string
}

// Income categories configuration
const INCOME_CATEGORIES: IncomeCategory[] = [
  {
    id: 'employment',
    labelKey: 'intakeWizard.income.categories.employment',
    icon: Briefcase,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-600',
    items: [
      {
        key: 'hasW2',
        labelKey: 'intakeWizard.income.items.hasW2.label',
        hintKey: 'intakeWizard.income.items.hasW2.hint',
        detailFields: [
          { key: 'w2Count', labelKey: 'intakeWizard.income.fields.w2Count', type: 'number', placeholder: '1' },
        ],
      },
      {
        key: 'has1099NEC',
        labelKey: 'intakeWizard.income.items.has1099NEC.label',
        hintKey: 'intakeWizard.income.items.has1099NEC.hint',
      },
      {
        key: 'hasTipsIncome',
        labelKey: 'intakeWizard.income.items.hasTipsIncome.label',
        hintKey: 'intakeWizard.income.items.hasTipsIncome.hint',
      },
    ],
  },
  {
    id: 'self_employment',
    labelKey: 'intakeWizard.income.categories.selfEmployment',
    icon: Building2,
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-600',
    items: [
      {
        key: 'hasSelfEmployment',
        labelKey: 'intakeWizard.income.items.hasSelfEmployment.label',
        hintKey: 'intakeWizard.income.items.hasSelfEmployment.hint',
      },
      {
        key: 'hasK1Income',
        labelKey: 'intakeWizard.income.items.hasK1Income.label',
        hintKey: 'intakeWizard.income.items.hasK1Income.hint',
        detailFields: [
          { key: 'k1Count', labelKey: 'intakeWizard.income.fields.k1Count', type: 'number', placeholder: '1' },
        ],
      },
    ],
  },
  {
    id: 'investments',
    labelKey: 'intakeWizard.income.categories.investments',
    icon: TrendingUp,
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-600',
    items: [
      {
        key: 'hasBankAccount',
        labelKey: 'intakeWizard.income.items.hasBankAccount.label',
        hintKey: 'intakeWizard.income.items.hasBankAccount.hint',
      },
      {
        key: 'hasInvestments',
        labelKey: 'intakeWizard.income.items.hasInvestments.label',
        hintKey: 'intakeWizard.income.items.hasInvestments.hint',
      },
      {
        key: 'hasCrypto',
        labelKey: 'intakeWizard.income.items.hasCrypto.label',
        hintKey: 'intakeWizard.income.items.hasCrypto.hint',
      },
    ],
  },
  {
    id: 'retirement',
    labelKey: 'intakeWizard.income.categories.retirement',
    icon: Coins,
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-600',
    items: [
      {
        key: 'hasRetirement',
        labelKey: 'intakeWizard.income.items.hasRetirement.label',
        hintKey: 'intakeWizard.income.items.hasRetirement.hint',
      },
      {
        key: 'hasSocialSecurity',
        labelKey: 'intakeWizard.income.items.hasSocialSecurity.label',
        hintKey: 'intakeWizard.income.items.hasSocialSecurity.hint',
      },
      {
        key: 'hasUnemployment',
        labelKey: 'intakeWizard.income.items.hasUnemployment.label',
        hintKey: 'intakeWizard.income.items.hasUnemployment.hint',
      },
    ],
  },
  {
    id: 'property',
    labelKey: 'intakeWizard.income.categories.property',
    icon: Home,
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-600',
    items: [
      {
        key: 'hasRentalProperty',
        labelKey: 'intakeWizard.income.items.hasRentalProperty.label',
        hintKey: 'intakeWizard.income.items.hasRentalProperty.hint',
        detailFields: [
          { key: 'rentalPropertyCount', labelKey: 'intakeWizard.income.fields.rentalPropertyCount', type: 'number', placeholder: '1' },
        ],
      },
      {
        key: 'hasBoughtSoldHome',
        labelKey: 'intakeWizard.income.items.hasBoughtSoldHome.label',
        hintKey: 'intakeWizard.income.items.hasBoughtSoldHome.hint',
      },
    ],
  },
]

export function WizardStep2Income({
  answers,
  onChange,
  taxTypes: _taxTypes,
  errors: _errors,
}: WizardStep2IncomeProps) {
  const { t } = useTranslation()
  // Use shared category toggle hook
  const { isExpanded, toggleCategory } = useCategoryToggle(['employment'])

  const handleItemToggle = (item: IncomeItem) => {
    const currentValue = answers[item.key] === true
    onChange(item.key, !currentValue)

    if (currentValue && item.detailFields) {
      item.detailFields.forEach((field) => onChange(field.key, undefined))
    }
  }

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">{t('intakeWizard.income.title')}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t('intakeWizard.income.subtitle')}
        </p>
      </div>

      {INCOME_CATEGORIES.map((category) => {
        const expanded = isExpanded(category.id)
        const Icon = category.icon
        const hasActiveItems = category.items.some((item) => answers[item.key] === true)

        return (
          <div
            key={category.id}
            className={cn(
              'border rounded-lg overflow-hidden transition-colors',
              hasActiveItems ? 'border-primary/50 bg-primary/5' : 'border-border'
            )}
          >
            {/* Category Header */}
            <button
              type="button"
              onClick={() => toggleCategory(category.id)}
              className={cn(
                'w-full flex items-center justify-between p-4',
                'hover:bg-muted/50 transition-colors'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn('p-2 rounded-lg', category.iconBg)}>
                  <Icon className={cn('w-5 h-5', category.iconColor)} />
                </div>
                <span className="font-medium text-foreground">{t(category.labelKey)}</span>
                {hasActiveItems && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-primary text-white rounded-full">
                    {t('intakeWizard.common.yes')}
                  </span>
                )}
              </div>
              <ChevronDown
                className={cn(
                  'w-5 h-5 text-muted-foreground transition-transform',
                  expanded && 'rotate-180'
                )}
              />
            </button>

            {/* Category Items */}
            {expanded && (
              <div className="px-4 pb-4 space-y-2">
                {category.items.map((item) => {
                  const isChecked = answers[item.key] === true
                  const label = t(item.labelKey)
                  const hint = item.hintKey ? t(item.hintKey) : undefined

                  return (
                    <div key={item.key}>
                      {/* Checkbox Item - M2 fix: improved accessibility */}
                      <div
                        onClick={() => handleItemToggle(item)}
                        className={cn(
                          'flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                          isChecked
                            ? 'bg-primary-light/50 border border-primary/30'
                            : 'hover:bg-muted/50'
                        )}
                        role="checkbox"
                        aria-checked={isChecked}
                        aria-label={`${label}${hint ? `. ${hint}` : ''}`}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleItemToggle(item)
                          }
                        }}
                      >
                        {/* Custom Checkbox */}
                        <div
                          className={cn(
                            'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                            isChecked
                              ? 'bg-primary border-primary'
                              : 'border-muted-foreground/50'
                          )}
                        >
                          {isChecked && (
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>

                        {/* Label and Hint */}
                        <div className="flex-1">
                          <span
                            className={cn(
                              'text-sm font-medium',
                              isChecked ? 'text-foreground' : 'text-foreground/80'
                            )}
                          >
                            {label}
                          </span>
                          {hint && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {hint}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Detail Fields (shown when checked) */}
                      {isChecked && item.detailFields && (
                        <div className="ml-8 mt-2 space-y-2">
                          {item.detailFields.map((field) => (
                            <DetailFieldInput
                              key={field.key}
                              field={field}
                              value={answers[field.key] as number | string | undefined}
                              onChange={(value) => onChange(field.key, value)}
                              label={t(field.labelKey)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Detail field input component
interface DetailFieldInputProps {
  field: DetailField
  value: number | string | undefined
  onChange: (value: number | string) => void
  label: string
}

function DetailFieldInput({ field, value, onChange, label }: DetailFieldInputProps) {
  if (field.type === 'number') {
    return (
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground w-32">{label}:</label>
        <input
          type="number"
          min={0}
          max={99}
          value={value ?? ''}
          onChange={(e) => {
            const val = parseInt(e.target.value) || 0
            onChange(Math.max(0, Math.min(99, val)))
          }}
          placeholder={field.placeholder}
          className={cn(
            'w-20 px-3 py-1.5 rounded-lg border bg-card text-foreground text-sm',
            'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
            'border-border'
          )}
        />
      </div>
    )
  }

  if (field.type === 'currency') {
    return (
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground w-32">{label}:</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            $
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={value ? Number(value).toLocaleString('en-US') : ''}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/[^0-9]/g, '')
              onChange(parseInt(cleaned) || 0)
            }}
            placeholder={field.placeholder || '0'}
            className={cn(
              'w-32 pl-7 pr-3 py-1.5 rounded-lg border bg-card text-foreground text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
              'border-border'
            )}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-muted-foreground w-32">{label}:</label>
      <input
        type="text"
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={cn(
          'flex-1 px-3 py-1.5 rounded-lg border bg-card text-foreground text-sm',
          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
          'border-border'
        )}
      />
    </div>
  )
}
