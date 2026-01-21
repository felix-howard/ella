/**
 * Template Picker - Modal for selecting pre-defined message templates
 * Templates are categorized for easy access during client communication
 */

import { useState, useMemo } from 'react'
import { cn } from '@ella/ui'
import { X, Search, FileText, Clock, AlertTriangle, CheckCircle, Send } from 'lucide-react'

export interface MessageTemplate {
  id: string
  category: TemplateCategory
  title: string
  content: string
  /** Placeholders like {clientName}, {docType} */
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

// Pre-defined templates
const TEMPLATES: MessageTemplate[] = [
  // Reminders
  {
    id: 'reminder-1',
    category: 'reminder',
    title: 'Nhắc nộp tài liệu',
    content: 'Chào {clientName},\n\nElla nhắc bạn gửi thêm tài liệu thuế còn thiếu để chúng tôi hoàn thành hồ sơ. Cảm ơn bạn!',
    placeholders: ['clientName'],
  },
  {
    id: 'reminder-2',
    category: 'reminder',
    title: 'Nhắc nhở lần 2',
    content: 'Chào {clientName},\n\nChúng tôi vẫn đang chờ một số tài liệu từ bạn. Vui lòng gửi sớm để tránh trễ hạn nộp thuế. Xin cảm ơn!',
    placeholders: ['clientName'],
  },

  // Missing documents
  {
    id: 'missing-1',
    category: 'missing',
    title: 'Yêu cầu W2',
    content: 'Chào {clientName},\n\nChúng tôi cần bạn gửi form W2 để hoàn thành hồ sơ thuế. Bạn có thể chụp ảnh và gửi qua link đã nhận.',
    placeholders: ['clientName'],
  },
  {
    id: 'missing-2',
    category: 'missing',
    title: 'Yêu cầu SSN/ID',
    content: 'Chào {clientName},\n\nVui lòng gửi ảnh chụp thẻ SSN và ID (bằng lái xe hoặc passport) để chúng tôi xác minh thông tin.',
    placeholders: ['clientName'],
  },
  {
    id: 'missing-3',
    category: 'missing',
    title: 'Yêu cầu 1099',
    content: 'Chào {clientName},\n\nChúng tôi cần các form 1099 (nếu có) từ ngân hàng, công ty chứng khoán hoặc nơi trả tiền cho bạn.',
    placeholders: ['clientName'],
  },

  // Blurry/Resend
  {
    id: 'blurry-1',
    category: 'blurry',
    title: 'Ảnh mờ - Chụp lại',
    content: 'Chào {clientName},\n\nẢnh {docType} bạn gửi bị mờ, chúng tôi không đọc được. Vui lòng chụp lại rõ hơn và gửi lại. Cảm ơn!',
    placeholders: ['clientName', 'docType'],
  },
  {
    id: 'blurry-2',
    category: 'blurry',
    title: 'Ảnh bị cắt',
    content: 'Chào {clientName},\n\nẢnh tài liệu bạn gửi bị cắt mất một phần. Vui lòng chụp lại đầy đủ 4 góc của tài liệu.',
    placeholders: ['clientName'],
  },

  // Complete
  {
    id: 'complete-1',
    category: 'complete',
    title: 'Đã nhận đủ tài liệu',
    content: 'Chào {clientName},\n\nChúng tôi đã nhận đủ tài liệu thuế của bạn. Hồ sơ đang được xử lý, chúng tôi sẽ liên hệ khi có kết quả.',
    placeholders: ['clientName'],
  },
  {
    id: 'complete-2',
    category: 'complete',
    title: 'Hoàn thành khai thuế',
    content: 'Chào {clientName},\n\nHồ sơ thuế của bạn đã được hoàn thành và nộp thành công. Cảm ơn bạn đã tin tưởng dịch vụ của chúng tôi!',
    placeholders: ['clientName'],
  },

  // General
  {
    id: 'general-1',
    category: 'general',
    title: 'Lời chào',
    content: 'Chào {clientName},\n\nCảm ơn bạn đã liên hệ. Chúng tôi sẽ hỗ trợ bạn ngay.',
    placeholders: ['clientName'],
  },
  {
    id: 'general-2',
    category: 'general',
    title: 'Xác nhận nhận tin',
    content: 'Chào {clientName},\n\nChúng tôi đã nhận được tin nhắn của bạn và sẽ phản hồi sớm nhất có thể.',
    placeholders: ['clientName'],
  },
]

export function TemplatePicker({
  isOpen,
  onClose,
  onSelect,
  clientName,
}: TemplatePickerProps) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all')

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return TEMPLATES.filter((template) => {
      const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
      const matchesSearch =
        search === '' ||
        template.title.toLowerCase().includes(search.toLowerCase()) ||
        template.content.toLowerCase().includes(search.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [search, selectedCategory])

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
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Không tìm thấy mẫu phù hợp</p>
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
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {template.content.replace('{clientName}', clientName || 'Quý khách')}
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
