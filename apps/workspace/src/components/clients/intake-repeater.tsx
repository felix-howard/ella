/**
 * IntakeRepeater - Repeater component for count-based intake fields
 * Renders multiple input blocks based on a count value (e.g., rental properties, K-1s)
 */

import { HelpCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import type { FieldType } from '../../lib/api-client'
import { CustomSelect } from '../ui/custom-select'

interface RepeaterOption {
  value: string
  label?: string
  labelVi?: string
  labelEn?: string
  labelKey?: string
  labelViKey?: string
  labelEnKey?: string
}

interface RepeaterField {
  suffix: string // e.g., 'Address' -> rentalAddress_1, rentalAddress_2
  labelVi?: string
  labelEn: string
  labelViKey?: string
  labelEnKey?: string
  fieldType: FieldType
  options?: RepeaterOption[]
}

interface IntakeRepeaterProps {
  countKey: string
  itemLabel: string
  itemLabelVi?: string
  itemLabelViKey?: string
  labelVi?: string
  labelEn?: string
  labelViKey?: string
  labelEnKey?: string
  maxItems?: number
  fields: RepeaterField[]
  answers: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}

// XSS sanitization: strip HTML tags from text input
function sanitizeTextInput(value: string): string {
  return value.replace(/<[^>]*>/g, '').slice(0, 500)
}

export function IntakeRepeater({
  countKey,
  itemLabel,
  itemLabelVi,
  itemLabelViKey,
  labelVi,
  labelEn,
  labelViKey,
  labelEnKey,
  maxItems = 10,
  fields,
  answers,
  onChange,
}: IntakeRepeaterProps) {
  const { i18n, t } = useTranslation()
  const language = i18n.language
  const count = typeof answers[countKey] === 'number'
    ? Math.min(answers[countKey] as number, maxItems)
    : 0

  if (count === 0) return null

  return (
    <div className="space-y-4 mt-4 pl-4 border-l-2 border-primary/20">
      <h4 className="text-sm font-medium text-muted-foreground">
        {getLocalizedText(labelEn, labelVi, language, t, labelEnKey, labelViKey)} ({count}{' '}
        {getLocalizedText(itemLabel, itemLabelVi, language, t, undefined, itemLabelViKey)})
      </h4>

      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="bg-muted/30 rounded-lg p-4 space-y-3">
          <div className="text-sm font-medium text-foreground">
            {getLocalizedText(itemLabel, itemLabelVi, language, t, undefined, itemLabelViKey)} #{index + 1}
          </div>

          {fields.map(field => {
            const key = `${field.suffix}_${index + 1}`
            const value = answers[key]

            return (
              <RepeaterFieldInput
                key={key}
                fieldKey={key}
                field={field}
                value={value}
                onChange={onChange}
                language={language}
                t={t}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

interface RepeaterFieldInputProps {
  fieldKey: string
  field: RepeaterField
  value: unknown
  onChange: (key: string, value: unknown) => void
  language: string
  t: ReturnType<typeof useTranslation>['t']
}

function RepeaterFieldInput({
  fieldKey,
  field,
  value,
  onChange,
  language,
  t,
}: RepeaterFieldInputProps) {
  const { fieldType, labelVi, labelEn, labelViKey, labelEnKey, options } = field
  const label = getLocalizedText(labelEn, labelVi, language, t, labelEnKey, labelViKey)

  if (fieldType === 'BOOLEAN') {
    return (
      <BooleanField
        fieldKey={fieldKey}
        label={label}
        hint={labelEn}
        checked={value === true}
        onChange={(checked) => onChange(fieldKey, checked)}
      />
    )
  }

  if (fieldType === 'NUMBER') {
    return (
      <NumberField
        fieldKey={fieldKey}
        label={label}
        hint={labelEn}
        value={typeof value === 'number' ? value : 0}
        onChange={(val) => onChange(fieldKey, val)}
      />
    )
  }

  if (fieldType === 'SELECT' && options) {
    return (
      <SelectField
        fieldKey={fieldKey}
        label={label}
        hint={labelEn}
        value={typeof value === 'string' ? value : ''}
        options={getLocalizedOptions(options, language, t)}
        onChange={(val) => onChange(fieldKey, val)}
      />
    )
  }

  // Default to TEXT
  return (
    <TextField
      fieldKey={fieldKey}
      label={label}
      hint={labelEn}
      value={typeof value === 'string' ? value : ''}
      onChange={(val) => onChange(fieldKey, val)}
    />
  )
}

// Boolean field
interface BooleanFieldProps {
  fieldKey: string
  label: string
  hint: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function BooleanField({
  fieldKey: _fieldKey,
  label,
  hint,
  checked,
  onChange,
}: BooleanFieldProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer',
        checked
          ? 'border-primary bg-primary-light/50'
          : 'border-border hover:border-primary/30'
      )}
      onClick={() => onChange(!checked)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onChange(!checked)
        }
      }}
      aria-pressed={checked}
      aria-label={label}
    >
      <div className="flex-1">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
          <HelpCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {hint}
        </p>
      </div>
      <div
        className={cn(
          'w-10 h-6 rounded-full p-0.5 transition-colors ml-3',
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

// Number field
interface NumberFieldProps {
  fieldKey: string
  label: string
  hint: string
  value: number
  onChange: (value: number) => void
}

function NumberField({
  fieldKey,
  label,
  hint,
  value,
  onChange,
}: NumberFieldProps) {
  const clampValue = (val: number) => Math.max(0, Math.min(99999999, val))

  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldKey} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <HelpCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
        {hint}
      </p>
      <input
        id={fieldKey}
        type="number"
        min={0}
        max={99999999}
        value={value}
        onChange={(e) => onChange(clampValue(parseInt(e.target.value) || 0))}
        className={cn(
          'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
          'border-border'
        )}
      />
    </div>
  )
}

// Select field
interface SelectFieldProps {
  fieldKey: string
  label: string
  hint: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

function SelectField({
  fieldKey,
  label,
  hint,
  value,
  options,
  onChange,
}: SelectFieldProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldKey} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <HelpCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
        {hint}
      </p>
      <CustomSelect
        value={value}
        onChange={onChange}
        options={options}
        placeholder={t('common.selectPlaceholder')}
      />
    </div>
  )
}

// Text field
interface TextFieldProps {
  fieldKey: string
  label: string
  hint: string
  value: string
  onChange: (value: string) => void
}

function TextField({
  fieldKey,
  label,
  hint,
  value,
  onChange,
}: TextFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldKey} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <HelpCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
        {hint}
      </p>
      <input
        id={fieldKey}
        type="text"
        value={value}
        onChange={(e) => onChange(sanitizeTextInput(e.target.value))}
        maxLength={500}
        className={cn(
          'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
          'border-border'
        )}
      />
    </div>
  )
}

function getLocalizedText(
  english: string | undefined,
  vietnamese: string | undefined,
  language: string,
  t: ReturnType<typeof useTranslation>['t'],
  englishKey?: string,
  vietnameseKey?: string
): string {
  const englishText = englishKey ? t(englishKey, { lng: 'en' }) : english
  const vietnameseText = vietnameseKey ? t(vietnameseKey, { lng: 'vi' }) : vietnamese
  if (language.toLowerCase().startsWith('vi')) return vietnameseText || englishText || ''
  return englishText || vietnameseText || ''
}

function getLocalizedOptions(
  options: RepeaterOption[],
  language: string,
  t: ReturnType<typeof useTranslation>['t']
): { value: string; label: string }[] {
  return options.map((option) => ({
    value: option.value,
    label: getLocalizedText(
      option.labelEn || option.label,
      option.labelVi || option.label,
      language,
      t,
      option.labelEnKey || option.labelKey,
      option.labelViKey || option.labelKey
    ),
  }))
}

// Export repeater configuration for common use cases
// eslint-disable-next-line react-refresh/only-export-components
export const REPEATER_CONFIGS = {
  rental: {
    countKey: 'rentalPropertyCount',
    itemLabel: 'Property',
    itemLabelViKey: 'intakeRepeater.rental.itemLabel',
    labelEn: 'Rental property details',
    labelViKey: 'intakeRepeater.rental.label',
    maxItems: 10,
    fields: [
      {
        suffix: 'rentalAddress',
        labelViKey: 'intakeRepeater.rental.address',
        labelEn: 'Property address',
        fieldType: 'TEXT' as FieldType,
      },
      {
        suffix: 'rentalType',
        labelViKey: 'intakeRepeater.rental.type',
        labelEn: 'Property type',
        fieldType: 'SELECT' as FieldType,
        options: [
          { value: 'SINGLE_FAMILY', labelEn: 'Single family', labelViKey: 'intakeRepeater.rental.option.singleFamily' },
          { value: 'MULTI_FAMILY', labelEn: 'Multi-family', labelViKey: 'intakeRepeater.rental.option.multiFamily' },
          { value: 'CONDO', labelEn: 'Condo', labelViKey: 'intakeRepeater.rental.option.condo' },
          { value: 'COMMERCIAL', labelEn: 'Commercial', labelViKey: 'intakeRepeater.rental.option.commercial' },
        ],
      },
    ],
  },
  k1: {
    countKey: 'k1Count',
    itemLabel: 'K-1',
    labelEn: 'K-1 details',
    labelViKey: 'intakeRepeater.k1.label',
    maxItems: 10,
    fields: [
      {
        suffix: 'k1EntityName',
        labelViKey: 'intakeRepeater.k1.entityName',
        labelEn: 'Entity name',
        fieldType: 'TEXT' as FieldType,
      },
      {
        suffix: 'k1EIN',
        labelViKey: 'intakeRepeater.k1.entityEin',
        labelEn: 'Entity EIN',
        fieldType: 'TEXT' as FieldType,
      },
    ],
  },
  w2: {
    countKey: 'w2Count',
    itemLabel: 'W-2',
    labelEn: 'W-2 details',
    labelViKey: 'intakeRepeater.w2.label',
    maxItems: 10,
    fields: [
      {
        suffix: 'w2EmployerName',
        labelViKey: 'intakeRepeater.w2.employerName',
        labelEn: 'Employer name',
        fieldType: 'TEXT' as FieldType,
      },
    ],
  },
}
