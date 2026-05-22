/**
 * Intake Question Add/Edit Modal
 * Form modal for creating or editing intake questions
 */
import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Button, Input } from '@ella/ui'
import { cn } from '@ella/ui'
import { api, type TaxType, type FieldType, type IntakeQuestion, type CreateIntakeQuestionInput } from '../../lib/api-client'

const TAX_TYPE_OPTIONS: { value: TaxType; label: string }[] = [
  { value: 'FORM_1040', label: '1040' },
  { value: 'FORM_1120S', label: '1120-S' },
  { value: 'FORM_1065', label: '1065' },
]

const FIELD_TYPE_OPTIONS: { value: FieldType; labelKey: string }[] = [
  { value: 'BOOLEAN', labelKey: 'fieldType.boolean' },
  { value: 'SELECT', labelKey: 'fieldType.select' },
  { value: 'NUMBER', labelKey: 'fieldType.number' },
  { value: 'TEXT', labelKey: 'fieldType.text' },
]

const SECTION_OPTIONS = [
  { value: 'tax_info', labelKey: 'section.taxInfo' },
  { value: 'identity', labelKey: 'section.identity' },
  { value: 'income', labelKey: 'section.income' },
  { value: 'dependents', labelKey: 'section.dependents' },
  { value: 'health', labelKey: 'section.health' },
  { value: 'deductions', labelKey: 'section.deductions' },
  { value: 'credits', labelKey: 'section.credits' },
  { value: 'business', labelKey: 'section.business' },
  { value: 'foreign', labelKey: 'section.foreign' },
  { value: 'entity_info', labelKey: 'section.entityInfo' },
  { value: 'ownership', labelKey: 'section.ownership' },
  { value: 'expenses', labelKey: 'section.expenses' },
  { value: 'assets', labelKey: 'section.assets' },
  { value: 'state', labelKey: 'section.state' },
]

interface IntakeQuestionModalProps {
  isOpen: boolean
  onClose: () => void
  question?: IntakeQuestion | null
}

export function IntakeQuestionModal({ isOpen, onClose, question }: IntakeQuestionModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isEditing = !!question

  // Form state
  const [formData, setFormData] = useState<CreateIntakeQuestionInput>({
    questionKey: '',
    taxTypes: ['FORM_1040'],
    labelVi: '',
    labelEn: '',
    hintVi: '',
    fieldType: 'BOOLEAN',
    options: '',
    condition: '',
    section: 'income',
    sortOrder: 0,
    isActive: true,
  })

  // Reset form when question changes
  useEffect(() => {
    if (question) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentionally loading form data
      setFormData({
        questionKey: question.questionKey,
        taxTypes: question.taxTypes,
        labelVi: question.labelVi,
        labelEn: question.labelEn,
        hintVi: question.hintVi || '',
        fieldType: question.fieldType,
        options: question.options || '',
        condition: question.condition || '',
        section: question.section,
        sortOrder: question.sortOrder,
        isActive: question.isActive,
      })
    } else {
      setFormData({
        questionKey: '',
        taxTypes: ['FORM_1040'],
        labelVi: '',
        labelEn: '',
        hintVi: '',
        fieldType: 'BOOLEAN',
        options: '',
        condition: '',
        section: 'income',
        sortOrder: 0,
        isActive: true,
      })
    }
  }, [question, isOpen])

  const createMutation = useMutation({
    mutationFn: (data: CreateIntakeQuestionInput) => api.admin.intakeQuestions.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'intake-questions'] })
      onClose()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreateIntakeQuestionInput>) =>
      api.admin.intakeQuestions.update(question!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'intake-questions'] })
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isEditing) {
      updateMutation.mutate(formData)
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleTaxTypeToggle = (taxType: TaxType) => {
    const current = formData.taxTypes || []
    const updated = current.includes(taxType)
      ? current.filter((t) => t !== taxType)
      : [...current, taxType]
    setFormData({ ...formData, taxTypes: updated.length > 0 ? updated : ['FORM_1040'] })
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {t(isEditing ? 'settingsIntakeQuestions.modal.editTitle' : 'settingsIntakeQuestions.modal.addTitle')}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Question Key */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsIntakeQuestions.questionKey')}</label>
            <Input
              value={formData.questionKey}
              onChange={(e) => setFormData({ ...formData, questionKey: e.target.value })}
              placeholder={t('settingsIntakeQuestions.questionKeyPlaceholder')}
              required
            />
          </div>

          {/* Tax Types */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsIntakeQuestions.appliesTo')}</label>
            <div className="flex gap-2">
              {TAX_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleTaxTypeToggle(opt.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    formData.taxTypes?.includes(opt.value)
                      ? 'bg-primary text-white'
                      : 'bg-muted text-foreground hover:bg-muted/80'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Label Vi */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsIntakeQuestions.labelVi')}</label>
            <Input
              value={formData.labelVi}
              onChange={(e) => setFormData({ ...formData, labelVi: e.target.value })}
              placeholder={t('settingsIntakeQuestions.labelViPlaceholder')}
              required
            />
          </div>

          {/* Label En */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsIntakeQuestions.labelEn')}</label>
            <Input
              value={formData.labelEn}
              onChange={(e) => setFormData({ ...formData, labelEn: e.target.value })}
              placeholder={t('settingsIntakeQuestions.labelEnPlaceholder')}
            />
          </div>

          {/* Section */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsIntakeQuestions.section')}</label>
            <select
              value={formData.section}
              onChange={(e) => setFormData({ ...formData, section: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
            >
              {SECTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
              ))}
            </select>
          </div>

          {/* Field Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsIntakeQuestions.fieldType')}</label>
            <select
              value={formData.fieldType}
              onChange={(e) => setFormData({ ...formData, fieldType: e.target.value as FieldType })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
            >
              {FIELD_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
              ))}
            </select>
          </div>

          {/* Options (for SELECT type) */}
          {formData.fieldType === 'SELECT' && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{t('settingsIntakeQuestions.optionsJson')}</label>
              <Input
                value={formData.options}
                onChange={(e) => setFormData({ ...formData, options: e.target.value })}
                placeholder='[{"value": "opt1", "label": "Option 1"}]'
              />
            </div>
          )}

          {/* Hint */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsIntakeQuestions.hint')}</label>
            <Input
              value={formData.hintVi}
              onChange={(e) => setFormData({ ...formData, hintVi: e.target.value })}
              placeholder={t('settingsIntakeQuestions.hintPlaceholder')}
            />
          </div>

          {/* Condition */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsIntakeQuestions.conditionJson')}</label>
            <Input
              value={formData.condition}
              onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
              placeholder='VD: {"hasKidsUnder17": true}'
            />
            <p className="text-xs text-muted-foreground">{t('settingsIntakeQuestions.conditionHelp')}</p>
          </div>

          {/* Sort Order */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsIntakeQuestions.sortOrder')}</label>
            <Input
              type="number"
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
            />
          </div>

          {/* Is Active */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 rounded border-border"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-foreground">
              {t('settingsIntakeQuestions.active')}
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t('common.saving') : isEditing ? t('common.update') : t('common.add')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
