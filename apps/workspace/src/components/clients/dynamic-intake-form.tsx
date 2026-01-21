/**
 * Dynamic Intake Questions Form - Fetches questions from API
 * Renders questions dynamically based on fieldType and conditions
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@ella/ui'
import { HelpCircle, Loader2 } from 'lucide-react'
import { api, type TaxType, type IntakeQuestion, type FieldType } from '../../lib/api-client'
import { CustomSelect } from '../ui/custom-select'

// Section labels for Vietnamese display
const SECTION_LABELS: Record<string, string> = {
  tax_info: 'Thông tin thuế',
  identity: 'Nhận dạng',
  income: 'Thu nhập',
  dependents: 'Người phụ thuộc',
  health: 'Bảo hiểm sức khỏe',
  deductions: 'Khấu trừ',
  credits: 'Tín dụng thuế',
  business: 'Kinh doanh',
  foreign: 'Nước ngoài',
  entity_info: 'Thông tin doanh nghiệp',
  ownership: 'Sở hữu',
  expenses: 'Chi phí',
  assets: 'Tài sản',
  state: 'Tiểu bang',
}

interface DynamicIntakeFormProps {
  taxTypes: TaxType[]
  answers: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  errors?: Record<string, string>
}

export function DynamicIntakeForm({ taxTypes, answers, onChange, errors }: DynamicIntakeFormProps) {
  // Fetch questions based on selected tax types
  const { data, isLoading, isError } = useQuery({
    queryKey: ['intake-questions', taxTypes],
    queryFn: () => api.getIntakeQuestions(taxTypes),
    enabled: taxTypes.length > 0,
  })

  const questions = data?.data || []

  // Group questions by section
  const questionsBySection = useMemo(() => {
    return questions.reduce(
      (acc, question) => {
        if (!acc[question.section]) {
          acc[question.section] = []
        }
        acc[question.section].push(question)
        return acc
      },
      {} as Record<string, IntakeQuestion[]>
    )
  }, [questions])

  // Check if a question should be shown based on condition
  const shouldShowQuestion = (question: IntakeQuestion): boolean => {
    if (!question.condition) return true

    try {
      const condition = JSON.parse(question.condition) as Record<string, unknown>
      for (const [key, expectedValue] of Object.entries(condition)) {
        if (answers[key] !== expectedValue) {
          return false
        }
      }
      return true
    } catch {
      return true // Show if condition parsing fails
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">Đang tải câu hỏi...</span>
      </div>
    )
  }

  if (isError || questions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Không có câu hỏi nào cho loại tờ khai đã chọn
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {Object.entries(questionsBySection).map(([section, sectionQuestions]) => {
        // Filter questions that should be shown
        const visibleQuestions = sectionQuestions.filter(shouldShowQuestion)
        if (visibleQuestions.length === 0) return null

        return (
          <FormSection key={section} title={SECTION_LABELS[section] || section}>
            <div className="space-y-3">
              {visibleQuestions.map((question) => (
                <DynamicQuestion
                  key={question.id}
                  question={question}
                  value={answers[question.questionKey]}
                  onChange={(value) => onChange(question.questionKey, value)}
                  error={errors?.[question.questionKey]}
                />
              ))}
            </div>
          </FormSection>
        )
      })}
    </div>
  )
}

// Individual question renderer
interface DynamicQuestionProps {
  question: IntakeQuestion
  value: unknown
  onChange: (value: unknown) => void
  error?: string
}

function DynamicQuestion({ question, value, onChange, error }: DynamicQuestionProps) {
  switch (question.fieldType) {
    case 'BOOLEAN':
      return (
        <ToggleQuestion
          label={question.labelVi}
          checked={value as boolean ?? false}
          onChange={onChange}
          hint={question.hintVi || undefined}
        />
      )

    case 'SELECT':
      return (
        <SelectQuestion
          label={question.labelVi}
          value={value as string ?? ''}
          onChange={onChange}
          options={parseOptions(question.options)}
          hint={question.hintVi || undefined}
          error={error}
        />
      )

    case 'NUMBER':
      return (
        <NumberQuestion
          label={question.labelVi}
          value={value as number ?? 0}
          onChange={onChange}
          hint={question.hintVi || undefined}
          error={error}
        />
      )

    case 'TEXT':
      return (
        <TextQuestion
          label={question.labelVi}
          value={value as string ?? ''}
          onChange={onChange}
          hint={question.hintVi || undefined}
          error={error}
        />
      )

    default:
      return null
  }
}

// Parse options from JSON string
// Handles both formats: { label } and { labelVi, labelEn }
function parseOptions(optionsJson: string | null): { value: string; label: string }[] {
  if (!optionsJson) return []
  try {
    const parsed = JSON.parse(optionsJson) as Array<{
      value: string | number
      label?: string
      labelVi?: string
      labelEn?: string
    }>
    return parsed.map((opt) => ({
      value: String(opt.value),
      label: opt.label || opt.labelVi || opt.labelEn || String(opt.value),
    }))
  } catch {
    return []
  }
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

// Toggle Question component (Yes/No)
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

// Select Question component
interface SelectQuestionProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  hint?: string
  error?: string
}

function SelectQuestion({ label, value, onChange, options, hint, error }: SelectQuestionProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {hint && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <HelpCircle className="w-3 h-3" />
          {hint}
        </p>
      )}
      <CustomSelect
        value={value}
        onChange={onChange}
        options={options}
        placeholder="Chọn..."
        error={!!error}
      />
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  )
}

// Number Question component
interface NumberQuestionProps {
  label: string
  value: number
  onChange: (value: number) => void
  hint?: string
  error?: string
}

function NumberQuestion({ label, value, onChange, hint, error }: NumberQuestionProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {hint && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <HelpCircle className="w-3 h-3" />
          {hint}
        </p>
      )}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className={cn(
          'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
          error ? 'border-error' : 'border-border'
        )}
      />
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  )
}

// Text Question component
interface TextQuestionProps {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  error?: string
}

function TextQuestion({ label, value, onChange, hint, error }: TextQuestionProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {hint && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <HelpCircle className="w-3 h-3" />
          {hint}
        </p>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full px-3 py-2.5 rounded-lg border bg-card text-foreground',
          'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
          error ? 'border-error' : 'border-border'
        )}
      />
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  )
}
