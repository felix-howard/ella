/**
 * Message Template Add/Edit Modal
 * Form modal for creating or editing message templates
 */
import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Trash2, Info, ChevronDown } from 'lucide-react'
import { Button, Input, cn } from '@ella/ui'
import { api, type MessageTemplate, type CreateMessageTemplateInput, type MessageTemplateCategory } from '../../lib/api-client'

const CATEGORY_OPTIONS: { value: MessageTemplateCategory; label: string; description?: string }[] = [
  { value: 'WELCOME', label: 'Chào mừng', description: 'Tự động gửi khi tạo khách hàng mới' },
  { value: 'REMINDER', label: 'Nhắc nhở' },
  { value: 'MISSING', label: 'Tài liệu thiếu' },
  { value: 'BLURRY', label: 'Ảnh mờ' },
  { value: 'COMPLETE', label: 'Hoàn thành' },
  { value: 'GENERAL', label: 'Chung' },
]

// Common placeholders with descriptions
const COMMON_PLACEHOLDERS = [
  { name: 'clientName', desc: 'Tên khách hàng' },
  { name: 'portalUrl', desc: 'Link gửi tài liệu' },
  { name: 'taxYear', desc: 'Năm thuế (VD: 2025)' },
  { name: 'docType', desc: 'Loại tài liệu' },
]

interface MessageTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  template?: MessageTemplate | null
  hasWelcomeTemplate?: boolean
}

export function MessageTemplateModal({ isOpen, onClose, template, hasWelcomeTemplate }: MessageTemplateModalProps) {
  const queryClient = useQueryClient()
  const isEditing = !!template

  // Check if WELCOME should be disabled (already exists and not editing the existing welcome template)
  const isWelcomeDisabled = hasWelcomeTemplate && (!isEditing || template?.category !== 'WELCOME')

  // Form state
  const [formData, setFormData] = useState<CreateMessageTemplateInput>({
    category: 'GENERAL',
    title: '',
    content: '',
    placeholders: [],
    sortOrder: 0,
    isActive: true,
  })
  const [newPlaceholder, setNewPlaceholder] = useState('')
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false)

  // Reset form when template changes or modal opens
  useEffect(() => {
    if (template) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        category: template.category,
        title: template.title,
        content: template.content,
        placeholders: template.placeholders || [],
        sortOrder: template.sortOrder,
        isActive: template.isActive,
      })
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        category: 'GENERAL',
        title: '',
        content: '',
        placeholders: [],
        sortOrder: 0,
        isActive: true,
      })
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNewPlaceholder('')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsCategoryDropdownOpen(false)
  }, [template, isOpen])

  const createMutation = useMutation({
    mutationFn: (data: CreateMessageTemplateInput) => api.admin.messageTemplates.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'message-templates'] })
      onClose()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CreateMessageTemplateInput>) =>
      api.admin.messageTemplates.update(template!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'message-templates'] })
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

  const addPlaceholder = (name?: string) => {
    const placeholderName = name || newPlaceholder.trim()
    if (placeholderName && !formData.placeholders?.includes(placeholderName)) {
      setFormData({ ...formData, placeholders: [...(formData.placeholders || []), placeholderName] })
      setNewPlaceholder('')
    }
  }

  const removePlaceholder = (placeholder: string) => {
    setFormData({ ...formData, placeholders: formData.placeholders?.filter((p) => p !== placeholder) })
  }

  const insertPlaceholder = (placeholder: string) => {
    // Add to placeholders list if not already there
    if (!formData.placeholders?.includes(placeholder)) {
      setFormData({
        ...formData,
        placeholders: [...(formData.placeholders || []), placeholder],
        content: formData.content + `{${placeholder}}`,
      })
    } else {
      setFormData({
        ...formData,
        content: formData.content + `{${placeholder}}`,
      })
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
            {isEditing ? 'Chỉnh sửa mẫu tin nhắn' : 'Thêm mẫu tin nhắn'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Category - Custom dropdown */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Danh mục</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2.5 text-left',
                  'border border-border rounded-lg bg-background',
                  'hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
                )}
              >
                <span className="text-foreground">
                  {CATEGORY_OPTIONS.find((opt) => opt.value === formData.category)?.label || 'Chọn danh mục'}
                </span>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-muted-foreground transition-transform',
                    isCategoryDropdownOpen && 'rotate-180'
                  )}
                />
              </button>

              {/* Dropdown list */}
              {isCategoryDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-auto">
                  {CATEGORY_OPTIONS.map((opt) => {
                    const isDisabled = opt.value === 'WELCOME' && isWelcomeDisabled
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (!isDisabled) {
                            setFormData({ ...formData, category: opt.value })
                            setIsCategoryDropdownOpen(false)
                          }
                        }}
                        className={cn(
                          'w-full px-3 py-2 text-left text-sm transition-colors',
                          formData.category === opt.value && 'bg-primary/10 text-primary',
                          isDisabled
                            ? 'opacity-50 cursor-not-allowed text-muted-foreground'
                            : 'hover:bg-muted'
                        )}
                      >
                        {opt.label}
                        {isDisabled && (
                          <span className="text-xs ml-2">(đã có)</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Tiêu đề</label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="VD: Nhắc nộp tài liệu"
              required
            />
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Nội dung</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Nội dung tin nhắn. Dùng {clientName} để chèn tên khách hàng..."
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground min-h-[150px] resize-y"
              required
            />
            {/* Quick insert placeholders */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Chèn nhanh:</span>
              {COMMON_PLACEHOLDERS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => insertPlaceholder(p.name)}
                  className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
                  title={p.desc}
                >
                  {'{' + p.name + '}'}
                </button>
              ))}
            </div>
          </div>

          {/* Placeholders info */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Placeholders đang sử dụng:</p>
                {formData.placeholders && formData.placeholders.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {formData.placeholders.map((placeholder) => (
                      <span
                        key={placeholder}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-card rounded text-xs font-mono"
                      >
                        {'{' + placeholder + '}'}
                        <button type="button" onClick={() => removePlaceholder(placeholder)}>
                          <Trash2 className="w-3 h-3 text-error hover:text-error/80" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span>Chưa có placeholder nào</span>
                )}
              </div>
            </div>
          </div>

          {/* Custom placeholder */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Thêm placeholder tùy chỉnh</label>
            <div className="flex gap-2">
              <Input
                value={newPlaceholder}
                onChange={(e) => setNewPlaceholder(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                placeholder="VD: taxYear"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addPlaceholder()
                  }
                }}
              />
              <Button type="button" size="sm" variant="outline" onClick={() => addPlaceholder()}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
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
