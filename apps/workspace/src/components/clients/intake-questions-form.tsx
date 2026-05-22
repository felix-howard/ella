/**
 * Intake Questions Form Component - Dynamic conditional form for client intake
 * Shows/hides questions based on previous answers (e.g., kids questions after hasKidsUnder17)
 */

import { cn } from '@ella/ui'
import { useTranslation } from 'react-i18next'
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
  { value: 'SINGLE', labelKey: 'filingStatus.single' },
  { value: 'MARRIED_FILING_JOINTLY', labelKey: 'filingStatus.marriedJointly' },
  { value: 'MARRIED_FILING_SEPARATELY', labelKey: 'filingStatus.marriedSeparately' },
  { value: 'HEAD_OF_HOUSEHOLD', labelKey: 'filingStatus.headOfHousehold' },
  { value: 'QUALIFYING_WIDOW', labelKey: 'filingStatus.qualifyingWidow' },
]

// Tax type options
const TAX_TYPE_OPTIONS: { value: TaxType; labelKey: string; descriptionKey: string }[] = [
  { value: 'FORM_1040', labelKey: 'legacyIntake.taxType.form1040', descriptionKey: 'legacyIntake.taxType.form1040Desc' },
  { value: 'FORM_1120S', labelKey: 'legacyIntake.taxType.form1120S', descriptionKey: 'legacyIntake.taxType.form1120SDesc' },
  { value: 'FORM_1065', labelKey: 'legacyIntake.taxType.form1065', descriptionKey: 'legacyIntake.taxType.form1065Desc' },
]

// Available tax years (current year - 1 is the latest filing year)
const currentYear = new Date().getFullYear() - 1
const TAX_YEARS = [currentYear, currentYear - 1, currentYear - 2]

export function IntakeQuestionsForm({ data, onChange, errors }: IntakeQuestionsFormProps) {
  const { t } = useTranslation()
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
      <FormSection title={t('section.taxInfo')}>
        {/* Tax Year */}
        <FormRow>
          <FormLabel required>{t('legacyIntake.taxYear')}</FormLabel>
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
          <FormLabel required>{t('legacyIntake.taxReturnType')}</FormLabel>
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
                <span className="font-medium text-foreground text-sm">{t(option.labelKey)}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{t(option.descriptionKey)}</p>
              </button>
            ))}
          </div>
          {errors?.taxTypes && <FormError>{errors.taxTypes}</FormError>}
        </FormRow>

        {/* Filing Status */}
        <FormRow>
          <FormLabel required>{t('legacyIntake.filingStatus')}</FormLabel>
          <CustomSelect
            value={data.filingStatus || ''}
            onChange={(value) => handleChange('filingStatus', value)}
            options={FILING_STATUS_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
            placeholder={t('legacyIntake.selectStatus')}
            error={!!errors?.filingStatus}
          />
          {errors?.filingStatus && <FormError>{errors.filingStatus}</FormError>}
        </FormRow>
      </FormSection>

      {/* Section: Income Sources */}
      <FormSection title={t('section.income')}>
        <div className="space-y-3">
          <ToggleQuestion
            label={t('legacyIntake.hasW2')}
            checked={data.hasW2}
            onChange={(v) => handleChange('hasW2', v)}
          />
          <ToggleQuestion
            label={t('legacyIntake.hasBankAccount')}
            checked={data.hasBankAccount}
            onChange={(v) => handleChange('hasBankAccount', v)}
            hint={t('legacyIntake.bankAccountHint')}
          />
          <ToggleQuestion
            label={t('legacyIntake.hasInvestments')}
            checked={data.hasInvestments}
            onChange={(v) => handleChange('hasInvestments', v)}
          />
          <ToggleQuestion
            label={t('legacyIntake.hasSelfEmployment')}
            checked={data.hasSelfEmployment}
            onChange={(v) => handleChange('hasSelfEmployment', v)}
            hint={t('legacyIntake.selfEmploymentHint')}
          />
          <ToggleQuestion
            label={t('legacyIntake.hasRentalProperty')}
            checked={data.hasRentalProperty}
            onChange={(v) => handleChange('hasRentalProperty', v)}
          />
        </div>
      </FormSection>

      {/* Section: Dependents - Conditional */}
      <FormSection title={t('section.dependents')}>
        <div className="space-y-3">
          <ToggleQuestion
            label={t('legacyIntake.hasKidsUnder17')}
            checked={data.hasKidsUnder17}
            onChange={(v) => {
              handleChange('hasKidsUnder17', v)
              if (!v) {
                onChange({ numKidsUnder17: 0, paysDaycare: false })
              }
            }}
            hint={t('legacyIntake.childTaxCreditHint')}
          />

          {/* Conditional: Number of kids */}
          {data.hasKidsUnder17 && (
            <div className="ml-6 pl-4 border-l-2 border-primary-light space-y-3">
              <FormRow>
                <FormLabel>{t('legacyIntake.numKidsUnder17')}</FormLabel>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleChange('numKidsUnder17', Math.max(1, (data.numKidsUnder17 || 1) - 1))}
                    className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-medium"
                    aria-label={t('common.decrease')}
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
                    aria-label={t('common.increase')}
                  >
                    +
                  </button>
                </div>
              </FormRow>

              <ToggleQuestion
                label={t('legacyIntake.paysDaycare')}
                checked={data.paysDaycare}
                onChange={(v) => handleChange('paysDaycare', v)}
                hint={t('legacyIntake.daycareHint')}
              />
            </div>
          )}

          <ToggleQuestion
            label={t('legacyIntake.hasKids17to24')}
            checked={data.hasKids17to24}
            onChange={(v) => handleChange('hasKids17to24', v)}
            hint={t('legacyIntake.educationCreditHint')}
          />
        </div>
      </FormSection>

      {/* Section: Business - Conditional */}
      {showBusinessQuestions && (
        <FormSection title={t('section.business')}>
          <div className="space-y-3">
            <ToggleQuestion
              label={t('legacyIntake.hasEmployees')}
              checked={data.hasEmployees}
              onChange={(v) => handleChange('hasEmployees', v)}
            />
            <ToggleQuestion
              label={t('legacyIntake.hasContractors')}
              checked={data.hasContractors}
              onChange={(v) => handleChange('hasContractors', v)}
            />
            <ToggleQuestion
              label={t('legacyIntake.has1099K')}
              checked={data.has1099K}
              onChange={(v) => handleChange('has1099K', v)}
              hint={t('legacyIntake.has1099KHint')}
            />
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
// eslint-disable-next-line react-refresh/only-export-components
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
    hasEmployees: false,
    hasContractors: false,
    has1099K: false,
  }
}
