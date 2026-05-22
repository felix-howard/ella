/**
 * Checklist Template Add/Edit Modal
 * Form modal for creating or editing checklist templates
 */
import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Button, Input } from '@ella/ui'
import { api, type TaxType, type ChecklistTemplate, type CreateChecklistTemplateInput } from '../../lib/api-client'

const TAX_TYPE_OPTIONS: { value: TaxType; labelKey: string }[] = [
  { value: 'FORM_1040', labelKey: 'settingsChecklist.taxType.form1040' },
  { value: 'FORM_1120S', labelKey: 'settingsChecklist.taxType.form1120s' },
  { value: 'FORM_1065', labelKey: 'settingsChecklist.taxType.form1065' },
]

const CATEGORY_OPTIONS = [
  { value: 'personal', labelKey: 'settingsChecklist.category.personal' },
  { value: 'prior_year', labelKey: 'settingsChecklist.category.priorYear' },
  { value: 'income', labelKey: 'settingsChecklist.category.income' },
  { value: 'health', labelKey: 'settingsChecklist.category.health' },
  { value: 'education', labelKey: 'settingsChecklist.category.education' },
  { value: 'deductions', labelKey: 'settingsChecklist.category.deductions' },
  { value: 'credits', labelKey: 'settingsChecklist.category.credits' },
  { value: 'business', labelKey: 'settingsChecklist.category.business' },
  { value: 'rental', labelKey: 'settingsChecklist.category.rental' },
  { value: 'foreign', labelKey: 'settingsChecklist.category.foreign' },
  { value: 'admin', labelKey: 'settingsChecklist.category.admin' },
  { value: 'ownership', labelKey: 'settingsChecklist.category.ownership' },
  { value: 'financials', labelKey: 'settingsChecklist.category.financials' },
  { value: 'payroll', labelKey: 'settingsChecklist.category.payroll' },
  { value: 'expenses', labelKey: 'settingsChecklist.category.expenses' },
  { value: 'assets', labelKey: 'settingsChecklist.category.assets' },
]

interface ChecklistTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  template?: ChecklistTemplate | null
  defaultTaxType?: TaxType
}

export function ChecklistTemplateModal({ isOpen, onClose, template, defaultTaxType }: ChecklistTemplateModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isEditing = !!template

  // Form state
  const [formData, setFormData] = useState<CreateChecklistTemplateInput>({
    taxType: defaultTaxType || 'FORM_1040',
    docType: '',
    labelVi: '',
    labelEn: '',
    category: 'personal',
    isRequired: false,
    expectedCount: 1,
    condition: '',
    hintVi: '',
  })

  // Reset form when template changes
  useEffect(() => {
    if (template) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentionally loading form data
      setFormData({
        taxType: template.taxType,
        docType: template.docType,
        labelVi: template.labelVi,
        labelEn: template.labelEn,
        category: template.category,
        isRequired: template.isRequired,
        expectedCount: template.expectedCount,
        condition: template.condition || '',
        hintVi: template.hintVi || '',
      })
    } else {
      setFormData({
        taxType: defaultTaxType || 'FORM_1040',
        docType: '',
        labelVi: '',
        labelEn: '',
        category: 'personal',
        isRequired: false,
        expectedCount: 1,
        condition: '',
        hintVi: '',
      })
    }
  }, [template, defaultTaxType, isOpen])

  const createMutation = useMutation({
    mutationFn: (data: CreateChecklistTemplateInput) => api.admin.checklistTemplates.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'checklist-templates'] })
      onClose()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreateChecklistTemplateInput>) =>
      api.admin.checklistTemplates.update(template!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'checklist-templates'] })
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isEditing) {
      const { taxType: _taxType, docType: _docType, ...updateData } = formData
      updateMutation.mutate(updateData)
    } else {
      createMutation.mutate(formData)
    }
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
            {isEditing ? t('settingsChecklist.modal.editTitle') : t('settingsChecklist.modal.addTitle')}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Tax Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsChecklist.taxType')}</label>
            <select
              value={formData.taxType}
              onChange={(e) => setFormData({ ...formData, taxType: e.target.value as TaxType })}
              disabled={isEditing}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground disabled:opacity-50"
            >
              {TAX_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
              ))}
            </select>
          </div>

          {/* Doc Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsChecklist.docTypeCode')}</label>
            <Input
              value={formData.docType}
              onChange={(e) => setFormData({ ...formData, docType: e.target.value })}
              placeholder={t('settingsChecklist.docTypeCodePlaceholder')}
              disabled={isEditing}
              required
            />
          </div>

          {/* Label Vi */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsChecklist.labelVi')}</label>
            <Input
              value={formData.labelVi}
              onChange={(e) => setFormData({ ...formData, labelVi: e.target.value })}
              placeholder={t('settingsChecklist.labelViPlaceholder')}
              required
            />
          </div>

          {/* Label En */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsChecklist.labelEn')}</label>
            <Input
              value={formData.labelEn}
              onChange={(e) => setFormData({ ...formData, labelEn: e.target.value })}
              placeholder={t('settingsChecklist.labelEnPlaceholder')}
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsChecklist.category')}</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
              ))}
            </select>
          </div>

          {/* Expected Count */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsChecklist.expectedCount')}</label>
            <Input
              type="number"
              min={1}
              value={formData.expectedCount}
              onChange={(e) => setFormData({ ...formData, expectedCount: parseInt(e.target.value) || 1 })}
            />
          </div>

          {/* Is Required */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isRequired"
              checked={formData.isRequired}
              onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
              className="w-4 h-4 rounded border-border"
            />
            <label htmlFor="isRequired" className="text-sm font-medium text-foreground">
              {t('form.required')}
            </label>
          </div>

          {/* Condition */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsChecklist.conditionJson')}</label>
            <Input
              value={formData.condition}
              onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
              placeholder={t('settingsChecklist.conditionJsonPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">{t('settingsChecklist.conditionHelp')}</p>
          </div>

          {/* Hint */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsChecklist.clientHint')}</label>
            <Input
              value={formData.hintVi}
              onChange={(e) => setFormData({ ...formData, hintVi: e.target.value })}
              placeholder={t('settingsChecklist.clientHintPlaceholder')}
            />
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
