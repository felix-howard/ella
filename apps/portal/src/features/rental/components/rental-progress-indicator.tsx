/**
 * RentalProgressIndicator Component
 * Visual step indicator for wizard progress
 */
import { memo } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@ella/ui'

interface RentalProgressIndicatorProps {
  currentStep: number
  totalSteps: number
}

export const RentalProgressIndicator = memo(function RentalProgressIndicator({
  currentStep,
  totalSteps,
}: RentalProgressIndicatorProps) {
  // Progress percentage
  const progress = ((currentStep) / (totalSteps - 1)) * 100

  return (
    <div className="px-6 py-3 bg-background/50 backdrop-blur-sm border-b border-border">
      <div className="flex items-center gap-3">
        {/* Step dots */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalSteps }).map((_, index) => (
            <div
              key={index}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                index === currentStep
                  ? 'w-6 bg-primary'
                  : index < currentStep
                    ? 'bg-primary/60'
                    : 'bg-muted-foreground/30'
              )}
            />
          ))}
        </div>

        {/* Progress bar - alternative view on larger screens */}
        <div className="hidden sm:flex flex-1 items-center gap-2">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {currentStep + 1} / {totalSteps}
          </span>
        </div>
      </div>
    </div>
  )
})

RentalProgressIndicator.displayName = 'RentalProgressIndicator'
