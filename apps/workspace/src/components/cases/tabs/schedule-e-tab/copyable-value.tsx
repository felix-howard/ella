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
