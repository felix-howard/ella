import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { ChevronDown } from 'lucide-react'
import { cn } from '../lib/utils'

const selectVariants = cva(
  'flex w-full appearance-none bg-card text-foreground transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary',
        error:
          'border border-error rounded-lg focus:outline-none focus:ring-2 focus:ring-error focus:border-error',
      },
      selectSize: {
        sm: 'h-8 px-3 pr-8 text-xs',
        default: 'h-10 px-3.5 pr-10 text-sm',
        lg: 'h-12 px-4 pr-12 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      selectSize: 'default',
    },
  }
)

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'>,
    VariantProps<typeof selectVariants> {
  options?: Array<{ value: string; label: string; disabled?: boolean }>
  placeholder?: string
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, variant, selectSize, options, placeholder, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          className={cn(selectVariants({ variant, selectSize, className }))}
          ref={ref}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options
            ? options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    )
  }
)
Select.displayName = 'Select'

// Select with label wrapper
export interface SelectFieldProps extends SelectProps {
  label?: string
  error?: string
  hint?: string
}

const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, error, hint, id, className, ...props }, ref) => {
    const generatedId = React.useId()
    const selectId = id || generatedId
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        {label && (
          <label htmlFor={selectId} className="text-xs font-medium text-foreground">
            {label}
          </label>
        )}
        <Select ref={ref} id={selectId} variant={error ? 'error' : 'default'} {...props} />
        {error && <span className="text-xs text-error">{error}</span>}
        {hint && !error && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
    )
  }
)
SelectField.displayName = 'SelectField'

export { Select, selectVariants, SelectField }
