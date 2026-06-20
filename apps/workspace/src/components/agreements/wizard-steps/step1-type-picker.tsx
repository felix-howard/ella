/**
 * Wizard Step 1 — Agreement type picker.
 * 5 cards (NDA, Engagement Letter, Service Agreement, Consent, Custom). Click selects
 * the type and advances the wizard. Card order matches the Agreement enum
 * declaration order (NDA first as the legacy default).
 *
 * Per-type gates (Phase 07): only the NDA type carries the active-engagement
 * gate. If the entity has an outstanding NDA invite (SENT + isActive) or a
 * SIGNED NDA whose deposit is still in flight (PENDING/PAID), the NDA card is
 * disabled with a tooltip. Other types remain selectable in parallel — they
 * don't carry the engagement-deposit semantics that motivated the gate.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FileSignature, FileText, Briefcase, FileCheck, FilePlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Agreement, AgreementType } from '../../../lib/api-client'

interface Props {
  agreements: Agreement[]
  onSelect: (type: AgreementType) => void
}

interface TypeOption {
  type: AgreementType
  icon: LucideIcon
  /** Tailwind classes for the icon tile background + foreground colors. */
  tileClass: string
}

const OPTIONS: TypeOption[] = [
  {
    type: 'NDA',
    icon: FileSignature,
    tileClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  {
    type: 'ENGAGEMENT_LETTER',
    icon: FileText,
    tileClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  },
  {
    type: 'SERVICE_AGREEMENT',
    icon: Briefcase,
    tileClass: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  },
  {
    type: 'CONSENT_7216',
    icon: FileCheck,
    tileClass: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  },
  {
    type: 'CUSTOM',
    icon: FilePlus,
    tileClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
]

type NdaBlockedReason = 'pendingSent' | 'activeEngagement' | null

function computeNdaBlockedReason(agreements: Agreement[]): NdaBlockedReason {
  for (const a of agreements) {
    if (a.type !== 'NDA') continue
    if (a.status === 'SENT' && a.isActive) return 'pendingSent'
    if (a.status === 'SIGNED' && (a.depositStatus === 'PENDING' || a.depositStatus === 'PAID')) {
      return 'activeEngagement'
    }
  }
  return null
}

export function Step1TypePicker({ agreements, onSelect }: Props) {
  const { t } = useTranslation()
  const ndaBlocked = useMemo(() => computeNdaBlockedReason(agreements), [agreements])

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('agreements.wizard.step1Description')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OPTIONS.map(({ type, icon: Icon, tileClass }) => {
          const disabled = type === 'NDA' && ndaBlocked !== null
          const tooltip = disabled && ndaBlocked ? t(`nda.send.disabled.${ndaBlocked}`) : undefined
          return (
            <button
              key={type}
              type="button"
              onClick={() => !disabled && onSelect(type)}
              disabled={disabled}
              title={tooltip}
              aria-disabled={disabled}
              className="text-left p-4 rounded-xl border border-border bg-card hover:border-primary hover:shadow-md transition-all flex items-start gap-3 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:shadow-none"
            >
              <span
                className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${tileClass}`}
              >
                <Icon className="w-5 h-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">
                  {t(`agreements.type.${type}`)}
                </span>
                <span className="block text-xs text-muted-foreground mt-1">
                  {disabled && ndaBlocked
                    ? t(`nda.send.disabled.${ndaBlocked}`)
                    : t(`agreements.wizard.typeDescription.${type}`)}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
