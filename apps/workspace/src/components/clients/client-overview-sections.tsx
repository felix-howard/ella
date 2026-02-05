/**
 * ClientOverviewSections - Displays all intake form data in collapsible sections
 * Groups answers by category and shows only answered questions
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Copy, Check, Pencil } from 'lucide-react'
import { cn } from '@ella/ui'
import { copyToClipboard } from '../../lib/formatters'
import {
  UI_TEXT,
  FILING_STATUS_LABELS,
  LANGUAGE_LABELS,
} from '../../lib/constants'
import {
  SECTION_CONFIG,
  SECTION_ORDER,
  FIELD_CONFIG,
  SELECT_LABELS,
  NON_EDITABLE_SECTIONS,
} from '../../lib/intake-form-config'
import type { ClientDetail } from '../../lib/api-client'
import { SectionEditModal } from './section-edit-modal'
import { QuickEditModal, type QuickEditField } from './quick-edit-modal'

interface ClientOverviewSectionsProps {
  client: ClientDetail
}

// Personal info fields that support quick-edit
const QUICK_EDIT_FIELDS: QuickEditField[] = ['name', 'phone', 'email']

export function ClientOverviewSections({ client }: ClientOverviewSectionsProps) {
  const { t } = useTranslation()
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [editingSectionKey, setEditingSectionKey] = useState<string | null>(null)
  const [quickEditField, setQuickEditField] = useState<QuickEditField | null>(null)
  // All sections expanded by default - initialize with all section keys
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    return new Set(Object.keys(SECTION_CONFIG))
  })

  const profile = client.profile
  const intakeAnswers = useMemo(() => profile?.intakeAnswers || {}, [profile?.intakeAnswers])
  const latestCase = client.taxCases?.[0]

  // Handle copy to clipboard
  const handleCopy = async (text: string, field: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  // Sanitize string for display (defense-in-depth against XSS)
  const sanitizeString = (str: string): string => {
    // Remove control characters (ASCII 0-31, 127) and limit length
    // eslint-disable-next-line no-control-regex
    return str.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 500)
  }

  // Format value for display
  const formatValue = (
    key: string,
    value: boolean | number | string | undefined,
    format?: string
  ): string => {
    if (value === undefined || value === null) return '—'

    switch (format) {
      case 'boolean':
        return value ? t('common.yes') : t('common.no')
      case 'currency':
        return typeof value === 'number'
          ? new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
            }).format(value)
          : sanitizeString(String(value))
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : sanitizeString(String(value))
      case 'select': {
        // Look up display label for select values
        const selectLabels = SELECT_LABELS[key]
        if (selectLabels && typeof value === 'string') {
          return selectLabels[value] || sanitizeString(value)
        }
        // Check filing status
        if (key === 'filingStatus' && typeof value === 'string') {
          return FILING_STATUS_LABELS[value as keyof typeof FILING_STATUS_LABELS] || sanitizeString(value)
        }
        return sanitizeString(String(value))
      }
      default:
        return typeof value === 'string' ? sanitizeString(value) : String(value)
    }
  }

  // Group intake answers by section
  const sectionData = useMemo(() => {
    const sections: Record<string, Array<{ key: string; label: string; value: string; rawValue: unknown; editable?: boolean }>> = {}

    // Add personal info section (from client directly)
    // name, phone, email are quick-editable via QuickEditModal
    sections.personal_info = [
      { key: 'name', label: UI_TEXT.form.clientName, value: client.name, rawValue: client.name, editable: true },
      { key: 'phone', label: UI_TEXT.form.phone, value: client.phone, rawValue: client.phone, editable: true },
    ]
    // Always include email row (show edit icon even if empty)
    sections.personal_info.push({
      key: 'email',
      label: UI_TEXT.form.email,
      value: client.email || '—',
      rawValue: client.email || '',
      editable: true,
    })
    sections.personal_info.push({
      key: 'language',
      label: UI_TEXT.form.language,
      value: LANGUAGE_LABELS[client.language],
      rawValue: client.language,
    })
    if (profile?.filingStatus) {
      sections.personal_info.push({
        key: 'filingStatus',
        label: UI_TEXT.form.filingStatus,
        value: FILING_STATUS_LABELS[profile.filingStatus as keyof typeof FILING_STATUS_LABELS] || profile.filingStatus,
        rawValue: profile.filingStatus,
      })
    }

    // Add tax info section (from tax case)
    sections.tax_info = []
    if (latestCase) {
      sections.tax_info.push({
        key: 'taxYear',
        label: UI_TEXT.form.taxYear,
        value: String(latestCase.taxYear),
        rawValue: latestCase.taxYear,
      })
      sections.tax_info.push({
        key: 'taxTypes',
        label: UI_TEXT.form.taxTypes,
        value: latestCase.taxTypes?.join(', ') || '—',
        rawValue: latestCase.taxTypes,
      })
    }

    // Add legacy profile fields that might not be in intakeAnswers
    const legacyFields = [
      'hasW2', 'hasBankAccount', 'hasInvestments', 'hasKidsUnder17',
      'numKidsUnder17', 'paysDaycare', 'hasKids17to24', 'hasSelfEmployment',
      'hasRentalProperty', 'businessName', 'ein', 'hasEmployees',
      'hasContractors', 'has1099K',
    ]

    // Process intake answers
    for (const [key, value] of Object.entries(intakeAnswers)) {
      const config = FIELD_CONFIG[key]
      if (!config) continue

      // Skip complex types (arrays, objects) that aren't simple display values
      if (typeof value === 'object' && value !== null) continue

      const formattedValue = formatValue(key, value as boolean | number | string | undefined, config.format)
      if (!sections[config.section]) {
        sections[config.section] = []
      }
      sections[config.section].push({
        key,
        label: config.label,
        value: formattedValue,
        rawValue: value,
      })
    }

    // Add legacy profile fields if not already in intakeAnswers
    if (profile) {
      for (const field of legacyFields) {
        const value = profile[field as keyof typeof profile]
        const config = FIELD_CONFIG[field]
        if (!config || value === undefined || value === null) continue
        // Skip if already added from intakeAnswers
        if (intakeAnswers[field] !== undefined) continue

        const formattedValue = formatValue(field, value as boolean | number | string, config.format)
        if (!sections[config.section]) {
          sections[config.section] = []
        }
        sections[config.section].push({
          key: field,
          label: config.label,
          value: formattedValue,
          rawValue: value,
        })
      }
    }

    return sections
  }, [client, profile, intakeAnswers, latestCase])

  // Filter sections that have data
  const sectionsWithData = SECTION_ORDER.filter(
    (sectionKey) => sectionData[sectionKey] && sectionData[sectionKey].length > 0
  )

  return (
    <div className="columns-1 lg:columns-2 gap-4">
      {sectionsWithData.map((sectionKey) => {
        const items = sectionData[sectionKey]!
        const config = SECTION_CONFIG[sectionKey]
        const isExpanded = expandedSections.has(sectionKey)

        return (
          <div
            key={sectionKey}
            className="bg-card rounded-xl border border-border overflow-hidden break-inside-avoid mb-4"
          >
            {/* Section Header */}
            <div className="flex items-center justify-between p-4 bg-muted/30">
              <button
                type="button"
                onClick={() => toggleSection(sectionKey)}
                className="flex-1 flex items-center gap-2 hover:bg-muted/50 transition-colors -m-4 p-4"
                aria-expanded={isExpanded}
              >
                <h2 className="text-sm font-semibold text-primary">
                  {config?.title || sectionKey}
                </h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              </button>
              <div className="flex items-center gap-1">
                {/* Edit button - only for editable sections */}
                {!NON_EDITABLE_SECTIONS.includes(sectionKey) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingSectionKey(sectionKey)
                    }}
                    className="p-1.5 rounded hover:bg-muted transition-colors"
                    aria-label={`Chỉnh sửa ${config?.title}`}
                  >
                    <Pencil className="w-4 h-4 text-muted-foreground hover:text-primary" />
                  </button>
                )}
                {/* Chevron */}
                <button
                  type="button"
                  onClick={() => toggleSection(sectionKey)}
                  className="p-1.5 rounded hover:bg-muted transition-colors"
                  aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                >
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-muted-foreground transition-transform duration-200',
                      isExpanded && 'rotate-180'
                    )}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>

            {/* Section Content */}
            {isExpanded && (
              <div className="p-4 pt-0">
                <div className="divide-y divide-border">
                  {items.map((item) => (
                    <InfoRow
                      key={item.key}
                      label={item.label}
                      value={item.value}
                      onCopy={
                        typeof item.rawValue === 'string' && item.rawValue.length > 0
                          ? () => handleCopy(String(item.rawValue), item.key)
                          : undefined
                      }
                      copied={copiedField === item.key}
                      editable={item.editable}
                      onEdit={
                        item.editable && QUICK_EDIT_FIELDS.includes(item.key as QuickEditField)
                          ? () => setQuickEditField(item.key as QuickEditField)
                          : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Section Edit Modal */}
      {editingSectionKey && (
        <SectionEditModal
          isOpen={!!editingSectionKey}
          onClose={() => setEditingSectionKey(null)}
          sectionKey={editingSectionKey}
          client={client}
        />
      )}

      {/* Quick Edit Modal for personal info fields */}
      {quickEditField && (
        <QuickEditModal
          isOpen={!!quickEditField}
          onClose={() => setQuickEditField(null)}
          field={quickEditField}
          currentValue={
            quickEditField === 'name' ? client.name :
            quickEditField === 'phone' ? client.phone :
            quickEditField === 'email' ? (client.email || '') :
            ''
          }
          clientId={client.id}
        />
      )}
    </div>
  )
}

// Info row component with optional copy and edit buttons
interface InfoRowProps {
  label: string
  value: string
  onCopy?: () => void
  copied?: boolean
  editable?: boolean
  onEdit?: () => void
}

function InfoRow({ label, value, onCopy, copied, editable, onEdit }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between py-3 first:pt-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">{value}</span>
        {/* Edit button - subtle, appears on hover */}
        {editable && onEdit && (
          <button
            onClick={onEdit}
            className="p-1 rounded hover:bg-muted transition-colors opacity-50 hover:opacity-100"
            aria-label={`Chỉnh sửa ${label}`}
          >
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
        {onCopy && (
          <button
            onClick={onCopy}
            className="p-1 rounded hover:bg-muted transition-colors"
            aria-label={`Copy ${label}`}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-success" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
        )}
      </div>
    </div>
  )
}
