/**
 * Intake Questions Form Component - Dynamic conditional form for client intake
 * Shows/hides questions based on previous answers (e.g., kids questions after hasKidsUnder17)
 */

import { cn } from '@ella/ui'
import { HelpCircle } from 'lucide-react'
import type { TaxType } from '../../lib/api-client'
import { CustomSelect } from '../ui/custom-select'

// Profile form data type
export interface IntakeFormData {
  // Tax info
  taxYear: number
  taxTypes: TaxType[]
  filingStatus: string
  // Income sources
  hasW2: boolean
  hasBankAccount: boolean
  hasInvestments: boolean
  // Dependents
  hasKidsUnder17: boolean
  numKidsUnder17: number
  paysDaycare: boolean
  hasKids17to24: boolean
  // Business
  hasSelfEmployment: boolean
  hasRentalProperty: boolean
  businessName: string
  ein: string
  hasEmployees: boolean
  hasContractors: boolean
  has1099K: boolean
}

interface IntakeQuestionsFormProps {
  data: IntakeFormData
  onChange: (data: Partial<IntakeFormData>) => void
  errors?: Partial<Record<keyof IntakeFormData, string>>
}

// Filing status options
const FILING_STATUS_OPTIONS = [
  { value: 'SINGLE', label: 'Độc thân' },
  { value: 'MARRIED_FILING_JOINTLY', label: 'Vợ chồng khai chung' },
  { value: 'MARRIED_FILING_SEPARATELY', label: 'Vợ chồng khai riêng' },
  { value: 'HEAD_OF_HOUSEHOLD', label: 'Chủ hộ' },
  { value: 'QUALIFYING_WIDOW', label: 'Góa phụ có con' },
]

// Tax type options
const TAX_TYPE_OPTIONS: { value: TaxType; label: string; description: string }[] = [
  { value: 'FORM_1040', label: '1040 (Cá nhân)', description: 'Tờ khai thuế cá nhân' },
  { value: 'FORM_1120S', label: '1120S (S-Corp)', description: 'Tờ khai thuế S-Corporation' },
  { value: 'FORM_1065', label: '1065 (Partnership)', description: 'Tờ khai thuế hợp danh' },
]

// Available tax years
const TAX_YEARS = [2025, 2024, 2023]

