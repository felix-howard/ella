/**
 * Client type selector — first step of the creation wizard.
 * Three cards: Individual, Individual + Business, Business Only
 */
import { User, UserPlus, Building2 } from 'lucide-react'
import { cn } from '@ella/ui'

export type ClientCreationType = 'INDIVIDUAL' | 'INDIVIDUAL_WITH_BUSINESS' | 'BUSINESS'

interface ClientTypeSelectorProps {
  onSelect: (type: ClientCreationType) => void
}

const TYPE_CARDS: { type: ClientCreationType; icon: typeof User; title: string; description: string }[] = [
  {
    type: 'INDIVIDUAL',
    icon: User,
    title: 'Individual',
    description: 'A person (files 1040)',
  },
  {
    type: 'INDIVIDUAL_WITH_BUSINESS',
    icon: UserPlus,
    title: 'Individual + Business',
    description: 'A person who owns a business',
  },
  {
    type: 'BUSINESS',
    icon: Building2,
    title: 'Business Only',
    description: 'A business entity',
  },
]

export function ClientTypeSelector({ onSelect }: ClientTypeSelectorProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-primary">What type of client?</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {TYPE_CARDS.map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.type}
              type="button"
              onClick={() => onSelect(card.type)}
              className={cn(
                'flex flex-col items-center gap-3 p-6 rounded-xl border border-border bg-card',
                'hover:border-primary hover:bg-primary/5 transition-all cursor-pointer',
                'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary'
              )}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary">
                <Icon className="w-6 h-6" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">{card.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{card.description}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
