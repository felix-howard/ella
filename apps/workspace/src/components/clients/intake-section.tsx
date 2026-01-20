/**
 * IntakeSection - Collapsible section for intake form
 * Used to group related intake questions in the multi-section form
 */

import { useState } from 'react'
import { cn } from '@ella/ui'
import { ChevronDown } from 'lucide-react'

interface IntakeSectionProps {
  title: string
  description?: string
  children: React.ReactNode
  defaultOpen?: boolean
}

export function IntakeSection({
  title,
  description,
  children,
  defaultOpen = false,
}: IntakeSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border border-border rounded-lg">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-muted/50 hover:bg-muted transition-colors rounded-t-lg"
        aria-expanded={isOpen}
      >
        <div className="text-left">
          <h3 className="font-medium text-foreground">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <ChevronDown
          className={cn(
            'h-5 w-5 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>
      {isOpen && (
        <div className="p-4 space-y-3 border-t border-border">{children}</div>
      )}
    </div>
  )
}
