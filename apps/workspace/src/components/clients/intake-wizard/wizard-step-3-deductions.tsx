/**
 * WizardStep3Deductions - Deductions information step
 * Checkbox-based deduction type selection with conditional detail fields
 */

import { cn } from '@ella/ui'
import { ChevronDown, Home, Heart, GraduationCap, HandHeart } from 'lucide-react'
import { useCategoryToggle, createItemToggleHandler } from './use-category-toggle'
import type { IntakeAnswers } from './wizard-container'

interface WizardStep3DeductionsProps {
  answers: IntakeAnswers
  onChange: (key: string, value: unknown) => void
  errors?: Record<string, string>
}

// Deduction category config
interface DeductionCategory {
  id: string
  label: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  items: DeductionItem[]
}

interface DeductionItem {
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

// Deduction categories configuration
const DEDUCTION_CATEGORIES: DeductionCategory[] = [
  {
    id: 'home',
    label: 'Nhà ở',
    icon: Home,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-600',
    items: [
      {
        key: 'hasMortgage',
        label: 'Có vay mua nhà (Mortgage)',
        hint: '1098 - Lãi vay mua nhà có thể khấu trừ',
      },
      {
        key: 'hasPropertyTax',
        label: 'Có trả Property Tax',
        hint: 'Thuế bất động sản hàng năm',
      },
      {
        key: 'hasHomeOffice',
        label: 'Có Home Office',
        hint: 'Phòng làm việc tại nhà (cho self-employed)',
        detailFields: [
          { key: 'homeOfficeSqFt', label: 'Diện tích (sqft)', type: 'number', placeholder: '150' },
        ],
      },
    ],
  },
  {
    id: 'medical',
    label: 'Y tế & Sức khỏe',
    icon: Heart,
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-600',
    items: [
      {
        key: 'hasMedicalExpenses',
        label: 'Có chi phí y tế lớn',
        hint: 'Chỉ khấu trừ được phần vượt 7.5% AGI',
        detailFields: [
          { key: 'medicalMileage', label: 'Số dặm đi khám', type: 'number', placeholder: '0' },
        ],
      },
      {
        key: 'hasHSA',
        label: 'Có HSA (Health Savings Account)',
        hint: 'Tài khoản tiết kiệm sức khỏe',
      },
      {
        key: 'hasMarketplaceCoverage',
        label: 'Có bảo hiểm qua Marketplace',
        hint: '1095-A - Affordable Care Act',
      },
    ],
  },
  {
    id: 'education',
    label: 'Giáo dục',
    icon: GraduationCap,
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-600',
    items: [
      {
        key: 'hasStudentLoanInterest',
        label: 'Có trả lãi Student Loan',
        hint: '1098-E - Tối đa $2,500 khấu trừ',
      },
      {
        key: 'hasEducatorExpenses',
        label: 'Là giáo viên có chi phí lớp học',
        hint: 'Tối đa $300 cho giáo viên K-12',
      },
      {
        key: 'hasTuitionExpenses',
        label: 'Có trả học phí (Tuition)',
        hint: '1098-T - Học phí đại học/cao đẳng',
      },
    ],
  },
  {
    id: 'charity',
    label: 'Từ thiện',
    icon: HandHeart,
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-600',
    items: [
      {
        key: 'hasCharitableDonations',
        label: 'Có đóng góp từ thiện',
        hint: 'Tiền mặt hoặc hiện vật cho tổ chức 501(c)(3)',
        detailFields: [
          { key: 'noncashDonationValue', label: 'Giá trị hiện vật ($)', type: 'currency', placeholder: '0' },
        ],
      },
      {
        key: 'hasCasualtyLoss',
        label: 'Có thiệt hại do thiên tai',
        hint: 'Chỉ áp dụng cho vùng thiên tai được tuyên bố',
      },
    ],
  },
]

export function WizardStep3Deductions({
  answers,
  onChange,
  errors: _errors,
}: WizardStep3DeductionsProps) {
  // Use shared category toggle hook
  const { isExpanded, toggleCategory } = useCategoryToggle(['home'])

  // Use shared item toggle handler
  const handleItemToggle = createItemToggleHandler(answers, onChange)

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">Khấu trừ</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Chọn các khoản chi phí có thể khấu trừ thuế
        </p>
      </div>

      {/* Standard vs Itemized Info */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border mb-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Lưu ý:</span> IRS cho phép chọn giữa
          Standard Deduction ($14,600 cá nhân / $29,200 vợ chồng năm 2024) hoặc Itemized Deductions.
          Chúng tôi sẽ tính toán phương án có lợi nhất cho bạn.
        </p>
      </div>

      {DEDUCTION_CATEGORIES.map((category) => {
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
                        aria-label={`${item.label}${item.hint ? `. ${item.hint}` : ''}`}
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
        <label className="text-sm text-muted-foreground w-36">{field.label}:</label>
        <input
          type="number"
          min={0}
          value={value ?? ''}
          onChange={(e) => {
            const val = parseInt(e.target.value) || 0
            onChange(Math.max(0, val))
          }}
          placeholder={field.placeholder}
          className={cn(
            'w-24 px-3 py-1.5 rounded-lg border bg-card text-foreground text-sm',
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
        <label className="text-sm text-muted-foreground w-36">{field.label}:</label>
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
      <label className="text-sm text-muted-foreground w-36">{field.label}:</label>
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
