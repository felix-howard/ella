import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'

const tooltipVariants = cva(
  'absolute z-50 px-3 py-1.5 text-sm rounded-lg shadow-lg pointer-events-none transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'bg-foreground text-background',
        light: 'bg-card text-foreground border border-border',
      },
      position: {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2',
      },
    },
    defaultVariants: {
      variant: 'default',
      position: 'top',
    },
  }
)

const arrowVariants = cva('absolute w-2 h-2 rotate-45', {
  variants: {
    variant: {
      default: 'bg-foreground',
      light: 'bg-card border-border',
    },
    position: {
      top: 'top-full left-1/2 -translate-x-1/2 -mt-1',
      bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-1',
      left: 'left-full top-1/2 -translate-y-1/2 -ml-1',
      right: 'right-full top-1/2 -translate-y-1/2 -mr-1',
    },
  },
  defaultVariants: {
    variant: 'default',
    position: 'top',
  },
})

// Define the expected props for child elements
interface ChildProps {
  onMouseEnter?: (e: React.MouseEvent) => void
  onMouseLeave?: (e: React.MouseEvent) => void
  onFocus?: (e: React.FocusEvent) => void
  onBlur?: (e: React.FocusEvent) => void
}

export interface TooltipProps extends VariantProps<typeof tooltipVariants> {
  content: React.ReactNode
  children: React.ReactElement<ChildProps>
  className?: string
  delay?: number
  showArrow?: boolean
  disabled?: boolean
}

const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(
  (
    {
      content,
      children,
      className,
      variant,
      position = 'top',
      delay = 200,
      showArrow = true,
      disabled = false,
    },
    ref
  ) => {
    const [isVisible, setIsVisible] = React.useState(false)
    const [shouldRender, setShouldRender] = React.useState(false)
    const showTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const hideTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    const showTooltip = () => {
      if (disabled) return
      // Clear any pending hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }
      showTimeoutRef.current = setTimeout(() => {
        setShouldRender(true)
        // Force reflow for transition
        requestAnimationFrame(() => {
          setIsVisible(true)
        })
      }, delay)
    }

    const hideTooltip = () => {
      // Clear any pending show timeout
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current)
        showTimeoutRef.current = null
      }
      setIsVisible(false)
      // Wait for transition to complete before unmounting
      hideTimeoutRef.current = setTimeout(() => {
        setShouldRender(false)
      }, 200)
    }

    // Cleanup all timeouts on unmount
    React.useEffect(() => {
      return () => {
        if (showTimeoutRef.current) {
          clearTimeout(showTimeoutRef.current)
        }
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current)
        }
      }
    }, [])

    // Get the original props from the child
    const childProps = children.props

    return (
      <div ref={ref} className="relative inline-flex">
        {React.cloneElement(children, {
          onMouseEnter: (e: React.MouseEvent) => {
            showTooltip()
            childProps.onMouseEnter?.(e)
          },
          onMouseLeave: (e: React.MouseEvent) => {
            hideTooltip()
            childProps.onMouseLeave?.(e)
          },
          onFocus: (e: React.FocusEvent) => {
            showTooltip()
            childProps.onFocus?.(e)
          },
          onBlur: (e: React.FocusEvent) => {
            hideTooltip()
            childProps.onBlur?.(e)
          },
        })}
        {shouldRender && (
          <div
            role="tooltip"
            className={cn(
              tooltipVariants({ variant, position }),
              isVisible ? 'opacity-100' : 'opacity-0',
              className
            )}
          >
            {content}
            {showArrow && (
              <span className={cn(arrowVariants({ variant, position }))} aria-hidden="true" />
            )}
          </div>
        )}
      </div>
    )
  }
)
Tooltip.displayName = 'Tooltip'

// Simple Tooltip for basic use cases
export interface SimpleTooltipProps {
  text: string
  children: React.ReactElement<ChildProps>
  position?: 'top' | 'bottom' | 'left' | 'right'
}

const SimpleTooltip: React.FC<SimpleTooltipProps> = ({ text, children, position = 'top' }) => {
  return (
    <Tooltip content={text} position={position}>
      {children}
    </Tooltip>
  )
}

export { Tooltip, SimpleTooltip, tooltipVariants, arrowVariants }