export function IntakeQuestionsForm({ data, onChange, errors }: IntakeQuestionsFormProps) {
  const handleChange = <K extends keyof IntakeFormData>(field: K, value: IntakeFormData[K]) => {
    onChange({ [field]: value })
  }

  const handleTaxTypeToggle = (taxType: TaxType) => {
    const current = data.taxTypes || []
    const updated = current.includes(taxType)
      ? current.filter((t) => t !== taxType)
      : [...current, taxType]
    onChange({ taxTypes: updated })
  }

  // Show business questions if hasSelfEmployment or FORM_1120S/1065 selected
  const showBusinessQuestions =
    data.hasSelfEmployment ||
    data.taxTypes?.includes('FORM_1120S') ||
    data.taxTypes?.includes('FORM_1065')

  return (
    <div className="space-y-8">
      {/* Section: Tax Information */}
      <FormSection title="Thông tin thuế">
        {/* Tax Year */}
        <FormRow>
          <FormLabel required>Năm thuế</FormLabel>
          <div className="flex gap-2">
            {TAX_YEARS.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => handleChange('taxYear', year)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  data.taxYear === year
                    ? 'bg-primary text-white'
                    : 'bg-muted text-foreground hover:bg-muted/80'
                )}
              >
                {year}
              </button>
            ))}
          </div>
          {errors?.taxYear && <FormError>{errors.taxYear}</FormError>}
        </FormRow>

        {/* Tax Types */}
        <FormRow>
          <FormLabel required>Loại tờ khai</FormLabel>
          <div className="grid gap-2 sm:grid-cols-3">
            {TAX_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleTaxTypeToggle(option.value)}
                className={cn(
                  'p-3 rounded-lg border-2 text-left transition-colors',
                  data.taxTypes?.includes(option.value)
                    ? 'border-primary bg-primary-light'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <span className="font-medium text-foreground text-sm">{option.label}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
              </button>
            ))}
          </div>
          {errors?.taxTypes && <FormError>{errors.taxTypes}</FormError>}
        </FormRow>

        {/* Filing Status */}
        <FormRow>
          <FormLabel required>Tình trạng hôn nhân</FormLabel>
          <CustomSelect
            value={data.filingStatus || ''}
            onChange={(value) => handleChange('filingStatus', value)}
            options={FILING_STATUS_OPTIONS}
            placeholder="Chọn tình trạng..."
            error={!!errors?.filingStatus}
          />
          {errors?.filingStatus && <FormError>{errors.filingStatus}</FormError>}
        </FormRow>
      </FormSection>

      {/* Section: Income Sources */}
      <FormSection title="Nguồn thu nhập">
        <div className="space-y-3">
          <ToggleQuestion
            label="Có W2 (thu nhập từ công việc)?"
            checked={data.hasW2}
            onChange={(v) => handleChange('hasW2', v)}
          />
          <ToggleQuestion
            label="Có tài khoản ngân hàng tại Mỹ?"
            checked={data.hasBankAccount}
            onChange={(v) => handleChange('hasBankAccount', v)}
            hint="Để nhận tiền hoàn thuế bằng Direct Deposit"
          />
          <ToggleQuestion
            label="Có đầu tư (cổ phiếu, crypto, bất động sản)?"
            checked={data.hasInvestments}
            onChange={(v) => handleChange('hasInvestments', v)}
          />
          <ToggleQuestion
            label="Có hoạt động tự kinh doanh?"
            checked={data.hasSelfEmployment}
            onChange={(v) => handleChange('hasSelfEmployment', v)}
            hint="Freelance, 1099-NEC, hoặc kinh doanh cá nhân"
          />
          <ToggleQuestion
            label="Có thu nhập từ cho thuê nhà?"
            checked={data.hasRentalProperty}
            onChange={(v) => handleChange('hasRentalProperty', v)}
          />
        </div>
      </FormSection>

      {/* Section: Dependents - Conditional */}
      <FormSection title="Người phụ thuộc">
        <div className="space-y-3">
          <ToggleQuestion
            label="Có con dưới 17 tuổi?"
            checked={data.hasKidsUnder17}
            onChange={(v) => {
              handleChange('hasKidsUnder17', v)
              if (!v) {
                onChange({ numKidsUnder17: 0, paysDaycare: false })
              }
            }}
            hint="Có thể được Child Tax Credit ($2,000/con)"
          />

          {/* Conditional: Number of kids */}
          {data.hasKidsUnder17 && (
            <div className="ml-6 pl-4 border-l-2 border-primary-light space-y-3">
              <FormRow>
                <FormLabel>Số con dưới 17 tuổi</FormLabel>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleChange('numKidsUnder17', Math.max(1, (data.numKidsUnder17 || 1) - 1))}
                    className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-medium"
                    aria-label="Giảm"
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-medium text-foreground">
                    {data.numKidsUnder17 || 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleChange('numKidsUnder17', (data.numKidsUnder17 || 1) + 1)}
                    className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-medium"
                    aria-label="Tăng"
                  >
                    +
                  </button>
                </div>
              </FormRow>

              <ToggleQuestion
                label="Có trả tiền Daycare cho con?"
                checked={data.paysDaycare}
                onChange={(v) => handleChange('paysDaycare', v)}
                hint="Có thể được Child and Dependent Care Credit"
              />
            </div>
          )}

          <ToggleQuestion
            label="Có con từ 17-24 tuổi đang đi học?"
            checked={data.hasKids17to24}
            onChange={(v) => handleChange('hasKids17to24', v)}
            hint="Có thể được American Opportunity Credit"
          />
        </div>
      </FormSection>

      {/* Section: Business - Conditional */}
      {showBusinessQuestions && (
        <FormSection title="Thông tin doanh nghiệp">
          <div className="space-y-4">
            <FormRow>
              <FormLabel>Tên doanh nghiệp</FormLabel>
              <input
                type="text"
                value={data.businessName || ''}
                onChange={(e) => handleChange('businessName', e.target.value)}
                placeholder="VD: ABC Consulting LLC"
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                  'border-border'
                )}
              />
            </FormRow>

            <FormRow>
              <FormLabel>EIN (nếu có)</FormLabel>
              <input
                type="text"
                value={data.ein || ''}
                onChange={(e) => handleChange('ein', e.target.value)}
                placeholder="XX-XXXXXXX"
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                  'border-border'
                )}
              />
            </FormRow>

            <div className="space-y-3">
              <ToggleQuestion
                label="Có nhân viên (W2)?"
                checked={data.hasEmployees}
                onChange={(v) => handleChange('hasEmployees', v)}
              />
              <ToggleQuestion
                label="Có trả cho contractors (1099-NEC)?"
                checked={data.hasContractors}
                onChange={(v) => handleChange('hasContractors', v)}
              />
              <ToggleQuestion
                label="Có nhận thanh toán qua thẻ (1099-K)?"
                checked={data.has1099K}
                onChange={(v) => handleChange('has1099K', v)}
                hint="Stripe, Square, PayPal Business, etc."
              />
            </div>
          </div>
        </FormSection>
      )}
    </div>
  )
}

// Form Section component
interface FormSectionProps {
  title: string
  children: React.ReactNode
}

function FormSection({ title, children }: FormSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-primary border-b border-border pb-2">
        {title}
      </h3>
      {children}
    </div>
  )
}

// Form Row component
function FormRow({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>
}

// Form Label component
interface FormLabelProps {
  children: React.ReactNode
  required?: boolean
}

function FormLabel({ children, required }: FormLabelProps) {
  return (
    <label className="block text-sm font-medium text-foreground">
      {children}
      {required && <span className="text-error ml-1">*</span>}
    </label>
  )
}

// Form Error component
function FormError({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-error">{children}</p>
}

// Toggle Question component
interface ToggleQuestionProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  hint?: string
}

function ToggleQuestion({ label, checked, onChange, hint }: ToggleQuestionProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer',
        checked ? 'border-primary bg-primary-light/50' : 'border-border hover:border-primary/30'
      )}
      onClick={() => onChange(!checked)}
    >
      <div className="flex-1">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {hint && (
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <HelpCircle className="w-3 h-3" aria-hidden="true" />
            {hint}
          </p>
        )}
      </div>
      <div
        className={cn(
          'w-10 h-6 rounded-full p-0.5 transition-colors',
          checked ? 'bg-primary' : 'bg-muted'
        )}
      >
        <div
          className={cn(
            'w-5 h-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </div>
    </div>
  )
}

// Default form data
export function getDefaultIntakeFormData(): IntakeFormData {
  return {
    taxYear: 2025,
    taxTypes: ['FORM_1040'],
    filingStatus: '',
    hasW2: false,
    hasBankAccount: false,
    hasInvestments: false,
    hasKidsUnder17: false,
    numKidsUnder17: 0,
    paysDaycare: false,
    hasKids17to24: false,
    hasSelfEmployment: false,
    hasRentalProperty: false,
    businessName: '',
    ein: '',
    hasEmployees: false,
    hasContractors: false,
    has1099K: false,
  }
}
