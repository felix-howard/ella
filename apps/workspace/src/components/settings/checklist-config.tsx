/**
 * Checklist Configuration Tab
 * Visual editor for managing checklist templates per tax type
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { Card, Button } from '@ella/ui'
import { cn } from '@ella/ui'
import { api, type TaxType, type ChecklistTemplate } from '../../lib/api-client'
import { ChecklistTemplateModal } from './checklist-template-modal'

const TAX_TYPE_LABEL_KEYS: Record<TaxType, string> = {
  FORM_1040: 'settingsChecklist.taxType.form1040',
  FORM_1120S: 'settingsChecklist.taxType.form1120s',
  FORM_1065: 'settingsChecklist.taxType.form1065',
}

export function ChecklistConfigTab() {
  const { t } = useTranslation()
  const [selectedTaxType, setSelectedTaxType] = useState<TaxType>('FORM_1040')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'checklist-templates', selectedTaxType],
    queryFn: () => api.admin.checklistTemplates.list({ taxType: selectedTaxType }),
  })

  const templates = data?.data || []

  // Group templates by category
  const templatesByCategory = templates.reduce(
    (acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = []
      }
      acc[template.category].push(template)
      return acc
    },
    {} as Record<string, ChecklistTemplate[]>
  )

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  // Expand all by default
  if (expandedCategories.size === 0 && Object.keys(templatesByCategory).length > 0) {
    setExpandedCategories(new Set(Object.keys(templatesByCategory)))
  }

  const handleAdd = () => {
    setEditingTemplate(null)
    setIsModalOpen(true)
  }

  const handleEdit = (template: ChecklistTemplate) => {
    setEditingTemplate(template)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingTemplate(null)
  }

  return (
    <div className="space-y-6">
      {/* Tax Type Tabs */}
      <div className="flex gap-2 border-b border-border pb-4">
        {(Object.keys(TAX_TYPE_LABEL_KEYS) as TaxType[]).map((taxType) => (
          <button
            key={taxType}
            onClick={() => setSelectedTaxType(taxType)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              selectedTaxType === taxType
                ? 'bg-primary text-white'
                : 'bg-muted text-foreground hover:bg-muted/80'
            )}
          >
            {t(TAX_TYPE_LABEL_KEYS[taxType])}
          </button>
        ))}
      </div>

      {/* Actions Bar */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {t('settingsChecklist.itemCount', { count: templates.length })}
        </p>
        <Button size="sm" className="gap-1.5" onClick={handleAdd}>
          <Plus className="w-4 h-4" />
          {t('settingsChecklist.addItem')}
        </Button>
      </div>

      {/* Templates List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t('settingsChecklist.emptyForTaxType')}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(templatesByCategory).map(([category, items]) => (
            <CategorySection
              key={category}
              category={category}
              templates={items}
              isExpanded={expandedCategories.has(category)}
              onToggle={() => toggleCategory(category)}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <ChecklistTemplateModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        template={editingTemplate}
        defaultTaxType={selectedTaxType}
      />
    </div>
  )
}

interface CategorySectionProps {
  category: string
  templates: ChecklistTemplate[]
  isExpanded: boolean
  onToggle: () => void
  onEdit: (template: ChecklistTemplate) => void
}

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  personal: 'settingsChecklist.category.personal',
  prior_year: 'settingsChecklist.category.priorYear',
  income: 'settingsChecklist.category.income',
  health: 'settingsChecklist.category.health',
  education: 'settingsChecklist.category.education',
  deductions: 'settingsChecklist.category.deductions',
  credits: 'settingsChecklist.category.credits',
  business: 'settingsChecklist.category.business',
  rental: 'settingsChecklist.category.rental',
  foreign: 'settingsChecklist.category.foreign',
  admin: 'settingsChecklist.category.admin',
  ownership: 'settingsChecklist.category.ownership',
  financials: 'settingsChecklist.category.financials',
  payroll: 'settingsChecklist.category.payroll',
  expenses: 'settingsChecklist.category.expenses',
  assets: 'settingsChecklist.category.assets',
}

function CategorySection({ category, templates, isExpanded, onToggle, onEdit }: CategorySectionProps) {
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
            {CATEGORY_LABEL_KEYS[category] ? t(CATEGORY_LABEL_KEYS[category]) : category}
          </span>
          <span className="text-sm text-muted-foreground">({templates.length})</span>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border divide-y divide-border">
          {templates.map((template) => (
            <TemplateRow key={template.id} template={template} onEdit={onEdit} />
          ))}
        </div>
      )}
    </Card>
  )
}

interface TemplateRowProps {
  template: ChecklistTemplate
  onEdit: (template: ChecklistTemplate) => void
}

function TemplateRow({ template, onEdit }: TemplateRowProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const isVietnamese = i18n.language.startsWith('vi')
  const templateLabel = isVietnamese
    ? template.labelVi || template.labelEn
    : template.labelEn || template.labelVi

  const deleteMutation = useMutation({
    mutationFn: () => api.admin.checklistTemplates.delete(template.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'checklist-templates'] })
    },
  })

  return (
    <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{templateLabel}</span>
          {template.isRequired && (
            <span className="px-1.5 py-0.5 text-xs bg-error/10 text-error rounded">
              {t('form.required')}
            </span>
          )}
          {template.condition && (
            <span className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
              {t('settingsChecklist.conditional')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">{template.docType}</span>
          {template.expectedCount > 1 && (
            <span className="text-xs text-muted-foreground">
              {t('settingsChecklist.expectedDocumentCount', { count: template.expectedCount })}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onEdit(template)}
          className="p-1.5 rounded hover:bg-muted transition-colors"
          title={t('common.edit')}
        >
          <Edit2 className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => {
            if (confirm(t('settingsChecklist.deleteConfirm'))) {
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
