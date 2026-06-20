import type * as React from 'react'

export type ComboboxPlacement = 'top' | 'bottom'

export interface ComboboxFloatingLayout {
  placement: ComboboxPlacement
  style: React.CSSProperties
}

const VIEWPORT_PADDING = 16
const PANEL_GAP = 4
const PANEL_MAX_HEIGHT = 320
const PANEL_MIN_HEIGHT = 96

export function getComboboxFloatingLayout(rect: DOMRect, viewportHeight: number): ComboboxFloatingLayout {
  const spaceBelow = viewportHeight - rect.bottom - VIEWPORT_PADDING
  const spaceAbove = rect.top - VIEWPORT_PADDING
  const placement: ComboboxPlacement =
    spaceBelow < PANEL_MAX_HEIGHT && spaceAbove > spaceBelow ? 'top' : 'bottom'
  const availableHeight = Math.max(
    PANEL_MIN_HEIGHT,
    (placement === 'top' ? spaceAbove : spaceBelow) - PANEL_GAP,
  )
  const maxHeight = Math.min(PANEL_MAX_HEIGHT, availableHeight)
  const verticalStyle =
    placement === 'top'
      ? { bottom: viewportHeight - rect.top + PANEL_GAP }
      : { top: rect.bottom + PANEL_GAP }

  return {
    placement,
    style: {
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      maxHeight,
      ...verticalStyle,
    },
  }
}
