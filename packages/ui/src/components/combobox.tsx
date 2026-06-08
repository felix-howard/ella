import * as React from 'react'
import { cn } from '../lib/utils'

/**
 * One selectable row in the {@link Combobox} dropdown.
 *
 * The component is search-agnostic: it never filters `items` itself, so callers
 * can drive results from a server query (debounced fetch) or local filtering.
 */
export interface ComboboxItem {
  /** Stable, unique value returned via `onSelect` (encode any extra data here). */
  id: string
  /** Primary label shown on the row. */
  label: string
  /** Group header this item sits under (e.g. "Clients"); consecutive items that
   *  share a group render under a single header. */
  group?: string
  /** Short tag rendered at the row's trailing edge (e.g. "Lead"). */
  badge?: string
  /** Secondary muted line under the label (e.g. business name · •••• 1234). */
  hint?: string
}

export interface ComboboxProps {
  items: ComboboxItem[]
  /** Controlled search text. */
  query: string
  onQueryChange: (query: string) => void
  onSelect: (item: ComboboxItem) => void
  placeholder?: string
  /** Show a "Searching…" row while results are in flight. */
  loading?: boolean
  emptyMessage?: string
  disabled?: boolean
  id?: string
  className?: string
  'aria-label'?: string
}

/**
 * Accessible single-select combobox following the ARIA 1.2 combobox pattern
 * (`role=combobox` input + `role=listbox` popup, `aria-activedescendant` for
 * keyboard focus). Selection fires on `mousedown` so a click lands before the
 * input's blur closes the panel. Dependency-free on purpose: results are
 * supplied by the caller, so no client-side fuzzy-filter library is needed.
 */
const Combobox = React.forwardRef<HTMLInputElement, ComboboxProps>(function Combobox(
  {
    items,
    query,
    onQueryChange,
    onSelect,
    placeholder,
    loading = false,
    emptyMessage = 'No results',
    disabled,
    id,
    className,
    'aria-label': ariaLabel,
  },
  ref,
) {
  const reactId = React.useId()
  const baseId = id ?? reactId
  const listboxId = `${baseId}-listbox`
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)

  // Keep the highlighted option in range as the result set changes.
  React.useEffect(() => {
    setActiveIndex((i) => (items.length === 0 ? 0 : Math.min(i, items.length - 1)))
  }, [items])

  const showPanel = open && query.trim().length > 0
  const optionId = (index: number) => `${baseId}-opt-${index}`

  const select = (item: ComboboxItem) => {
    onSelect(item)
    setOpen(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((i) => (items.length ? (i + 1) % items.length : 0))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((i) => (items.length ? (i - 1 + items.length) % items.length : 0))
    } else if (event.key === 'Enter') {
      if (showPanel && items[activeIndex]) {
        event.preventDefault()
        select(items[activeIndex])
      }
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className={cn('relative', className)}>
      <input
        ref={ref}
        id={baseId}
        type="text"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={showPanel && items[activeIndex] ? optionId(activeIndex) : undefined}
        aria-label={ariaLabel}
        autoComplete="off"
        disabled={disabled}
        value={query}
        placeholder={placeholder}
        onChange={(event) => {
          onQueryChange(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        className="flex h-10 w-full rounded-lg border border-input bg-card px-3.5 text-sm text-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
      />

      {showPanel && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-card py-1 shadow-lg"
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
                  // mousedown (not click) so selection runs before the input blur closes the panel
                  onMouseDown={(event) => {
                    event.preventDefault()
                    select(item)
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm text-foreground',
                    active && 'bg-primary-light/40',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{item.label}</span>
                    {item.hint && (
                      <span className="block truncate text-xs text-muted-foreground">{item.hint}</span>
                    )}
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
      )}
    </div>
  )
})
Combobox.displayName = 'Combobox'

export { Combobox }
