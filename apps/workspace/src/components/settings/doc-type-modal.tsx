/**
 * Doc Type Library Add/Edit Modal
 * Form modal for creating or editing document types
 */
import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { X, Plus, Trash2 } from 'lucide-react'
import { Button, Input } from '@ella/ui'
import { api, type DocTypeLibraryItem, type CreateDocTypeLibraryInput } from '../../lib/api-client'

const CATEGORY_OPTIONS = [
  { value: 'personal', labelKey: 'settingsDocLibrary.category.personal' },
  { value: 'income', labelKey: 'settingsDocLibrary.category.income' },
  { value: 'health', labelKey: 'settingsDocLibrary.category.health' },
  { value: 'education', labelKey: 'settingsDocLibrary.category.education' },
  { value: 'deductions', labelKey: 'settingsDocLibrary.category.deductions' },
  { value: 'business', labelKey: 'settingsDocLibrary.category.business' },
  { value: 'prior_year', labelKey: 'settingsDocLibrary.category.priorYear' },
  { value: 'crypto', labelKey: 'settingsDocLibrary.category.crypto' },
  { value: 'foreign', labelKey: 'settingsDocLibrary.category.foreign' },
  { value: 'other', labelKey: 'settingsDocLibrary.category.other' },
]

interface DocTypeModalProps {
  isOpen: boolean
  onClose: () => void
  docType?: DocTypeLibraryItem | null
}

export function DocTypeModal({ isOpen, onClose, docType }: DocTypeModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isEditing = !!docType

  // Form state
  const [formData, setFormData] = useState<CreateDocTypeLibraryInput>({
    code: '',
    labelVi: '',
    labelEn: '',
    category: 'personal',
    aliases: [],
    keywords: [],
    sortOrder: 0,
    isActive: true,
  })
  const [newAlias, setNewAlias] = useState('')
  const [newKeyword, setNewKeyword] = useState('')

  // Reset form when docType changes
  useEffect(() => {
    if (docType) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentionally loading form data
      setFormData({
        code: docType.code,
        labelVi: docType.labelVi,
        labelEn: docType.labelEn,
        category: docType.category,
        aliases: docType.aliases || [],
        keywords: docType.keywords || [],
        sortOrder: docType.sortOrder,
        isActive: docType.isActive,
      })
    } else {
      setFormData({
        code: '',
        labelVi: '',
        labelEn: '',
        category: 'personal',
        aliases: [],
        keywords: [],
        sortOrder: 0,
        isActive: true,
      })
    }
    setNewAlias('')
    setNewKeyword('')
  }, [docType, isOpen])

  const createMutation = useMutation({
    mutationFn: (data: CreateDocTypeLibraryInput) => api.admin.docTypeLibrary.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'doc-type-library'] })
      onClose()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Omit<CreateDocTypeLibraryInput, 'code'>>) =>
      api.admin.docTypeLibrary.update(docType!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'doc-type-library'] })
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isEditing) {
      const { code: _code, ...updateData } = formData
      updateMutation.mutate(updateData)
    } else {
      createMutation.mutate(formData)
    }
  }

  const addAlias = () => {
    if (newAlias.trim() && !formData.aliases?.includes(newAlias.trim())) {
      setFormData({ ...formData, aliases: [...(formData.aliases || []), newAlias.trim()] })
      setNewAlias('')
    }
  }

  const removeAlias = (alias: string) => {
    setFormData({ ...formData, aliases: formData.aliases?.filter((a) => a !== alias) })
  }

  const addKeyword = () => {
    if (newKeyword.trim() && !formData.keywords?.includes(newKeyword.trim())) {
      setFormData({ ...formData, keywords: [...(formData.keywords || []), newKeyword.trim()] })
      setNewKeyword('')
    }
  }

  const removeKeyword = (keyword: string) => {
    setFormData({ ...formData, keywords: formData.keywords?.filter((k) => k !== keyword) })
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
            {isEditing ? t('settingsDocLibrary.modal.editTitle') : t('settingsDocLibrary.modal.addTitle')}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Code */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsDocLibrary.code')}</label>
            <Input
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder={t('settingsDocLibrary.codePlaceholder')}
              disabled={isEditing}
              required
            />
          </div>

          {/* Label Vi */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsDocLibrary.labelVi')}</label>
            <Input
              value={formData.labelVi}
              onChange={(e) => setFormData({ ...formData, labelVi: e.target.value })}
              placeholder={t('settingsDocLibrary.labelViPlaceholder')}
              required
            />
          </div>

          {/* Label En */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsDocLibrary.labelEn')}</label>
            <Input
              value={formData.labelEn}
              onChange={(e) => setFormData({ ...formData, labelEn: e.target.value })}
              placeholder={t('settingsDocLibrary.labelEnPlaceholder')}
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsDocLibrary.category')}</label>
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

          {/* Aliases */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsDocLibrary.aliases')}</label>
            <div className="flex gap-2">
              <Input
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                placeholder={t('settingsDocLibrary.aliasPlaceholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addAlias()
                  }
                }}
              />
              <Button type="button" size="sm" variant="outline" onClick={addAlias}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {formData.aliases && formData.aliases.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {formData.aliases.map((alias) => (
                  <span
                    key={alias}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-xs"
                  >
                    {alias}
                    <button type="button" onClick={() => removeAlias(alias)}>
                      <Trash2 className="w-3 h-3 text-error" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Keywords */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsDocLibrary.keywords')}</label>
            <div className="flex gap-2">
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder={t('settingsDocLibrary.keywordPlaceholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addKeyword()
                  }
                }}
              />
              <Button type="button" size="sm" variant="outline" onClick={addKeyword}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {formData.keywords && formData.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {formData.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs"
                  >
                    {keyword}
                    <button type="button" onClick={() => removeKeyword(keyword)}>
                      <Trash2 className="w-3 h-3 text-error" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Sort Order */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{t('settingsDocLibrary.sortOrder')}</label>
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
              {t('settingsDocLibrary.active')}
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
