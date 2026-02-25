/**
 * GroupedFileRow - Visual grouping for multi-page documents
 * Shows connected rows with left border and page badges
 */

import { Fragment, type ReactNode } from 'react'
import type { RawImage } from '../../lib/api-client'
import type { DocumentGroup } from '../../lib/document-grouping'
import { getPageDisplay } from '../../lib/document-grouping'

interface GroupedFileRowProps {
  group: DocumentGroup
  renderFileRow: (
    image: RawImage,
    options: {
      isGrouped: boolean
      isFirst: boolean
      isLast: boolean
      pageDisplay: string | null
    }
  ) => ReactNode
}

export function GroupedFileRow({
  group,
  renderFileRow,
}: GroupedFileRowProps) {
  return (
    <div className="relative">
      {/* Left connector line */}
      <div
        className="absolute left-3 top-3 bottom-3 w-0.5 bg-primary/30"
        aria-hidden="true"
      />

      {/* Group header badge - shows base name + count for all groups */}
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-primary/10 border-b border-primary/20">
        <span className="ml-8 text-primary" aria-hidden="true">📑</span>
        <span className="text-primary">{group.baseName}</span>
        <span className="text-primary/70">
          ({group.pageCount} trang)
        </span>
      </div>

      {/* Grouped rows */}
      {group.images.map((image, idx) => {
        const isFirst = idx === 0
        const isLast = idx === group.images.length - 1
        const pageDisplay = getPageDisplay(image)

        return (
          <Fragment key={image.id}>
            {renderFileRow(image, {
              isGrouped: true,
              isFirst,
              isLast,
              pageDisplay,
            })}
          </Fragment>
        )
      })}
    </div>
  )
}

/**
 * Connector icon component for grouped rows
 */
export function GroupConnector({
  isFirst,
  isLast,
}: {
  isFirst: boolean
  isLast: boolean
}) {
  return (
    <div className="flex items-center justify-center w-4 h-4 text-primary/50 flex-shrink-0">
      {isFirst && !isLast && (
        <svg viewBox="0 0 16 16" className="w-full h-full">
          <path
            d="M8 2 L8 14 M8 2 Q8 8, 14 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )}
      {!isFirst && !isLast && (
        <svg viewBox="0 0 16 16" className="w-full h-full">
          <path
            d="M8 0 L8 16 M8 8 L14 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      )}
      {isLast && !isFirst && (
        <svg viewBox="0 0 16 16" className="w-full h-full">
          <path
            d="M8 0 L8 8 Q8 8, 14 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )}
      {isFirst && isLast && (
        <svg viewBox="0 0 16 16" className="w-full h-full">
          <circle cx="8" cy="8" r="3" fill="currentColor" />
        </svg>
      )}
    </div>
  )
}

/**
 * Page badge component
 */
export function PageBadge({ display }: { display: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary flex-shrink-0">
      {display}
    </span>
  )
}
