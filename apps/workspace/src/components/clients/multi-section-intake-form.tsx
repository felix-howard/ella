/**
 * MultiSectionIntakeForm - Dynamic intake questionnaire with collapsible sections
 * Fetches questions from API based on selected tax types and groups by section
 * Saves all answers to intakeAnswers JSON field
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { HelpCircle, Loader2 } from 'lucide-react'
import { api, type TaxType, type IntakeQuestion as IntakeQuestionType } from '../../lib/api-client'
import { IntakeSection } from './intake-section'
import { IntakeQuestion } from './intake-question'
import { IntakeProgress } from './intake-progress'

// Section configuration with English-first labels and descriptions
const SECTION_CONFIG: Record<
  string,
  { titleKey: string; title: string; descriptionKey: string; description: string; defaultOpen: boolean }
> = {
  client_status: {
    titleKey: 'section.clientStatus',
    title: 'Client Information',
    descriptionKey: 'multiSectionIntake.description.clientStatus',
    description: 'Status and history',
    defaultOpen: true,
  },
  identity: {
    titleKey: 'section.identity',
    title: 'Identity',
    descriptionKey: 'multiSectionIntake.description.identity',
    description: 'Personal information',
    defaultOpen: false,
  },
  prior_year: {
    titleKey: 'section.priorYear',
    title: 'Prior Year & Extension',
    descriptionKey: 'multiSectionIntake.description.priorYear',
    description: 'Estimated tax, extension, prior-year AGI',
    defaultOpen: false,
  },
  life_changes: {
    titleKey: 'section.lifeChanges',
    title: 'Life Changes',
    descriptionKey: 'multiSectionIntake.description.lifeChanges',
    description: 'Major events that affect tax filing',
    defaultOpen: false,
  },
  income: {
    titleKey: 'section.income',
    title: 'Income Sources',
    descriptionKey: 'multiSectionIntake.description.income',
    description: 'W-2, 1099, investments, and more',
    defaultOpen: true,
  },
  dependents: {
    titleKey: 'section.dependents',
    title: 'Dependents',
    descriptionKey: 'multiSectionIntake.description.dependents',
    description: 'Children and other dependents',
    defaultOpen: false,
  },
  health: {
    titleKey: 'section.health',
    title: 'Health Insurance',
    descriptionKey: 'multiSectionIntake.description.health',
    description: 'Marketplace, HSA',
    defaultOpen: false,
  },
  deductions: {
    titleKey: 'section.deductions',
    title: 'Deductions',
    descriptionKey: 'multiSectionIntake.description.deductions',
    description: 'Mortgage, charity, medical, and more',
    defaultOpen: false,
  },
  credits: {
    titleKey: 'section.credits',
    title: 'Tax Credits',
    descriptionKey: 'multiSectionIntake.description.credits',
    description: 'Energy, EV, adoption, and other credits',
    defaultOpen: false,
  },
  foreign: {
    titleKey: 'section.foreign',
    title: 'Foreign Income',
    descriptionKey: 'multiSectionIntake.description.foreign',
    description: 'Accounts, FBAR, FEIE',
    defaultOpen: false,
  },
  business: {
    titleKey: 'section.business',
    title: 'Business Information',
    descriptionKey: 'multiSectionIntake.description.business',
    description: 'For self-employment',
    defaultOpen: false,
  },
  filing: {
    titleKey: 'section.filing',
    title: 'Filing & Delivery',
    descriptionKey: 'multiSectionIntake.description.filing',
    description: 'Delivery preference, notes',
    defaultOpen: false,
  },
  entity_info: {
    titleKey: 'section.entityInfo',
    title: 'Entity Information',
    descriptionKey: 'multiSectionIntake.description.entityInfo',
    description: 'S-Corp or Partnership',
    defaultOpen: false,
  },
  ownership: {
    titleKey: 'section.ownership',
    title: 'Ownership Structure',
    descriptionKey: 'multiSectionIntake.description.ownership',
    description: 'Owners and changes',
    defaultOpen: false,
  },
  expenses: {
    titleKey: 'section.expenses',
    title: 'Business Expenses',
    descriptionKey: 'multiSectionIntake.description.expenses',
    description: 'Employees, contractors, officer compensation',
    defaultOpen: false,
  },
  assets: {
    titleKey: 'section.assets',
    title: 'Assets',
    descriptionKey: 'multiSectionIntake.description.assets',
    description: 'Purchases, disposals, depreciation',
    defaultOpen: false,
  },
  state: {
    titleKey: 'section.state',
    title: 'State Tax',
    descriptionKey: 'multiSectionIntake.description.state',
    description: 'Multi-state activity',
    defaultOpen: false,
  },
  tax_info: {
    titleKey: 'section.taxInfo',
    title: 'Tax Information',
    descriptionKey: 'multiSectionIntake.description.taxInfo',
    description: 'Tax year and status',
    defaultOpen: true,
  },
}

// Section display order
// NOTE: 'tax_info' is excluded because taxYear and filingStatus are already
// handled by the parent form (ProfileStep in new.tsx, TaxInfoSection in client detail)
const SECTION_ORDER = [
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
  const { t, i18n } = useTranslation()
  const language = i18n.language
  // Fetch questions based on selected tax types
  const { data, isLoading, isError } = useQuery({
    queryKey: ['intake-questions', taxTypes],
    queryFn: () => api.getIntakeQuestions(taxTypes),
    enabled: taxTypes.length > 0,
  })

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // Excludes 'tax_info' section since it's handled separately by the parent form
  const orderedSections = useMemo(() => {
    const sections = Object.keys(questionsBySection).filter((s) => s !== 'tax_info')
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
        label: getLocalizedText(opt.labelEn || opt.label, opt.labelVi || opt.label, language) || String(opt.value),
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
        <span className="ml-2 text-muted-foreground">{t('clientIntake.loadingQuestions')}</span>
      </div>
    )
  }

  if (isError || questions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <HelpCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
        <p>{t('clientIntake.noQuestionsForTaxType')}</p>
        <p className="text-sm mt-1">{t('multiSectionIntake.selectAtLeastOneTaxType')}</p>
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
          titleKey: '',
          description: '',
          descriptionKey: '',
          defaultOpen: false,
        }

        return (
          <IntakeSection
            key={section}
            title={config.titleKey ? t(config.titleKey) : config.title}
            description={config.descriptionKey ? t(config.descriptionKey) : config.description}
            defaultOpen={getSectionDefaultOpen(section)}
          >
            {sectionQuestions.map((q) => (
              <IntakeQuestion
                key={q.questionKey}
                questionKey={q.questionKey}
                label={getLocalizedText(q.labelEn, q.labelVi, language)}
                hint={getLocalizedText(q.hintEn, q.hintVi, language)}
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

function getLocalizedText(
  english: string | null | undefined,
  vietnamese: string | null | undefined,
  language: string
): string {
  if (language.toLowerCase().startsWith('vi')) return vietnamese || english || ''
  return english || vietnamese || ''
}
