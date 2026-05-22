/**
 * Message Template Configuration Tab
 * Simplified admin management for 3 fixed message templates:
 * - PORTAL_LINK: Initial message requesting doc upload (sends client portal link)
 * - SCHEDULE_C: Request for Schedule C (business expenses)
 * - SCHEDULE_E: Request for Schedule E (rental property)
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Edit2, FileText, Receipt, Building2, Loader2 } from 'lucide-react'
import { Card } from '@ella/ui'
import { cn } from '@ella/ui'
import { api, type MessageTemplate, type MessageTemplateCategory } from '../../lib/api-client'
import { MessageTemplateModal } from './message-template-modal'

// Fixed template configuration (3 singletons)
const TEMPLATE_CONFIG: Record<
  MessageTemplateCategory,
  { labelKey: string; labelEnKey: string; icon: typeof FileText; color: string; descriptionKey: string }
> = {
  PORTAL_LINK: {
    labelKey: 'settingsTemplates.portalLink.label',
    labelEnKey: 'settingsTemplates.portalLink.shortLabel',
    icon: FileText,
    color: 'text-primary',
    descriptionKey: 'settingsTemplates.portalLink.description',
  },
  SCHEDULE_C: {
    labelKey: 'settingsTemplates.scheduleC.label',
    labelEnKey: 'settingsTemplates.scheduleC.shortLabel',
    icon: Receipt,
    color: 'text-amber-500',
    descriptionKey: 'settingsTemplates.scheduleC.description',
  },
  SCHEDULE_E: {
    labelKey: 'settingsTemplates.scheduleE.label',
    labelEnKey: 'settingsTemplates.scheduleE.shortLabel',
    icon: Building2,
    color: 'text-blue-500',
    descriptionKey: 'settingsTemplates.scheduleE.description',
  },
}

// Order for display
const TEMPLATE_ORDER: MessageTemplateCategory[] = ['PORTAL_LINK', 'SCHEDULE_C', 'SCHEDULE_E']

export function MessageTemplateConfigTab() {
  const { t } = useTranslation()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<MessageTemplateCategory | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'message-templates'],
    queryFn: () => api.admin.messageTemplates.list(),
  })

  const templates = data?.data || []

  // Create a map of category -> template for easy lookup
  const templateByCategory = templates.reduce(
    (acc, template) => {
      acc[template.category] = template
      return acc
    },
    {} as Record<MessageTemplateCategory, MessageTemplate>
  )

  const handleEdit = (category: MessageTemplateCategory) => {
    setEditingCategory(category)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingCategory(null)
  }

  // Get existing template for the editing category
  const editingTemplate = editingCategory ? templateByCategory[editingCategory] : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm text-muted-foreground">
          {t('settingsTemplates.description')}
        </p>
      </div>

      {/* Templates List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {TEMPLATE_ORDER.map((category) => {
            const config = TEMPLATE_CONFIG[category]
            const template = templateByCategory[category]
            const Icon = config.icon

            return (
              <Card key={category} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Icon */}
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                        'bg-muted'
                      )}
                    >
                      <Icon className={cn('w-5 h-5', config.color)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-foreground">{t(config.labelKey)}</h3>
                        <span className="text-xs text-muted-foreground">({t(config.labelEnKey)})</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{t(config.descriptionKey)}</p>

                      {template ? (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-sm font-medium text-foreground mb-1">
                            {template.title}
                          </p>
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
                      ) : (
                        <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                          <p className="text-sm text-warning">
                            {t('settingsTemplates.notConfigured')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={() => handleEdit(category)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg',
                      'bg-muted hover:bg-muted/80 transition-colors',
                      'text-sm font-medium text-foreground'
                    )}
                  >
                    <Edit2 className="w-4 h-4" />
                    {t('common.edit')}
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Edit Modal */}
      <MessageTemplateModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        template={editingTemplate}
        category={editingCategory}
      />
    </div>
  )
}
