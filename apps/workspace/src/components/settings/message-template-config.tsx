/**
 * Message Template Configuration Tab
 * Admin management for quick message templates used in client communication
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Clock, AlertTriangle, CheckCircle, FileText, Receipt } from 'lucide-react'
import { Card, Button } from '@ella/ui'
import { cn } from '@ella/ui'
import { api, type MessageTemplate, type MessageTemplateCategory } from '../../lib/api-client'
import { MessageTemplateModal } from './message-template-modal'

// Category configuration for display
const CATEGORY_CONFIG: Record<MessageTemplateCategory, { label: string; icon: typeof FileText; color: string; description?: string }> = {
  WELCOME: { label: 'Chào mừng', icon: FileText, color: 'text-primary', description: 'Tin nhắn tự động gửi khi tạo khách hàng mới' },
  REMINDER: { label: 'Nhắc nhở', icon: Clock, color: 'text-warning' },
  MISSING: { label: 'Tài liệu thiếu', icon: AlertTriangle, color: 'text-error' },
  BLURRY: { label: 'Ảnh mờ', icon: AlertTriangle, color: 'text-warning' },
  COMPLETE: { label: 'Hoàn thành', icon: CheckCircle, color: 'text-success' },
  GENERAL: { label: 'Chung', icon: FileText, color: 'text-muted-foreground' },
  SCHEDULE_C: { label: 'Chi phí (Schedule C)', icon: Receipt, color: 'text-primary', description: 'Tin nhắn gửi form chi phí kinh doanh' },
}

export function MessageTemplateConfigTab() {
  const [filterCategory, setFilterCategory] = useState<MessageTemplateCategory | 'all'>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'message-templates', filterCategory],
    queryFn: () =>
      api.admin.messageTemplates.list({
        category: filterCategory !== 'all' ? filterCategory : undefined,
      }),
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
    {} as Record<MessageTemplateCategory, MessageTemplate[]>
  )

  const handleAdd = () => {
    setEditingTemplate(null)
    setIsModalOpen(true)
  }

  const handleEdit = (template: MessageTemplate) => {
    setEditingTemplate(template)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingTemplate(null)
  }

  return (
    <div className="space-y-6">
      {/* Category Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilterCategory('all')}
          className={cn(
            'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
            filterCategory === 'all'
              ? 'bg-primary text-white'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          Tất cả
        </button>
        {(Object.keys(CATEGORY_CONFIG) as MessageTemplateCategory[]).map((category) => {
          const config = CATEGORY_CONFIG[category]
          const Icon = config.icon
          return (
            <button
              key={category}
              onClick={() => setFilterCategory(category)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                filterCategory === category
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {config.label}
            </button>
          )
        })}
      </div>

      {/* Actions Bar */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{templates.length} mẫu tin nhắn</p>
        <Button size="sm" className="gap-1.5" onClick={handleAdd}>
          <Plus className="w-4 h-4" />
          Thêm mẫu mới
        </Button>
      </div>

      {/* Templates List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Chưa có mẫu tin nhắn nào
        </div>
      ) : filterCategory === 'all' ? (
        // Grouped view when showing all
        <div className="space-y-6">
          {(Object.keys(CATEGORY_CONFIG) as MessageTemplateCategory[]).map((category) => {
            const categoryTemplates = templatesByCategory[category] || []
            if (categoryTemplates.length === 0) return null
            return (
              <CategorySection
                key={category}
                category={category}
                templates={categoryTemplates}
                onEdit={handleEdit}
              />
            )
          })}
        </div>
      ) : (
        // Flat view when filtering by category
        <div className="space-y-3">
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} onEdit={handleEdit} />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <MessageTemplateModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        template={editingTemplate}
        hasWelcomeTemplate={templates.some((t) => t.category === 'WELCOME')}
        hasScheduleCTemplate={templates.some((t) => t.category === 'SCHEDULE_C')}
      />
    </div>
  )
}

interface CategorySectionProps {
  category: MessageTemplateCategory
  templates: MessageTemplate[]
  onEdit: (template: MessageTemplate) => void
}

function CategorySection({ category, templates, onEdit }: CategorySectionProps) {
  const config = CATEGORY_CONFIG[category]
  const Icon = config.icon

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn('w-4 h-4', config.color)} />
        <h3 className="font-medium text-foreground">{config.label}</h3>
        <span className="text-sm text-muted-foreground">({templates.length})</span>
      </div>
      <div className="space-y-3">
        {templates.map((template) => (
          <TemplateCard key={template.id} template={template} onEdit={onEdit} />
        ))}
      </div>
    </div>
  )
}

interface TemplateCardProps {
  template: MessageTemplate
  onEdit: (template: MessageTemplate) => void
}

function TemplateCard({ template, onEdit }: TemplateCardProps) {
  const queryClient = useQueryClient()
  const config = CATEGORY_CONFIG[template.category]

  const toggleMutation = useMutation({
    mutationFn: () =>
      api.admin.messageTemplates.update(template.id, { isActive: !template.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'message-templates'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.admin.messageTemplates.delete(template.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'message-templates'] })
    },
  })

  return (
    <Card
      className={cn(
        'p-4 transition-colors',
        !template.isActive && 'opacity-60'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-foreground">{template.title}</span>
            <span className={cn('px-1.5 py-0.5 text-xs rounded', config.color, 'bg-muted')}>
              {config.label}
            </span>
            {!template.isActive && (
              <span className="px-1.5 py-0.5 text-xs bg-muted text-muted-foreground rounded">
                Tắt
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">
            {template.content}
          </p>
          {template.placeholders.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {template.placeholders.map((placeholder) => (
                <span
                  key={placeholder}
                  className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded font-mono"
                >
                  {'{' + placeholder + '}'}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => toggleMutation.mutate()}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            title={template.isActive ? 'Tắt' : 'Bật'}
            disabled={toggleMutation.isPending}
          >
            {template.isActive ? (
              <ToggleRight className="w-4 h-4 text-primary" />
            ) : (
              <ToggleLeft className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={() => onEdit(template)}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            title="Chỉnh sửa"
          >
            <Edit2 className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => {
              if (confirm('Bạn có chắc muốn xóa mẫu tin nhắn này?')) {
                deleteMutation.mutate()
              }
            }}
            className="p-1.5 rounded hover:bg-error/10 transition-colors"
            title="Xóa"
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="w-4 h-4 text-error" />
          </button>
        </div>
      </div>
    </Card>
  )
}
