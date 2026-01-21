/**
 * Checklist Configuration Tab
 * Visual editor for managing checklist templates per tax type
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { Card, Button } from '@ella/ui'
import { cn } from '@ella/ui'
import { api, type TaxType, type ChecklistTemplate } from '../../lib/api-client'
import { ChecklistTemplateModal } from './checklist-template-modal'

const TAX_TYPE_LABELS: Record<TaxType, string> = {
  FORM_1040: '1040 (Cá nhân)',
  FORM_1120S: '1120-S (S-Corp)',
  FORM_1065: '1065 (Partnership)',
}

export function ChecklistConfigTab() {
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
        {(Object.keys(TAX_TYPE_LABELS) as TaxType[]).map((taxType) => (
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
            {TAX_TYPE_LABELS[taxType]}
          </button>
        ))}
      </div>

      {/* Actions Bar */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {templates.length} mục trong checklist
        </p>
        <Button size="sm" className="gap-1.5" onClick={handleAdd}>
          <Plus className="w-4 h-4" />
          Thêm mục
        </Button>
      </div>

      {/* Templates List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Chưa có mục nào cho loại tờ khai này
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

const CATEGORY_LABELS: Record<string, string> = {
  personal: 'Cá nhân / Nhận dạng',
  prior_year: 'Năm trước / IRS',
  income: 'Thu nhập',
  health: 'Bảo hiểm sức khỏe',
  education: 'Giáo dục',
  deductions: 'Khấu trừ',
  credits: 'Tín dụng thuế',
  business: 'Kinh doanh',
  rental: 'Cho thuê',
  foreign: 'Nước ngoài',
  admin: 'Hành chính',
  ownership: 'Sở hữu',
  financials: 'Tài chính',
  payroll: 'Bảng lương',
  expenses: 'Chi phí',
  assets: 'Tài sản',
}

function CategorySection({ category, templates, isExpanded, onToggle, onEdit }: CategorySectionProps) {
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
            {CATEGORY_LABELS[category] || category}
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
  const queryClient = useQueryClient()

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
          <span className="font-medium text-foreground">{template.labelVi}</span>
          {template.isRequired && (
            <span className="px-1.5 py-0.5 text-xs bg-error/10 text-error rounded">
              Bắt buộc
            </span>
          )}
          {template.condition && (
            <span className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
              Có điều kiện
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">{template.docType}</span>
          {template.expectedCount > 1 && (
            <span className="text-xs text-muted-foreground">
              (Cần {template.expectedCount} tài liệu)
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onEdit(template)}
          className="p-1.5 rounded hover:bg-muted transition-colors"
          title="Chỉnh sửa"
        >
          <Edit2 className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => {
            if (confirm('Bạn có chắc muốn xóa mục này?')) {
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
  )
}
