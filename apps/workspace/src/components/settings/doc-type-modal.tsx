/**
 * Doc Type Library Add/Edit Modal
 * Form modal for creating or editing document types
 */
import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Trash2 } from 'lucide-react'
import { Button, Input } from '@ella/ui'
import { api, type DocTypeLibraryItem, type CreateDocTypeLibraryInput } from '../../lib/api-client'

const CATEGORY_OPTIONS = [
  { value: 'personal', label: 'Cá nhân' },
  { value: 'income', label: 'Thu nhập' },
  { value: 'health', label: 'Sức khỏe' },
  { value: 'education', label: 'Giáo dục' },
  { value: 'deductions', label: 'Khấu trừ' },
  { value: 'business', label: 'Kinh doanh' },
  { value: 'prior_year', label: 'Năm trước' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'foreign', label: 'Nước ngoài' },
  { value: 'other', label: 'Khác' },
]

interface DocTypeModalProps {
  isOpen: boolean
  onClose: () => void
  docType?: DocTypeLibraryItem | null
}

export function DocTypeModal({ isOpen, onClose, docType }: DocTypeModalProps) {
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
      const { code, ...updateData } = formData
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
            {isEditing ? 'Chỉnh sửa loại tài liệu' : 'Thêm loại tài liệu'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Code */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Mã (code)</label>
            <Input
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="VD: W2, FORM_1099_INT"
              disabled={isEditing}
              required
            />
          </div>

          {/* Label Vi */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Tên tiếng Việt</label>
            <Input
              value={formData.labelVi}
              onChange={(e) => setFormData({ ...formData, labelVi: e.target.value })}
              placeholder="VD: Phiếu lương W2"
              required
            />
          </div>

          {/* Label En */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Tên tiếng Anh</label>
            <Input
              value={formData.labelEn}
              onChange={(e) => setFormData({ ...formData, labelEn: e.target.value })}
              placeholder="VD: W2 Wage Statement"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Danh mục</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Aliases */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Tên thay thế (aliases)</label>
            <div className="flex gap-2">
              <Input
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                placeholder="VD: w-2, wage form"
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
            <label className="text-sm font-medium text-foreground">Từ khóa (keywords)</label>
            <div className="flex gap-2">
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="VD: wages, income, employer"
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
            <label className="text-sm font-medium text-foreground">Thứ tự sắp xếp</label>
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
              Kích hoạt
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Hủy
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Đang lưu...' : isEditing ? 'Cập nhật' : 'Thêm mới'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
