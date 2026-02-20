/**
 * Message Template Add/Edit Modal
 * Simplified form modal for editing message templates
 * Category is fixed (passed as prop), only title, content, placeholders can be edited
 */
import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Trash2, Info, FileText, Receipt, Building2 } from 'lucide-react'
import { Button, Input, cn } from '@ella/ui'
import {
  api,
  type MessageTemplate,
  type CreateMessageTemplateInput,
  type MessageTemplateCategory,
} from '../../lib/api-client'

// Template config for display
const TEMPLATE_CONFIG: Record<
  MessageTemplateCategory,
  { label: string; icon: typeof FileText; color: string }
> = {
  PORTAL_LINK: { label: 'Gửi link tải tài liệu', icon: FileText, color: 'text-primary' },
  SCHEDULE_C: { label: 'Yêu cầu Schedule C', icon: Receipt, color: 'text-amber-500' },
  SCHEDULE_E: { label: 'Yêu cầu Schedule E', icon: Building2, color: 'text-blue-500' },
}

// Common placeholders with descriptions
const COMMON_PLACEHOLDERS = [
  { name: 'clientName', desc: 'Tên khách hàng' },
  { name: 'portalUrl', desc: 'Link gửi tài liệu' },
  { name: 'taxYear', desc: 'Năm thuế (VD: 2025)' },
  { name: 'docType', desc: 'Loại tài liệu' },
  { name: 'expenseUrl', desc: 'Link form chi phí (Schedule C/E)' },
]

interface MessageTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  template?: MessageTemplate | null
  category: MessageTemplateCategory | null
}

export function MessageTemplateModal({
  isOpen,
  onClose,
  template,
  category,
}: MessageTemplateModalProps) {
  const queryClient = useQueryClient()
  const isEditing = !!template

  // Form state
  const [formData, setFormData] = useState<Omit<CreateMessageTemplateInput, 'category'>>({
    title: '',
    content: '',
    placeholders: [],
    sortOrder: 0,
    isActive: true,
  })
  const [newPlaceholder, setNewPlaceholder] = useState('')

  // Reset form when template changes or modal opens
  useEffect(() => {
    if (template) {
      setFormData({
        title: template.title,
        content: template.content,
        placeholders: template.placeholders || [],
        sortOrder: template.sortOrder,
        isActive: template.isActive,
      })
    } else {
      // Default content based on category
      const defaultContent = getDefaultContent(category)
      setFormData({
        title: getDefaultTitle(category),
        content: defaultContent.content,
        placeholders: defaultContent.placeholders,
        sortOrder: 0,
        isActive: true,
      })
    }
    setNewPlaceholder('')
  }, [template, isOpen, category])

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
    if (!category) return

    const data = { ...formData, category }
    if (isEditing) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
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
    setFormData({
      ...formData,
      placeholders: formData.placeholders?.filter((p) => p !== placeholder),
    })
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

  if (!isOpen || !category) return null

  const config = TEMPLATE_CONFIG[category]
  const Icon = config.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <Icon className={cn('w-4 h-4', config.color)} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {isEditing ? 'Chỉnh sửa' : 'Cấu hình'} mẫu tin nhắn
              </h2>
              <p className="text-sm text-muted-foreground">{config.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Tiêu đề</label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="VD: Gửi link tải tài liệu"
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

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Hủy
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Đang lưu...' : isEditing ? 'Cập nhật' : 'Lưu'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Helper functions for default content
function getDefaultTitle(category: MessageTemplateCategory | null): string {
  switch (category) {
    case 'PORTAL_LINK':
      return 'Gửi link tải tài liệu thuế'
    case 'SCHEDULE_C':
      return 'Yêu cầu thông tin Schedule C'
    case 'SCHEDULE_E':
      return 'Yêu cầu thông tin Schedule E'
    default:
      return ''
  }
}

function getDefaultContent(category: MessageTemplateCategory | null): {
  content: string
  placeholders: string[]
} {
  switch (category) {
    case 'PORTAL_LINK':
      return {
        content: `Chào {clientName},

Cảm ơn bạn đã liên hệ với Ella Tax. Vui lòng nhấn vào link bên dưới để tải lên tài liệu thuế của bạn:

{portalUrl}

Nếu có thắc mắc, hãy liên hệ với chúng tôi.`,
        placeholders: ['clientName', 'portalUrl'],
      }
    case 'SCHEDULE_C':
      return {
        content: `Chào {clientName},

Chúng tôi cần thông tin chi phí kinh doanh (Schedule C) của bạn cho năm thuế {taxYear}. Vui lòng nhấn vào link bên dưới để điền thông tin:

{expenseUrl}

Nếu có thắc mắc, hãy liên hệ với chúng tôi.`,
        placeholders: ['clientName', 'taxYear', 'expenseUrl'],
      }
    case 'SCHEDULE_E':
      return {
        content: `Chào {clientName},

Chúng tôi cần thông tin bất động sản cho thuê (Schedule E) của bạn cho năm thuế {taxYear}. Vui lòng nhấn vào link bên dưới để điền thông tin:

{expenseUrl}

Nếu có thắc mắc, hãy liên hệ với chúng tôi.`,
        placeholders: ['clientName', 'taxYear', 'expenseUrl'],
      }
    default:
      return { content: '', placeholders: [] }
  }
}
