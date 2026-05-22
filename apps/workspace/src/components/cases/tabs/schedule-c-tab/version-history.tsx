/**
 * Version History - Timeline of Schedule C submissions and changes
 */
import { useState, useMemo, useCallback } from 'react'
import { History, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { VersionHistoryEntry } from '../../../../lib/api-client'
import { formatDateTime } from './format-utils'

interface VersionHistoryProps {
  history: VersionHistoryEntry[]
}

const VI_EXACT_CHANGE_KEYS: [string, string][] = [
  ['schedule.change.legacy.initialSubmission', 'schedule.change.initialSubmission'],
  ['schedule.change.legacy.noChanges', 'schedule.change.noChanges'],
]

const VI_PREFIX_KEYS: [string, string][] = [
  ['schedule.change.legacyPrefix.added', 'schedule.change.added'],
  ['schedule.change.legacyPrefix.removed', 'schedule.change.removed'],
  ['schedule.change.legacyPrefix.updated', 'schedule.change.updated'],
  ['schedule.change.legacyPrefix.addedProperty', 'schedule.change.addedProperty'],
  ['schedule.change.legacyPrefix.removedProperty', 'schedule.change.removedProperty'],
]

const EN_PREFIXES: [RegExp, string][] = [
  [/^Added property (.+)$/, 'schedule.change.addedProperty'],
  [/^Removed property (.+)$/, 'schedule.change.removedProperty'],
  [/^Added (.+)$/, 'schedule.change.added'],
  [/^Removed (.+)$/, 'schedule.change.removed'],
  [/^Updated (.+)$/, 'schedule.change.updated'],
]

const EN_CHANGE_MAP: Record<string, string> = {
  'Initial submission': 'schedule.change.initialSubmission',
  'No changes': 'schedule.change.noChanges',
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function VersionHistory({ history }: VersionHistoryProps) {
  const { t, i18n } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)

  // Translate a single change description
  const translateChange = useCallback((change: string): string => {
    // Check exact matches first (both Vietnamese and English)
    const viExactKey = VI_EXACT_CHANGE_KEYS.find(([sourceKey]) => change === t(sourceKey, { lng: 'vi' }))?.[1]
    const exactKey = viExactKey || EN_CHANGE_MAP[change]
    if (exactKey) return t(exactKey)

    // Check bracket prefix pattern: [propId] Updated Field
    const bracketMatch = change.match(/^\[(.+?)\]\s*(.+)$/)
    if (bracketMatch) {
      const [, propId, rest] = bracketMatch
      const viPrefixes = VI_PREFIX_KEYS.map(([sourceKey, targetKey]) => [
        new RegExp(`^${escapeRegex(t(sourceKey, { lng: 'vi' }))} (.+)$`),
        targetKey,
      ] as [RegExp, string])
      const allPrefixes = [...viPrefixes, ...EN_PREFIXES]
      for (const [regex, key] of allPrefixes) {
        const match = rest.match(regex)
        if (match) return `[${propId}] ${t(key, { field: match[1] })}`
      }
      return change
    }

    // Check pattern-based matches
    const viPrefixes = VI_PREFIX_KEYS.map(([sourceKey, targetKey]) => [
      new RegExp(`^${escapeRegex(t(sourceKey, { lng: 'vi' }))} (.+)$`),
      targetKey,
    ] as [RegExp, string])
    const allPrefixes = [...viPrefixes, ...EN_PREFIXES]
    for (const [regex, key] of allPrefixes) {
      const match = change.match(regex)
      if (match) return t(key, { field: match[1] })
    }

    return change
  }, [t])

  // Memoize sorted history to avoid sorting on every render
  const sortedHistory = useMemo(() =>
    [...history].sort((a, b) => b.version - a.version),
    [history]
  )

  // Show only first 3 unless expanded
  const displayedHistory = isExpanded ? sortedHistory : sortedHistory.slice(0, 3)
  const hasMore = sortedHistory.length > 3

  if (sortedHistory.length === 0) {
    return null
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-foreground uppercase tracking-wide mb-3 pb-2 border-b border-border flex items-center gap-2">
        <History className="w-4 h-4" />
        {t('schedule.versionHistory')}
      </h3>

      <div className="space-y-3">
        {displayedHistory.map((entry) => (
          <div
            key={entry.version}
            className="flex items-start gap-2 sm:gap-3 text-sm"
          >
            {/* Version badge */}
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-medium flex-shrink-0 mt-0.5">
              v{entry.version}
            </span>

            <div className="flex-1 min-w-0">
              {/* Timestamp */}
              <p className="text-xs text-muted-foreground truncate">
                {formatDateTime(entry.submittedAt, 'DATETIME_FULL', i18n.language === 'vi' ? 'vi-VN' : 'en-US')}
              </p>

              {/* Changes */}
              <p className="text-foreground break-words">
                {entry.changes.length > 0
                  ? entry.changes.map(translateChange).join(', ')
                  : t('schedule.change.initialSubmission')}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Show more/less toggle */}
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-3"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              {t('common.collapse')}
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              {t('common.showMore', { count: sortedHistory.length - 3 })}
            </>
          )}
        </button>
      )}
    </div>
  )
}
