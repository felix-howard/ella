/**
 * MoveToEntitySubmenu - Hover-submenu list of peer entities for Move-to-Entity action
 * Used inside FileActionDropdown. Caller owns position + show state.
 */

import { forwardRef } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { cn } from '@ella/ui'
import type { EntityInfo } from '../../lib/api-client'
import { getEntityColor } from './entity-filter-bar'

export interface MoveToEntitySubmenuProps {
  peers: EntityInfo[]
  isPending: boolean
  position: { top: number; left: number }
  onSelect: (targetCaseId: string, entityName: string) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

export const MoveToEntitySubmenu = forwardRef<HTMLDivElement, MoveToEntitySubmenuProps>(
  function MoveToEntitySubmenu(
    { peers, isPending, position, onSelect, onMouseEnter, onMouseLeave },
    ref
  ) {
    return createPortal(
      <div
        ref={ref}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          zIndex: 10000,
        }}
        className="w-52 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
      >
        {peers.map((peer, index) => {
          const color = getEntityColor(index)
          return (
            <button
              key={peer.clientId}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(peer.caseId, peer.name)
              }}
              disabled={isPending}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors',
                isPending && 'opacity-50 cursor-not-allowed'
              )}
            >
              <span className={cn('w-2 h-2 rounded-full flex-shrink-0', color.bg)} />
              <span className="truncate flex-1">{peer.name}</span>
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            </button>
          )
        })}
      </div>,
      document.body
    )
  }
)
