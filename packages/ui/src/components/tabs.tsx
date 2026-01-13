import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'

// Tabs Context
interface TabsContextValue {
  activeTab: string
  setActiveTab: (value: string) => void
  variant: 'pill' | 'underline'
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined)

const useTabsContext = () => {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider')
  }
  return context
}

// Tabs Root
const tabsVariants = cva('', {
  variants: {
    variant: {
      pill: '',
      underline: '',
    },
  },
  defaultVariants: {
    variant: 'pill',
  },
})

export interface TabsProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof tabsVariants> {
  defaultValue: string
  value?: string
  onValueChange?: (value: string) => void
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, children, defaultValue, value, onValueChange, variant = 'pill', ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue)
    const activeTab = value ?? internalValue

    const setActiveTab = React.useCallback(
      (newValue: string) => {
        if (onValueChange) {
          onValueChange(newValue)
        } else {
          setInternalValue(newValue)
        }
      },
      [onValueChange]
    )

    return (
      <TabsContext.Provider value={{ activeTab, setActiveTab, variant: variant ?? 'pill' }}>
        <div ref={ref} className={cn(tabsVariants({ variant }), className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    )
  }
)
Tabs.displayName = 'Tabs'

// Tabs List (using type alias instead of empty interface)
const tabsListVariants = cva('inline-flex items-center gap-1', {
  variants: {
    variant: {
      pill: 'bg-muted rounded-full p-1',
      underline: 'border-b border-border',
    },
  },
  defaultVariants: {
    variant: 'pill',
  },
})

export type TabsListProps = React.HTMLAttributes<HTMLDivElement>

const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, children, ...props }, ref) => {
    const { variant } = useTabsContext()
    const listRef = React.useRef<HTMLDivElement | null>(null)

    // Keyboard navigation for tabs (WCAG 2.1 compliance)
    const handleKeyDown = (e: React.KeyboardEvent) => {
      const tabs = Array.from(
        listRef.current?.querySelectorAll('[role="tab"]') || []
      ) as HTMLElement[]
      const currentIndex = tabs.findIndex((tab) => tab === document.activeElement)

      let nextIndex = currentIndex

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault()
          nextIndex = (currentIndex + 1) % tabs.length
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault()
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
          break
        case 'Home':
          e.preventDefault()
          nextIndex = 0
          break
        case 'End':
          e.preventDefault()
          nextIndex = tabs.length - 1
          break
        default:
          return
      }

      tabs[nextIndex]?.focus()
      tabs[nextIndex]?.click()
    }

    return (
      <div
        ref={(node) => {
          listRef.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        role="tablist"
        onKeyDown={handleKeyDown}
        className={cn(tabsListVariants({ variant }), className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
TabsList.displayName = 'TabsList'

// Tabs Trigger
const tabsTriggerVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        pill: 'rounded-full',
        underline: 'border-b-2 border-transparent -mb-px',
      },
      active: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [
      {
        variant: 'pill',
        active: true,
        className: 'bg-primary text-primary-foreground shadow-sm',
      },
      {
        variant: 'pill',
        active: false,
        className: 'text-secondary hover:text-foreground hover:bg-muted/50',
      },
      {
        variant: 'underline',
        active: true,
        className: 'border-primary text-primary',
      },
      {
        variant: 'underline',
        active: false,
        className: 'text-secondary hover:text-foreground hover:border-muted',
      },
    ],
    defaultVariants: {
      variant: 'pill',
      active: false,
    },
  }
)

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, ...props }, ref) => {
    const { activeTab, setActiveTab, variant } = useTabsContext()
    const isActive = activeTab === value

    return (
      <button
        ref={ref}
        role="tab"
        type="button"
        tabIndex={isActive ? 0 : -1}
        aria-selected={isActive}
        onClick={() => setActiveTab(value)}
        className={cn(tabsTriggerVariants({ variant, active: isActive }), className)}
        {...props}
      />
    )
  }
)
TabsTrigger.displayName = 'TabsTrigger'

// Tabs Content
export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const { activeTab } = useTabsContext()
    const isActive = activeTab === value

    if (!isActive) return null

    return (
      <div
        ref={ref}
        role="tabpanel"
        tabIndex={0}
        className={cn('mt-4 focus-visible:outline-none', className)}
        {...props}
      />
    )
  }
)
TabsContent.displayName = 'TabsContent'

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsVariants, tabsListVariants, tabsTriggerVariants }
