/**
 * IntakeRepeater - Repeater component for count-based intake fields
 * Renders multiple input blocks based on a count value (e.g., rental properties, K-1s)
 */

import { HelpCircle } from 'lucide-react'
import { cn } from '@ella/ui'
import type { FieldType } from '../../lib/api-client'
import { CustomSelect } from '../ui/custom-select'

interface RepeaterField {
  suffix: string // e.g., 'Address' -> rentalAddress_1, rentalAddress_2
  labelVi: string
  labelEn: string
  fieldType: FieldType
  options?: { value: string; label: string }[]
}

interface IntakeRepeaterProps {
  countKey: string
  itemLabel: string
  labelVi: string
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
  labelVi,
  maxItems = 10,
  fields,
  answers,
  onChange,
}: IntakeRepeaterProps) {
  const count = typeof answers[countKey] === 'number'
    ? Math.min(answers[countKey] as number, maxItems)
    : 0

  if (count === 0) return null

  return (
    <div className="space-y-4 mt-4 pl-4 border-l-2 border-primary/20">
      <h4 className="text-sm font-medium text-muted-foreground">
        {labelVi} ({count} {itemLabel})
      </h4>

      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="bg-muted/30 rounded-lg p-4 space-y-3">
          <div className="text-sm font-medium text-foreground">
            {itemLabel} #{index + 1}
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
}

function RepeaterFieldInput({
  fieldKey,
  field,
  value,
  onChange,
}: RepeaterFieldInputProps) {
  const { fieldType, labelVi, labelEn, options } = field

  if (fieldType === 'BOOLEAN') {
    return (
      <BooleanField
        fieldKey={fieldKey}
        labelVi={labelVi}
        labelEn={labelEn}
        checked={value === true}
        onChange={(checked) => onChange(fieldKey, checked)}
      />
    )
  }

  if (fieldType === 'NUMBER') {
    return (
      <NumberField
        fieldKey={fieldKey}
        labelVi={labelVi}
        labelEn={labelEn}
        value={typeof value === 'number' ? value : 0}
        onChange={(val) => onChange(fieldKey, val)}
      />
    )
  }

  if (fieldType === 'SELECT' && options) {
    return (
      <SelectField
        fieldKey={fieldKey}
        labelVi={labelVi}
        labelEn={labelEn}
        value={typeof value === 'string' ? value : ''}
        options={options}
        onChange={(val) => onChange(fieldKey, val)}
      />
    )
  }

  // Default to TEXT
  return (
    <TextField
      fieldKey={fieldKey}
      labelVi={labelVi}
      labelEn={labelEn}
      value={typeof value === 'string' ? value : ''}
      onChange={(val) => onChange(fieldKey, val)}
    />
  )
}

// Boolean field
interface BooleanFieldProps {
  fieldKey: string
  labelVi: string
  labelEn: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function BooleanField({
  fieldKey: _fieldKey,
  labelVi,
  labelEn,
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
      aria-label={labelVi}
    >
      <div className="flex-1">
        <span className="text-sm font-medium text-foreground">{labelVi}</span>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
          <HelpCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {labelEn}
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
  labelVi: string
  labelEn: string
  value: number
  onChange: (value: number) => void
}

function NumberField({
  fieldKey,
  labelVi,
  labelEn,
  value,
  onChange,
}: NumberFieldProps) {
  const clampValue = (val: number) => Math.max(0, Math.min(99999999, val))

  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldKey} className="block text-sm font-medium text-foreground">
        {labelVi}
      </label>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <HelpCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
        {labelEn}
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
  labelVi: string
  labelEn: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

function SelectField({
  fieldKey,
  labelVi,
  labelEn,
  value,
  options,
  onChange,
}: SelectFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldKey} className="block text-sm font-medium text-foreground">
        {labelVi}
      </label>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <HelpCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
        {labelEn}
      </p>
      <CustomSelect
        value={value}
        onChange={onChange}
        options={options}
        placeholder="Chọn..."
      />
    </div>
  )
}

// Text field
interface TextFieldProps {
  fieldKey: string
  labelVi: string
  labelEn: string
  value: string
  onChange: (value: string) => void
}

function TextField({
  fieldKey,
  labelVi,
  labelEn,
  value,
  onChange,
}: TextFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldKey} className="block text-sm font-medium text-foreground">
        {labelVi}
      </label>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <HelpCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
        {labelEn}
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

// Export repeater configuration for common use cases
export const REPEATER_CONFIGS = {
  rental: {
    countKey: 'rentalPropertyCount',
    itemLabel: 'Bất động sản',
    labelVi: 'Chi tiết bất động sản cho thuê',
    maxItems: 10,
    fields: [
      {
        suffix: 'rentalAddress',
        labelVi: 'Địa chỉ',
        labelEn: 'Property address',
        fieldType: 'TEXT' as FieldType,
      },
      {
        suffix: 'rentalType',
        labelVi: 'Loại bất động sản',
        labelEn: 'Property type',
        fieldType: 'SELECT' as FieldType,
        options: [
          { value: 'SINGLE_FAMILY', label: 'Nhà đơn lẻ' },
          { value: 'MULTI_FAMILY', label: 'Chung cư' },
          { value: 'CONDO', label: 'Căn hộ' },
          { value: 'COMMERCIAL', label: 'Thương mại' },
        ],
      },
    ],
  },
  k1: {
    countKey: 'k1Count',
    itemLabel: 'K-1',
    labelVi: 'Chi tiết K-1',
    maxItems: 10,
    fields: [
      {
        suffix: 'k1EntityName',
        labelVi: 'Tên công ty/partnership',
        labelEn: 'Entity name',
        fieldType: 'TEXT' as FieldType,
      },
      {
        suffix: 'k1EIN',
        labelVi: 'EIN của công ty',
        labelEn: 'Entity EIN',
        fieldType: 'TEXT' as FieldType,
      },
    ],
  },
  w2: {
    countKey: 'w2Count',
    itemLabel: 'W-2',
    labelVi: 'Chi tiết W-2',
    maxItems: 10,
    fields: [
      {
        suffix: 'w2EmployerName',
        labelVi: 'Tên công ty',
        labelEn: 'Employer name',
        fieldType: 'TEXT' as FieldType,
      },
    ],
  },
}
