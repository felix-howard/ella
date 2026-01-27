/**
 * Step 2: Tax Year & Form Type Selection
 * - Tax year selection (current year default, 2 years back)
 * - Form type selection (optional, 1040 default)
 * - Info message about optional questionnaire
 */

import { Button } from '@ella/ui'
import { cn } from '@ella/ui'
import { Info } from 'lucide-react'
import type { CreateClientFormData, StepProps } from './types'

const CURRENT_YEAR = new Date().getFullYear()

const TAX_YEARS = [
  { value: CURRENT_YEAR, label: String(CURRENT_YEAR) },
  { value: CURRENT_YEAR - 1, label: String(CURRENT_YEAR - 1) },
  { value: CURRENT_YEAR - 2, label: String(CURRENT_YEAR - 2) },
]

const FORM_TYPES: Array<{
  value: CreateClientFormData['formType']
  label: string
  description: string
}> = [
  { value: '1040', label: '1040 (Cá nhân)', description: 'Tờ khai thuế cá nhân' },
  { value: '1120S', label: '1120S (S-Corp)', description: 'Tờ khai thuế S-Corporation' },
  { value: '1065', label: '1065 (Partnership)', description: 'Tờ khai thuế hợp danh' },
]

export function Step2TaxYear({ formData, onUpdate, onNext, onBack }: StepProps) {
  return (
    <div className="space-y-6">
      {/* Tax Year Selection */}
      <div className="space-y-2">
        <label id="tax-year-label" className="text-sm font-medium text-foreground">
          Năm thuế <span className="text-destructive">*</span>
        </label>
        <div
          className="flex gap-2"
          role="radiogroup"
          aria-labelledby="tax-year-label"
        >
          {TAX_YEARS.map((year) => (
            <button
              key={year.value}
              type="button"
              role="radio"
              aria-checked={formData.taxYear === year.value}
              onClick={() => onUpdate({ taxYear: year.value })}
              className={cn(
                'flex-1 py-3 px-4 rounded-lg border text-sm font-medium transition-all',
                formData.taxYear === year.value
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background border-border hover:bg-muted hover:border-muted-foreground/30'
              )}
            >
              {year.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form Type Selection (Optional) */}
      <div className="space-y-2">
        <label id="form-type-label" className="text-sm font-medium text-foreground">
          Loại tờ khai{' '}
          <span className="text-muted-foreground font-normal">(không bắt buộc)</span>
        </label>
        <div
          className="space-y-2"
          role="radiogroup"
          aria-labelledby="form-type-label"
        >
          {FORM_TYPES.map((form) => (
            <button
              key={form.value}
              type="button"
              role="radio"
              aria-checked={formData.formType === form.value}
              onClick={() => onUpdate({ formType: form.value })}
              className={cn(
                'w-full flex flex-col items-start p-3 rounded-lg border text-left transition-all',
                formData.formType === form.value
                  ? 'bg-primary/5 border-primary'
                  : 'bg-background border-border hover:bg-muted'
              )}
            >
              <span
                className={cn(
                  'text-sm font-medium',
                  formData.formType === form.value ? 'text-primary' : 'text-foreground'
                )}
              >
                {form.label}
              </span>
              <span className="text-xs text-muted-foreground">{form.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Info Message */}
      <div className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-muted">
        <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Bạn có thể bổ sung thông tin chi tiết sau khi khách gửi tài liệu. Không cần
          điền questionnaire ngay bây giờ.
        </p>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack}>
          ← Quay lại
        </Button>
        <Button onClick={onNext}>Tiếp tục →</Button>
      </div>
    </div>
  )
}
