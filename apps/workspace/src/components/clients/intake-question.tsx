/**
 * IntakeQuestion - Dynamic question component for intake forms
 * Renders appropriate input based on fieldType with conditional visibility
 * Uses React.memo for performance with 100+ questions
 */

import { memo } from 'react'
import { cn } from '@ella/ui'
import { HelpCircle } from 'lucide-react'
import type { FieldType } from '../../lib/api-client'
import { CustomSelect } from '../ui/custom-select'

// XSS sanitization: strip HTML tags from text input
function sanitizeTextInput(value: string): string {
  return value.replace(/<[^>]*>/g, '').slice(0, 500) // Max 500 chars
}

interface IntakeQuestionProps {
  questionKey: string
  label: string
  hint?: string | null
  fieldType: FieldType
  options?: { value: string; label: string }[]
  value: unknown
  onChange: (key: string, value: unknown) => void
  condition?: { key: string; value: unknown }
  answers: Record<string, unknown>
}

// Memoized for performance with 100+ questions
export const IntakeQuestion = memo(function IntakeQuestion({
  questionKey,
  label,
  hint,
  fieldType,
  options,
  value,
  onChange,
  condition,
  answers,
}: IntakeQuestionProps) {
  // Check condition - hide if condition not met
  if (condition && answers[condition.key] !== condition.value) {
    return null
  }

  return (
    <div className="space-y-1">
      {fieldType === 'BOOLEAN' ? (
        <BooleanQuestion
          questionKey={questionKey}
          label={label}
          hint={hint}
          checked={value === true}
          onChange={(checked) => onChange(questionKey, checked)}
        />
      ) : fieldType === 'NUMBER' ? (
        <NumberQuestion
          questionKey={questionKey}
          label={label}
          hint={hint}
          value={(value as number) ?? 0}
          onChange={(val) => onChange(questionKey, val)}
        />
      ) : fieldType === 'CURRENCY' ? (
        <CurrencyQuestion
          questionKey={questionKey}
          label={label}
          hint={hint}
          value={(value as number) ?? 0}
          onChange={(val) => onChange(questionKey, val)}
        />
      ) : fieldType === 'NUMBER_INPUT' ? (
        <NumberInputQuestion
          questionKey={questionKey}
          label={label}
          hint={hint}
          value={(value as number) ?? undefined}
          onChange={(val) => onChange(questionKey, val)}
        />
      ) : fieldType === 'SELECT' ? (
        <SelectQuestion
          questionKey={questionKey}
          label={label}
          hint={hint}
          value={(value as string) ?? ''}
          options={options || []}
          onChange={(val) => onChange(questionKey, val)}
        />
      ) : fieldType === 'TEXT' ? (
        <TextQuestion
          questionKey={questionKey}
          label={label}
          hint={hint}
          value={(value as string) ?? ''}
          onChange={(val) => onChange(questionKey, val)}
        />
      ) : null}
    </div>
  )
})

// Boolean/Toggle Question
interface BooleanQuestionProps {
  questionKey: string
  label: string
  hint?: string | null
  checked: boolean
  onChange: (checked: boolean) => void
}

