/**
 * Left-column context panel for the portal quote pay page. Fills the desktop
 * layout beside the quote card with the org's name, a short lead, and a few
 * single-line trust signals (Stripe, encryption, receipt). Kept text-light so
 * it reassures without crowding the page. On mobile it stacks below the card.
 */
import { useTranslation } from 'react-i18next'
import { Lock, ReceiptText, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface QuoteIntroPanelProps {
  orgName: string
  recipientFirstName: string | null
}

export function QuoteIntroPanel({ orgName, recipientFirstName }: QuoteIntroPanelProps) {
  const { t } = useTranslation()

  const lead = recipientFirstName
    ? t('quote.intro.leadNamed', { firstName: recipientFirstName, orgName })
    : t('quote.intro.lead', { orgName })

  return (
    <div className="lg:py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{orgName}</p>
      <h1 className="mt-3 text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
        {t('quote.intro.heading')}
      </h1>
      <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
        {lead}
      </p>

      <ul className="mt-9 space-y-5">
        <TrustItem icon={ShieldCheck} label={t('quote.trust.secureTitle')} />
        <TrustItem icon={Lock} label={t('quote.trust.encryptedTitle')} />
        <TrustItem icon={ReceiptText} label={t('quote.trust.receiptTitle')} />
      </ul>
    </div>
  )
}

function TrustItem({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <li className="flex items-center gap-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="text-base font-medium text-foreground">{label}</span>
    </li>
  )
}
