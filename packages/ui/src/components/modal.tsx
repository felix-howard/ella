import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'
import { X } from 'lucide-react'

const modalOverlayVariants = cva(
  'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-200',
  {
    variants: {
      open: {
        true: 'opacity-100 pointer-events-auto',
        false: 'opacity-0 pointer-events-none',
      },
    },
    defaultVariants: {
      open: false,
    },
  }
)

const modalContentVariants = cva(
  'relative bg-card rounded-xl shadow-lg transition-all duration-200 max-h-[90vh] overflow-auto',
  {
    variants: {
      size: {
        sm: 'w-full max-w-sm p-4',
        default: 'w-full max-w-md p-6',
        lg: 'w-full max-w-lg p-6',
        xl: 'w-full max-w-xl p-6',
        full: 'w-full max-w-4xl p-6',
      },
      open: {
        true: 'scale-100 opacity-100',
        false: 'scale-95 opacity-0',
      },
    },
    defaultVariants: {
      size: 'default',
      open: false,
    },
  }
)

export interface ModalProps extends VariantProps<typeof modalContentVariants> {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  showCloseButton?: boolean
  /** ID of element that labels the modal (for accessibility) */
  'aria-labelledby'?: string
  /** ID of element that describes the modal (for accessibility) */
  'aria-describedby'?: string
}

const Modal = React.forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      open,
      onClose,
      children,
      className,
      size,
      closeOnOverlayClick = true,
      closeOnEscape = true,
      showCloseButton = true,
      'aria-labelledby': ariaLabelledby,
      'aria-describedby': ariaDescribedby,
    },
    ref
  ) => {
    // Handle escape key press
    React.useEffect(() => {
      if (!closeOnEscape || !open) return
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
      }
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }, [closeOnEscape, open, onClose])

    // Prevent body scroll when modal is open
    React.useEffect(() => {
      if (open) {
        document.body.style.overflow = 'hidden'
      } else {
        document.body.style.overflow = ''
      }
      return () => {
        document.body.style.overflow = ''
      }
    }, [open])

    const handleOverlayClick = (e: React.MouseEvent) => {
      if (closeOnOverlayClick && e.target === e.currentTarget) {
        onClose()
      }
    }

    return (
      <div
        className={cn(modalOverlayVariants({ open }))}
        onClick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledby}
        aria-describedby={ariaDescribedby}
      >
        <div ref={ref} className={cn(modalContentVariants({ size, open }), className)}>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-1 text-muted hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          )}
          {children}
        </div>
      </div>
    )
  }
)
Modal.displayName = 'Modal'

// Modal subcomponent types (using type alias instead of empty interface)
export type ModalHeaderProps = React.HTMLAttributes<HTMLDivElement>
export type ModalTitleProps = React.HTMLAttributes<HTMLHeadingElement>
export type ModalDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>
export type ModalBodyProps = React.HTMLAttributes<HTMLDivElement>
export type ModalFooterProps = React.HTMLAttributes<HTMLDivElement>

// Modal Header
const ModalHeader = React.forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mb-4 pr-8', className)} {...props} />
  )
)
ModalHeader.displayName = 'ModalHeader'

// Modal Title
const ModalTitle = React.forwardRef<HTMLHeadingElement, ModalTitleProps>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn('text-lg font-semibold text-primary leading-tight', className)}
      {...props}
    />
  )
)
ModalTitle.displayName = 'ModalTitle'

// Modal Description
const ModalDescription = React.forwardRef<HTMLParagraphElement, ModalDescriptionProps>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-secondary mt-1', className)} {...props} />
  )
)
ModalDescription.displayName = 'ModalDescription'

// Modal Body
const ModalBody = React.forwardRef<HTMLDivElement, ModalBodyProps>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('py-2', className)} {...props} />
)
ModalBody.displayName = 'ModalBody'

// Modal Footer
const ModalFooter = React.forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('mt-4 flex justify-end gap-3 pt-4 border-t border-border', className)}
      {...props}
    />
  )
)
ModalFooter.displayName = 'ModalFooter'

export {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  modalOverlayVariants,
  modalContentVariants,
}
