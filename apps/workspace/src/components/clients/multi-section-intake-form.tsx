/**
 * MultiSectionIntakeForm - Dynamic intake questionnaire with collapsible sections
 * Fetches questions from API based on selected tax types and groups by section
 * Saves all answers to intakeAnswers JSON field
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HelpCircle, Loader2 } from 'lucide-react'
import { api, type TaxType, type IntakeQuestion as IntakeQuestionType } from '../../lib/api-client'
import { IntakeSection } from './intake-section'
import { IntakeQuestion } from './intake-question'
import { IntakeProgress } from './intake-progress'

// Section configuration with Vietnamese labels and descriptions
const SECTION_CONFIG: Record<
  string,
  { title: string; description: string; defaultOpen: boolean }
> = {
  client_status: {
    title: 'Thông tin khách hàng',
    description: 'Trạng thái và lịch sử',
    defaultOpen: true,
  },
  identity: {
    title: 'Nhận dạng',
    description: 'Thông tin cá nhân',
    defaultOpen: false,
  },
  prior_year: {
    title: 'Năm trước & Extension',
    description: 'Estimated tax, extension, AGI năm trước',
    defaultOpen: false,
  },
  life_changes: {
    title: 'Thay đổi trong năm',
    description: 'Sự kiện quan trọng ảnh hưởng đến thuế',
    defaultOpen: false,
  },
  income: {
    title: 'Nguồn thu nhập',
    description: 'W2, 1099, đầu tư, v.v.',
    defaultOpen: true,
  },
  dependents: {
    title: 'Người phụ thuộc',
    description: 'Con cái và người phụ thuộc khác',
    defaultOpen: false,
  },
  health: {
    title: 'Bảo hiểm sức khỏe',
    description: 'Marketplace, HSA',
    defaultOpen: false,
  },
  deductions: {
    title: 'Khấu trừ',
    description: 'Mortgage, từ thiện, y tế, v.v.',
    defaultOpen: false,
  },
  credits: {
    title: 'Tín dụng thuế',
    description: 'Năng lượng, xe điện, nhận con nuôi',
    defaultOpen: false,
  },
  foreign: {
    title: 'Thu nhập nước ngoài',
    description: 'Tài khoản, FBAR, FEIE',
    defaultOpen: false,
  },
  business: {
    title: 'Thông tin doanh nghiệp',
    description: 'Cho kinh doanh cá nhân',
    defaultOpen: false,
  },
  filing: {
    title: 'Giao nhận tờ khai',
    description: 'Delivery preference, notes',
    defaultOpen: false,
  },
  entity_info: {
    title: 'Thông tin pháp nhân',
    description: 'S-Corp hoặc Partnership',
    defaultOpen: false,
  },
  ownership: {
    title: 'Cấu trúc sở hữu',
    description: 'Chủ sở hữu và thay đổi',
    defaultOpen: false,
  },
  expenses: {
    title: 'Chi phí kinh doanh',
    description: 'Nhân viên, contractors, officer compensation',
    defaultOpen: false,
  },
  assets: {
    title: 'Tài sản',
    description: 'Mua bán, khấu hao',
    defaultOpen: false,
  },
  state: {
    title: 'Thuế tiểu bang',
    description: 'Hoạt động đa tiểu bang',
    defaultOpen: false,
  },
  tax_info: {
    title: 'Thông tin thuế',
    description: 'Năm thuế và tình trạng',
    defaultOpen: true,
  },
}

// Section display order
const SECTION_ORDER = [
  'tax_info',
  'client_status',
  'identity',
  'prior_year',
  'life_changes',
  'income',
  'dependents',
  'health',
  'deductions',
  'credits',
  'foreign',
  'business',
  'filing',
  'entity_info',
  'ownership',
  'expenses',
  'assets',
  'state',
]

// Section trigger mappings: which answer keys trigger section auto-expand
const SECTION_TRIGGERS: Record<string, string[]> = {
  business: ['hasSelfEmployment'],
  dependents: ['hasKidsUnder17', 'hasKids17to24', 'hasOtherDependents'],
  health: ['hasMarketplaceCoverage', 'hasHSA'],
  deductions: ['hasMortgage', 'hasPropertyTax', 'hasCharitableDonations', 'hasMedicalExpenses'],
  credits: ['hasEnergyCredits', 'hasEVCredit', 'hasAdoptionExpenses'],
  foreign: ['hasForeignAccounts', 'hasForeignIncome'],
  prior_year: ['hasExtensionFiled', 'estimatedTaxPaid'],
  entity_info: ['hasSelfEmployment'],
  ownership: ['hasOwnershipChanges'],
  expenses: ['businessHasEmployees', 'businessHasContractors'],
  assets: ['hasAssetPurchases', 'hasAssetDisposals'],
}

interface MultiSectionIntakeFormProps {
  taxTypes: TaxType[]
  answers: Record<string, unknown>
  onChange: (answers: Record<string, unknown>) => void
}

export function MultiSectionIntakeForm({
  taxTypes,
  answers,
  onChange,
}: MultiSectionIntakeFormProps) {
  // Fetch questions based on selected tax types
  const { data, isLoading, isError } = useQuery({
    queryKey: ['intake-questions', taxTypes],
    queryFn: () => api.getIntakeQuestions(taxTypes),
    enabled: taxTypes.length > 0,
  })

  const questions = data?.data || []

  // Handle answer change with UI-side cascade cleanup
  // This removes dependent answers when parent toggles to false (e.g., hasW2 -> w2Count)
  // For existing clients, the backend performs deeper cleanup via cascade logic
  // when intakeAnswers are saved via the API (see api.clients.update)
  const handleChange = (key: string, value: unknown) => {
    const newAnswers = { ...answers, [key]: value }

    // Clear dependent values when parent changes to false (UI-side only)
    if (value === false) {
      // Clear child questions that depend on this field
      questions.forEach((q) => {
        if (q.condition) {
          try {
            const condition = JSON.parse(q.condition)
            if (condition.key === key && newAnswers[q.questionKey] !== undefined) {
              delete newAnswers[q.questionKey]
            }
          } catch {
            // Ignore parse errors
          }
        }
      })
    }

    onChange(newAnswers)
  }

  // Group questions by section and sort
  const questionsBySection = useMemo(() => {
    const grouped: Record<string, IntakeQuestionType[]> = {}

    questions.forEach((q) => {
      const section = q.section || 'other'
      if (!grouped[section]) {
        grouped[section] = []
      }
      grouped[section].push(q)
    })

    // Sort questions within each section by sortOrder
    Object.keys(grouped).forEach((section) => {
      grouped[section].sort((a, b) => a.sortOrder - b.sortOrder)
    })

    return grouped
  }, [questions])

  // Get ordered sections
  const orderedSections = useMemo(() => {
    const sections = Object.keys(questionsBySection)
    return SECTION_ORDER.filter((s) => sections.includes(s)).concat(
      sections.filter((s) => !SECTION_ORDER.includes(s))
    )
  }, [questionsBySection])

  // Parse options from JSON string
  // Handles both formats: { label } and { labelVi, labelEn }
  const parseOptions = (
    optionsJson: string | null
  ): { value: string; label: string }[] => {
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
    } catch (error) {
      console.warn('[IntakeForm] Failed to parse options JSON:', optionsJson, error)
      return []
    }
  }

  // Parse condition from JSON string
  const parseCondition = (
    conditionJson: string | null
  ): { key: string; value: unknown } | undefined => {
    if (!conditionJson) return undefined
    try {
      return JSON.parse(conditionJson)
    } catch (error) {
      console.warn('[IntakeForm] Failed to parse condition JSON:', conditionJson, error)
      return undefined
    }
  }

  // Check if section has any visible questions (considering conditions)
  const hasVisibleQuestions = (sectionQuestions: IntakeQuestionType[]): boolean => {
    return sectionQuestions.some((q) => {
      if (!q.condition) return true
      const condition = parseCondition(q.condition)
      if (!condition) return true
      return answers[condition.key] === condition.value
    })
  }

  // Track which sections have answers
  const sectionsWithAnswers = useMemo(() => {
    const sections = new Set<string>()
    questions.forEach(q => {
      if (answers[q.questionKey] !== undefined && answers[q.questionKey] !== '') {
        sections.add(q.section || 'other')
      }
    })
    return sections
  }, [questions, answers])

  // Smart section auto-expand: open if has answers or relevant triggers are true
  const getSectionDefaultOpen = (section: string): boolean => {
    // Check static config default
    const config = SECTION_CONFIG[section]
    if (config?.defaultOpen) return true

    // Open if section already has answers
    if (sectionsWithAnswers.has(section)) return true

    // Open if parent trigger is true (e.g., business section when hasSelfEmployment)
    const triggers = SECTION_TRIGGERS[section] || []
    return triggers.some(key => answers[key] === true)
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
        <HelpCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
        <p>Không có câu hỏi nào cho loại tờ khai đã chọn</p>
        <p className="text-sm mt-1">Vui lòng chọn ít nhất một loại tờ khai</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Progress indicator */}
      <IntakeProgress questions={questions} answers={answers} />

      {orderedSections.map((section) => {
        const sectionQuestions = questionsBySection[section]
        if (!sectionQuestions || !hasVisibleQuestions(sectionQuestions)) {
          return null
        }

        const config = SECTION_CONFIG[section] || {
          title: section,
          description: '',
          defaultOpen: false,
        }

        return (
          <IntakeSection
            key={section}
            title={config.title}
            description={config.description}
            defaultOpen={getSectionDefaultOpen(section)}
          >
            {sectionQuestions.map((q) => (
              <IntakeQuestion
                key={q.questionKey}
                questionKey={q.questionKey}
                label={q.labelVi}
                hint={q.hintVi}
                fieldType={q.fieldType}
                options={parseOptions(q.options)}
                value={answers[q.questionKey]}
                onChange={handleChange}
                condition={parseCondition(q.condition)}
                answers={answers}
              />
            ))}
          </IntakeSection>
        )
      })}
    </div>
  )
}
