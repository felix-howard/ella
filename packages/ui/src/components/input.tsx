import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'

const inputVariants = cva(
  'flex w-full bg-card text-foreground transition-all duration-200 placeholder:text-muted-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary',
        error:
          'border border-error rounded-lg focus:outline-none focus:ring-2 focus:ring-error focus:border-error',
        ghost: 'border-none bg-transparent focus:outline-none focus:ring-0',
      },
      inputSize: {
        sm: 'h-8 px-3 text-xs',
        default: 'h-10 px-3.5 py-2.5 text-sm',
        lg: 'h-12 px-4 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      inputSize: 'default',
    },
  }
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, inputSize, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, inputSize, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

// Input with label wrapper
export interface InputFieldProps extends InputProps {
  label?: string
  error?: string
  hint?: string
}

const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, error, hint, id, className, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id || generatedId
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-foreground">
            {label}
          </label>
        )}
        <Input ref={ref} id={inputId} variant={error ? 'error' : 'default'} {...props} />
        {error && <span className="text-xs text-error">{error}</span>}
        {hint && !error && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
    )
  }
)
InputField.displayName = 'InputField'

export { Input, inputVariants, InputField }
