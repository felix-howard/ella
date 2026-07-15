import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'
import { X } from 'lucide-react'

const modalOverlayVariants = cva(
  'fixed inset-0 z-50 flex items-center justify-center bg-black/40 transition-opacity duration-200',
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
  overlayClassName?: string
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  showCloseButton?: boolean
  closeButtonAriaLabel?: string
  /** ID of element that labels the modal (for accessibility) */
  'aria-labelledby'?: string
  /** ID of element that describes the modal (for accessibility) */
  'aria-describedby'?: string
}

interface BodyScrollLockState {
  count: number
  previousOverflow: string
}

const bodyScrollLocks = new WeakMap<Document, BodyScrollLockState>()

function lockBodyScroll(ownerDocument: Document): () => void {
  const activeLock = bodyScrollLocks.get(ownerDocument)
  if (activeLock) {
    activeLock.count += 1
  } else {
    bodyScrollLocks.set(ownerDocument, {
      count: 1,
      previousOverflow: ownerDocument.body.style.overflow,
    })
    ownerDocument.body.style.overflow = 'hidden'
  }

  let released = false
  return () => {
    if (released) return
    released = true

    const lock = bodyScrollLocks.get(ownerDocument)
    if (!lock) return
    lock.count -= 1
    if (lock.count > 0) return

    ownerDocument.body.style.overflow = lock.previousOverflow
    bodyScrollLocks.delete(ownerDocument)
  }
}

const Modal = React.forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      open,
      onClose,
      children,
      className,
      overlayClassName,
      size,
      closeOnOverlayClick = true,
      closeOnEscape = true,
      showCloseButton = true,
      closeButtonAriaLabel = 'Close modal',
      'aria-labelledby': ariaLabelledby,
      'aria-describedby': ariaDescribedby,
    },
    ref
  ) => {
    const contentRef = React.useRef<HTMLDivElement | null>(null)

    const setContentRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        contentRef.current = node
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      },
      [ref]
    )

    const getFocusableElements = React.useCallback(() => {
      const content = contentRef.current
      if (!content) return []
      return Array.from(
        content.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null)
    }, [])

    // Handle escape key and keep keyboard focus inside the dialog.
    React.useEffect(() => {
      if (!open) return
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && closeOnEscape) {
          onClose()
          return
        }

        if (e.key !== 'Tab') return

        const focusable = getFocusableElements()
        if (focusable.length === 0) {
          e.preventDefault()
          contentRef.current?.focus()
          return
        }

        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = document.activeElement

        if (e.shiftKey && active === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }, [closeOnEscape, getFocusableElements, open, onClose])

    React.useEffect(() => {
      if (!open) return
      const previousActiveElement = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
      window.setTimeout(() => {
        const firstFocusable = getFocusableElements()[0]
        ;(firstFocusable ?? contentRef.current)?.focus()
      }, 0)
      return () => previousActiveElement?.focus()
    }, [getFocusableElements, open])

    // A reference count keeps nested modals locked even when React cleans them
    // up out of mount order (for example when a parent and child close together).
    React.useEffect(() => {
      if (!open) return undefined
      return lockBodyScroll(document)
    }, [open])

    const handleOverlayClick = (e: React.MouseEvent) => {
      if (closeOnOverlayClick && e.target === e.currentTarget) {
        onClose()
      }
    }

    if (!open) return null

    return (
      <div
        className={cn(modalOverlayVariants({ open }), overlayClassName)}
        onClick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledby}
        aria-describedby={ariaDescribedby}
      >
        <div
          ref={setContentRef}
          className={cn(modalContentVariants({ size, open }), className)}
          tabIndex={-1}
        >
          {showCloseButton && (
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-1 text-muted hover:bg-muted hover:text-foreground transition-colors"
              aria-label={closeButtonAriaLabel}
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
