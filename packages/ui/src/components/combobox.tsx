import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../lib/utils'
import { getComboboxFloatingLayout, type ComboboxFloatingLayout } from './combobox-floating'
import { ComboboxListbox } from './combobox-listbox'

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
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [layout, setLayout] = React.useState<ComboboxFloatingLayout | null>(null)

  // Keep the highlighted option in range as the result set changes.
  React.useEffect(() => {
    setActiveIndex((i) => (items.length === 0 ? 0 : Math.min(i, items.length - 1)))
  }, [items])

  const showPanel = open && query.trim().length > 0
  const optionId = (index: number) => `${baseId}-opt-${index}`

  const setInputRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )

  const updateLayout = React.useCallback(() => {
    const node = inputRef.current
    if (!node) return
    setLayout(getComboboxFloatingLayout(node.getBoundingClientRect(), window.innerHeight))
  }, [])

  React.useLayoutEffect(() => {
    if (!showPanel) return
    updateLayout()
    window.addEventListener('resize', updateLayout)
    window.addEventListener('scroll', updateLayout, true)
    return () => {
      window.removeEventListener('resize', updateLayout)
      window.removeEventListener('scroll', updateLayout, true)
    }
  }, [showPanel, updateLayout])

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

  const listbox = showPanel ? (
    <ComboboxListbox
      id={listboxId}
      items={items}
      loading={loading}
      emptyMessage={emptyMessage}
      activeIndex={activeIndex}
      layout={layout}
      optionId={optionId}
      onActiveIndexChange={setActiveIndex}
      onSelect={select}
    />
  ) : null

  return (
    <div className={cn('relative', className)}>
      <input
        ref={setInputRef}
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

      {listbox && typeof document !== 'undefined' ? createPortal(listbox, document.body) : listbox}
    </div>
  )
})
Combobox.displayName = 'Combobox'

export { Combobox }
