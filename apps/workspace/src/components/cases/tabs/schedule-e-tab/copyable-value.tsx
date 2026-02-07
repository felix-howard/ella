/**
 * CopyableValue - Display a formatted value with a copy-to-clipboard icon
 * Copies raw number (no $ sign) for easy paste into tax software
 */
import { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@ella/ui'

interface CopyableValueProps {
  /** Formatted display string (e.g. "$1,570.00") */
  formatted: string
  /** Raw value to copy (number or string). Strips "$" and copies plain number */
  rawValue: string | number | null | undefined
  className?: string
}

export function CopyableValue({ formatted, rawValue, className }: CopyableValueProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    // Extract plain number string for tax software (e.g. "1570.00")
    const text = rawValue != null ? String(rawValue) : '0'
    const clean = text.replace(/[^0-9.-]/g, '')
    const num = parseFloat(clean)
    const copyText = isNaN(num) ? '0.00' : num.toFixed(2)

    try {
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = copyText
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }, [rawValue])

  return (
    <span className={cn('inline-flex items-center gap-1.5 group', className)}>
      <span className="tabular-nums">{formatted}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted-foreground/10"
        title="Copy giá trị"
        aria-label={`Copy ${formatted}`}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>
    </span>
  )
}

/**
 * CopyableText - Display text with a copy-to-clipboard icon
 * Copies exact text value (for address, etc.)
 */
interface CopyableTextProps {
  /** Text to display and copy */
  text: string
  /** Optional different value to copy (defaults to text) */
  copyValue?: string
  className?: string
  /** Show copy icon always instead of on hover */
  alwaysShowIcon?: boolean
}

export function CopyableText({ text, copyValue, className, alwaysShowIcon = false }: CopyableTextProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    const valueToCopy = copyValue ?? text

    try {
      await navigator.clipboard.writeText(valueToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = valueToCopy
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }, [text, copyValue])

  return (
    <span className={cn('inline-flex items-center gap-1.5 group', className)}>
      <span>{text}</span>
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          'transition-opacity p-0.5 rounded hover:bg-muted-foreground/10',
          alwaysShowIcon ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}
        title="Copy"
        aria-label={`Copy ${text}`}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>
    </span>
  )
}

/**
 * CopyableNumber - Display a number with copy functionality
 * Copies raw integer (for days, counts, etc.)
 */
interface CopyableNumberProps {
  /** Number to display and copy */
  value: number
  /** Display format (defaults to showing raw number) */
  formatted?: string
  className?: string
}

export function CopyableNumber({ value, formatted, className }: CopyableNumberProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    const copyText = String(value)

    try {
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = copyText
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }, [value])

  return (
    <span className={cn('inline-flex items-center gap-1.5 group', className)}>
      <span className="tabular-nums">{formatted ?? value}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted-foreground/10"
        title="Copy"
        aria-label={`Copy ${value}`}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>
    </span>
  )
}
