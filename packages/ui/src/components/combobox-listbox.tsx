import * as React from 'react'
import { cn } from '../lib/utils'
import type { ComboboxFloatingLayout } from './combobox-floating'
import type { ComboboxItem } from './combobox'

interface ComboboxListboxProps {
  id: string
  items: ComboboxItem[]
  loading: boolean
  emptyMessage: string
  activeIndex: number
  layout: ComboboxFloatingLayout | null
  optionId: (index: number) => string
  onActiveIndexChange: (index: number) => void
  onSelect: (item: ComboboxItem) => void
}

export function ComboboxListbox({
  id,
  items,
  loading,
  emptyMessage,
  activeIndex,
  layout,
  optionId,
  onActiveIndexChange,
  onSelect,
}: ComboboxListboxProps) {
  return (
    <ul
      id={id}
      role="listbox"
      data-placement={layout?.placement}
      style={layout?.style ?? { position: 'fixed', left: 0, top: 0, width: 0, visibility: 'hidden' }}
      className="z-50 overflow-auto overscroll-contain rounded-lg border border-border bg-card py-1 shadow-xl"
    >
      {loading && items.length === 0 && (
        <li role="presentation" className="px-3 py-2 text-xs text-muted-foreground">
          Searching…
        </li>
      )}
      {!loading && items.length === 0 && (
        <li role="presentation" className="px-3 py-2 text-xs text-muted-foreground">
          {emptyMessage}
        </li>
      )}
      {items.map((item, index) => {
        const previousGroup = index > 0 ? items[index - 1].group : undefined
        const header = item.group && item.group !== previousGroup ? item.group : null
        const active = index === activeIndex
        return (
          <React.Fragment key={item.id}>
            {header && (
              <li
                role="presentation"
                className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {header}
              </li>
            )}
            <li
              id={optionId(index)}
              role="option"
              aria-selected={active}
              onMouseDown={(event) => {
                event.preventDefault()
                onSelect(item)
              }}
              onMouseEnter={() => onActiveIndexChange(index)}
              className={cn(
                'flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm text-foreground',
                active && 'bg-primary-light/40',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{item.label}</span>
                {item.hint && <span className="block truncate text-xs text-muted-foreground">{item.hint}</span>}
              </span>
              {item.badge && (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {item.badge}
                </span>
              )}
            </li>
          </React.Fragment>
        )
      })}
    </ul>
  )
}
