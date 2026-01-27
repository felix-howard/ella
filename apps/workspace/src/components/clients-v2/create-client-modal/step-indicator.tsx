/**
 * Step Indicator - Visual progress for 3-step wizard
 * Shows current step, completed steps, and labels
 */

import { cn } from '@ella/ui'
import { Check } from 'lucide-react'

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3
  steps: { label: string }[]
}

export function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, index) => {
        const stepNum = (index + 1) as 1 | 2 | 3
        const isActive = stepNum === currentStep
        const isComplete = stepNum < currentStep

        return (
          <div key={index} className="flex items-center">
            {/* Connector line between steps */}
            {index > 0 && (
              <div
                className={cn(
                  'w-8 h-0.5 mx-2',
                  isComplete ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
            {/* Step circle and label */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  isActive && 'bg-primary text-primary-foreground',
                  isComplete && 'bg-primary text-primary-foreground',
                  !isActive && !isComplete && 'bg-muted text-muted-foreground'
                )}
              >
                {isComplete ? <Check className="w-4 h-4" /> : stepNum}
              </div>
              <span
                className={cn(
                  'text-xs mt-1',
                  isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
