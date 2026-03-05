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
    <div className="px-6 py-3.5 bg-background/80 backdrop-blur-md border-b border-border/30">
      <div className="flex items-center gap-3">
        {/* Step dots */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalSteps }).map((_, index) => (
            <div
              key={index}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                index === currentStep
                  ? 'w-8 bg-primary'
                  : index < currentStep
                    ? 'w-1.5 bg-primary/50'
                    : 'w-1.5 bg-muted-foreground/20'
              )}
            />
          ))}
        </div>

        {/* Progress bar - alternative view on larger screens */}
        <div className="hidden sm:flex flex-1 items-center gap-2.5">
          <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground/70 font-medium whitespace-nowrap">
            {currentStep + 1} / {totalSteps}
          </span>
        </div>
      </div>
    </div>
  )
})

RentalProgressIndicator.displayName = 'RentalProgressIndicator'
