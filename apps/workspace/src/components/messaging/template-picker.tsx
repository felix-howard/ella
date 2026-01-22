/**
 * Template Picker - Modal for selecting pre-defined message templates
 * Templates are fetched from API and categorized for easy access during client communication
 */

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@ella/ui'
import { X, Search, FileText, Clock, AlertTriangle, CheckCircle, Send, Loader2 } from 'lucide-react'
import { api, type MessageTemplate as ApiMessageTemplate, type MessageTemplateCategory } from '../../lib/api-client'

// Local interface matching API but with lowercase category for UI compatibility
export interface MessageTemplate {
  id: string
  category: TemplateCategory
  title: string
  content: string
  placeholders?: string[]
}

export type TemplateCategory = 'reminder' | 'missing' | 'blurry' | 'complete' | 'general'

export interface TemplatePickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (template: MessageTemplate) => void
  clientName?: string
}

// Category configuration
const CATEGORIES: Record<TemplateCategory, { label: string; icon: typeof FileText; color: string }> = {
  reminder: { label: 'Nhắc nhở', icon: Clock, color: 'text-warning' },
  missing: { label: 'Tài liệu thiếu', icon: AlertTriangle, color: 'text-error' },
  blurry: { label: 'Ảnh mờ', icon: AlertTriangle, color: 'text-warning' },
  complete: { label: 'Hoàn thành', icon: CheckCircle, color: 'text-success' },
  general: { label: 'Chung', icon: FileText, color: 'text-muted-foreground' },
}

// Map API category (uppercase) to UI category (lowercase)
const mapApiCategoryToUi = (apiCategory: MessageTemplateCategory): TemplateCategory => {
  return apiCategory.toLowerCase() as TemplateCategory
}

// Convert API template to UI template format
const mapApiTemplateToUi = (apiTemplate: ApiMessageTemplate): MessageTemplate => ({
  id: apiTemplate.id,
  category: mapApiCategoryToUi(apiTemplate.category),
  title: apiTemplate.title,
  content: apiTemplate.content,
  placeholders: apiTemplate.placeholders,
})

export function TemplatePicker({
  isOpen,
  onClose,
  onSelect,
  clientName,
}: TemplatePickerProps) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all')

  // Fetch templates from API
  const { data, isLoading } = useQuery({
    queryKey: ['message-templates'],
    queryFn: () => api.admin.messageTemplates.list({ isActive: true }),
    enabled: isOpen, // Only fetch when modal is open
  })

  // Map API templates to UI format (exclude WELCOME - they're auto-sent)
  const templates: MessageTemplate[] = useMemo(() => {
    if (!data?.data) return []
    return data.data
      .filter((t) => t.category !== 'WELCOME') // WELCOME templates are auto-sent, not for manual selection
      .map(mapApiTemplateToUi)
  }, [data])

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
      const matchesSearch =
        search === '' ||
        template.title.toLowerCase().includes(search.toLowerCase()) ||
        template.content.toLowerCase().includes(search.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [templates, search, selectedCategory])

  // Handle template selection with placeholder replacement
  const handleSelect = (template: MessageTemplate) => {
    // Replace all known placeholders with values or friendly defaults
    const processedContent = template.content
      .replace(/{clientName}/g, clientName || 'Quý khách')
      .replace(/{docType}/g, '[loại tài liệu]') // Default placeholder for docType

    const processedTemplate = {
      ...template,
      content: processedContent,
    }
    onSelect(processedTemplate)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Chọn mẫu tin nhắn</h2>
            <p className="text-sm text-muted-foreground">Chọn mẫu để gửi nhanh cho khách hàng</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="px-6 py-3 border-b border-border space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm mẫu tin nhắn..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                'w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
                'text-sm placeholder:text-muted-foreground'
              )}
            />
          </div>

          {/* Category filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                selectedCategory === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              Tất cả
            </button>
            {(Object.keys(CATEGORIES) as TemplateCategory[]).map((category) => {
              const config = CATEGORIES[category]
              const Icon = config.icon
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    selectedCategory === category
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {config.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Template list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {templates.length === 0
                  ? 'Chưa có mẫu tin nhắn nào. Hãy thêm mẫu trong Cài đặt.'
                  : 'Không tìm thấy mẫu phù hợp'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTemplates.map((template) => {
                const categoryConfig = CATEGORIES[template.category]
                const CategoryIcon = categoryConfig.icon

                return (
                  <button
                    key={template.id}
                    onClick={() => handleSelect(template)}
                    className={cn(
                      'w-full text-left p-4 rounded-xl border border-border',
                      'bg-card hover:bg-muted/30 hover:border-primary/30',
                      'transition-colors group'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <CategoryIcon className={cn('w-4 h-4', categoryConfig.color)} />
                          <span className="font-medium text-sm text-foreground">
                            {template.title}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                          {template.content.replace(/{clientName}/g, clientName || 'Quý khách')}
                        </p>
                      </div>
                      <Send className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
