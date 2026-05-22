/**
 * Intake Questions Configuration Tab
 * Visual editor for managing intake questionnaire
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react'
import { Card, Button } from '@ella/ui'
import { cn } from '@ella/ui'
import { api, type TaxType, type IntakeQuestion, type FieldType } from '../../lib/api-client'
import { IntakeQuestionModal } from './intake-question-modal'

const TAX_TYPE_LABELS: Record<TaxType, string> = {
  FORM_1040: '1040',
  FORM_1120S: '1120-S',
  FORM_1065: '1065',
}

const FIELD_TYPE_LABEL_KEYS: Record<FieldType, string> = {
  BOOLEAN: 'fieldType.boolean',
  SELECT: 'fieldType.select',
  NUMBER: 'fieldType.number',
  NUMBER_INPUT: 'fieldType.numberInput',
  CURRENCY: 'fieldType.currency',
  TEXT: 'fieldType.text',
}

const SECTION_LABEL_KEYS: Record<string, string> = {
  tax_info: 'section.taxInfo',
  identity: 'section.identity',
  life_changes: 'section.lifeChanges',
  income: 'section.income',
  dependents: 'section.dependents',
  health: 'section.health',
  deductions: 'section.deductions',
  credits: 'section.credits',
  foreign: 'section.foreign',
  business: 'section.business',
  entity_info: 'section.entityInfo',
  ownership: 'section.ownership',
  expenses: 'section.expenses',
  assets: 'section.assets',
  state: 'section.state',
}

export function IntakeQuestionsConfigTab() {
  const { t } = useTranslation()
  const [filterTaxType, setFilterTaxType] = useState<TaxType | 'all'>('all')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<IntakeQuestion | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'intake-questions', filterTaxType],
    queryFn: () =>
      api.admin.intakeQuestions.list(
        filterTaxType !== 'all' ? { taxType: filterTaxType } : undefined
      ),
  })

  const questions = data?.data || []

  // Group questions by section
  const questionsBySection = questions.reduce(
    (acc, question) => {
      if (!acc[question.section]) {
        acc[question.section] = []
      }
      acc[question.section].push(question)
      return acc
    },
    {} as Record<string, IntakeQuestion[]>
  )

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  // Expand all by default
  if (expandedSections.size === 0 && Object.keys(questionsBySection).length > 0) {
    setExpandedSections(new Set(Object.keys(questionsBySection)))
  }

  const handleAdd = () => {
    setEditingQuestion(null)
    setIsModalOpen(true)
  }

  const handleEdit = (question: IntakeQuestion) => {
    setEditingQuestion(question)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingQuestion(null)
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex gap-2 border-b border-border pb-4">
        <button
          onClick={() => setFilterTaxType('all')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            filterTaxType === 'all'
              ? 'bg-primary text-white'
              : 'bg-muted text-foreground hover:bg-muted/80'
          )}
        >
          {t('common.all')}
        </button>
        {(Object.keys(TAX_TYPE_LABELS) as TaxType[]).map((taxType) => (
          <button
            key={taxType}
            onClick={() => setFilterTaxType(taxType)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              filterTaxType === taxType
                ? 'bg-primary text-white'
                : 'bg-muted text-foreground hover:bg-muted/80'
            )}
          >
            {TAX_TYPE_LABELS[taxType]}
          </button>
        ))}
      </div>

      {/* Actions Bar */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{t('settingsIntakeQuestions.count', { count: questions.length })}</p>
        <Button size="sm" className="gap-1.5" onClick={handleAdd}>
          <Plus className="w-4 h-4" />
          {t('settingsIntakeQuestions.addQuestion')}
        </Button>
      </div>

      {/* Questions List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
      ) : questions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t('settingsIntakeQuestions.empty')}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(questionsBySection).map(([section, items]) => (
            <SectionGroup
              key={section}
              section={section}
              questions={items}
              isExpanded={expandedSections.has(section)}
              onToggle={() => toggleSection(section)}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <IntakeQuestionModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        question={editingQuestion}
      />
    </div>
  )
}

interface SectionGroupProps {
  section: string
  questions: IntakeQuestion[]
  isExpanded: boolean
  onToggle: () => void
  onEdit: (question: IntakeQuestion) => void
}

function SectionGroup({ section, questions, isExpanded, onToggle, onEdit }: SectionGroupProps) {
  const { t } = useTranslation()
  return (
    <Card className="overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="font-medium text-foreground">
            {SECTION_LABEL_KEYS[section] ? t(SECTION_LABEL_KEYS[section]) : section}
          </span>
          <span className="text-sm text-muted-foreground">({questions.length})</span>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border divide-y divide-border">
          {questions.map((question) => (
            <QuestionRow key={question.id} question={question} onEdit={onEdit} />
          ))}
        </div>
      )}
    </Card>
  )
}

interface QuestionRowProps {
  question: IntakeQuestion
  onEdit: (question: IntakeQuestion) => void
}

function QuestionRow({ question, onEdit }: QuestionRowProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()

  const toggleMutation = useMutation({
    mutationFn: () =>
      api.admin.intakeQuestions.update(question.id, { isActive: !question.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'intake-questions'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.admin.intakeQuestions.delete(question.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'intake-questions'] })
    },
  })

  return (
    <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn('font-medium', question.isActive ? 'text-foreground' : 'text-muted-foreground')}
          >
            {getLocalizedQuestionLabel(question, i18n.language)}
          </span>
          <span className="px-1.5 py-0.5 text-xs bg-muted text-muted-foreground rounded">
            {t(FIELD_TYPE_LABEL_KEYS[question.fieldType])}
          </span>
          {question.condition && (
            <span className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
              {t('settingsIntakeQuestions.conditional')}
            </span>
          )}
          {!question.isActive && (
            <span className="px-1.5 py-0.5 text-xs bg-muted text-muted-foreground rounded">
              {t('settingsIntakeQuestions.inactive')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">{question.questionKey}</span>
          <span className="text-xs text-muted-foreground">|</span>
          <span className="text-xs text-muted-foreground">
            {question.taxTypes.map((t) => TAX_TYPE_LABELS[t]).join(', ')}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => toggleMutation.mutate()}
          className="p-1.5 rounded hover:bg-muted transition-colors"
          title={t(question.isActive ? 'settingsIntakeQuestions.disableQuestion' : 'settingsIntakeQuestions.enableQuestion')}
          disabled={toggleMutation.isPending}
        >
          {question.isActive ? (
            <ToggleRight className="w-5 h-5 text-primary" />
          ) : (
            <ToggleLeft className="w-5 h-5 text-muted-foreground" />
          )}
        </button>
        <button
          onClick={() => onEdit(question)}
          className="p-1.5 rounded hover:bg-muted transition-colors"
          title={t('common.edit')}
        >
          <Edit2 className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => {
            if (confirm(t('settingsIntakeQuestions.deleteConfirm'))) {
              deleteMutation.mutate()
            }
          }}
          className="p-1.5 rounded hover:bg-error/10 transition-colors"
          title={t('common.delete')}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="w-4 h-4 text-error" />
        </button>
      </div>
    </div>
  )
}

function getLocalizedQuestionLabel(question: IntakeQuestion, language: string): string {
  if (language.toLowerCase().startsWith('vi')) {
    return question.labelVi || question.labelEn || question.questionKey
  }
  return question.labelEn || question.labelVi || question.questionKey
}