function BooleanQuestion({
  questionKey,
  label,
  hint,
  checked,
  onChange,
}: BooleanQuestionProps) {
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
        {hint && (
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
            {hint}
          </p>
        )}
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

// Number Question
interface NumberQuestionProps {
  questionKey: string
  label: string
  hint?: string | null
  value: number
  onChange: (value: number) => void
}

// Number bounds for validation (prevent unreasonable values)
const NUMBER_MIN = 0
const NUMBER_MAX = 99

function NumberQuestion({
  questionKey,
  label,
  hint,
  value,
  onChange,
}: NumberQuestionProps) {
  const clampValue = (val: number) => Math.max(NUMBER_MIN, Math.min(NUMBER_MAX, val))

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border">
      <div className="flex-1">
        <label
          htmlFor={questionKey}
          className="text-sm font-medium text-foreground"
        >
          {label}
        </label>
        {hint && (
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
            {hint}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 ml-3">
        <button
          type="button"
          onClick={() => onChange(clampValue(value - 1))}
          disabled={value <= NUMBER_MIN}
          className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Giảm"
        >
          -
        </button>
        <input
          id={questionKey}
          type="number"
          min={NUMBER_MIN}
          max={NUMBER_MAX}
          value={value}
          onChange={(e) => onChange(clampValue(parseInt(e.target.value) || 0))}
          className="w-12 text-center px-1 py-1 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="button"
          onClick={() => onChange(clampValue(value + 1))}
          disabled={value >= NUMBER_MAX}
          className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Tăng"
        >
          +
        </button>
      </div>
    </div>
  )
}

// Currency Question - for monetary values (estimated tax, AGI, etc.)
interface CurrencyQuestionProps {
  questionKey: string
  label: string
  hint?: string | null
  value: number
  onChange: (value: number) => void
}

// Format number with commas for display
function formatCurrency(value: number): string {
  if (!value && value !== 0) return ''
  return value.toLocaleString('en-US')
}

// Parse formatted string back to number
function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^0-9]/g, '')
  return parseInt(cleaned, 10) || 0
}

function CurrencyQuestion({
  questionKey,
  label,
  hint,
  value,
  onChange,
}: CurrencyQuestionProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={questionKey}
        className="block text-sm font-medium text-foreground"
      >
        {label}
      </label>
      {hint && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <HelpCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {hint}
        </p>
      )}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
          $
        </span>
        <input
          id={questionKey}
          type="text"
          inputMode="numeric"
          value={value ? formatCurrency(value) : ''}
          onChange={(e) => onChange(parseCurrency(e.target.value))}
          placeholder="0"
          className={cn(
            'w-full pl-7 pr-3 py-2.5 rounded-lg border bg-card text-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
            'border-border'
          )}
        />
      </div>
    </div>
  )
}

// Number Input Question - for larger numbers that need typing (sq ft, mileage, etc.)
interface NumberInputQuestionProps {
  questionKey: string
  label: string
  hint?: string | null
  value: number | undefined
  onChange: (value: number) => void
}

function NumberInputQuestion({
  questionKey,
  label,
  hint,
  value,
  onChange,
}: NumberInputQuestionProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={questionKey}
        className="block text-sm font-medium text-foreground"
      >
        {label}
      </label>
      {hint && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <HelpCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {hint}
        </p>
      )}
      <input
        id={questionKey}
        type="number"
        inputMode="numeric"
        value={value ?? ''}
        onChange={(e) => {
          const val = e.target.value
          onChange(val === '' ? 0 : parseInt(val, 10) || 0)
        }}
        placeholder="0"
        className={cn(
          'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
          'border-border'
        )}
      />
    </div>
  )
}

// Select Question
interface SelectQuestionProps {
  questionKey: string
  label: string
  hint?: string | null
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

function SelectQuestion({
  questionKey,
  label,
  hint,
  value,
  options,
  onChange,
}: SelectQuestionProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={questionKey}
        className="block text-sm font-medium text-foreground"
      >
        {label}
      </label>
      {hint && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <HelpCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {hint}
        </p>
      )}
      <CustomSelect
        value={value}
        onChange={onChange}
        options={options}
        placeholder="Chọn..."
      />
    </div>
  )
}

// Text Question
interface TextQuestionProps {
  questionKey: string
  label: string
  hint?: string | null
  value: string
  onChange: (value: string) => void
}

function TextQuestion({
  questionKey,
  label,
  hint,
  value,
  onChange,
}: TextQuestionProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={questionKey}
        className="block text-sm font-medium text-foreground"
      >
        {label}
      </label>
      {hint && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <HelpCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {hint}
        </p>
      )}
      <input
        id={questionKey}
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
