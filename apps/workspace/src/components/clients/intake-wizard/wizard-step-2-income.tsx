/**
 * WizardStep2Income - Income information step
 * Checkbox-based income type selection with conditional detail fields
 */

import { cn } from '@ella/ui'
import { ChevronDown, Briefcase, Building2, TrendingUp, Coins, Home } from 'lucide-react'
import { useCategoryToggle, createItemToggleHandler } from './use-category-toggle'
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
  label: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  items: IncomeItem[]
}

interface IncomeItem {
  key: string
  label: string
  hint?: string
  detailFields?: DetailField[]
}

interface DetailField {
  key: string
  label: string
  type: 'number' | 'text' | 'currency'
  placeholder?: string
}

// Income categories configuration
const INCOME_CATEGORIES: IncomeCategory[] = [
  {
    id: 'employment',
    label: 'Thu nhập từ việc làm',
    icon: Briefcase,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-600',
    items: [
      {
        key: 'hasW2',
        label: 'Có W-2 (lương từ công ty)',
        hint: 'Thu nhập từ việc làm có khấu trừ thuế',
        detailFields: [
          { key: 'w2Count', label: 'Số lượng W-2', type: 'number', placeholder: '1' },
        ],
      },
      {
        key: 'has1099NEC',
        label: 'Có 1099-NEC (thu nhập tự do)',
        hint: 'Thu nhập từ hợp đồng, freelance',
      },
      {
        key: 'hasTipsIncome',
        label: 'Có thu nhập từ Tips',
        hint: 'Tiền boa không được báo cáo qua W-2',
      },
    ],
  },
  {
    id: 'self_employment',
    label: 'Kinh doanh / Tự làm chủ',
    icon: Building2,
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-600',
    items: [
      {
        key: 'hasSelfEmployment',
        label: 'Có thu nhập tự kinh doanh',
        hint: 'Schedule C - kinh doanh cá nhân',
      },
      {
        key: 'hasK1Income',
        label: 'Có K-1 (Partnership/S-Corp)',
        hint: 'Thu nhập từ công ty hợp danh hoặc S-Corp',
        detailFields: [
          { key: 'k1Count', label: 'Số lượng K-1', type: 'number', placeholder: '1' },
        ],
      },
    ],
  },
  {
    id: 'investments',
    label: 'Đầu tư & Tài chính',
    icon: TrendingUp,
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-600',
    items: [
      {
        key: 'hasBankAccount',
        label: 'Có tài khoản ngân hàng (lãi suất)',
        hint: '1099-INT - tiền lãi từ ngân hàng',
      },
      {
        key: 'hasInvestments',
        label: 'Có đầu tư chứng khoán',
        hint: '1099-B, 1099-DIV - cổ phiếu, quỹ',
      },
      {
        key: 'hasCrypto',
        label: 'Có giao dịch Crypto',
        hint: 'Bitcoin, Ethereum, etc.',
      },
    ],
  },
  {
    id: 'retirement',
    label: 'Hưu trí & Trợ cấp',
    icon: Coins,
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-600',
    items: [
      {
        key: 'hasRetirement',
        label: 'Có thu nhập hưu trí',
        hint: '1099-R - 401k, IRA, pension',
      },
      {
        key: 'hasSocialSecurity',
        label: 'Có Social Security',
        hint: 'SSA-1099 - an sinh xã hội',
      },
      {
        key: 'hasUnemployment',
        label: 'Có Unemployment',
        hint: '1099-G - trợ cấp thất nghiệp',
      },
    ],
  },
  {
    id: 'property',
    label: 'Bất động sản',
    icon: Home,
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-600',
    items: [
      {
        key: 'hasRentalProperty',
        label: 'Có bất động sản cho thuê',
        hint: 'Schedule E - thu nhập cho thuê',
        detailFields: [
          { key: 'rentalPropertyCount', label: 'Số bất động sản', type: 'number', placeholder: '1' },
        ],
      },
      {
        key: 'hasBoughtSoldHome',
        label: 'Có mua/bán nhà trong năm',
        hint: 'Có thể có lợi nhuận chịu thuế',
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
  // Use shared category toggle hook
  const { isExpanded, toggleCategory } = useCategoryToggle(['employment'])

  // Use shared item toggle handler
  const handleItemToggle = createItemToggleHandler(answers, onChange)

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">Nguồn thu nhập</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Chọn tất cả các nguồn thu nhập bạn có trong năm thuế
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
                <span className="font-medium text-foreground">{category.label}</span>
                {hasActiveItems && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-primary text-white rounded-full">
                    Có
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

                  return (
                    <div key={item.key}>
                      {/* Checkbox Item */}
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
                            {item.label}
                          </span>
                          {item.hint && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {item.hint}
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
}

function DetailFieldInput({ field, value, onChange }: DetailFieldInputProps) {
  if (field.type === 'number') {
    return (
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground w-32">{field.label}:</label>
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
        <label className="text-sm text-muted-foreground w-32">{field.label}:</label>
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
      <label className="text-sm text-muted-foreground w-32">{field.label}:</label>
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
