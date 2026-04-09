/**
 * Intake type selector - First step of the public intake form wizard.
 * 3 cards with client-friendly language (no CPA jargon).
 */
import { useTranslation } from 'react-i18next'
import { User, UserPlus, Building2 } from 'lucide-react'

export type IntakeClientType = 'INDIVIDUAL' | 'INDIVIDUAL_WITH_BUSINESS' | 'BUSINESS'

interface IntakeTypeSelectorProps {
  onSelect: (type: IntakeClientType) => void
}

export function IntakeTypeSelector({ onSelect }: IntakeTypeSelectorProps) {
  const { t } = useTranslation()

  const cards: { type: IntakeClientType; icon: typeof User; titleKey: string; descKey: string }[] = [
    { type: 'INDIVIDUAL', icon: User, titleKey: 'form.typePersonal', descKey: 'form.typePersonalDesc' },
    { type: 'INDIVIDUAL_WITH_BUSINESS', icon: UserPlus, titleKey: 'form.typePersonalBusiness', descKey: 'form.typePersonalBusinessDesc' },
    { type: 'BUSINESS', icon: Building2, titleKey: 'form.typeBusinessOnly', descKey: 'form.typeBusinessOnlyDesc' },
  ]

  return (
    <div className="px-6 py-6 space-y-4">
      <h2 className="text-lg font-semibold text-primary text-center">
        {t('form.typeQuestion')}
      </h2>
      <div className="grid grid-cols-1 gap-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.type}
              type="button"
              onClick={() => onSelect(card.type)}
              className="flex items-center gap-4 p-4 rounded-xl border border-border bg-background hover:border-primary hover:bg-primary/5 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary shrink-0">
                <Icon className="w-6 h-6" />
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">{t(card.titleKey)}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{t(card.descKey)}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
