/**
 * WizardStepIndicator - Visual progress indicator for wizard steps
 * Horizontal on desktop, vertical/compact on mobile
 */

import { Check } from 'lucide-react'
import { cn } from '@ella/ui'

interface Step {
  id: number
  label: string
  shortLabel: string
}

interface WizardStepIndicatorProps {
  steps: readonly Step[]
  currentStep: number
  visitedSteps: Set<number>
  onStepClick: (step: number) => void
}

export function WizardStepIndicator({
  steps,
  currentStep,
  visitedSteps,
  onStepClick,
}: WizardStepIndicatorProps) {
  // Handle keyboard navigation between steps
  const handleKeyDown = (e: React.KeyboardEvent, stepId: number) => {
    const isClickable = (id: number) => visitedSteps.has(id) || id === currentStep + 1

    if (e.key === 'ArrowRight' && stepId < steps.length - 1) {
      e.preventDefault()
      const nextStep = stepId + 1
      if (isClickable(nextStep)) onStepClick(nextStep)
    } else if (e.key === 'ArrowLeft' && stepId > 0) {
      e.preventDefault()
      const prevStep = stepId - 1
      if (isClickable(prevStep)) onStepClick(prevStep)
    }
  }

  return (
    <div className="w-full">
      {/* Desktop: Horizontal layout */}
      <div className="hidden sm:flex items-center justify-center">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep
          const isCompleted = visitedSteps.has(step.id) && step.id < currentStep
          const isClickable = visitedSteps.has(step.id) || step.id === currentStep + 1

          return (
            <div key={step.id} className="flex items-center">
              {/* Step Circle */}
              <button
                type="button"
                onClick={() => isClickable && onStepClick(step.id)}
                onKeyDown={(e) => handleKeyDown(e, step.id)}
                disabled={!isClickable}
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-full transition-all',
                  'font-medium text-sm',
                  isCompleted
                    ? 'bg-primary text-white'
                    : isActive
                      ? 'bg-primary text-white ring-4 ring-primary/20'
                      : visitedSteps.has(step.id)
                        ? 'bg-primary-light text-primary'
                        : 'bg-muted text-muted-foreground',
                  isClickable && !isActive
                    ? 'cursor-pointer hover:ring-2 hover:ring-primary/30'
                    : 'cursor-default'
                )}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`${step.label}${isCompleted ? ' - Hoàn thành' : ''}. Dùng phím mũi tên để di chuyển.`}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <span>{step.id + 1}</span>
                )}
              </button>

              {/* Step Label */}
              <span
                className={cn(
                  'ml-2 text-sm font-medium',
                  isActive || isCompleted ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'w-12 lg:w-20 h-0.5 mx-4',
                    index < currentStep ? 'bg-primary' : 'bg-border'
                  )}
                  aria-hidden="true"
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile: Compact horizontal with short labels */}
      <div className="flex sm:hidden items-center justify-between px-2 relative">
        {/* Mobile connector lines - render first as background */}
        <div className="absolute top-4 left-0 right-0 flex px-6" aria-hidden="true">
          {steps.slice(0, -1).map((_, index) => (
            <div
              key={`connector-${index}`}
              className={cn(
                'flex-1 h-0.5 mx-2',
                index < currentStep ? 'bg-primary' : 'bg-border'
              )}
            />
          ))}
        </div>

        {steps.map((step) => {
          const isActive = step.id === currentStep
          const isCompleted = visitedSteps.has(step.id) && step.id < currentStep
          const isClickable = visitedSteps.has(step.id) || step.id === currentStep + 1

          return (
            <div key={step.id} className="flex flex-col items-center flex-1 z-10">
              {/* Step Circle */}
              <button
                type="button"
                onClick={() => isClickable && onStepClick(step.id)}
                onKeyDown={(e) => handleKeyDown(e, step.id)}
                disabled={!isClickable}
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full transition-all',
                  'font-medium text-xs bg-card',
                  isCompleted
                    ? 'bg-primary text-white'
                    : isActive
                      ? 'bg-primary text-white ring-2 ring-primary/20'
                      : visitedSteps.has(step.id)
                        ? 'bg-primary-light text-primary'
                        : 'bg-muted text-muted-foreground',
                  isClickable && !isActive
                    ? 'cursor-pointer active:scale-95'
                    : 'cursor-default'
                )}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`${step.label}${isCompleted ? ' - Hoàn thành' : ''}`}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <span>{step.id + 1}</span>
                )}
              </button>

              {/* Short Label */}
              <span
                className={cn(
                  'mt-1 text-xs font-medium text-center',
                  isActive ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {step.shortLabel}
              </span>
            </div>
          )
        })}
      </div>

      {/* Progress bar for mobile */}
      <div className="sm:hidden mt-4">
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Bước {currentStep + 1} / {steps.length}
        </p>
      </div>
    </div>
  )
}
